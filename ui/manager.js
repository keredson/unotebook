import { useState, useEffect } from 'preact/hooks';
import { h } from 'preact';
import htm from 'htm';
const html = htm.bind(h);


export function Manager() {
  const [files, setFiles] = useState([]);
  useEffect(() => {
    fetch('/files').then(r=>r.json()).then(setFiles);
  }, []);

  function new_notebook() {
    window.open('/notebook/__new__.unb', '_blank')
  }

  return html`<div>
    <h1>µNotebook</h1>
    <p>Notebooks:</p>
    <ul>
      ${files.map(f => html`<li><a target=${'_'+f} href='/notebook/${f}'>${f}</a></li>`)}
      <li><button onClick=${()=>new_notebook()}>New</button></li>
    </ul>
  </div>`;
}


