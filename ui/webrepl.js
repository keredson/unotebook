import { cleaveLastStatement, is_safe_to_assign_to_var, stripPythonComment, appendWithCR, UNOTEBOOK_REPR_FUNCTION } from './repl.js'
import * as storage from './storage';

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
    this.running = false;
    this.stdout = ''
    this.running_timer = null;
    this._abort = false
    this._reprInjected = false;
  }

  async connect(url, onReady = null) {
    if (!url.substring(4).includes(':')) url = url + ':8266';
    this.url = url;             // e.g. "ws://192.168.4.1:8266/"
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
      this._reprInjected = false;
      this.dispatchEvent(new Event('disconnect'));
    };
    this.ws.onmessage = async (ev) => {
      let text = '';
      if (typeof ev.data === 'string') {
        text = ev.data;
      } else {
        text = this._dec.decode(new Uint8Array(ev.data));
      }
      //console.log('ws: ', JSON.stringify(text))
      if (this.first_msg && text=='Password: ') {
        const password = prompt("Password?", await storage.getNotebook('__webrepl_last_pass__') || '').trim()
        this.waiting_auth = true
        this.ws.send(password + '\n')
        await storage.saveNotebook('__webrepl_last_pass__', password)
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
        if (text.trim().startsWith('paste mode;') && text.trim().endsWith('===')) {
          this.wait_for_paste_mode = false
        }
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
      //console.log({text})

      this.stdout = appendWithCR(this.stdout, text)

      this.last_packet = text
      if (text === '>>> ') {
        clearTimeout(this.running_timer);
        this.running_timer = setTimeout(() => {
          if (this.last_packet === '>>> ') {
            this.running = false;
            this.stdout = this.stdout.replace(/>>> $/, '')
            console.log("Timed out — REPL idle");
          }
        }, 500);
        return
      } else {
        clearTimeout(this.running_timer);
      }

      this.dispatchEvent(new CustomEvent('stdout', { detail: this.stdout }));
    };

    // Optional: perform any login / REPL-mode prep
    if (this.onReady) {
      await this.onReady(this.ws);
    }

    this.connected = true;
    this._reprInjected = false;
    this.dispatchEvent(new Event('connect'));
  }

  async reset() {
    console.log('resetting webrepl')
    await this._send('import sys, gc; sys.modules.clear(); gc.collect(); locals().clear()')
    while (this.running) await sleep(100);
    this._reprInjected = false;
  }

  async _send(code, finished=null) {
    if (!this.connected || !this.ws || this.ws.readyState !== 1) {
      throw new Error('Not connected (WebREPL)');
    }
    check_non_ascii(code)
    code = code.replaceAll('\r\n','\n')
    const {head, tail} = cleaveLastStatement(code)
    this.finished = finished
    this.stdout = ''
    this._abort = false
    console.log({head, tail})
    const segments = []
    if (head) segments.push(head)
    if (tail) {
      if (is_safe_to_assign_to_var(tail)) {
        const expr = stripPythonComment(tail).trim()
        if (expr.length) {
          segments.push(`_ = (${expr})`)
          segments.push('if _ is not None:\n    __unotebook_repr__(_)')
        } else {
          segments.push(tail)
        }
      } else {
        segments.push(tail)
      }
    }
    code = segments.join('\n')
    console.log('code:', code)

    const blocks = groupBlocks(splitPythonTopLevelNoComments(code));
    for (const block of blocks) {
      console.log('sending ', block.type, ' block', block.text)
      this.ignore_bytes = block.text.length+2
      this.running = true
      this.wait_for_paste_mode = true
      await this.ws.send('');
      while (this.wait_for_paste_mode) await sleep(10)
      await this.ws.send(block.text)
      await this.ws.send('');
      await sleep(100)
      while (this.ignore_bytes > 0) await sleep(10)
      while (this.running) {
        if (this._abort) {
          // CTRL-C doesn't do squat in WebREPL sadly...
          //await this.ws.send(CTRL_C);
          console.log('aborting...')
        }
        await sleep(10)
      }
      if (this._abort) break
    }
  }

  async run(code) {
      await this._ensureReprFunction();
      await this._send(code)
      while (this.running) await sleep(100);
  }

  disconnect() {
    try { this.ws?.close(); } catch {}
  }

  async abort() {
    this._abort = true
    console.log('abort requested')
    return "Abort requested.  If WebREPL stuck in infinite loop, manually reboot device."
  }

  async _ensureReprFunction() {
    if (!this.connected || this._reprInjected) return;
    await this._send(UNOTEBOOK_REPR_FUNCTION);
    while (this.running) await sleep(100);
    this._reprInjected = true;
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function check_non_ascii(text) {
  const encoded = new TextEncoder().encode(text)
  for (const byte of encoded) {
    if (byte > 0x7f) {
      throw new Error(
        "Non-ASCII character detected. WebREPL only accepts plain ASCII text."
      );
    }
  }
}

function splitPythonTopLevelNoComments(src) {
  const code = src.replace(/\r\n?/g, "\n");
  const lines = code.split("\n").map(stripPythonComment);

  let inStr = false, strQuote = "";
  let paren = 0, bracket = 0, brace = 0;

  const blocks = [];
  let blockStart = null;
  let lastNonEmpty = -1;

  const atTop = () => !inStr && paren === 0 && bracket === 0 && brace === 0;

  const isContinuationHeader = (t) => {
    // must be at column 0, not in parens/strings, and one of these headers:
    // try-family: except/finally/else (for try), if-family: elif/else,
    // loops: else, match: case/else
    return /^(elif\b|else\s*:|except\b.*:|finally\s*:|case\b.*:)$/.test(t);
  };

  const classify = (text) => {
    const t = text.trimStart();
    if (/^@/.test(t)) return "decorators";
    if (/^(async\s+)?def\b/.test(t)) return "def";
    if (/^class\b/.test(t)) return "class";
    if (/^(from\b|import\b)/.test(t)) return "import";
    if (/^if\s+__name__\s*==\s*["']__main__["']\s*:/.test(t)) return "guard";
    return "stmt";
  };

  const pushBlock = (start, end) => {
    if (start == null || end <= start) return;
    const text = lines.slice(start, end).join("\n");
    if (text.trim()) blocks.push({ text, startLine: start, endLine: end, type: classify(text) });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const indent = line.match(/^[ \t]*/)[0].length;
    const trimmed = line.trim();
    const isBlank = trimmed === "";

    // Start of a new top-level *header*?
    const startsTopHeader = atTop() && !isBlank && indent === 0;

    // If a new header line appears at top level…
    if (startsTopHeader) {
      // Is it a continuation header (elif/else/except/finally/case)?
      if (!isContinuationHeader(trimmed)) {
        // Close previous block (if any), then start a new one
        if (blockStart !== null) pushBlock(blockStart, i);
        blockStart = i;
      }
      // else: continuation header → keep in current block (do not split)
    }

    if (!isBlank) lastNonEmpty = i;

    // ——— update parser state across the line ———
    for (let k = 0; k < line.length; k++) {
      const ch = line[k];

      if (inStr) {
        if (strQuote.length === 1) {
          if (ch === "\\") { k++; continue; }
          if (ch === strQuote) { inStr = false; strQuote = ""; }
        } else {
          if (line.slice(k, k+3) === strQuote) { inStr = false; strQuote = ""; k += 2; }
        }
        continue;
      }

      if (ch === "#") break;

      if (ch === "'" || ch === '"') {
        if (line.slice(k, k+3) === ch.repeat(3)) { inStr = true; strQuote = ch.repeat(3); k += 2; }
        else { inStr = true; strQuote = ch; }
        continue;
      }

      if (ch === "(") paren++;
      else if (ch === ")") paren = Math.max(0, paren - 1);
      else if (ch === "[") bracket++;
      else if (ch === "]") bracket = Math.max(0, bracket - 1);
      else if (ch === "{") brace++;
      else if (ch === "}") brace = Math.max(0, brace - 1);
    }
  }

  if (blockStart !== null) pushBlock(blockStart, lastNonEmpty + 1);

  // merge decorators with following def/class
  const merged = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.type === "decorators" && i + 1 < blocks.length &&
        (blocks[i + 1].type === "def" || blocks[i + 1].type === "class")) {
      merged.push({
        text: b.text + "\n" + blocks[i + 1].text,
        startLine: b.startLine,
        endLine: blocks[i + 1].endLine,
        type: blocks[i + 1].type,
      });
      i++;
    } else {
      merged.push(b);
    }
  }
  return merged;
}

const CTRL_C = '\x03';

function groupBlocks(blocks, limit=255) {
  const grouped = [];
  let cur = '';

  const flush = () => {
    if (cur) {
      grouped.push({text:cur});
      cur = '';
    }
  };

  for (const b of blocks) {
    const text = b.text.endsWith('\n') ? b.text : b.text + '\n';
    console.log({text, cur})
    // If current + next would exceed the hard limit → flush current
    if (cur.length && cur.length + text.length > limit) {
      flush();
    }
    cur += text;
  }

  flush();
  return grouped;
}
