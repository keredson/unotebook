import { h, render } from 'preact';
import htm from 'htm';
import { Router } from 'preact-router';
import { Notebook } from './notebook.js'
import { Manager } from './manager.js'

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



function App() {
  console.log('window.__unotebook_version__', window.__unotebook_version__)
  return html`
    <div>
      <style>${css}</style>
      <${Router}>
        <${Manager} path="/" />
        <${Notebook} path="/notebook/:fn" />
      <//>
      <div style='margin-top:2em; color: #444; font-size:smaller;'><a style='color: #444;' href='https://github.com/keredson/unotebook' target='_unotebook_github'>µNotebook</a> v${window.__unotebook_version__} - © 2025 Derek Anderson</div>
    </div>
  `;
}



const mount = document.getElementById('app');
mount.textContent = '';
render(html`<${App}/>`, mount);