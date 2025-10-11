import { h } from 'preact';
import { useState, useEffect, useImperativeHandle, useRef, useMemo } from 'preact/hooks';
import htm from 'htm';
import { forwardRef } from 'preact/compat';
import snarkdown from 'snarkdown';
import { render_ansi } from './render_ansi.js'
import { FULL_TOOLBOX, loadBlockly } from './blockly_util.js'



const html = htm.bind(h);


export const Cell = forwardRef((props, ref) => {
  const blockly_id = useMemo(() => 'blockly-'+Math.random().toString(36).slice(2, 9), []);
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
  const cellRef = useRef(null);
  const [blocklyVisible, set_blocklyVisible] = useState(false);
  const blocklyStateRef = useRef(props.cell?.metadata?.blockly?.state || null);
  const blocklyContextRef = useRef(null);
  const [cellMetadata, set_cellMetadata] = useState(() => props.cell?.metadata ? {...props.cell.metadata} : {});

  const is_blockly = Boolean(cellMetadata?.blockly);
  const blocklyOverlayStyles = blocklyVisible ? html`<style>
    .blockly-modal__header {
      display: flex;
      justify-content: flex-end;
      padding: 0.6rem 0.9rem;
      background: #f5f5f5;
      border-bottom: 1px solid #ddd;
      z-index: 1;
    }
    .blockly-modal__close {
    }
  </style>` : null;

  useImperativeHandle(ref, () => ({
    getValue: () => {
      if (cellMetadata?.blockly && blocklyContextRef.current?.workspace) {
        try {
          blocklyStateRef.current = blocklyContextRef.current.Blockly.serialization.workspaces.save(
            blocklyContextRef.current.workspace
          );
        } catch (err) {
          console.error('Failed to snapshot Blockly workspace', err);
        }
      }

      let metadata = cellMetadata;
      if (metadata?.blockly) {
        const nextState = blocklyStateRef.current ?? metadata.blockly.state;
        const nextBlockly = {
          ...metadata.blockly,
          version: metadata.blockly.version ?? 1,
        };
        if (nextState !== undefined && nextState !== null) {
          nextBlockly.state = nextState;
        } else {
          delete nextBlockly.state;
        }
        metadata = {
          ...metadata,
          blockly: nextBlockly,
        };
      }
      const cell = {...props.cell, metadata};
      return ({run, cell, source, clear});
    }
  }));

    useEffect(() => {
      const meta = props.cell?.metadata ? {...props.cell.metadata} : {};
      if (meta.blockly) {
        meta.blockly = {
          ...meta.blockly,
          version: meta.blockly.version ?? 1,
        };
      }
      set_cellMetadata(meta);
      blocklyStateRef.current = meta.blockly?.state || null;
    }, [props.cell?.id]);

    useEffect(() => {
      if (props.cell?.cell_type=='markdown' && source.length) {
        set_html(snarkdown(source))
        set_show_source(false)
      }
    }, []);

    useEffect(() => {
      if (!is_blockly || !blocklyVisible) return;

      let cancelled = false;

      (async () => {
        const { Blockly, pythonGenerator } = await loadBlockly();
        if (cancelled) return;

        const workspace = Blockly.inject(blockly_id, {
          toolbox: FULL_TOOLBOX,
          renderer: 'thrasos',
          trashcan: true,
        });

        let initializing = true;

        const changeListener = () => {
          const code = pythonGenerator.workspaceToCode(workspace).trim();
          set_source(code);
          if (!initializing) props.changed?.();
          try {
            blocklyStateRef.current = Blockly.serialization.workspaces.save(workspace);
          } catch (err) {
            console.error('Failed to serialize Blockly workspace', err);
          }
        };

        workspace.addChangeListener(changeListener);

        if (blocklyStateRef.current) {
          try {
            Blockly.serialization.workspaces.load(blocklyStateRef.current, workspace);
          } catch (err) {
            console.error('Failed to restore Blockly workspace', err);
          }
          const restored = pythonGenerator.workspaceToCode(workspace);
          set_source(restored.trim());
        } else {
          changeListener();
        }

        initializing = false;

        const resizeWorkspace = () => {
          Blockly.svgResize(workspace);
        };

        const scheduleInitialLayout = () => {
          if (cancelled) return;
          Blockly.svgResize(workspace);
          workspace.scrollCenter();
        };

        window.addEventListener('resize', resizeWorkspace);
        requestAnimationFrame(scheduleInitialLayout);

        blocklyContextRef.current = {
          workspace,
          Blockly,
          pythonGenerator,
          changeListener,
          resizeWorkspace,
        };
      })();

      return () => {
        cancelled = true;
        const ctx = blocklyContextRef.current;
        if (ctx?.workspace) {
          window.removeEventListener('resize', ctx.resizeWorkspace);
          ctx.workspace.removeChangeListener(ctx.changeListener);
          ctx.workspace.dispose();
          blocklyContextRef.current = null;
        }
      };
    }, [is_blockly, blocklyVisible, blockly_id]);

    useEffect(() => {
      if (!props.connected) {
        set_running(false)
      }
    }, [props.connected]);

  function placeholder() {
    if (is_blockly) return '# click 🖉 to edit  -->'
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

  async function stop() {
    set_error(await props.backend.abort())
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

  function openBlockly() {
    set_blocklyVisible(true);
  }

  function closeBlockly() {
    const ctx = blocklyContextRef.current;
    if (ctx?.workspace) {
      const { workspace, pythonGenerator, Blockly, changeListener, resizeWorkspace } = ctx;
      const code = pythonGenerator.workspaceToCode(workspace).trim();
      set_source(code);
      props.changed?.();
      try {
        blocklyStateRef.current = Blockly.serialization.workspaces.save(workspace);
      } catch (err) {
        console.error('Failed to serialize Blockly workspace', err);
        blocklyStateRef.current = null;
      }
      set_cellMetadata(prev => {
        const next = prev ? {...prev} : {};
        const current = next.blockly || {};
        const blocklyMeta = {
          ...current,
          version: current.version ?? 1,
        };
        if (blocklyStateRef.current !== undefined && blocklyStateRef.current !== null) {
          blocklyMeta.state = blocklyStateRef.current;
        } else {
          delete blocklyMeta.state;
        }
        next.blockly = blocklyMeta;
        return next;
      });
      window.removeEventListener('resize', resizeWorkspace);
      workspace.removeChangeListener(changeListener);
      workspace.dispose();
      blocklyContextRef.current = null;
    }
    set_blocklyVisible(false);
  }

  const blocklyOverlay = blocklyVisible ? html`
    ${blocklyOverlayStyles}
    <div style=${{
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      background: 'rgba(0, 0, 0, 0.6)',
      zIndex: 2000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style=${{
        position: 'relative',
        width: '90vw',
        height: '90vh',
        background: '#fff',
        borderRadius: '6px',
        boxShadow: '0 4px 18px rgba(0, 0, 0, 0.35)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div class='blockly-modal__header'>
          <button class='blockly-modal__close' onClick=${closeBlockly}>✕ Close</button>
        </div>
        <div id=${blockly_id} style=${{ flex: '1', minHeight: 0, position: 'relative' }}></div>
      </div>
    </div>
  ` : null;

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
      throw new Error("Not Connected")
    }
    scrollIntoViewIfNeeded(cellRef.current)
    
    // stop previous stream for this cell (if any)
    cancelRef.current?.();
    // start a new run; keep data in this cell only
    try {
      console.log('props.run_cell',props.run_cell)
      set_running(true)
      await props.run_cell(source, set_stdout, { timeoutMs: 10000, newline: true });
    } catch (e) {
      set_error(`⚠️ ${e}`);
    } finally {
      set_running(false)
    }
  }

  return html`<div>
    <div ref=${cellRef} class='add-cell' style='padding-left:1em; display:inline-flex; gap:.4rem; color:#444'>
      <span title="Insert Code..." style="cursor:pointer;" onClick=${()=>props.insert_before('code')}>+code</span>
      <span title="Insert Blockly..." style="cursor:pointer;" onClick=${()=>props.insert_before('blockly')}>+blockly</span>
      <span title="Insert Documentation..." style="cursor:pointer;" onClick=${()=>props.insert_before('markdown')}>+doc</span>
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
                value=${source}
                onInput=${e => {set_source(e.target.value); if (!is_blockly) props.changed()}}
                onKeyDown=${handleKeyDown}
                onFocus=${()=>set_focused(true)}
                onBlur=${()=>set_focused(false)}
                readOnly=${is_blockly}
              />
            </td>
            <td width='4em' valign='top'>
              <div style='opacity:${is_blockly || focused ? 1 : 0}; line-height:1.1'>
                <div style="cursor:pointer; color:#888;" title="Run (Ctrl-Enter)" onClick=${e=>running ? stop() : run()}>${running ? '◼' : '▶'}</div>
                ${is_blockly ? html`<div style='cursor:pointer; color:#888;' title="Delete Cell" onClick=${openBlockly}>🖉</div>` : null }
                <div style='cursor:pointer; color:#888;' title="Delete Cell" onClick=${()=>props.delete_cell()}>🗙</div>
              </div>
            </td>
          </tr>
        </table>` : null }
      ${stdout ? html`<pre class='output' style='margin:0;'><code>${render_ansi(stdout)}</code></pre>` : null}
      ${jpeg ? html`<img class='output' src=${jpeg} />` : null}
      ${png ? html`<img class='output' src=${png} />` : null}
      ${html_ ? html`<div style='display:flex; alignItems:top;' class='markdown'>
        <div style='display:inline-block;' dangerouslySetInnerHTML=${{ __html: html_ }} />
        <span style='margin-left:1em; cursor:pointer;' onClick=${()=>set_show_source(true)}>📝</span>
      </div>` : null}
      ${error ? html`<pre class='output' style='margin:0; background-color:#ffdddd;'><code>${error}</code></pre>` : null}
    </div>
    ${blocklyOverlay}
  </div>`;
})


function scrollIntoViewIfNeeded(el, options = { behavior: 'smooth', block: 'center' }) {
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const viewHeight = window.innerHeight || document.documentElement.clientHeight;
  const isVisible = rect.top >= 0 && rect.bottom <= viewHeight;
  if (!isVisible) {
    el.scrollIntoView(options);
  }
}
