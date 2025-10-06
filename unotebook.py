__version__ = None
try:
    __version__ = open('unotebook_VERSION.txt').read()
except:
    try:
      __version__ = open('VERSION.txt').read()
    except:
        print("could not load version")

# unotebook_http.py
import socket, _thread, os

def serve_file(cl, path, ctype, gzip=False):
  try:
    f = open(path, 'rb')
  except OSError:
    cl.send(b"HTTP/1.1 404 Not Found\r\nContent-Length:0\r\n\r\n")
    return
  try:
    size = os.stat(path)[6]
    hdr = "HTTP/1.1 200 OK\r\nContent-Type: {}\r\n".format(ctype)
    if gzip:
      hdr += "Content-Encoding: gzip\r\n"
    hdr += "Content-Length: {}\r\n\r\n".format(size)
    cl.send(hdr.encode())
    while True:
      data = f.read(1024)
      if not data:
        break
      cl.send(data)
  finally:
    f.close()

def client_thread(cl, addr):
  try:
    req = cl.recv(512)
    if not req:
      cl.close()
      return
    line = req.split(b"\r\n", 1)[0]
    parts = line.split()
    path = b"/"
    if len(parts) >= 2:
      path = parts[1]
    if path in (b"/", b"/unotebook.html"):
      serve_file(cl, "/unotebook.html", "text/html; charset=utf-8")
    elif path == b"/unotebook.js":
      serve_file(cl, "/unotebook.js.gz", "application/javascript; charset=utf-8", gzip=True)
    else:
      cl.send(b"HTTP/1.1 404 Not Found\r\nContent-Length:0\r\n\r\n")
  except Exception as e:
    try:
      cl.send(b"HTTP/1.1 500 Internal Server Error\r\nContent-Length:0\r\n\r\n")
    except:
      pass
  finally:
    try:
      cl.close()
    except:
      pass

def http_server():
  s = socket.socket()
  s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
  s.bind(("0.0.0.0", 80))
  s.listen(2)
  print("HTTP server listening on port 80")
  while True:
    cl, addr = s.accept()
    _thread.start_new_thread(client_thread, (cl, addr))

def start():
  _thread.start_new_thread(http_server, ())
