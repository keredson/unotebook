/**
 * Cleave off the last line only if it's a standalone statement.
 * Returns { head, tail }.
 */
export function cleaveLastStatement(src) {
  const norm = src.replace(/\r\n?/g, "\n");
  const lines = norm.trimEnd().split("\n");
  if (lines.length === 0) return { head: "", tail: "" };

  let inStr = false, quote = "", escape = false;
  let depth = 0;
  const body = lines.slice(0, -1).join("\n");
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inStr) {
      if (!escape && ch === quote) inStr = false;
      escape = !escape && ch === "\\";
      continue;
    }
    if (ch === '"' || ch === "'") { inStr = true; quote = ch; escape = false; continue; }
    if ("([{".includes(ch)) depth++;
    if (")]}".includes(ch)) depth = Math.max(0, depth - 1);
  }

  const lastLine = lines[lines.length - 1];

  const leading = s => (s.match(/^\s*/)?.[0].length ?? 0);
  const stripTrailingCommentForColon = line => line.replace(/\s+#.*$/, "");
  const isBlockHeader = line => /:\s*$/.test(stripTrailingCommentForColon(line));

  const openBlockOnLast = isBlockHeader(lastLine);
  const backslashOnLast = /\\\s*(#.*)?$/.test(lastLine);
  const backslashOnPrev = lines.length >= 2 && /\\\s*(#.*)?$/.test(lines[lines.length - 2]);

  const lastIndent = leading(lastLine);
  let parentIdx = -1;
  for (let i = lines.length - 2; i >= 0; i--) {
    const l = lines[i];
    if (!l.trim()) continue;
    const ind = leading(l);
    if (ind < lastIndent) { parentIdx = i; break; }
  }
  const insideParentBlock = parentIdx !== -1 && isBlockHeader(lines[parentIdx]);

  const canSplit =
    depth === 0 &&
    !inStr &&
    !openBlockOnLast &&
    !backslashOnLast &&
    !backslashOnPrev &&
    !insideParentBlock;

  if (!canSplit) return { head: src, tail: "" };

  // Preserve a trailing newline from the original only if head doesn't already end with \n
  const headBase = lines.slice(0, -1).join("\n");
  const head = (/\n$/.test(norm) && !/\n$/.test(headBase)) ? headBase + "\n" : headBase;

  return { head, tail: lastLine };
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

export const UNOTEBOOK_REPR_FUNCTION = `
try: import json
except: import ujson as json
import usys

def b64encode_stream(b):
 t=b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
 w=usys.stdout.write
 for i in range(0,len(b),3):
  c=b[i:i+3];p=3-len(c);v=int.from_bytes(c,"big")<<(p*8)
  for j in range(18,-1,-6):w(chr(t[(v>>j)&63]))
  if p:w("="*p)

def b64encode_stream(b):
  t = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
  w = usys.stdout.write
  for i in range(0, len(b), 3):
    c = b[i:i+3]
    p = 3 - len(c)
    v = int.from_bytes(c, "big") << (p * 8)
    quad = ''.join(chr(t[(v >> j) & 63]) for j in range(18, -1, -6))
    if p:
      quad = quad[:4 - p] + ('=' * p)
    w(quad)

def __unotebook_repr__(o):
  if o is None: return
  if hasattr(o, '_repr_mimebundle_'): print(json.dumps(o._repr_mimebundle_()), end='')
  else:
    print('{"__unotebook_repr__":{', end='')
    if hasattr(o, '_repr_html_'):       print('"text/html":', json.dumps(o._repr_html_()), end=',')
    if hasattr(o, '_repr_markdown_'):   print('"text/markdown":', json.dumps(o._repr_html_()), end=',')
    if hasattr(o, '_repr_svg_'):        print('"image/svg+xml":', json.dumps(o._repr_svg_()), end=',')
    if hasattr(o, '_repr_png_'):
      usys.stdout.write('"image/png":"')
      b64encode_stream(o._repr_png_())
      usys.stdout.write('",')
    if hasattr(o, '_repr_jpeg_'):
      usys.stdout.write('"image/jpeg":"')
      b64encode_stream(o._repr_jpeg_())
      usys.stdout.write('",')
    if hasattr(o, '_repr_latex_'):      print('"text/latex":', json.dumps(o._repr_latex_()), end=',')
    if hasattr(o, '_repr_javascript_'): print('"application/javascript":', json.dumps(o._repr_javascript_()), end=',')
    print('"text/plain":', json.dumps(repr(o)), end='}}\\n')
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
