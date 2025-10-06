import { h, render } from 'preact';
import htm from 'htm';
import { Router } from 'preact-router';
import { Notebook } from './notebook.js'
import { Manager } from './manager.js'
import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import { BleNus } from './blenus';
import { WebRepl } from './webrepl';
import { useGuardHashLinks } from './useGuardHashLinks.js';

import VERSION from '../VERSION?raw';
const VERSION_STR = (typeof VERSION === 'string' ? VERSION : VERSION?.default || '').trim();


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
  body > #app {
    border-radius: 6px;
    margin-top: 1em;
    background-color: #f4f0e8;
    padding:2em;
    box-shadow: 0px 2px 8px rgba(0, 0, 0, 0.3);
    margin: 1em;
  }
  html {
    background-color: #ddd;
  }
  .output {
    padding: 8px;
    display: block;
    font-size:smaller;
    line-height: 1.1em;
  }

  pre.warning {
    background: #ffe5e5;              /* soft red background */
    color: #a40000;                   /* dark red text */
    border: 1px solid #ffb3b3;        /* subtle border */
    border-radius: 6px;
    padding: 0.5em 1em;
    margin: 0.5em 0;
    font-family: system-ui, sans-serif;
    font-size: 0.9rem;
    white-space: pre-wrap;            /* wrap long lines */
    max-width: 280px;
    float: right;
    box-shadow: 0 2px 6px rgba(0,0,0,0.1);
  }

  pre.warning::before {
    content: "⚠️ ";
    font-size: 1rem;
  }


  `;

const BASE = location.pathname.startsWith('/unotebook/')
  ? '/unotebook'
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
  if (!location.hash) {
    // keep current origin + base, inject a hash without reloading
    history.replaceState(null, '', BASE + '#/');
  }
}


function App() {
  console.log('window.__unotebook_version__', window.__unotebook_version__)

  const [url, setUrl] = useState(getHashPath());

  const ble = useMemo(() => new BleNus(), []);
  const webrepl = useMemo(() => new WebRepl(), []);
  const [connected, setConnected] = useState(false);
  const [connected_text, set_connected_text] = useState(null);
  const [warning, set_warning] = useState(null);
  const [active_backend, set_active_backend] = useState(null);
  const sinkRef = useRef({ id: 0, cb: null });
  const backend = active_backend==='ble' ? ble : (active_backend==='webrepl' ? webrepl : null);

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
    backend.addEventListener('data', onData);
    return () => {
      backend.removeEventListener('connect', onConnect);
      backend.removeEventListener('disconnect', onDisconnect);
      backend.removeEventListener('data', onData);
      backend.disconnect();
    };
  }, [backend]);

  useEffect(() => {
    const warning = [
      ble?.status?.BATTERY_LOW_VOLTAGE_WARNING && 'Low Battery',
      ble?.status?.BATTERY_HIGH_CURRENT && 'High Current',
      //ble?.status?.BLE_HOST_CONNECTED && 'Connected'
    ].filter(Boolean);
    set_warning(warning.length ? warning.join('\n') : null);
  }, [ble?.status]);

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

  function connect_webrepl() {
    console.log('connect_webrepl')
    set_active_backend('webrepl')
    const connection_url = prompt("WebREPL ip[:port]?")
    set_connected_text('🔗︎ ws://'+connection_url)
    webrepl.connect(connection_url, async (ws) => {
      // ready
    })
  }

  async function connect_ble() {
    console.log('connect_ble')
    set_active_backend('ble')
    const name = await ble.connect()
    set_connected_text('🔗︎ '+name)
    ble.send('print(1)')
  }

  return html`
    <div>
      <style>${css}</style>
      <div style='display:flex; gap:1rem; justify-content:space-between;'>
        <span style='font-size:smaller;'>${
          url.length > 1 ? html`<a href="#/">Home</a>${url.substring(1).split('/').map((s, i) => html` » ${decodeURIComponent(s)}`)}` : null
        }</span>
        <div style='display:flex; gap:1rem; align-items: center;'>
          ${ connected ? null : html`<button onClick=${e=>connect_ble()}>🔗︎ Pybricks</button>` }
          ${ connected ? null : html`<button onClick=${e=>connect_webrepl()}>🔗︎ WebREPL</button>` }
          ${ connected ? html`<code style='font-size:smaller; line-height:1;'>${connected_text}</code> <button onClick=${e=>{if (confirm("Disconnect?")) {active_backend=='ble' ? ble.disconnect() : webrepl.disconnect()}}}>Disconnect</button>` : null }
        </div>
      </div>
      ${ warning ? html`<pre class='warning' ><code>${warning}</code></pre>` : null }
      <${Router} url=${url} key=${url} onChange=${e => console.log('url:', e.url)}>
        <${Manager} path="/" />
        <${Notebook} backend=${backend} connected=${connected} sinkRef=${sinkRef} source='local' path="/local/:fn" onDirtyChange=${setDirty} />
        <${Notebook} backend=${backend} connected=${connected} sinkRef=${sinkRef} source='device' path="/device/:fn" onDirtyChange=${setDirty} />
      </${Router}>
      <div style='text-align:center; margin-top:2em; color: #444; font-size:smaller;'>
        <a style='color: #444;' href='https://github.com/keredson/unotebook' target='_unotebook_github'>µNotebook</a> v${VERSION_STR} - © 2025
      </div>
    </div>
  `;
}



const mount = document.getElementById('app');
mount.textContent = '';
render(html`<${App}/>`, mount);
