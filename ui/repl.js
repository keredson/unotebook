/**
 * Cleave off the last line only if it's a standalone statement.
 * Returns { head, tail }.
 */
export function cleaveLastStatement(src) {
  const lines = src.trimEnd().replace(/\r\n?/g, "\n").split("\n");
  if (lines.length === 0) return { head: "", tail: "" };

  let inStr = false, quote = "", escape = false;
  let depth = 0; // (), [], {}

  const body = lines.slice(0, -1).join("\n");
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inStr) {
      if (!escape && ch === quote) inStr = false;
      escape = !escape && ch === "\\";
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = true; quote = ch; escape = false;
      continue;
    }
    if ("([{".includes(ch)) depth++;
    if (")]}".includes(ch)) depth = Math.max(0, depth - 1);
  }

  const lastLine = lines[lines.length - 1];
  const openBlock = /:\s*(#.*)?$/.test(lastLine);
  const continued = /\\\s*(#.*)?$/.test(lastLine);

  // check indentation
  const lastIndent = lastLine.match(/^\s*/)[0].length;
  const prevNonEmpty = [...lines]
    .reverse()
    .find(l => l.trim().length > 0 && l !== lastLine);
  const prevIndent = prevNonEmpty ? prevNonEmpty.match(/^\s*/)[0].length : 0;

  const indented = lastIndent > prevIndent;

  const canSplit =
    depth === 0 &&
    !inStr &&
    !openBlock &&
    !continued &&
    !indented;

  return canSplit
    ? { head: lines.slice(0, -1).join("\n"), tail: lastLine }
    : { head: src, tail: "" };
}


/**
 * Return true iff `line` is a self-contained *expression* line
 * that is safe to assign via `_ = <expr>`.
 *
 * Disqualifies:
 *   - blank / comment-only
 *   - open strings or unbalanced brackets
 *   - lines ending with ':' or line continuation '\' 
 *   - statement keywords: import, from, pass, break, continue, return, raise,
 *     assert, del, global, nonlocal, class, def, with, async def/for/with,
 *     for, while, if, try, except, finally, match, case, @decorator
 *   - assignment statements (a=1, a+=1, etc). (Allows walrus `:=`.)
 *   - top-level 'yield' or 'await' (unsafe outside proper contexts)
 */
export function is_safe_to_assign_to_var(line) {
  if (line == null) return false;
  const src = line.replace(/\r\n?$/, "");
  const trimmed = src.trim();
  if (!trimmed) return false;                 // empty
  if (trimmed.startsWith("#")) return false;  // pure comment
  if (/\\\s*$/.test(src)) return false;       // continuation
  if (/:$/.test(trimmed)) return false;       // block header

  // Quick decorator check
  if (/^\s*@/.test(src)) return false;

  // Scan while tracking strings, comments, and bracket depth
  let inStr = false, q = "", triple = false, esc = false, depth = 0;
  let sawComment = false;

  // Helpers to detect tokens outside strings/brackets
  const badKeyword = (kw) => new RegExp(`(^|\\b)${kw}(\\b|$)`);
  const opener = new Set(["(", "[", "{"]);
  const closer = new Set([")", "]", "}"]);

  // First pass: also build a version with strings/comments stripped to test tokens safely
  let bare = "";
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (sawComment) { bare += " "; continue; }

    if (inStr) {
      if (!triple) {
        if (!esc && ch === "\\") { esc = true; bare += " "; continue; }
        if (esc) { esc = false; bare += " "; continue; }
        if (ch === q) { inStr = false; q = ""; }
        bare += " ";
        continue;
      } else {
        // triple-quoted
        if (src.startsWith(q.repeat(3), i)) {
          inStr = false; triple = false; q = ""; i += 2;
        }
        bare += " ";
        continue;
      }
    } else {
      if (ch === "#") { sawComment = true; bare += " "; continue; }
      if (ch === "'" || ch === '"') {
        if (src.startsWith(ch.repeat(3), i)) {
          inStr = true; triple = true; q = ch; i += 2;
        } else {
          inStr = true; triple = false; q = ch;
        }
        bare += " ";
        continue;
      }
      if (opener.has(ch)) { depth++; bare += ch; continue; }
      if (closer.has(ch)) { depth = Math.max(0, depth - 1); bare += ch; continue; }
      bare += ch;
    }
  }

  // If we ended inside a string or with unbalanced brackets, not safe
  if (inStr || depth !== 0) return false;

  const bareTrim = bare.trim();

  // Reject lines that are clearly statements
  // (Order matters a bit; check multi-word forms first.)
  const statementRegexes = [
    /\basync\s+def\b/,
    /\basync\s+for\b/,
    /\basync\s+with\b/,
    /\bfrom\b/,
    /\bimport\b/,
    /\bpass\b/,
    /\bbreak\b/,
    /\bcontinue\b/,
    /\breturn\b/,
    /\braise\b/,
    /\bassert\b/,
    /\bdel\b/,
    /\bglobal\b/,
    /\bnonlocal\b/,
    /\bclass\b/,
    /\bdef\b/,
    /\bwith\b/,
    /\bfor\b/,
    /\bwhile\b/,
    /\bif\b/,
    /\btry\b/,
    /\bexcept\b/,
    /\bfinally\b/,
    /\bmatch\b/,
    /\bcase\b/,
  ];
  if (statementRegexes.some(rx => rx.test(bareTrim))) return false;

  // Disallow top-level yield/await (unsafe in most contexts)
  if (/\byield\b/.test(bareTrim) || /\bawait\b/.test(bareTrim)) return false;

  // Disallow assignment statements (allow walrus ':=' and comparisons '==', '!=', '<=', '>=')
  // We'll scan for a bare '=' that isn't part of '==', '!=', '<=', '>=', or ':='.
  for (let i = 0; i < bare.length; i++) {
    if (bare[i] === "=") {
      const prev = bare[i - 1] || "";
      const next = bare[i + 1] || "";
      const pair = prev + "=";
      if (prev === ":" && next === "=") { i++; continue; }        // ':=' walrus -> ok
      if (prev === "=" || prev === "!" || prev === "<" || prev === ">") { continue; } // '==','!=','<=','>='
      // augmented assignments like '+=', '-=', etc. will have '=' with prev being operator not in the set above.
      return false;
    }
  }

  // If we get here, it looks like a plain expression line → safe to wrap
  return true;
}

const UNOTEBOOK_REPR_FUNCTION = `import sys
def __unotebook_repr__(o):
  s = sys.stdout
  if o is None: return
  try:
    buf = memoryview(o)
    if buf[:2] == b'\xff\xd8':
      s.send('{"image/jpeg":"')
      stream_b64(buf, s)
      s.send('"}')
      return
    elif buf[:8] == b'\x89PNG\r\n\x1a\n':
      s.send('{"image/png":"')
      stream_b64(buf, s)
      s.send('"}')
      return
  except TypeError:
    pass # not a buffer
  ret = {}
  if hasattr(o, '_repr_mimebundle_'):
    ret = o._repr_mimebundle_()
  elif hasattr(o, '_repr_html_'):
    ret['text/html'] = o._repr_html_()
  elif hasattr(o, '_repr_markdown_'):
    ret['text/htmarkdownml'] = o._repr_markdown_()
  elif hasattr(o, '_repr_svg_'):
    ret['image/svg+xml'] = o._repr_svg_()
  elif hasattr(o, '_repr_png_'):
    ret['image/png'] = o._repr_png_()
  elif hasattr(o, '_repr_jpeg_'):
    ret['image/jpeg'] = o._repr_jpeg_()
  elif hasattr(o, '_repr_latex_'):
    ret['text/latex'] = o._repr_latex_()
  elif hasattr(o, '_repr_javascript_'):
    ret['application/javascript'] = o._repr_javascript_()
  else:
    ret = repr(o)
  json.dump(ret, s)
`

export function stripPythonComment(line) {
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    // toggle quote states, ignoring escaped quotes
    if (ch === "'" && !inDouble && line[i - 1] !== "\\") inSingle = !inSingle;
    else if (ch === '"' && !inSingle && line[i - 1] !== "\\") inDouble = !inDouble;

    // if # appears outside of strings, it's the start of a comment
    if (ch === "#" && !inSingle && !inDouble) {
      return line.slice(0, i).trimEnd();
    }
  }
  return line.trimEnd();
}

let pendingCR = false;
export function appendWithCR(prev, chunk) {
  let out = prev || '';
  let i = 0;

  // If the previous chunk ended with '\r', decide what to do now
  if (pendingCR) {
    if (chunk[i] === '\n') {
      // It was actually CRLF across chunks → newline
      out += '\n';
      i++; // consume the '\n'
    } else {
      // Bare CR → overwrite current line
      const lastNL = out.lastIndexOf('\n');
      out = lastNL === -1 ? '' : out.slice(0, lastNL + 1);
      // (do not consume current char; we'll append normally below)
    }
    pendingCR = false;
  }

  for (; i < chunk.length; i++) {
    const ch = chunk[i];

    if (ch === '\r') {
      // Look ahead for '\n' inside this same chunk
      if (i + 1 < chunk.length && chunk[i + 1] === '\n') {
        out += '\n';   // CRLF → newline
        i++;           // skip the LF
      } else {
        // Bare CR → move to line start (overwrite)
        const lastNL = out.lastIndexOf('\n');
        out = lastNL === -1 ? '' : out.slice(0, lastNL + 1);
        // Don't output anything yet; subsequent chars will overwrite
      }
      continue;
    }

    // Normal char
    out += ch;
  }

  // If this chunk ended with CR (and no LF yet), remember for the next call
  if (chunk.endsWith('\r')) pendingCR = true;

  return out;
}
