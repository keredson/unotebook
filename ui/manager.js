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

  return html`<div>
    <h1>µNotebook</h1>
    <table style='margin-left:1em;'>
      <tr><th>Notebook</th><th>Size</th></tr>
      ${files.map(f => html`<tr>
        <td><a target=${'_'+f.fn} href='/notebook/${f.fn}'>${rstrip(f.fn, '.unb')}</a></td>
        <td style='color:#444;'>${humanize_bytes(f.size)}</td>
        <td style='padding-left:1em;'>
          <span style='cursor:pointer; color:#888;' onClick=${()=>delete_notebook(f.fn)}>❌</span>
        </td>
      </tr>`)}
      <tr><td><button style='margin-top:.5em' onClick=${()=>new_notebook()}>New Notebook...</button></td></tr>
    </table>
  </div>`;
}

function humanize_bytes(n) {
  if (n === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const k = 1024;
  const i = Math.floor(Math.log(n) / Math.log(k));
  const value = n / Math.pow(k, i);
  return value.toFixed(value < 10 && i > 0 ? 1 : 0) + " " + units[i];
}

function rstrip(str, suffix) {
  return str.endsWith(suffix) ? str.slice(0, -suffix.length) : str;
}
