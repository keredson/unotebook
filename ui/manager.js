import { useState, useEffect } from 'preact/hooks';
import { h } from 'preact';
import htm from 'htm';
const html = htm.bind(h);

import * as storage from './storage';

export function Manager() {
  const [files, setFiles] = useState([]);
  const [reload, set_reload] = useState(0);
  useEffect(() => {
    storage.listNotebooks().then(files=>setFiles(files))
  }, [reload]);

  function new_notebook() {
    document.location.hash = '#/local/__new__.unb'
  }

  async function delete_notebook(fn) {
    if (confirm('Delete notebook '+fn+'?')) {
      storage.deleteNotebook(fn).then(()=>set_reload(reload+1))
    }
  }

  async function rename_notebook(fn) {
    var new_fn = prompt('Enter new name of notebook?')
    if (!new_fn) return
    if (!new_fn.endsWith('.unb')) new_fn = new_fn+'.unb'
    const doc = await storage.getNotebook(fn)
    await storage.saveNotebook(new_fn, doc)
    await storage.deleteNotebook(fn)
    set_reload(reload+1)
  }

  async function copy_notebook(fn) {
    var new_fn = prompt('Enter a name for the new notebook...')
    if (!new_fn) return
    if (!new_fn.endsWith('.unb')) new_fn = new_fn+'.unb'
    const doc = await storage.getNotebook(fn)
    await storage.saveNotebook(new_fn, doc)
    set_reload(reload+1)
  }

  async function download_notebook(fn) {
    const obj = await storage.getNotebook(fn);
    if (obj == null) {
      throw new Error(`Notebook not found: ${fn}`);
    }
    // stringify (pretty) and make a JSON blob
    const json = JSON.stringify(obj, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fn;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function upload_notebook() {
    const input = document.getElementById('upload_notebook');
    const file = input.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const obj = JSON.parse(text);
      await storage.saveNotebook(file.name, obj);
      set_reload(reload + 1);
    } catch (err) {
      console.error('Failed to upload notebook:', err);
      alert('Error uploading notebook: ' + err.message);
    }
  }

  return html`<div style='text-align:center;'>
    <h1 style='margin-top:0'>µNotebook</h1>
    <table style='margin:0 auto; text-align:left;'>
      <tr><th></th><th>Notebook</th><th>Size</th></tr>
      ${files.map(f => html`<tr>
        <td style='color:#444;'>${iconForSource(f.source)}</td>
        <td style='padding-right:1em;'>
          <a href='#/${f.source}/${f.fn}'><code>${f.fn}</code></a>
        </td>
        <td style='color:#444;'>${humanize_bytes(f.size)}</td>
        <td>
          <div style='padding-left:1em; display:inline-flex; gap:.5rem;'>
            <span title='Delete ${f.fn}' style='cursor:pointer; color:#888;' onClick=${()=>delete_notebook(f.fn)}>❌︎</span>
            <span title='Rename ${f.fn}' style='cursor:pointer; color:#888;' onClick=${()=>rename_notebook(f.fn)}>✎</span>
            <span title='Copy ${f.fn}' style='cursor:pointer; color:#888;' onClick=${()=>copy_notebook(f.fn)}>🗐︎</span>
            <span title='Download ${f.fn}' style='cursor:pointer; color:#888;' onClick=${()=>download_notebook(f.fn)}>📥︎</span>
          </div>
        </td>
      </tr>`)}
      <tr><td colspan='3'>
        <div style='display:inline-flex; gap:.5rem; margin-top:.5em'>
          <button onClick=${()=>new_notebook()}>New Notebook</button>
          <input id='upload_notebook' type="file" accept=".unb" style='display:none;' onChange=${()=>upload_notebook()} />
          <button onClick=${()=>document.getElementById('upload_notebook').click()}>Upload Notebook...</button>
        </div>
      </td></tr>
    </table>
  </div>`;
}

function humanize_bytes(n) {
  if (n === 0) return "0b";
  const units = ["b", "kb", "mb", "gb", "tb", "pb"];
  const k = 1024;
  const i = Math.floor(Math.log(n) / Math.log(k));
  const value = n / Math.pow(k, i);
  return value.toFixed(value < 10 && i > 0 ? 1 : 0) + "" + units[i];
}

function rstrip(str, suffix) {
  return str.endsWith(suffix) ? str.slice(0, -suffix.length) : str;
}

function iconForSource(source) {
  switch (source) {
    case 'local':   return '🌐︎'; // browser-local or 🌐
    case 'device':  return '⚙︎'; // esp32 / pybricks or ⚙️
    case 'cloud':   return '☁︎'; // or ☁️
    default:        return '';
  }
}
