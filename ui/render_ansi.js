import { html } from 'htm/preact';

// Simple regex-based ANSI parser → Preact spans
export function render_ansi(str) {
  const parts = [];
  const colorMap = {
    30: 'black', 31: 'red', 32: 'green', 33: 'yellow',
    34: 'blue', 35: 'magenta', 36: 'cyan', 37: 'white'
  };

  const regex = /\x1b\[([0-9;]+)m/g;
  let lastIndex = 0;
  let m;
  let style = {};

  while ((m = regex.exec(str)) !== null) {
    if (m.index > lastIndex) {
      parts.push(html`<span style=${style}>${str.slice(lastIndex, m.index)}</span>`);
    }
    const codes = m[1].split(';').map(Number);
    for (const c of codes) {
      if (c === 0) style = {};                // reset
      else if (c === 1) style = { ...style, 'font-weight': 'bold' };
      else if (c >= 30 && c <= 37) style = { ...style, color: colorMap[c] };
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < str.length) {
    parts.push(html`<span style=${style}>${str.slice(lastIndex)}</span>`);
  }

  return parts;
}
