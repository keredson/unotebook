import { h } from 'preact';
import { useState, useEffect, useImperativeHandle, useRef } from 'preact/hooks';
import htm from 'htm';
import { forwardRef } from 'preact/compat';
import snarkdown from 'snarkdown';


const html = htm.bind(h);


export const Cell = forwardRef((props, ref) => {
  const [source, set_source] = useState(props.cell?.source?.join('') || '');
  const [stdout, set_stdout] = useState(null);
  const [error, set_error] = useState(null);
  const [running, set_running] = useState(false);
  const [show_source, set_show_source] = useState(true);
  const [jpeg, set_jpeg] = useState(null);
  const [png, set_png] = useState(null);
  const [html_, set_html] = useState(null);
  const [focused, set_focused] = useState(false);
  const cancelRef = useRef(null);

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
    set_error(null)
    set_png(null)
    set_html(null)
    set_show_source(true)
  }

  function stop() {
    running.abort()
    set_running(false)
    set_error('Aborted')
  }

  function setSourceAndRestoreSelection(nextValue, el, start, end = start) {
    set_source(nextValue);
    // wait for React to paint, then restore
    requestAnimationFrame(() => {
      try { el.setSelectionRange(start, end); } catch (_) {}
    });
  }

  function handleKeyDown(e) {
    const el = e.target;

    // === TAB / SHIFT+TAB ===
    if (e.key === "Tab") {
      e.preventDefault();

      const val   = el.value;
      const start = el.selectionStart;
      const end   = el.selectionEnd;

      if (start === end) {
        // single caret: insert two spaces and move caret after them
        el.setRangeText("  ", start, end, "end");
        const caret = start + 2;
        return setSourceAndRestoreSelection(el.value, el, caret);
      }

      // Compute full-line selection bounds
      const lineStart = val.lastIndexOf("\n", start - 1) + 1;
      const nextNl    = val.indexOf("\n", end);
      const lineEnd   = (nextNl === -1 ? val.length : nextNl);

      const block = val.slice(lineStart, lineEnd);
      const lines = block.split("\n");

      // Precompute absolute start index of each selected line
      const lineStartsAbs = [];
      {
        let idx = lineStart;
        for (let i = 0; i < lines.length; i++) {
          lineStartsAbs.push(idx);
          idx += lines[i].length + 1; // +1 for '\n' (except last line; harmless)
        }
      }

      // Build per-line deltas (how many chars we add/remove at each line start)
      const deltas = new Array(lines.length).fill(0);

      let newBlock;
      if (e.shiftKey) {
        // OUTDENT: remove up to two leading spaces per line
        newBlock = lines.map((ln, i) => {
          const m = ln.match(/^ {1,2}/);
          const remove = m ? m[0].length : 0;
          deltas[i] = -remove;
          return ln.slice(remove);
        }).join("\n");
      } else {
        // INDENT: add two spaces to each line
        newBlock = lines.map((ln, i) => {
          deltas[i] = 2;
          return "  " + ln;
        }).join("\n");
      }

      // Replace the block
      el.setSelectionRange(lineStart, lineEnd);
      el.setRangeText(newBlock, lineStart, lineEnd, "preserve"); // keep caret anchors

      // Adjust original start/end by sum of deltas for all lines whose start precedes the anchor
      const sumDeltasUpTo = (pos) => {
        let sum = 0;
        for (let i = 0; i < lineStartsAbs.length; i++) {
          if (pos > lineStartsAbs[i]) sum += deltas[i];
        }
        return sum;
      };

      const newStart = start + sumDeltasUpTo(start);
      const newEnd   = end   + sumDeltasUpTo(end);

      el.setSelectionRange(newStart, newEnd);

      // update your state if you’re controlling the textarea
      set_source?.(el.value);
      return;
    }

    // Ctrl+Enter run
    if (e.ctrlKey && e.key === "Enter") {
      e.preventDefault();
      run();
      return;
    }

    // --- ENTER: keep indent; +2 spaces if previous line ends with ":" ---
    if (e.key === "Enter") {
      e.preventDefault();
      const start = el.selectionStart;
      const end   = el.selectionEnd;
      const val   = el.value;

      const lineStart = val.lastIndexOf("\n", start - 1) + 1;
      const before    = val.slice(lineStart, start);
      const baseIndent = (before.match(/^[ ]*/) || [""])[0];

      // Python block? last non-space before caret is ":" (ignore trailing spaces/comments)
      const beforeTrim = before.replace(/\s+$/, "");
      const blockLine  = /:\s*(#.*)?$/.test(beforeTrim);

      const extra = blockLine ? "  " : "";     // +2 spaces
      el.setRangeText("\n" + baseIndent + extra, start, end, "end");
      set_source?.(el.value);
      return;
    }

    // --- BACKSPACE at start-of-indent: remove 2 spaces (soft outdent) ---
    if (e.key === "Backspace") {
      const start = el.selectionStart;
      const end   = el.selectionEnd;
      if (start === end) {
        const val   = el.value;
        const lineStart = val.lastIndexOf("\n", start - 1) + 1;
        // caret is within leading spaces?
        const leading = (val.slice(lineStart, start).match(/^[ ]*$/) || [""])[0];
        if (leading.length > 0) {
          e.preventDefault();
          // delete 2 spaces if available, else delete whatever is there
          const remove = Math.min(2, leading.length);
          el.setRangeText("", start - remove, start, "end");
          set_source?.(el.value);
          return;
        }
      }
    }

    // Ctrl+S (save)
    if (e.ctrlKey && e.key === "s") {
      e.preventDefault();
      props.save()
    }
  }

  const append = (s) => set_stdout((prev) => (prev||'') + s);

  async function run() {
    set_stdout(null)
    set_jpeg(null)
    set_png(null)
    set_html(null)
    set_error(null)
    console.log('props.cell?.cell_type', props.cell?.cell_type)
    if (props.cell?.cell_type=='markdown') {
      const html_ = snarkdown(source);
      set_html(html_)
      set_show_source(html_.length == 0)
    }
    else if (props.cell?.cell_type=='code') {
      await run_code()
    }
  }

  async function run_code() {
    if (!props.connected) {
      alert('Not Connected')
      return
    }
    // stop previous stream for this cell (if any)
    cancelRef.current?.();
    // start a new run; keep data in this cell only
    try {
      console.log('props.run_cell',props.run_cell)
      set_running(true)
      await props.run_cell(source, append, { timeoutMs: 10000, newline: true });
    } catch (e) {
      append(`\n⚠️ ${e}\n`);
    } finally {
      set_running(false)
    }
  }

  const stdout_without_repl_prompt = stdout?.endsWith('>>> ') ? stdout.substring(0,stdout.length-4) : stdout
  console.log({stdout_without_repl_prompt})

  return html`<div>
    <div class='add-cell' style='padding-left:1em; display:inline-flex; gap:.4rem; color:#444'>
      <span title="Insert Cell..." style="cursor:pointer;" onClick=${()=>props.insert_before('code')}>+code</span>
      <span title="Insert Cell..." style="cursor:pointer;" onClick=${()=>props.insert_before('markdown')}>+doc</span>
    </div>
    <div style="border-radius: 3px; border-left: 5px solid ${running ? '#df651eff' : '#ded2ba'} !important; padding: .5em; background-color:#f0ebe1;">
      ${show_source ? html`
        <table style='width: 100%;'>
          <tr>
            <td>
              <textarea 
                spellcheck=${false}
                autocapitalize=${'off'}
                autocorrect=${'off'}
                autocomplete=${'off'}
                style="padding: .5em; border:1px solid silver; outline:none; background-color:#f8f6f1; width:calc(100% - 1.5em)"
                placeholder=${placeholder()}
                rows=${source.split('\n').length || 1}
                onInput=${e => {set_source(e.target.value); props.changed()}}
                onKeyDown=${handleKeyDown}
                onFocus=${()=>set_focused(true)}
                onBlur=${()=>set_focused(false)}
              >${source}</textarea>
            </td>
            <td width='4em' valign='top'>
              <div style='opacity:${focused ? 1 : 0}; line-height:1.1'>
                <div style="cursor:pointer; color:#888;" title="Run (Ctrl-Enter)" onClick=${e=>running ? stop() : run()}>${running ? '◼' : '▶'}</div>
                <div style='cursor:pointer; color:#888;' title="Delete Cell" onClick=${()=>props.delete_cell()}>🗙</div>
              </div>
            </td>
          </tr>
        </table>` : null }
      ${stdout_without_repl_prompt ? html`<pre class='output' style='margin:0;'><code>${stdout_without_repl_prompt.trim()}</code></pre>` : null}
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
