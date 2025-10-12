import { h, render } from 'preact';
import htm from 'htm';
import { Router } from 'preact-router';
import { Notebook } from './notebook.js'
import { Manager } from './manager.js'
import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import { Pybricks } from './pybricks';
import { WebRepl } from './webrepl';
import { useGuardHashLinks } from './useGuardHashLinks.js';
import * as storage from './storage';
//import '../style.css';
//import 'preact/debug';

import VERSION from '../VERSION.txt?raw';

const html = htm.bind(h);


const css = `
  .add-cell {
    opacity: 0;
    font-size: smaller;
  }
  .add-cell:hover {
    opacity: 1;
  }
  .markdown h1 {
    margin-top: 0;
  }
  body {
    font-size: 16px;
    line-height: 1.65;
    margin-left: auto;
    margin-right: auto;
    max-width: 800px;
    min-height: 0;
    height: auto;
    font-family: system-ui, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif;
  }
  body #app_container {
    border-radius: 10px;
    margin-top: 1em;
    background-color: #f4f0e8;
    padding:2em;
    box-shadow: 0 2px 6px rgba(0,0,0,0.08);
    margin: 1em;
  }
  html {
    background-color: #ddd;
  }
  .output {
    display: block;
    max-height: calc(1.1em * 30);  /* ≈ 40 lines */
    overflow-y: auto;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 0.75em;
    line-height: 1.2;
    padding: 0.5em;
    padding-top: 1em;
  }

  .warning {
    background: #ffe5e5;              /* soft red background */
    color: #a40000;                   /* dark red text */
    border: 1px solid #ffb3b3;        /* subtle border */
    border-radius: 6px;
    padding: 0.5em 1em;
    margin: 0.5em 0;
    font-family: system-ui, sans-serif;
    font-size: 0.9rem;
    white-space: pre-wrap;            /* wrap long lines */
    box-shadow: 0 2px 6px rgba(0,0,0,0.1);
    text-align: left;
  }

  .warning::before {
    content: "⚠️ ";
    font-size: 1rem;
  }

  .blocklyMainBackground {
    fill: #f8f6f1 !important; /* light tan background */
    stroke: none !important;
  }

  .blocklyFlyoutBackground {
    fill: #f0ebe1 !important;              /* flyout SVG rect fill */
    rx: 0 !important;
    ry: 0 !important;
    /*fill-opacity: .6 !important;*/
    }

  .blocklyToolbox {
    background-color: #f0ebe1 !important;
  }

  .blocklyText,
  .blocklyDropdownText,
  .blocklyEditableText,
  .blocklyTreeLabel,
  .blocklyFlyoutLabel,
  .blocklyMenuItemContent,
  .blocklyWidget,
  .blocklyToolbox,
  .blocklyTextArea,
  .blocklyHtmlInput {
    font-family: system-ui, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif !important;
  }

  pre.blockly-python {
    background-color: #f8f6f1;
    border: 1px solid silver;
    border-radius: 3px;
    padding: 0.5em;
    margin: 0;
    overflow-x: auto;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 0.75em;
    line-height: 1.2;
    color: #2b1e10;
  }

  textarea.python-textarea {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 0.75em !important;
    line-height: 1.2 !important;
    padding: 0.5em !important;
  }

  pre.blockly-python code {
    display: block;
    white-space: pre;
  }

  code[class*="language-"] {
    font-family: inherit;
  }

  code[class*="language-"] .token.comment {
    color: #8a7e6b;
    font-style: italic;
  }

  code[class*="language-"] .token.keyword {
    color: #2c5aa0;
    font-weight: 600;
  }

  code[class*="language-"] .token.boolean,
  code[class*="language-"] .token.number {
    color: #8b3f8c;
  }

  code[class*="language-"] .token.string {
    color: #b35625;
  }

  code[class*="language-"] .token.builtin {
    color: #6753b5;
  }

  code[class*="language-"] .token.decorator {
    color: #3e7a29;
  }

  code[class*="language-"] .token.operator {
    color: #005c7a;
  }

  code[class*="language-"] .token.punctuation {
    color: #4f453a;
  }

  .code-editor {
    position: relative;
    width: 100%;
    box-sizing: border-box;
  }

  .code-editor__preview {
    margin: 0;
    padding: 0.75em;
    pointer-events: none;
  }

  pre.blockly-python.code-editor__preview {
    background: #f8f6f1;
    border-radius: 3px;
  }

  .code-editor__textarea {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    padding: 0.5em;
    border: 1px solid transparent;
    border-radius: 3px;
    background: transparent;
    color: transparent;
    caret-color: #2b1e10;
    resize: none;
    box-sizing: border-box;
    z-index: 1;
  }

  .code-editor__textarea:focus {
    outline: none;
  }

  .code-editor__textarea::placeholder {
    color: #8a8273;
  }

  .code-editor__textarea::selection {
    background: rgba(217, 164, 65, 0.35);
  }

  `;

const BASE = location.pathname.startsWith('/code/')
  ? '/code'
  : ''; // '' when hosted at /

const getHashPath = () => {
  // Prefer hash; if none, fall back to pathname (minus base)
  let p = location.hash.replace(/^#/, '');
  if (!p) {
    p = location.pathname.slice(BASE.length) || '/';
  }
  if (!p.startsWith('/')) p = '/' + p;
  return p;
};

function ensureHash() {
  if (location.hash) return;

  const path = location.pathname;
  if (path !== BASE) return;

  // keep current origin + base, inject a hash without reloading
  history.replaceState(null, '', BASE + '#/');
}


function App() {
  console.log('window.__unotebook_version__', window.__unotebook_version__)

  const [url, setUrl] = useState(getHashPath());

  const pybricks = useMemo(() => new Pybricks(), []);
  const webrepl = useMemo(() => new WebRepl(), []);
  const [connected, setConnected] = useState(false);
  const [connected_text, set_connected_text] = useState(null);
  const [warning, set_warning] = useState(null);
  const [http_warning, set_http_warning] = useState(false);
  const [https_warning, set_https_warning] = useState(false);
  const [active_backend, set_active_backend] = useState(null);
  const sinkRef = useRef({ id: 0, cb: null });
  const backend = active_backend==='pybricks' ? pybricks : (active_backend==='webrepl' ? webrepl : null);

  const isDirtyRef = useRef(false);
  // pass a setter to Notebook so it can mark dirty/clean
  const setDirty = (v) => { isDirtyRef.current = !!v; };
  useGuardHashLinks(isDirtyRef);

  useEffect(() => {
    if (backend==null) return;
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onData = (e) => {
      const cb = sinkRef.current.cb;
      if (cb) cb(e.detail);
    };
    backend.addEventListener('connect', onConnect);
    backend.addEventListener('disconnect', onDisconnect);
    backend.addEventListener('stdout', onData);
    return () => {
      backend.removeEventListener('connect', onConnect);
      backend.removeEventListener('disconnect', onDisconnect);
      backend.removeEventListener('stdout', onData);
      backend.disconnect();
    };
  }, [backend]);

  useEffect(() => {
    const warning = [
      pybricks?.status?.BATTERY_LOW_VOLTAGE_WARNING && 'Low Battery',
      pybricks?.status?.BATTERY_HIGH_CURRENT && 'High Current',
      //pybricks?.status?.BLE_HOST_CONNECTED && 'Connected'
    ].filter(Boolean);
    set_warning(warning.length ? warning.join('\n') : null);
  }, [pybricks?.status]);

  useEffect(() => {
    const onHash = () => {
      const next = getHashPath();
      setUrl(u => (u === next ? u : next));
    };
    window.addEventListener('hashchange', onHash);
    ensureHash();   // normalize first paint at / or /unotebook/
    onHash();
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  async function connect_webrepl() {
    console.log('connect_webrepl')
    if (location.protocol=='https:') {
      set_https_warning(true)
      return
    }
    set_active_backend('webrepl')
    var connection_url = prompt("WebREPL url? (ws://ip[:port])", await storage.getNotebook('__webrepl_last_url__') || 'ws://')
    if (!connection_url.startsWith('ws://') && !connection_url.startsWith('wss://')) {
      connection_url = 'ws://'+connection_url
    }
    set_connected_text('🔗︎ '+connection_url)
    try {
      const ws = await webrepl.connect(connection_url)
      await storage.saveNotebook('__webrepl_last_url__', connection_url)
    } catch(e) {
      console.log({e})
      alert(prettyError(e))
    }
  }

  async function connect_pybricks() {
    console.log('connect_pybricks')
    if (!navigator.bluetooth) {
      set_http_warning(true)
      return
    }
    set_active_backend('pybricks')
    const name = await pybricks.connect()
    set_connected_text('🔗︎ '+name)
  }

  return html`
    <div id='app_container'>
      <style>${css}</style>
      <div style='display:flex; gap:1rem; justify-content:space-between;'>
        <span style='font-size:smaller;'>${
          url.length > 1
            ? html`<a href="#/">Home</a>${url
                .substring(1)
                .split('/')
                .map((s, i) =>
                  i === 0 && s === 'local'
                    ? html` » <span style='cursor:default' title="Local Storage">🌐︎</span>`
                    : html` » ${decodeURIComponent(s)}`
                )}`
            : null
        }</span>
        <div style='display:flex; gap:1rem; align-items: center;'>
          ${ connected ? null : html`<button onClick=${e=>connect_pybricks()}>🔗︎ Pybricks</button>` }
          ${ connected ? null : html`<button onClick=${e=>connect_webrepl()}>🔗︎ WebREPL</button>` }
          ${ connected ? html`<code style='font-size:smaller; line-height:1;'>${connected_text}</code> <button onClick=${e=>{if (confirm("Disconnect?")) {active_backend=='pybricks' ? pybricks.disconnect() : webrepl.disconnect()}}}>Disconnect</button>` : null }
        </div>
      </div>
      ${ http_warning ? html`<div class='warning'>
        Bluetooth not available over HTTP. Goto: <a href="https://unotebook.org/">https://unotebook.org/</a>
        <span onClick=${()=>set_http_warning(false)} style='cursor:pointer; float:right; margin-top:.1em'>❌︎</span>
      </div>` : null }
      ${ https_warning ? html`<div class='warning'>
        WebREPL not available over HTTPS. Copy <a href='http://unotebook.org' onClick=${copy_link}>http://unotebook.org</u> into the address bar.
        <span onClick=${()=>set_https_warning(false)} style='cursor:pointer; float:right; margin-top:.1em'>❌︎</span>
      </div>` : null }
      ${ warning ? html`<pre class='warning' style='max-width: 280px; float: right;'><code>${warning}</code></pre>` : null }
      <${Router} url=${url} key=${url} onChange=${e => console.log('url:', e.url)}>
        <${Manager} path="/" />
        <${Notebook} backend=${backend} connected=${connected} sinkRef=${sinkRef} source='local' path="/local/:fn" onDirtyChange=${setDirty} />
        <${Notebook} backend=${backend} connected=${connected} sinkRef=${sinkRef} source='device' path="/device/:fn" onDirtyChange=${setDirty} />
      </${Router}>
    </div>
    <div style='text-align:center; margin-top:1em; color: #444; font-size:smaller;'>
      <a style='color: #444;' href='//unotebook.org' target='_unotebook_org'>µNotebook</a> v${VERSION} © 2025 - <a style='color: #444;' href='https://github.com/keredson/unotebook' target='_unotebook_github'>source code</a> - <a style='color: #444;' href='https://github.com/keredson/unotebook/issues/new' target='_unotebook_github'>report a bug</a>
    </div>
  `;
}



const mount = document.getElementById('app');
mount.textContent = '';
render(html`<${App}/>`, mount);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const base = `${window.location.origin}${import.meta.env.BASE_URL}`;
    const swUrl = new URL('service-worker.js', base).toString();
    navigator.serviceWorker.register(swUrl).catch((error) => {
      console.warn('Service worker registration failed:', error);
    });
  });
}


async function copy_link(e) {
  e.preventDefault()
  const a = e.target
  await navigator.clipboard.writeText(a.href);
  alert('Copied "'+ a.href +'" to clipboard.')
}

function prettyError(e) {
  // native Error
  if (e instanceof Error) return e.message;

  // CloseEvent from WebSocket
  if (typeof CloseEvent !== "undefined" && e instanceof CloseEvent) {
    const reason = e.reason ? ` ${e.reason}` : "";
    return `WebSocket closed (${e.code})${reason}`;
  }

  // plain string
  if (typeof e === "string") return e;

  // common shapes (e.g., { message, code, reason, type })
  if (e && typeof e === "object") {
    if (e.message && e.code) return `${e.message} (code ${e.code})`;
    if (e.message) return e.message;
    if (e.reason) return `Error: ${e.reason}`;
    if (e.type) return `${e.type}${e.error ? `: ${e.error}` : ""}`;
    try { return JSON.stringify(e); } catch {}
  }

  // last resort
  return String(e);
}
