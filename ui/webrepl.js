export class WebRepl extends EventTarget {
  constructor() {
    super();
    this.ws = null;
    this._dec = new TextDecoder();
    this.first_msg = true;
    this.waiting_auth = false;
    this.ignore_bytes = 0
    this.finished_exec_cb = null;
    this.stop_bytes = null;
    this.wait_for_paste_mode = false;
    this.finished = null;
  }

  async connect(url, onReady = null) {
    if (!url.includes(':')) url = url + ':8266';
    this.url = 'ws://'+url;             // e.g. "ws://192.168.4.1:8266/"
    this.onReady = onReady;     // optional async (ws) => { ... } for handshake
    if (!this.url) throw new Error('WebReplRunner: missing url');
    this.ws = new WebSocket(this.url);
    // WebREPL typically uses binary frames; we’ll still decode as text:
    this.ws.binaryType = 'arraybuffer';

    await new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error('WebREPL connect timeout')), 10000);
      this.ws.onopen = () => { clearTimeout(to); resolve(); };
      this.ws.onerror = (e) => { clearTimeout(to); reject(e); };
    });

    this.ws.onclose = () => {
      this.connected = false;
      this.dispatchEvent(new Event('disconnect'));
    };
    this.ws.onmessage = (ev) => {
      let text = '';
      if (typeof ev.data === 'string') {
        text = ev.data;
      } else {
        text = this._dec.decode(new Uint8Array(ev.data));
      }
      if (this.first_msg && text=='Password: ') {
        const password = 'steven' || prompt("Password?").trim()
        this.waiting_auth = true
        this.ws.send(password + '\n')
      }
      if (this.waiting_auth) {
        if (text.trim()=='Access denied') {
          alert(text.trim());
          this.disconnect()
          this.waiting_auth = false
        }
        if (text.trim().startsWith('WebREPL connected')) {
          console.log(text.trim())
          //this.ws.send(new Uint8Array([0x05])); // Ctrl-E to enter raw-REPL
          this.waiting_auth = false
        }
      }
      if (this.wait_for_paste_mode) {
        if (text.trim()=='===') this.wait_for_paste_mode = false
        console.log('wait_for_paste_mode', text.trim())
        return
      }
      if (this.ignore_bytes) {
        if (text.length <= this.ignore_bytes) {
          this.ignore_bytes -= text.length
          return
        } else {
          text = text.substring(this.ignore_bytes)
          this.ignore_bytes = 0
        }
      }
      if (text==this.stop_bytes) {
        if (this.finished) this.finished()
          return
      }
      this.dispatchEvent(new CustomEvent('data', { detail: text }));
    };

    // Optional: perform any login / REPL-mode prep
    if (this.onReady) {
      await this.onReady(this.ws);
    }

    this.connected = true;
    //this.send(UNOTEBOOK_REPR_FUNCTION)
    this.dispatchEvent(new Event('connect'));
  }

  async send(code, finished=null) {
    if (!this.connected || !this.ws || this.ws.readyState !== 1) {
      throw new Error('Not connected (WebREPL)');
    }

    code = code.replaceAll('\r\n','\n')
    const {head, tail} = cleaveLastStatement(code)
    this.stop_bytes = 'DONE_'+Math.random().toString(36).slice(2)
    this.finished = finished
    console.log({head, tail})
    code = head + (tail && isSafeToWrapInPrint(tail) ? '\n(lambda v: print(v) if v is not None else None)('+tail+')' : tail) + '\nprint("'+this.stop_bytes+'")'
    console.log({code})
    this.ignore_bytes = code.length + 'paste mode; Ctrl-C to cancel, Ctrl-D to finish\n=== '.length + 5

    this.ws.send('');
    await sleep(10);
    this.ws.send(code);
    this.ws.send('');
  }

  disconnect() {
    try { this.ws?.close(); } catch {}
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Cleave off the last line only if it's a standalone statement.
 * Returns { head, tail }.
 */
function cleaveLastStatement(src) {
  const lines = src.trim().replace(/\r\n?/g, "\n").split("\n");
  if (lines.length === 0) return { head: "", tail: "" };

  let text = "";
  let inStr = false, quote = "", escape = false;
  let depth = 0; // (), [], {}

  // Scan all but the last line to see if context is balanced.
  const body = lines.slice(0, -1).join("\n");
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inStr) {
      if (!escape && ch === quote) inStr = false;
      escape = !escape && ch === "\\";
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = true; quote = ch; escape = false;
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    if (ch === ")" || ch === "]" || ch === "}") depth = Math.max(0, depth - 1);
  }

  const lastLine = lines[lines.length - 1];
  const openBlock = /:\s*(#.*)?$/.test(lastLine);
  const continued = /\\\s*(#.*)?$/.test(lastLine);

  // If we’re balanced and not inside string/paren, last line stands alone.
  const canSplit = depth === 0 && !inStr && !openBlock && !continued;

  //console.log({src,canSplit, depth, inStr, openBlock, continued})
  return canSplit
    ? { head: lines.slice(0, -1).join("\n"), tail: lastLine }
    : { head: src, tail: "" };
}

/**
 * Return true iff `line` is a self-contained *expression* line
 * that is safe to wrap in print(...).
 *
 * Disqualifies:
 *   - blank / comment-only
 *   - open strings or unbalanced brackets
 *   - lines ending with ':' or line continuation '\' 
 *   - statement keywords: import, from, pass, break, continue, return, raise,
 *     assert, del, global, nonlocal, class, def, with, async def/for/with,
 *     for, while, if, try, except, finally, match, case, @decorator
 *   - assignment statements (a=1, a+=1, etc). (Allows walrus `:=`.)
 *   - top-level 'yield' or 'await' (unsafe outside proper contexts)
 */
function isSafeToWrapInPrint(line) {
  if (line == null) return false;
  const src = line.replace(/\r\n?$/, "");
  const trimmed = src.trim();
  if (!trimmed) return false;                 // empty
  if (trimmed.startsWith("#")) return false;  // pure comment
  if (/\\\s*$/.test(src)) return false;       // continuation
  if (/:$/.test(trimmed)) return false;       // block header

  // Quick decorator check
  if (/^\s*@/.test(src)) return false;

  // Scan while tracking strings, comments, and bracket depth
  let inStr = false, q = "", triple = false, esc = false, depth = 0;
  let sawComment = false;

  // Helpers to detect tokens outside strings/brackets
  const badKeyword = (kw) => new RegExp(`(^|\\b)${kw}(\\b|$)`);
  const opener = new Set(["(", "[", "{"]);
  const closer = new Set([")", "]", "}"]);

  // First pass: also build a version with strings/comments stripped to test tokens safely
  let bare = "";
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (sawComment) { bare += " "; continue; }

    if (inStr) {
      if (!triple) {
        if (!esc && ch === "\\") { esc = true; bare += " "; continue; }
        if (esc) { esc = false; bare += " "; continue; }
        if (ch === q) { inStr = false; q = ""; }
        bare += " ";
        continue;
      } else {
        // triple-quoted
        if (src.startsWith(q.repeat(3), i)) {
          inStr = false; triple = false; q = ""; i += 2;
        }
        bare += " ";
        continue;
      }
    } else {
      if (ch === "#") { sawComment = true; bare += " "; continue; }
      if (ch === "'" || ch === '"') {
        if (src.startsWith(ch.repeat(3), i)) {
          inStr = true; triple = true; q = ch; i += 2;
        } else {
          inStr = true; triple = false; q = ch;
        }
        bare += " ";
        continue;
      }
      if (opener.has(ch)) { depth++; bare += ch; continue; }
      if (closer.has(ch)) { depth = Math.max(0, depth - 1); bare += ch; continue; }
      bare += ch;
    }
  }

  // If we ended inside a string or with unbalanced brackets, not safe
  if (inStr || depth !== 0) return false;

  const bareTrim = bare.trim();

  // Reject lines that are clearly statements
  // (Order matters a bit; check multi-word forms first.)
  const statementRegexes = [
    /\basync\s+def\b/,
    /\basync\s+for\b/,
    /\basync\s+with\b/,
    /\bfrom\b/,
    /\bimport\b/,
    /\bpass\b/,
    /\bbreak\b/,
    /\bcontinue\b/,
    /\breturn\b/,
    /\braise\b/,
    /\bassert\b/,
    /\bdel\b/,
    /\bglobal\b/,
    /\bnonlocal\b/,
    /\bclass\b/,
    /\bdef\b/,
    /\bwith\b/,
    /\bfor\b/,
    /\bwhile\b/,
    /\bif\b/,
    /\btry\b/,
    /\bexcept\b/,
    /\bfinally\b/,
    /\bmatch\b/,
    /\bcase\b/,
  ];
  if (statementRegexes.some(rx => rx.test(bareTrim))) return false;

  // Disallow top-level yield/await (unsafe in most contexts)
  if (/\byield\b/.test(bareTrim) || /\bawait\b/.test(bareTrim)) return false;

  // Disallow assignment statements (allow walrus ':=' and comparisons '==', '!=', '<=', '>=')
  // We'll scan for a bare '=' that isn't part of '==', '!=', '<=', '>=', or ':='.
  for (let i = 0; i < bare.length; i++) {
    if (bare[i] === "=") {
      const prev = bare[i - 1] || "";
      const next = bare[i + 1] || "";
      const pair = prev + "=";
      if (prev === ":" && next === "=") { i++; continue; }        // ':=' walrus -> ok
      if (prev === "=" || prev === "!" || prev === "<" || prev === ">") { continue; } // '==','!=','<=','>='
      // augmented assignments like '+=', '-=', etc. will have '=' with prev being operator not in the set above.
      return false;
    }
  }

  // If we get here, it looks like a plain expression line → safe to wrap
  return true;
}

const UNOTEBOOK_REPR_FUNCTION = `import sys
def __unotebook_repr__(o):
  s = sys.stdout
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
`