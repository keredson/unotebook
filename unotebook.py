# unotebook.py
import os, socket, json, sys, builtins, uio, re
try: import ubinascii as _b64
except ImportError: import binascii as _b64

__version__ = '0.1'

_notebook_globals_ = {}
locals_ = {}

INDEX_HTML = '''
<!doctype html>
<meta charset="utf-8">
<title>µNotebook</title>
<body style='background-color: #f4f0e8; font-family: system-ui, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif;' id="app">Loading...</body>
<style>
  body {
    
    font-size: 16px;
    line-height: 1.65;
    
  }
  .output {
    padding: 8px;
    display: block;
  }
</style>
<script type="module" src="/unotebook.js"></script>
'''

def stream_b64(buf, s):
  for i in range(0, len(buf), 57):
    b64_s = _b64.b2a_base64(buf[i:i+57])
    if isinstance(b64_s, bytes) and b64_s.endswith(b'\n'): b64_s = b64_s[:-1]
    if isinstance(b64_s, str) and b64_s.endswith('\n'): b64_s = b64_s[:-1]
    s.send(b64_s)

def send_repr(o, s):
  if o is None: return
  try:
    buf = memoryview(o)
    if buf[:2] == b'\xff\xd8':
      s.send('{"image/jpeg":"')
      stream_b64(buf, s)
      s.send('"}')
      return
    elif buf[:8] == b'\x89PNG\r\n\x1a\n':
      s.send('{"image/png":"')
      stream_b64(buf, s)
      s.send('"}')
      return
  except TypeError:
    pass # not a buffer
  ret = {}
  if hasattr(o, '_repr_mimebundle_'):
    ret = o._repr_mimebundle_()
  elif hasattr(o, '_repr_html_'):
    ret['text/html'] = o._repr_html_()
  elif hasattr(o, '_repr_markdown_'):
    ret['text/htmarkdownml'] = o._repr_markdown_()
  elif hasattr(o, '_repr_svg_'):
    ret['image/svg+xml'] = o._repr_svg_()
  elif hasattr(o, '_repr_png_'):
    ret['image/png'] = o._repr_png_()
  elif hasattr(o, '_repr_jpeg_'):
    ret['image/jpeg'] = o._repr_jpeg_()
  elif hasattr(o, '_repr_latex_'):
    ret['text/latex'] = o._repr_latex_()
  elif hasattr(o, '_repr_javascript_'):
    ret['application/javascript'] = o._repr_javascript_()
  else:
    ret = repr(o)
  json.dump(ret, s)


def run_cell(s, fn, cmd):
  global _notebook_globals_
  globals_ = _notebook_globals_.get(fn)
  if globals_ is None:
    globals_ = {}
    _notebook_globals_[fn] = globals_
  print('run_cell', fn, repr(cmd))
  lines = cmd.rstrip().splitlines()
  if not lines: return
  real_print = builtins.print
  def capture_print(*args, **kwargs):
    buf = uio.StringIO()
    real_print(*args, **kwargs, file=buf)
    s.send(json.dumps(buf.getvalue()))
    s.send('\n')
  builtins.print = capture_print
  try:
    *body, last = lines
    if last.startswith(' ') or last.startswith('\t'):
      body.append(last)
      last = None
    if body:
      exec('\n'.join(body), globals_, globals_)
    if last:
      try:
        result = eval(last, globals_, globals_)
        send_repr(result, s)
      except SyntaxError:
        exec(last, globals_, globals_)
  finally:
    builtins.print = real_print


class StdoutStreamer:
  def __init__(self, cl):
    self.cl = cl
    self.buf = bytearray()
  def write(self, s):
    if not isinstance(s, (bytes, bytearray)):
      s = s.encode()
      self.cl.send(json.dumps(s))
  def flush(self):
      pass


def handle_request(s):
      action, path, mode = s.readline().decode().strip().split()
      headers = {}
      while header := s.readline().decode():
        if header == "\r\n":
          break
        k, v = header.split(': ',1)
        headers[k] = v.strip()
      print(action, path, headers)
      if action=='GET' and (path=="/" or path.startswith('/notebook/')):
        s.send("HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n")
        s.send('<script>window.__unotebook_version__ = %s</script>' % repr(__version__))
        s.send(INDEX_HTML)
      elif action=='GET' and path=="/unotebook.js":
        s.send("HTTP/1.1 200 OK\r\nContent-Type: text/javascript\r\n\r\n")
        with open('unotebook.js', 'rb') as f:
          while line := f.readline():
            s.send(line)
      elif action=='POST' and path=="/_delete":
        fn = json.loads(s.read(int(headers['Content-Length'])))
        assert fn.endswith('.unb')
        os.remove(fn)
        s.send("HTTP/1.1 200 OK\r\n")
      elif action=='POST' and path=="/_stop":
        fn = json.loads(s.read(int(headers['Content-Length'])))
        assert fn.endswith('.unb')
        try: del _notebook_globals_[fn]
        except KeyError: pass
        s.send("HTTP/1.1 200 OK\r\n")
      elif action=='POST' and path=="/run_cell":
        body = json.loads(s.read(int(headers['Content-Length'])))
        cmds = body.get('source', [])
        s.send("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n")
        run_cell(s, body['fn'], '\n'.join(cmds))
      elif action=='POST' and path.startswith("/_save/"):
        fn = _sanitize_and_decode(path[len("/_save/"):])
        assert fn.endswith('.unb')
        nbytes = int(headers['Content-Length'])
        with open(fn, 'wb') as f:
          for i in range(0, nbytes, 1024):
            f.write(s.read(min(1024, nbytes-i)))
        s.send("HTTP/1.1 200 OK\r\n")
      elif action=='GET' and path=="/_files":
        files = sorted(
          [{'fn':f, 'running':f in _notebook_globals_, 'size':os.stat(f)[6]} for f in os.listdir() if f.endswith(".unb")],
          key=lambda x: x['fn']
        )
        body = json.dumps(files)
        s.send("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n")
        s.send(body)
      elif action=='GET' and path.startswith('/_notebook/') and path.endswith('.unb'):
        s.send("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n")
        fn = _sanitize_and_decode(path.split('/')[-1])
        if fn == '__new__.unb':
          s.send(json.dumps({'cells':[{'cell_type':'code','source':[]}]}))
        else:
          with open(fn, 'rb') as f:
            while line := f.readline():
              s.send(line)
      else:
        s.send("HTTP/1.1 404 Not Found\r\n\r\n")


def _sanitize_and_decode(fn):
  return re.sub(r"[^\w+.\- ]", "_", fn.replace('%20',' ').replace('+',' '))

def run(port=80):
  addr = socket.getaddrinfo("0.0.0.0", port)[0][-1]
  s = socket.socket(); s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
  s.bind(addr)
  s.listen(5)
  print("Serving on", addr)
  while True:
    cl, _ = s.accept()
    try:
      handle_request(cl)
    except Exception as e:
      print(e)
      sys.print_exception(e)
      try: s.send("HTTP/1.1 500 Internal Server Error\r\n\r\nError")
      except: pass
    finally:
      cl.close()

run(12345)

