import { h, render } from 'preact';
import htm from 'htm';
import { Router } from 'preact-router';
import { Notebook } from './notebook.js'
import { Manager } from './manager.js'
import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import { BleNus } from './blenus';
import { WebRepl } from './webrepl';

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
`;

const getHashPath = () => {
  const p = location.hash.replace(/^#/, '');
  return p && p.startsWith('/') ? p : '/';
};


function App() {
  console.log('window.__unotebook_version__', window.__unotebook_version__)

  const [url, setUrl] = useState(getHashPath());

  const ble = useMemo(() => new BleNus(), []);
  const webrepl = useMemo(() => new WebRepl(), []);
  const [connected, setConnected] = useState(false);
  const [connected_text, set_connected_text] = useState(null);
  const [active_backend, set_active_backend] = useState(null);
  const sinkRef = useRef({ id: 0, cb: null });
  const backend = active_backend==='ble' ? ble : (active_backend==='webrepl' ? webrepl : null);

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
    const onHash = () => {
      const next = getHashPath();
      // avoid no-op setState (helps some reconciliation cases)
      setUrl(u => (u === next ? u : next));
    };
    window.addEventListener('hashchange', onHash);
    // ensure first paint matches current bar (important on hard reload)
    onHash();
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  function connect_webrepl() {
    console.log('connect_webrepl')
    set_active_backend('webrepl')
    const connection_url = 'camerabot.local' || prompt("WebREPL ip[:port]?")
    set_connected_text('🔗 ws://'+connection_url)
    webrepl.connect(connection_url, async (ws) => {
      // ready
    })
  }

  async function connect_ble() {
    console.log('connect_ble')
    set_active_backend('ble')
    const name = await ble.connect()
    set_connected_text('🔗 '+name)
    ble.send('print(1)')
  }

  return html`
    <div>
      <style>${css}</style>
      <div style='display:flex; gap:1rem; justify-content:space-between;'>
        <span style='font-size:smaller;'>${
          url.length > 1 ? html`<a href="#">Home</a>${url.substring(1).split('/').map((s, i) => html` » ${s}`)}` : null
        }</span>
        <div style='display:flex; gap:1rem; align-items: center;'>
          ${ connected ? null : html`<button onClick=${e=>connect_ble()}>🔗 Pybricks</button>` }
          ${ connected ? null : html`<button onClick=${e=>connect_webrepl()}>🔗 WebREPL</button>` }
          ${ connected ? html`<code style='font-size:smaller; line-height:1;'>${connected_text}</code> <button onClick=${e=>{if (confirm("Disconnect?")) {active_backend=='ble' ? ble.disconnect() : webrepl.disconnect()}}}>Disconnect</button>` : null }
        </div>
      </div>
      <${Router} url=${url} key=${url} onChange=${e => console.log('url:', e.url)}>
        <${Manager} path="/" />
        <${Notebook} backend=${backend} connected=${connected} sinkRef=${sinkRef} path="/:fn" />
      <//>
      <div style='text-align:center; margin-top:2em; color: #444; font-size:smaller;'><a style='color: #444;' href='https://github.com/keredson/unotebook' target='_unotebook_github'>µNotebook</a> v${window.__unotebook_version__} - © 2025 Derek Anderson</div>
    </div>
  `;
}



const mount = document.getElementById('app');
mount.textContent = '';
render(html`<${App}/>`, mount);