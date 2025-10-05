import { h } from 'preact';
import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import htm from 'htm';
import { Cell } from './cell';
import { route } from 'preact-router';
import { BleNus } from './blenus';
import { WebRepl } from './webrepl';

const html = htm.bind(h);

function random_id() {
  return Math.random().toString(36).slice(2);
}

export function Notebook(props) {
  const [doc, set_doc] = useState({});
  const [cells, set_cells] = useState([]);
  const [metadata, set_metadata] = useState([]);
  const [saving, set_saving] = useState(false);
  const [changes, set_changes] = useState(false);

  const ble = useMemo(() => new BleNus(), []);
  const webrepl = useMemo(() => new WebRepl(), []);
  const [connected, setConnected] = useState(false);
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

  const changesRef = useRef(changes);
  useEffect(() => { changesRef.current = changes }, [changes]);
  useEffect(() => {
    const handler = (e) => {
      if (changesRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
  
  const refs = useRef(new Map());
  const getRef = id => {
    let r = refs.current.get(id);
    if (!r) {
      r = { current: null };
      refs.current.set(id, r);
    }
    return r;
  };

  useEffect(() => {
    fetch('/_notebook/'+props['fn']).then(r=>r.json()).then(n=>{
      set_doc(n)
      set_cells(n['cells'].map((cell) => ({cell_type:'code', id:random_id(), ...cell})))
      set_metadata(n['metadata'])
      document.title = props['fn'] + ' - µNotebook';
    });
  }, []);

  function insert_before(i, cell_type) {
    console.log('insert_before', i, cell_type)
    const next = cells.slice()
    next.splice(i, 0, {id:crypto.randomUUID(), cell_type, source:[]})
    set_cells(next)

  }

  function delete_cell(i) {
    if (confirm("Delete cell?")) {
      const next = cells.slice()
      next.splice(i, 1)
      set_cells(next)
    }
  }

  function add_cell() {
    const next = cells.slice()
    next.push({source:[], cell_type:'code'})
    set_cells(next)
  }

  async function save() {
    set_saving(true)
    let cells_ = []
    let fn = props['fn'];
    if (fn=='__new__.unb') {
      fn = prompt("Enter notebook name:")
      if (!fn.endsWith('.unb')) fn = fn+'.unb'
    }
    for (const c of cells) {
      const api = refs.current.get(c.id)?.current;
      const source = api.getValue().source.split('\n');
      cells_.push({id:c.id, cell_type:c.cell_type, source})
    }
    const payload = {cells:cells_, metadata}
    const resp = await fetch('/_save/'+encode_fn(fn), {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload, null, 2)
    })
    set_saving(false)
    set_changes(false)
    if (props['fn']=='__new__.unb') {
      route('/notebook/'+fn)
    }
  }

  async function run_all() {
    // Run sequentially
    for (const c of cells) {
      const api = refs.current.get(c.id)?.current;
      try {
        const result = await api.getValue().run();
      } catch (e) {
        console.error("Cell failed:", c.id, e);
        break
      }
    }
  }

  async function run_cell(code, onData, opts = {}, finished=null) {
    if (!backend.connected) throw new Error('Not connected');
    const { timeoutMs = 0, newline = true } = opts;

    // make this the active sink
    const myId = sinkRef.current.id + 1;
    sinkRef.current = { id: myId, cb: onData };

    // optional: auto-clear sink after a quiet timeout
    let timer = null;
    const armTimer = () => {
      if (!timeoutMs) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        // only clear if still the active session
        if (sinkRef.current.id === myId) sinkRef.current = { id: myId, cb: null };
      }, timeoutMs);
    };
    if (timeoutMs) armTimer();

    // small wrapper to keep the sink alive while chunks come in
    const originalCb = onData;
    sinkRef.current.cb = (chunk) => {
      originalCb(chunk);
      armTimer();
    };

    // send the code
    const payload = newline && !code.endsWith('\n') ? code + '\n' : code;
    await backend.send(payload, finished);

    // return a cancel function so the Cell can stop receiving
    return () => {
      if (sinkRef.current.id === myId) {
        sinkRef.current = { id: myId, cb: null };
      }
      clearTimeout(timer);
    };
  }

  async function restart() {
    if (confirm("Restart notebook?")) {
      const resp = await fetch('/_stop', {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(props.fn)
      })

      for (const c of cells) {
        const api = refs.current.get(c.id)?.current;
        api.getValue().clear();
      }
    }
  }

  function connect_webrepl() {
    console.log('connect_webrepl')
    set_active_backend('webrepl')
    webrepl.connect('camerabot.local' || prompt("WebREPL ip[:port]?"), async (ws) => {
      // ready
    })
  }

  return html`<div>
    <h1 style='margin-top:0; margin-bottom:0;'>${doc?.metadata?.name || props.fn}</h1>
    <div style='display:flex; gap:.5rem; margin-bottom:.5em;'>
      <button onClick=${e=>run_all()}>Run All</button>
      <button onClick=${e=>restart()}>Restart</button>
      <button disabled=${props['fn']!='__new__.unb' && !changes} onClick=${e=>save()}>${props['fn']=='__new__.unb' ? 'Save as...' : 'Save'}</button>
      <span style='width:1em;'/>
      ${ connected ? html`<button onClick=${e=>{if (confirm("Disconnect?")) {active_backend=='ble' ? ble.disconnect() : webrepl.disconnect()}}}>Disconnect</button>` : null }
      ${ connected ? null : html`<button onClick=${e=>set_active_backend('ble') && ble.connect()}>🔗 Pybricks</button>` }
      ${ connected ? null : html`<button onClick=${e=>connect_webrepl()}>🔗 WebREPL</button>` }
    </div>
    ${cells.map((cell, i) => html`<${Cell} 
        key=${cell.id} cell=${cell} idx=${i} fn=${props.fn}
        ref=${getRef(cell.id)} 
        insert_before=${(cell_type) => insert_before(i, cell_type)}
        delete_cell=${() => delete_cell(i)}
        save=${save}
        changed=${()=>set_changes(true)}
        connected=${connected}
        run_cell=${run_cell}
    />`)}
    <div style='display:flex; gap:.5rem; margin-top:.5em;'>
      <button onClick=${e=>add_cell()}>Add Cell</button>
    </div>
  </div>`;
}

function encode_fn(fn) {
  return fn
    .trim()
    .replace(/\s+/g, "+")        // spaces -> +
    .replace(/\//g, "_")         // forbid slash
    .replace(/[^A-Za-z0-9+._-]/g, "_"); // all else -> _
}
