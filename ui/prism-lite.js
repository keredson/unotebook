// Minimal Prism-style syntax highlighter focused on Python.
// Provides just enough of the Prism API (highlight + languages.python)
// to keep integration small without pulling the full library.

const KEYWORDS = new Set([
  'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue',
  'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from',
  'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or',
  'pass', 'raise', 'return', 'try', 'while', 'with', 'yield'
]);

const BOOL_LITERALS = new Set(['True', 'False', 'None']);

const BUILTINS = new Set([
  'abs', 'all', 'any', 'bool', 'bytes', 'dict', 'enumerate', 'float',
  'int', 'len', 'list', 'map', 'max', 'min', 'print', 'range', 'round',
  'set', 'sorted', 'str', 'sum', 'tuple', 'zip'
]);

const TOKEN_PATTERNS = [
  { type: null, pattern: /\s+/y },
  { type: 'comment', pattern: /#[^\n]*/y },
  {
    type: 'string',
    pattern: /(?:[rRuUbBfF]{0,2})(?:(?:"""[\s\S]*?""")|(?:'''[\s\S]*?''')|(?:"(?:\\.|[^"\\\r\n])*")|(?:'(?:\\.|[^'\\\r\n])*'))/y
  },
  {
    type: 'number',
    pattern: /(?:0[bB][01_]+|0[oO][0-7_]+|0[xX][\da-fA-F_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d[\d_]*)?j?)/y
  },
  { type: 'decorator', pattern: /@(?:\w+(?:\.\w+)*)/y },
  {
    type: 'operator',
    pattern: /\*\*=?|\/\/=?|<<=?|>>=?|!=|==|<=|>=|:=|->|\+=|-=|\*=|\/=|%=|\^=|&=|\|=|~|[-+*/%<>=^&|]/y
  },
  { type: 'punctuation', pattern: /[{}[\]();,.]/y },
  { type: 'identifier', pattern: /[A-Za-z_]\w*/y },
  { type: null, pattern: /./y } // fallback: advance by one character
];

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function highlightToken(token) {
  if (!token.type) return escapeHtml(token.content);
  const className = token.alias ? `${token.type} ${token.alias}` : token.type;
  return `<span class="token ${className}">${escapeHtml(token.content)}</span>`;
}

function tokenizePython(code) {
  const tokens = [];
  let index = 0;

  while (index < code.length) {
    let matched = false;

    for (const spec of TOKEN_PATTERNS) {
      spec.pattern.lastIndex = index;
      const match = spec.pattern.exec(code);
      if (!match) continue;

      const value = match[0];
      index += value.length;
      matched = true;

      if (!value.length) break;

      if (spec.type === 'identifier') {
        if (KEYWORDS.has(value)) {
          tokens.push({ type: 'keyword', content: value });
        } else if (BOOL_LITERALS.has(value)) {
          tokens.push({ type: 'boolean', content: value });
        } else if (BUILTINS.has(value)) {
          tokens.push({ type: 'builtin', content: value });
        } else {
          tokens.push({ type: null, content: value });
        }
      } else {
        tokens.push({ type: spec.type, content: value, alias: spec.alias });
      }

      break;
    }

    if (!matched) {
      // fail-safe: advance a single character to avoid infinite loop
      tokens.push({ type: null, content: code.charAt(index) });
      index += 1;
    }
  }

  return tokens;
}

const Prism = {
  languages: {
    python: {}
  },
  highlight(code, _grammar, _language) {
    const source = typeof code === 'string' ? code : String(code ?? '');
    const tokens = tokenizePython(source);
    return tokens.map(highlightToken).join('');
  },
  highlightElement(element) {
    if (!element) return;
    const parent = element.parentElement;
    const html = Prism.highlight(element.textContent || '', Prism.languages.python, 'python');
    element.innerHTML = html;
    element.classList.add('language-python');
    if (parent) parent.classList.add('language-python');
  }
};

export function highlightPython(code) {
  return Prism.highlight(code, Prism.languages.python, 'python');
}

export { Prism };
export default Prism;
