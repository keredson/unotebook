import { h } from 'preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import htm from 'htm';
import { Cell } from './cell';
import * as storage from './storage';
import { Package, Code, FileText, Save, Play, RefreshCcw, Copy } from 'react-feather';


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

  const refs = useRef(new Array());
  const getRef = i => {
    while (i >= refs.current.length) {
      refs.current.push(new Map())
    }
    return refs.current[i]
  };

  useEffect(() => {
    storage.getNotebook(props['fn']).then(doc=>{
      if (!doc) doc = {cells:[]}
      set_doc(doc)
      set_cells(doc.cells.map((cell) => ({id:random_id(), cell_type:'code', id:random_id(), ...cell})))
      set_metadata(doc.metadata)
      if (props.connected) props.backend.reset()
    })
  }, []);

  function insert_before(i, cell_type) {
    console.log('insert_before', i, cell_type)
    const next = cells.slice()
    if (cell_type=='blockly') next.splice(i, 0, {id:random_id(), source:[], cell_type:'code', metadata:{blockly:{version:1}}})
    else next.splice(i, 0, {cell_type, source:[]})
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
    if (cell_type=='blockly') next.push({id:random_id(), source:[], cell_type:'code', metadata:{blockly:{version:1}}})
    else next.push({source:[], cell_type})
    set_cells(next)
  }

  const getNotebookContext = useCallback((idx) => {
    const context = [];
    for (let j = 0; j < idx; j++) {
      const ref = refs.current[j]?.current;
      let cell = cells[j];
      let source = '';
      if (ref?.getValue) {
        const value = ref.getValue();
        source = value?.source ?? '';
        cell = value?.cell ?? cell;
      } else {
        source = (cell?.source || []).join('');
      }
      if ((cell?.cell_type || 'code') === 'code' && source) {
        context.push(source);
      }
    }
    return context;
  }, [cells]);

  async function save(fn) {
    set_saving(true)
    let cells_ = []
    var new_fn = false
    if (!fn || fn=='__new__.ipynb') {
      fn = prompt("Enter notebook name:")
      if (!fn.endsWith('.ipynb')) fn = fn+'.ipynb'
      new_fn = true
    }
    cells.forEach((c, i) => {
      const api = refs.current[i]?.current;
      const original = api.getValue().source;
      const hasTrailingNewline = original.endsWith('\n');
      const sourceLines = original.split('\n').map((line) => line + '\n');
      if (!hasTrailingNewline && sourceLines.length) {
        sourceLines[sourceLines.length - 1] = sourceLines[sourceLines.length - 1].slice(0, -1);
      }
      const source = sourceLines;
      const cell = api.getValue().cell;
      // avoid adding an extra \n if already empty at end
      if (source[source.length - 1] === '\n') source.pop();
      cells_.push({...cell, source})
    })
    const payload = {cells:cells_, metadata}
    await storage.saveNotebook(fn, payload)
    set_saving(false)
    set_changes(false)
    if (new_fn) {
      document.location.hash = '#/local/'+fn
    }
  }

  async function run_all() {
    // Run sequentially
    for (var i=0; i<cells.length; ++i) {
      const api = refs.current[i]?.current;
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
      await props.backend?.reset()
      for (const c of cells) {
        const api = refs.current.get(c.id)?.current;
        api.getValue().clear();
      }
    }
  }

  const bottom_button_bar_style = cells.length ? {
    display:'flex', 
    gap:'.5rem', 
    marginTop:'.5em', 
  } : {
    display:'flex', 
    gap:'2rem', 
    marginTop:'2.5em', 
    margin:'2em', 
    justifyContent:'center'
  }

  const bottom_button_bar_span_style = cells.length ? null : {flexDirection: 'column', margin:'.5em'}

  return html`<div>
    <h1 style='margin-top:0; margin-bottom:0;'>${doc?.metadata?.name || props.fn.replace(/.ipynb$/, '').replace('__new__', '(Untitled)')}</h1>
    <div style='display:flex; gap:.5rem; margin-bottom:.5em;'>
      <button onClick=${e=>run_all()} class='button_with_icon' disabled=${!connected}>
        <span>
          <${Play} size=${14} aria-hidden=${true} />
          Run All
        </span>
      </button>
      <button onClick=${e=>reset()} class='button_with_icon' disabled=${!connected}>
        <span>
        <${RefreshCcw} size=${14} aria-hidden=${true} />
        Reset
        </span>
      </button>
      <button disabled=${props['fn']!='__new__.ipynb' && !changes} onClick=${e=>save(props['fn'])} class='button_with_icon' style=${props['fn']=='__new__.ipynb' ? {display:'none'} : null}>
        <span>
        <${Save} size=${14} aria-hidden=${true} />
        Save
        </span>
      </button>
      <button onClick=${e=>save()} class='button_with_icon'>
        <span>
        <${props['fn']=='__new__.ipynb' ? Save : Copy} size=${14} aria-hidden=${true} />
        Save as...
        </span>
      </button>
    </div>
    ${cells.map((cell, i) => html`<${Cell} 
        key=${cell.id}
        cell=${cell}
        idx=${i}
        fn=${props.fn}
        ref=${getRef(i)} 
        getNotebookContext=${getNotebookContext}
        insert_before=${(cell_type) => insert_before(i, cell_type)}
        delete_cell=${() => delete_cell(i)}
        save=${save}
        changed=${()=>set_changes(true)}
        connected=${connected}
        backend=${backend}
        run_cell=${run_cell}
    />`)}
    <div style=${bottom_button_bar_style}>
      <button onClick=${e=>add_cell()} class='button_with_icon'>
        <span style=${bottom_button_bar_span_style}>
          <${Code} size=${14} aria-hidden=${true} />
          <span>Add Python</span>
        </span>
      </button>
      <button onClick=${e=>add_cell('blockly')} class='button_with_icon'>
        <span style=${bottom_button_bar_span_style}>
          <${Package} size=${14} aria-hidden=${true} />
          <span>Add Blocks</span>
        </span>
      </button>
      <button onClick=${e=>add_cell('markdown')} class='button_with_icon' style=${cells.length ? {border:0, backgroundColor:'transparent', color:'#444;'} : null}>
        <span style=${bottom_button_bar_span_style}>
          <${FileText} size=${14} aria-hidden=${true} />
          <span>Add Doc</span>
        </span>
      </button>
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
