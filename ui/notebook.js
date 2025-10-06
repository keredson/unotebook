import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import htm from 'htm';
import { Cell } from './cell';
import { route } from 'preact-router';
import * as storage from './storage';

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

  const { backend, connected, sinkRef } = props;

  useEffect(() => { 
    props.onDirtyChange(changes)
  }, [changes]);

  // stop navigation when unsaved work
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
    storage.getNotebook(props['fn']).then(doc=>{
      if (!doc) doc = {cells:[{cell_type:'code'}]}
      set_doc(doc)
      set_cells(doc.cells.map((cell) => ({cell_type:'code', id:random_id(), ...cell})))
      set_metadata(doc.metadata)
      props.backend.reset()
    })
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
      set_changes(true)
    }
  }

  function add_cell(cell_type='code') {
    const next = cells.slice()
    next.push({source:[], cell_type})
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
    await storage.saveNotebook(fn, payload)
    set_saving(false)
    set_changes(false)
    if (props['fn']=='__new__.unb') {
      document.location.hash = '#/local/'+fn
    }
  }

  async function run_all() {
    // Run sequentially
    for (const c of cells) {
      const api = refs.current.get(c.id)?.current;
      try {
        const result = await api.getValue().run();
        await sleep(100)
      } catch (e) {
        console.error("Cell failed:", c.id, e);
        break
      }
    }
  }

  async function run_cell(code, onData, opts = {}) {
    console.log('run_cell', code, backend?.connected)
    if (!backend?.connected) {
      alert("Not Connected")
      throw new Error('Not connected');
    }
    const { timeoutMs = 0, newline = true } = opts;

    // make this the active sink
    const myId = sinkRef.current.id + 1;
    sinkRef.current = { id: myId, cb: onData };

    // send the code
    const payload = newline && !code.endsWith('\n') ? code + '\n' : code;
    await backend.run(payload);
  }

  async function reset() {
    if (confirm("Clear all output and reset all variables/code on the device?")) {
      sinkRef.current = { id: null, cb: null };
      await props.backend.reset()
      for (const c of cells) {
        const api = refs.current.get(c.id)?.current;
        api.getValue().clear();
      }
    }
  }

  return html`<div>
    <h1 style='margin-top:0; margin-bottom:0;'>${doc?.metadata?.name || props.fn.replace(/.unb$/, '')}</h1>
    <div style='display:flex; gap:.5rem; margin-bottom:.5em;'>
      <button onClick=${e=>run_all()}>Run All</button>
      <button onClick=${e=>reset()}>Reset</button>
      <button disabled=${props['fn']!='__new__.unb' && !changes} onClick=${e=>save()}>${props['fn']=='__new__.unb' ? 'Save as...' : 'Save'}</button>
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
      <button onClick=${e=>add_cell()}>Add Code</button>
      <button onClick=${e=>add_cell('markdown')} style='border: 0; background-color: transparent; color: #444;'>Add Doc</button>
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

const sleep = ms => new Promise(r => setTimeout(r, ms));
