import { cleaveLastStatement, isSafeToWrapInPrint } from './repl.js'

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

  async reset() {
    console.log('resetting webrepl')
    await this.send('import sys, gc; sys.modules.clear(); gc.collect(); locals().clear()')
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

