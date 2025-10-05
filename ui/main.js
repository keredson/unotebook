import { h, render } from 'preact';
import htm from 'htm';
import { Router } from 'preact-router';
import { Notebook } from './notebook.js'
import { Manager } from './manager.js'
import { useState, useEffect } from 'preact/hooks';

const html = htm.bind(h);


const css = `
  .add-cell {
    opacity: 0;
    font-size: smaller;
  }
  .add-cell:hover {
    opacity: 1;
  }
  .markdown h1 {
    margin-top: 0;
  }
  body {
    font-size: 16px;
    line-height: 1.65;
    margin-left: auto;
    margin-right: auto;
    max-width: 800px;
    min-height: 0;
    height: auto;
    font-family: system-ui, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif;
  }
  body > #app {
    margin-top: 1em;
    background-color: #f4f0e8;
    padding:2em;
    box-shadow: 0px 2px 8px rgba(0, 0, 0, 0.3);
    margin: 1em;
  }
  html {
    background-color: #ddd;
  }
  .output {
    padding: 8px;
    display: block;
    font-size:smaller;
    line-height: 1.1em;
  }
`;

const getHashPath = () => {
  const p = location.hash.replace(/^#/, '');
  return p && p.startsWith('/') ? p : '/';
};


function App() {
  console.log('window.__unotebook_version__', window.__unotebook_version__)

  const [url, setUrl] = useState(getHashPath());

  useEffect(() => {
    const onHash = () => {
      const next = getHashPath();
      // avoid no-op setState (helps some reconciliation cases)
      setUrl(u => (u === next ? u : next));
    };
    window.addEventListener('hashchange', onHash);
    // ensure first paint matches current bar (important on hard reload)
    onHash();
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return html`
    <div>
      <style>${css}</style>
      <${Router} url=${url} key=${url} onChange=${e => console.log('url:', e.url)}>
        <${Manager} path="/" />
        <${Notebook} path="/:fn" />
      <//>
      <div style='text-align:center; margin-top:2em; color: #444; font-size:smaller;'><a style='color: #444;' href='https://github.com/keredson/unotebook' target='_unotebook_github'>µNotebook</a> v${window.__unotebook_version__} - © 2025 Derek Anderson</div>
    </div>
  `;
}



const mount = document.getElementById('app');
mount.textContent = '';
render(html`<${App}/>`, mount);