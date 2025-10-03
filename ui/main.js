import { h, render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import htm from 'htm';
import { Router } from 'preact-router';
import { Notebook } from './notebook.js'

const html = htm.bind(h);


const css = `
  .add-cell {
    opacity: 0;
    font-size: smaller;
  }
  .add-cell:hover {
    opacity: 1;
  }
`;


function Home() {
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



function App() {
  return html`
    <div>
      <style>${css}</style>
      <${Router}>
        <${Home} path="/" />
        <${Notebook} path="/notebook/:fn" />
      <//>
      <div style='margin-top:2em; color: #444; font-size:smaller;'>µNotebook v0.1 - © 2025 Derek Anderson</div>
    </div>
  `;
}



const mount = document.getElementById('app');
mount.textContent = '';
render(html`<${App}/>`, mount);