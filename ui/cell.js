import { h } from 'preact';
import { useState, useEffect, useImperativeHandle } from 'preact/hooks';
import htm from 'htm';
import { forwardRef } from 'preact/compat';
import snarkdown from 'snarkdown';


const html = htm.bind(h);

async function postAndStream(url, payload, onItem, ac) {
  const res = await fetch(url, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(payload),
    signal: ac.signal
  });

  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // NDJSON parse: split at newlines; keep the last partial line
      let nl;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        try {
          const obj = JSON.parse(line);
          onItem(obj);
        } catch (e) {
          console.warn("Bad NDJSON line:", line, e);
        }
      }
    }

    // flush any final buffered complete line (rare)
    const last = buffer.trim();
    if (last) {
      onItem(JSON.parse(last));
    }
  } finally {
    reader.releaseLock?.();
  }
}

export const Cell = forwardRef((props, ref) => {
  const [source, set_source] = useState(props.cell?.source?.join('\n') || '');
  const [stdout, set_stdout] = useState(null);
  const [error, set_error] = useState(null);
  const [running, set_running] = useState(false);
  const [show_source, set_show_source] = useState(true);
  const [jpeg, set_jpeg] = useState(null);
  const [png, set_png] = useState(null);
  const [html_, set_html] = useState(null);
  const [focused, set_focused] = useState(false);

  useImperativeHandle(ref, () => ({
    getValue: () => ({run, source, clear})
  }));

    useEffect(() => {
      if (props.cell?.cell_type=='markdown' && source.length) {
        set_html(snarkdown(source))
        set_show_source(false)
      }
    }, []);

  function placeholder() {
    if (props.cell.cell_type=='code') return 'print("Hello world!")'
    if (props.cell.cell_type=='markdown') return '# Hello world!'
  }

  function clear() {
    set_stdout(null)
    set_jpeg(null)
    set_png(null)
    set_html(null)
    set_show_source(true)
  }

  function stop() {
    running.abort()
    set_running(false)
    set_error('Aborted')
  }

  function run() {
    set_stdout(null)
    set_jpeg(null)
    set_png(null)
    set_html(null)
    console.log('props.cell?.cell_type', props.cell?.cell_type)
    if (props.cell?.cell_type=='markdown') {
      const html_ = snarkdown(source);
      set_html(html_)
      set_show_source(html_.length == 0)
    }
    else if (props.cell?.cell_type=='code') {
      const ac = new AbortController();
      set_running(ac)
      postAndStream('/run_cell', {source:source.split('\n'), fn:props.fn}, resp => {
        if (typeof resp === "string") {
          set_stdout(prev => (prev || "") + resp)
        }
        if (resp['image/jpeg']) {
          set_jpeg('data:image/jpeg;base64,'+resp['image/jpeg'])
        }
        if (resp['image/png']) {
          set_png('data:image/png;base64,'+resp['image/png'])
        }
      }, ac).then(() => set_running(false))
    }
  }
  return html`<div>
    <div class='add-cell' style='padding-left:1em; display:inline-flex; gap:.4rem; color:#444'>
      <span title="Insert Cell..." style="cursor:pointer;" onClick=${()=>props.insert_before('code')}>+code</span>
      <span title="Insert Cell..." style="cursor:pointer;" onClick=${()=>props.insert_before('markdown')}>+markdown</span>
    </div>
    <div style="border-radius: 3px; border-left: 5px solid #ded2ba !important; padding: .5em; background-color:#f0ebe1;">
      ${show_source ? html`
        <table style='width: 100%;'>
          <tr>
            <td>
              <textarea 
                style="padding: .5em; border:1px solid silver; outline:none; background-color:#f8f6f1; width:100%"
                placeholder=${props.idx==0 ? placeholder() : null}
                rows=${source.split('\n').length || 1}
                onInput=${e => set_source(e.target.value)}
                onKeyDown=${e => {
                  if (e.ctrlKey && e.key === "Enter") {
                    e.preventDefault();
                    run()
                  }
                }}
                onFocus=${()=>set_focused(true)}
                onBlur=${()=>set_focused(false)}
              >${source}</textarea>
            </td>
            <td width='4em' valign='top'>
              <div style='margin-left:.1em; opacity:${focused ? 1 : 0}'>
                <span style="cursor:pointer; color:#888;" title="Run (Ctrl-Enter)" onClick=${e=>running ? stop() : run()}>${running ? '◼' : '▶'}</span>
                <br/>
                <span style='cursor:pointer; color:#888;' onClick=${()=>props.delete_cell()}>❌</span>
              </div>
            </td>
          </tr>
        </table>` : null }
      ${stdout ? html`<pre class='output' style='margin:0;'><code>${stdout}</code></pre>` : null}
      ${jpeg ? html`<img class='output' src=${jpeg} />` : null}
      ${png ? html`<img class='output' src=${png} />` : null}
      ${html_ ? html`<div style='display:flex; alignItems:top;' class='markdown'>
        <div style='display:inline-block;' dangerouslySetInnerHTML=${{ __html: html_ }} />
        <span style='margin-left:1em; cursor:pointer;' onClick=${()=>set_show_source(true)}>📝</span>
      </div>` : null}
      ${error ? html`<pre class='output' style='margin:0; background-color:#ffdddd;'><code>${error}</code></pre>` : null}
    </div>
  </div>`;
})
