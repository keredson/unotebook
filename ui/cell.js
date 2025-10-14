import { h } from 'preact';
import { useState, useEffect, useImperativeHandle, useRef, useMemo, useCallback, useLayoutEffect } from 'preact/hooks';
import htm from 'htm';
import { forwardRef } from 'preact/compat';
import snarkdown from 'snarkdown';
import { render_ansi } from './render_ansi.js'
import { FULL_TOOLBOX, loadBlockly, BLOCKLY_CSS } from './blockly_util.js'
import { highlightPython } from './prism-lite.js';
import { AlertTriangle, FileText, Play, Square, Trash2, X as XIcon } from 'react-feather';

const registeredNotebookFunctionBlocks = new Set();

const BORDER_COLORS = {
  idle: '#ded2ba',
  running: '#d9a441',
  success: '#6f9b7a',
  error: '#df651e',
};

function extractNotebookSymbols(codeSnippets) {
  const variableNames = new Set();
  const functionMap = new Map();
  const defRegex = /^def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*:/;
  const assignRegex = /^([A-Za-z_][A-Za-z0-9_]*)\s*(?::[^=]+)?=\s*(?![=])/;

  for (const snippet of codeSnippets || []) {
    if (!snippet) continue;
    const lines = snippet.split('\n');
    for (const line of lines) {
      if (!line) continue;
      if (/^\s/.test(line)) continue; // ignore indented lines
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      if (trimmed.startsWith('def ')) {
        const match = defRegex.exec(trimmed);
        if (match) {
          const [, name, paramSection] = match;
          const params = paramSection
            .split(',')
            .map(p => p.trim())
            .filter(Boolean)
            .map(p => p.replace(/=.*/, '').replace(/:.*/, '').replace(/^\*+/, '').trim())
            .filter(Boolean);
          functionMap.set(name, { name, params });
        }
        continue;
      }

      const assignMatch = assignRegex.exec(trimmed);
      if (assignMatch) {
        variableNames.add(assignMatch[1]);
      }
    }
  }

  return { variables: Array.from(variableNames).sort(), functions: Array.from(functionMap.values()) };
}

function sanitizeFunctionName(name) {
  return name.replace(/[^A-Za-z0-9_]/g, '_');
}

function registerNotebookFunctionBlocks(Blockly, pythonGenerator, functions) {
  const registered = [];
  if (!functions || !functions.length) return registered;

  functions.forEach((fn, index) => {
    const safeName = sanitizeFunctionName(fn.name || `func_${index}`);
    const signatureKey = `${safeName}_${fn.params.length}_${index}`;
    const stmtType = `notebook_call_${signatureKey}_stmt`;
    const exprType = `notebook_call_${signatureKey}_expr`;

    const params = fn.params || [];
    const tooltip = params.length ? `${fn.name}(${params.join(', ')})` : `${fn.name}()`;

    if (!registeredNotebookFunctionBlocks.has(stmtType)) {
      Blockly.Blocks[stmtType] = {
        init() {
          this.setStyle('procedure_blocks');
          this.setPreviousStatement(true);
          this.setNextStatement(true);
          this.setInputsInline(true);
          if (params.length === 0) {
            this.appendDummyInput('HEADER').appendField(`call ${fn.name}()`);
          } else {
            this.appendDummyInput('HEADER').appendField(`call ${fn.name}(`);
            params.forEach((param, idx) => {
              const input = this.appendValueInput(`ARG${idx}`).setCheck(null);
              const suffix = idx === params.length - 1 ? ')' : ',';
              input.appendField(`${param}${suffix}`);
            });
          }
          this.setTooltip(`Call ${tooltip}`);
        }
      };

      pythonGenerator.forBlock[stmtType] = function(block, generator) {
        const args = params.map((param, idx) => generator.valueToCode(block, `ARG${idx}`, pythonGenerator.ORDER_NONE) || 'None');
        const code = `${fn.name}(${args.join(', ')})\n`;
        return code;
      };

      registeredNotebookFunctionBlocks.add(stmtType);
    }

    if (!registeredNotebookFunctionBlocks.has(exprType)) {
      Blockly.Blocks[exprType] = {
        init() {
          this.setStyle('procedure_blocks');
          this.setOutput(true, null);
          this.setInputsInline(true);
          if (params.length === 0) {
            this.appendDummyInput('HEADER').appendField(`${fn.name}()`);
          } else {
            this.appendDummyInput('HEADER').appendField(`${fn.name}(`);
            params.forEach((param, idx) => {
              const input = this.appendValueInput(`ARG${idx}`).setCheck(null);
              const suffix = idx === params.length - 1 ? ')' : ',';
              input.appendField(`${param}${suffix}`);
            });
          }
          this.setTooltip(`Return value of ${tooltip}`);
        }
      };

      pythonGenerator.forBlock[exprType] = function(block, generator) {
        const args = params.map((param, idx) => generator.valueToCode(block, `ARG${idx}`, pythonGenerator.ORDER_NONE) || 'None');
        const code = `${fn.name}(${args.join(', ')})`;
        return [code, pythonGenerator.ORDER_FUNCTION_CALL];
      };

      registeredNotebookFunctionBlocks.add(exprType);
    }

    registered.push({ stmtType, exprType });
  });

  return registered;
}

function createFunctionFlyoutItems(functionBlocks) {
  if (!functionBlocks || !functionBlocks.length) return [];
  const items = [];
  functionBlocks.forEach(({ stmtType, exprType }) => {
    items.push({ kind: 'block', type: stmtType });
    items.push({ kind: 'block', type: exprType });
  });
  return items;
}

function ensureNotebookVariables(workspace, variableNames) {
  if (!variableNames || !variableNames.length) return;
  const existing = new Set((workspace.getAllVariables() || []).map(v => v.name));
  let added = false;
  variableNames.forEach(name => {
    if (name && !existing.has(name)) {
      workspace.createVariable(name);
      added = true;
    }
  });
  if (added) {
    if (workspace.refreshToolboxSelection) {
      workspace.refreshToolboxSelection();
    } else if (workspace.toolbox_?.refreshSelection) {
      workspace.toolbox_.refreshSelection();
    }
  }
}



const html = htm.bind(h);


export const Cell = forwardRef((props, ref) => {
  const blockly_id = useMemo(() => 'blockly-'+Math.random().toString(36).slice(2, 9), []);
  const [source, set_source] = useState(props.cell?.source?.join('') || '');
  const [stdout, set_stdout] = useState(null);
  const [richOutput, set_richOutput] = useState(null);
  const [error, set_error] = useState(null);
  const [runState, set_runState] = useState('idle');
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
  const textareaRef = useRef(null);
  const previewRef = useRef(null);

  const is_blockly = Boolean(cellMetadata?.blockly);
  const highlightedSource = useMemo(() => highlightPython(source || ''), [source]);
  const lineCount = useMemo(
    () => Math.max(1, (source.match(/\n/g)?.length ?? 0)),
    [source]
  );
  const editorHeight = useMemo(() => `${(lineCount+1) * 1.2}em`, [lineCount]);
  const textEditorHeight = useMemo(() => `${(lineCount+2) * 1.2}em`, [lineCount]);
  const borderColor = BORDER_COLORS[runState] || BORDER_COLORS.idle;
  const isRunning = runState === 'running';
  const actionButtonStyle = 'background:none; border:none; padding:0; margin:0; display:inline-flex; align-items:center; color:#888; cursor:pointer;';
  const handleStdout = useCallback((value) => {
    set_stdout(value);
    if (typeof value === 'string') {
      if (value.includes('Traceback (most recent call last)')) {
        set_runState('error');
      } else {
        try {
          const lines = value.trimEnd().split('\n');
          const last = lines[lines.length - 1];
          const parsed = JSON.parse(last);
          if (parsed && parsed.__unotebook_repr__) {
            set_richOutput(parsed.__unotebook_repr__);
            //const remaining = lines.slice(0, -1).join('\n');
            //set_stdout(remaining ? `${remaining}\n` : '');
            return;
          }
        } catch (err) {
          // ignore parse errors
          set_richOutput(null);
        }
      }
    } else {
      set_richOutput(null);
    }
  }, []);

  useLayoutEffect(() => {
    if (is_blockly || !show_source) return;
    const textarea = textareaRef.current;
    const preview = previewRef.current;
    if (!textarea || !preview) return;
    const syncScroll = () => {
      const x = textarea.scrollLeft || 0;
      preview.scrollLeft = x;
    };
    syncScroll();
    textarea.addEventListener('scroll', syncScroll);
    return () => textarea.removeEventListener('scroll', syncScroll);
  }, [show_source, is_blockly]);

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
        const codeContext = props.getNotebookContext ? props.getNotebookContext(props.idx) : [];
        const symbolInfo = extractNotebookSymbols(codeContext);

        const { Blockly, pythonGenerator, theme } = await loadBlockly();
        if (cancelled) return;

        const workspace = Blockly.inject(blockly_id, {
          toolbox: FULL_TOOLBOX,
          renderer: 'thrasos',
          trashcan: true,
          theme: theme || undefined,
        });

        const functionBlocks = registerNotebookFunctionBlocks(Blockly, pythonGenerator, symbolInfo.functions);

        const origInit = pythonGenerator.init;
        pythonGenerator.init = function (workspace) {
          origInit.call(this, workspace);
          // Remove Blockly’s automatic "var = None" pre-declarations
          if (this.definitions_) {
            delete this.definitions_.variables;          // common key
          }
        };

        const defaultProcedureCallback = workspace.getToolboxCategoryCallback
          ? workspace.getToolboxCategoryCallback('PROCEDURE')
          : (Blockly.Procedures && Blockly.Procedures.flyoutCategory) ? Blockly.Procedures.flyoutCategory : null;

        workspace.registerToolboxCategoryCallback('PROCEDURE', (ws) => {
          const original = defaultProcedureCallback ? defaultProcedureCallback(ws) : [];
          const extras = createFunctionFlyoutItems(functionBlocks);
          return original.concat(extras);
        });
        ensureNotebookVariables(workspace, symbolInfo.variables);

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
          ensureNotebookVariables(workspace, symbolInfo.variables);
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
    }, [is_blockly, blocklyVisible, blockly_id, props.getNotebookContext, props.idx]);

    useEffect(() => {
      if (!props.connected && runState === 'running') {
        set_runState('idle');
      }
    }, [props.connected, runState]);

  function placeholder() {
    if (is_blockly) return '# click the edit button to modify  -->'
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
    set_runState('idle')
  }

  async function stop() {
    set_error(await props.backend.abort())
    set_runState('error')
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
    ${ is_blockly ? BLOCKLY_CSS : null}
    <div class='blockly-modal__overlay'>
      <div class='blockly-modal__content'>
        <div class='blockly-modal__header'>
          <button class='blockly-modal__close' onClick=${closeBlockly} style='display:inline-flex; align-items:center; gap:0.3rem;'>
            <${XIcon} size=${14} aria-hidden=${true} />
            Close
          </button>
        </div>
        <div id=${blockly_id} style=${{ flex: '1', minHeight: 0, position: 'relative' }}></div>
      </div>
    </div>
  ` : null;

  async function run() {
    set_stdout(null)
    set_richOutput(null)
    set_jpeg(null)
    set_png(null)
    set_html(null)
    set_error(null)
    if (props.cell?.cell_type === 'code') {
      set_runState('running');
    }
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
    set_runState('running');
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
      await props.run_cell(source, handleStdout, { timeoutMs: 10000, newline: true });
      set_runState(prev => (prev === 'error' ? 'error' : 'success'));
    } catch (e) {
      set_error(e instanceof Error ? e.message : String(e));
      set_runState('error');
    }
  }

  return html`<div>
    <div ref=${cellRef} class='add-cell' style='padding-left:1em; display:inline-flex; gap:.4rem; color:#444'>
      <span title="Insert Code..." style="cursor:pointer;" onClick=${()=>props.insert_before('code')}>+code</span>
      <span title="Insert Blockly..." style="cursor:pointer;" onClick=${()=>props.insert_before('blockly')}>+blocks</span>
      <span title="Insert Documentation..." style="cursor:pointer;" onClick=${()=>props.insert_before('markdown')}>+doc</span>
    </div>
    <div style="border-radius: 3px; border-left: 5px solid ${borderColor} !important; padding: .5em; background-color:#f0ebe1;">
      ${show_source ? html`
        <div style='display:flex; gap:.5rem; align-items:flex-start;'>
          <div style='flex:1; min-width:0; position:relative;'>
            ${is_blockly ? html`
              <div style='position:relative;'>
                <button
                  type='button'
                  title="Edit Blocks"
                  aria-label="Edit Blocks"
                  style='position:absolute; top:0.5rem; right:0.5rem; z-index:1;'
                  onClick=${openBlockly}>
                  Edit
                </button>
                <pre class='blockly-python language-python' style=${{ width: '100%', boxSizing: 'border-box', minHeight: editorHeight, paddingRight: '3.5rem' }}>
                  <code class='language-python' dangerouslySetInnerHTML=${{ __html: highlightedSource || '&nbsp;' }}></code>
                </pre>
              </div>
            ` : html`
              <div class='code-editor' style=${{ minHeight: editorHeight }}>
                <pre
                  ref=${previewRef}
                  class='blockly-python language-python code-editor__preview'
                  style=${{ height: editorHeight, overflow: 'hidden' }}
                >
                  <code class='language-python' dangerouslySetInnerHTML=${{ __html: highlightedSource || '&nbsp;' }}></code>
                </pre>
                <textarea 
                  wrap="off"
                  ref=${textareaRef}
                  style=${{ height: textEditorHeight }}
                  class='python-textarea code-editor__textarea'
                  spellcheck=${false}
                  autocapitalize=${'off'}
                  autocorrect=${'off'}
                  autocomplete=${'off'}
                  placeholder=${placeholder()}
                  value=${source}
                  onInput=${e => {set_source(e.target.value); if (!is_blockly) props.changed()}}
                  onKeyDown=${handleKeyDown}
                  onFocus=${()=>set_focused(true)}
                  onBlur=${()=>set_focused(false)}
                />
              </div>
            `}
          </div>
          <div style='flex:0 0 auto;'>
            <div style='line-height:1.2; display:flex; flex-direction:column; align-items:center; gap:0.8rem;'>
              <button
                type='button'
                style=${actionButtonStyle}
                title=${isRunning ? 'Stop (Ctrl-Enter)' : 'Run (Ctrl-Enter)'}
                aria-label=${isRunning ? 'Stop (Ctrl-Enter)' : 'Run (Ctrl-Enter)'}
                onClick=${()=>isRunning ? stop() : run()}>
                ${isRunning
                  ? html`<${Square} size=${24} aria-hidden=${true} />`
                  : html`<${Play} size=${24} aria-hidden=${true} />`}
              </button>
              <button
                type='button'
                style=${actionButtonStyle}
                title="Delete Cell"
                aria-label="Delete Cell"
                onClick=${()=>props.delete_cell()}>
                <${Trash2} size=${16} aria-hidden=${true} />
              </button>
            </div>
          </div>
        </div>` : null }
      ${stdout ? html`<pre class='output' style='margin:0;'><code>${render_ansi(strip_repr(stdout))}</code></pre>` : null}
      ${richOutput ? html`
        <div class='output' style='margin:0; padding-top:0;'>
          ${renderRichOutput(richOutput)}
        </div>
      ` : null}
      ${jpeg ? html`<img class='output' src=${jpeg} />` : null}
      ${png ? html`<img class='output' src=${png} />` : null}
      ${html_ ? html`<div style='display:flex; alignItems:top;' class='markdown'>
        <div style='display:inline-block;' dangerouslySetInnerHTML=${{ __html: html_ }} />
        <button
          type='button'
          style='margin-left:1em; background:none; border:none; padding:0; display:inline-flex; align-items:center; color:#888; cursor:pointer;'
          title="Show Source"
          aria-label="Show Source"
          onClick=${()=>set_show_source(true)}>
          <${FileText} size=${16} aria-hidden=${true} />
        </button>
      </div>` : null}
      ${error ? html`<div class='output' style='margin:0; background-color:#ffdddd; display:flex; gap:0.5rem; align-items:flex-start;'>
        <span style='flex:0 0 auto; margin-top:0.15em;'><${AlertTriangle} size=${16} aria-hidden=${true} /></span>
        <code style='white-space:pre-wrap;'>${error}</code>
      </div>` : null}
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

function renderRichOutput(bundle) {
  if (!bundle || typeof bundle !== 'object') return null;

  if (bundle['text/html']) {
    return html`<div dangerouslySetInnerHTML=${{ __html: bundle['text/html'] }} />`;
  }

  if (bundle['image/png']) {
    return html`<img src=${`data:image/png;base64,${bundle['image/png']}`} />`;
  }

  if (bundle['image/jpeg']) {
    return html`<img src=${`data:image/jpeg;base64,${bundle['image/jpeg']}`} />`;
  }

  if (bundle['text/plain']) {
    return html`<pre style='margin:0;'><code>${bundle['text/plain']}</code></pre>`;
  }

  const first = Object.keys(bundle)[0];
  if (!first) return null;
  return html`<pre style='margin:0;'><code>${bundle[first]}</code></pre>`;
}


function strip_repr(s) {
  var lines = s.trimEnd().split('\n');
  const last = lines[lines.length - 1];
  try {
  const parsed = JSON.parse(last);
    if (parsed && parsed.__unotebook_repr__) {
      lines.pop()
    }
  } catch(err) {
    // not json
  }
  return lines.join('\n')
}
