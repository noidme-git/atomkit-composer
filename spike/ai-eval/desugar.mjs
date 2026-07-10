// Pure desugarer — the English→canonical phrase-rewriting pass, with NO top-level
// proof and NO process.exit (unlike ../english-desugar.mjs, which is a self-running
// spike). Faithful port of that spike's PHRASES + logic so the harness stays
// deterministic and importable. When the desugarer graduates into core/composer as
// a real module, delete this vendor copy and import it instead.

const PHRASES = [
  { say: ['contains', 'personal', 'data'], to: () => 'pii' },
  { say: ['is', 'personal'], to: () => 'pii' },
  { say: ['is', 'confidential'], to: () => 'protected' },
  { say: ['is', 'hidden'], to: () => 'hidden' },
  { say: ['visible', 'to'], take: 1, to: (v) => `roles=${v}` },
  { say: ['only', 'for'], take: 1, to: (v) => `roles=${v}` },
  { say: ['needs'], take: 2, to: (cat, word) => (word === 'consent' ? `consent=${cat}` : null) },

  { say: ['level'], take: 1, to: (v) => `level=${v}` },
  { say: ['labelled'], take: 1, to: (v) => `aria-label=${v}` },
  { say: ['described', 'as'], take: 1, to: (v) => `alt=${v}` },
  { say: ['opens', 'in', 'a', 'new', 'tab'], to: () => 'external' },
  { say: ['links', 'to'], take: 1, to: (v) => `href=${v}` },
  { say: ['tracked', 'as'], take: 1, to: (v) => `track=${v}` },

  { say: ['size'], take: 1, to: (v) => `size=${v}` },
  { say: ['in', 'colour'], take: 1, to: (v) => `color=${v}` },
  { say: ['in', 'color'], take: 1, to: (v) => `color=${v}` },
  { say: ['centered'], to: () => 'align=center' },
  { say: ['centred'], to: () => 'align=center' },
  { say: ['bold'], to: () => 'weight=700' },
].sort((a, b) => b.say.length - a.say.length);

function tokens(head) {
  const out = [];
  let i = 0;
  while (i < head.length) {
    while (i < head.length && /\s/.test(head[i])) i++;
    if (i >= head.length) break;
    const q = head[i];
    if (q === '"' || q === "'") {
      let j = i + 1, s = q;
      while (j < head.length && head[j] !== q) { s += head[j]; j++; }
      out.push(s + q); i = j + 1;
    } else {
      let j = i;
      while (j < head.length && !/\s/.test(head[j])) j++;
      out.push(head.slice(i, j)); i = j;
    }
  }
  return out;
}

const KNOWN_WORDS = new Set(PHRASES.flatMap((p) => p.say));

function desugarHead(head) {
  const toks = tokens(head);
  const out = [];
  let i = 0;
  if (i < toks.length) out.push(toks[i++]);
  if (i < toks.length && /^["']/.test(toks[i])) out.push(toks[i++]);

  while (i < toks.length) {
    const t = toks[i];
    if (t.includes('=') || /^["']/.test(t)) { out.push(t); i++; continue; }

    const match = PHRASES.find((p) => p.say.every((w, k) => toks[i + k] === w));
    if (match) {
      const args = [];
      for (let k = 0; k < (match.take ?? 0); k++) {
        const arg = toks[i + match.say.length + k];
        if (arg === undefined)
          throw new Error(`AQL: "${match.say.join(' ')}" needs ${match.take} more word(s). Try: ${match.say.join(' ')} <value>`);
        args.push(arg);
      }
      const rewritten = match.to(...args);
      if (rewritten === null)
        throw new Error(`AQL: don't understand "${toks.slice(i, i + match.say.length + (match.take ?? 0)).join(' ')}"`);
      out.push(rewritten);
      i += match.say.length + (match.take ?? 0);
      continue;
    }

    if (['pii', 'protected', 'hidden', 'external'].includes(t)) { out.push(t); i++; continue; }

    throw new Error(
      `AQL: I don't understand "${t}". Bare words must be a known phrase ` +
      `(${[...KNOWN_WORDS].slice(0, 6).join(', ')}, …) or a key=value.`,
    );
  }
  return out.join(' ');
}

export function desugar(src) {
  return src
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//')) return line;
      const indent = line.slice(0, line.length - line.trimStart().length);
      const openBlock = trimmed.endsWith('{');
      const body = openBlock ? trimmed.slice(0, -1).trim() : trimmed;
      if (body === '}' || body === '') return line;
      if (/^(page|widget)\b/.test(body)) return line;
      return indent + desugarHead(body) + (openBlock ? ' {' : '');
    })
    .join('\n');
}
