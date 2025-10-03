import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import htm from 'htm';
import { Cell } from './cell';
import { route } from 'preact-router';

const html = htm.bind(h);


export function Notebook(props) {
  const [doc, set_doc] = useState({});
  const [cells, set_cells] = useState([]);
  const [metadata, set_metadata] = useState([]);
  const [saving, set_saving] = useState(false);
  
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
      set_cells(n['cells'].map((cell) => ({cell_type:'code', id:crypto.randomUUID(), ...cell})))
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
    next.push({source:[]})
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
      const source = api.getValue().source;
      cells_.push({id:c.id, cell_type:c.cell_type, source})
    }
    const payload = {cells:cells_, metadata}
    const resp = await fetch('/_save/'+encodeURI(fn), {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload)
    })
    set_saving(false)
    if (props['fn']=='__new__.unb') {
      route('/notebook/'+fn)
    }
  }

  async function run_all() {
    console.log('run_all')
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

  return html`<div>
    <h1>${doc?.metadata?.name || props.fn}</h1>
    <div style='display:flex; gap:.5rem; margin-bottom:.5em;'>
      <button onClick=${e=>run_all()}>Run All</button>
      <button onClick=${e=>save()}>${props['fn']=='__new__.unb' ? 'Save as...' : 'Save'}</button>
    </div>
    ${cells.map((cell, i) => html`<${Cell} 
        key=${cell.id} cell=${cell} idx=${i} 
        ref=${getRef(cell.id)} 
        insert_before=${(cell_type) => insert_before(i, cell_type)}
        delete_cell=${() => delete_cell(i)}
    />`)}
    <div style='display:flex; gap:.5rem; margin-top:.5em;'>
      <button onClick=${e=>add_cell()}>Add Cell</button>
    </div>
  </div>`;
}
