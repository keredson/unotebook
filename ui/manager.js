import { useState, useEffect } from 'preact/hooks';
import { h } from 'preact';
import htm from 'htm';
const html = htm.bind(h);


export function Manager() {
  const [files, setFiles] = useState([]);
  const [reload, set_reload] = useState(0);
  useEffect(() => {
    fetch('/_files').then(r=>r.json()).then(setFiles);
  }, [reload]);

  function new_notebook() {
    window.open('/notebook/__new__.unb', '_blank')
  }

  async function delete_notebook(fn) {
    if (confirm('Delete notebook '+fn+'?')) {
      const resp = await fetch('/_delete', {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(fn)
      })
      set_reload(reload+1)
    }
  }

  async function stop_notebook(fn) {
    if (confirm('Stop notebook '+fn+'?')) {
      const resp = await fetch('/_stop', {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(fn)
      })
      set_reload(reload+1)
    }
  }

  async function download_notebook(fn) {
    const resp = await fetch('/_notebook/'+fn)
    const blob = await resp.blob();
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
    const resp = await fetch("/_save/"+file.name, {
      method: "POST",
      body: file
    });
    set_reload(reload+1)
  }

  return html`<div style='text-align:center;'>
    <h1 style='margin-top:0'>µNotebook</h1>
    <table style='margin:0 auto;'>
      <tr><th>Notebook</th><th>Size</th></tr>
      ${files.map(f => html`<tr>
        <td style='padding:.5em 1em;'><a target=${'_'+f.fn} href='/notebook/${f.fn}'><pre>${f.fn}</pre></a></td>
        <td style='color:#444;'>${humanize_bytes(f.size)}</td>
        <td>
          <div style='padding-left:1em; display:inline-flex; gap:.5rem;'>
            <span title='delete ${f.fn}' style='cursor:pointer; color:#888;' onClick=${()=>delete_notebook(f.fn)}>❌</span>
            <span title='download ${f.fn}' style='cursor:pointer; color:#888;' onClick=${()=>download_notebook(f.fn)}>📥</span>
            ${f.running ? html`<span title='stop ${f.fn}' style='cursor:pointer; color:#888;' onClick=${()=>stop_notebook(f.fn)}>◼</span>` : null}
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
