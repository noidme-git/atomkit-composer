// SPIKE: English-like AQL as a SURFACE SYNTAX that lowers to canonical AQL.
//
// The owner wants AQL to read like English, be writable by anyone, and be friendly
// to an LLM. The question this spike answers is architectural, not cosmetic:
//
//   Does English AQL need a new parser, or is it a desugaring pass?
//
// If it is a desugaring pass — surface → canonical → the existing parser — then:
//   * the schema, governance, serializer, compiler and 21-doc conformance suite are
//     all untouched;
//   * `serialize()` still round-trips (it emits canonical, which is the stored form);
//   * an LLM can be taught the English surface while the machine keeps one grammar.
//
// The proof obligation: for a real page, `compile(english)` must deep-equal
// `compile(canonical)`. Not "look similar". Deep-equal.

import { compilePage } from '@noidmejs/atomkit';
import assert from 'node:assert/strict';

// ── The phrase table ────────────────────────────────────────────────────────
// Each entry rewrites a token RUN into a canonical `key=value` or flag.
// `n` is how many tokens the phrase consumes after the keyword.
// Ordered longest-first so `contains personal data` wins over `contains`.
const PHRASES = [
  // governance — the words a compliance reviewer would actually say
  { say: ['contains', 'personal', 'data'], to: () => 'pii' },
  { say: ['is', 'personal'], to: () => 'pii' },
  { say: ['is', 'confidential'], to: () => 'protected' },
  { say: ['is', 'hidden'], to: () => 'hidden' },
  { say: ['visible', 'to'], take: 1, to: (v) => `roles=${v}` },
  { say: ['only', 'for'], take: 1, to: (v) => `roles=${v}` },
  { say: ['needs'], take: 2, to: (cat, word) => (word === 'consent' ? `consent=${cat}` : null) },

  // content + a11y
  { say: ['level'], take: 1, to: (v) => `level=${v}` },
  { say: ['labelled'], take: 1, to: (v) => `aria-label=${v}` },
  { say: ['described', 'as'], take: 1, to: (v) => `alt=${v}` },
  { say: ['opens', 'in', 'a', 'new', 'tab'], to: () => 'external' },
  { say: ['links', 'to'], take: 1, to: (v) => `href=${v}` },
  { say: ['tracked', 'as'], take: 1, to: (v) => `track=${v}` },

  // style — the handful a writer reaches for
  { say: ['size'], take: 1, to: (v) => `size=${v}` },
  { say: ['in', 'colour'], take: 1, to: (v) => `color=${v}` },
  { say: ['in', 'color'], take: 1, to: (v) => `color=${v}` },
  { say: ['centered'], to: () => 'align=center' },
  { say: ['centred'], to: () => 'align=center' },
  { say: ['bold'], to: () => 'weight=700' },
].sort((a, b) => b.say.length - a.say.length);

/** Split a head into tokens, keeping quoted strings whole. */
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

/** Rewrite one English head into a canonical AQL head. */
function desugarHead(head) {
  const toks = tokens(head);
  const out = [];
  let i = 0;

  // atom type, then an optional quoted string, pass through untouched
  if (i < toks.length) out.push(toks[i++]);
  if (i < toks.length && /^["']/.test(toks[i])) out.push(toks[i++]);

  while (i < toks.length) {
    const t = toks[i];

    // already canonical (`key=value`) or a canonical flag — leave it alone
    if (t.includes('=') || /^["']/.test(t)) { out.push(t); i++; continue; }

    const match = PHRASES.find((p) => p.say.every((w, k) => toks[i + k] === w));
    if (match) {
      const args = [];
      for (let k = 0; k < (match.take ?? 0); k++) {
        const arg = toks[i + match.say.length + k];
        // A phrase that runs off the end of the line must ERROR. `visible to` with no
        // role produced `roles=undefined` — the literal string — which then became a
        // role nobody has. Silent garbage, the exact class this desugarer exists to kill.
        if (arg === undefined) {
          throw new Error(`AQL: "${match.say.join(' ')}" needs ${match.take} more word(s). Try: ${match.say.join(' ')} <value>`);
        }
        args.push(arg);
      }
      const rewritten = match.to(...args);
      if (rewritten === null) throw new Error(`AQL: don't understand "${toks.slice(i, i + match.say.length + (match.take ?? 0)).join(' ')}"`);
      out.push(rewritten);
      i += match.say.length + (match.take ?? 0);
      continue;
    }

    // A canonical flag we know about is fine.
    if (['pii', 'protected', 'hidden', 'external'].includes(t)) { out.push(t); i++; continue; }

    // Anything else is a bare word. Today the parser turns it into an empty prop,
    // silently. That is the same silent-failure class as the `{` bug. Refuse.
    throw new Error(
      `AQL: I don't understand "${t}". Bare words must be a known phrase ` +
      `(${[...KNOWN_WORDS].slice(0, 6).join(', ')}, …) or a key=value.`,
    );
  }
  return out.join(' ');
}

/** Desugar a whole English AQL source into canonical AQL. */
export function desugar(src) {
  return src
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//')) return line;
      const indent = line.slice(0, line.length - line.trimStart().length);
      // Preserve a trailing `{` or a lone `}`
      const openBlock = trimmed.endsWith('{');
      const body = openBlock ? trimmed.slice(0, -1).trim() : trimmed;
      if (body === '}' || body === '') return line;
      if (/^(page|widget)\b/.test(body)) return line; // headers stay canonical
      return indent + desugarHead(body) + (openBlock ? ' {' : '');
    })
    .join('\n');
}

// ── The proof ───────────────────────────────────────────────────────────────
const ENGLISH = `page "Careers" {
  section {
    heading "Join Northwind Health" level 1 size 3rem
    text "We build software for hospitals." in colour "#525c6b"
  }
  section visible to recruiter {
    heading "Compensation band" level 2
    text "£120,000 – £160,000" bold
  }
  section {
    text "priya@northwind.health" contains personal data
    text "+44 7700 900412" is personal
  }
  section is confidential {
    text "Hiring plan Q3"
  }
  section needs marketing consent {
    button "Subscribe" links to "#subscribe" tracked as cta_subscribe
  }
  text "© 2026 Northwind Health" centered
}`;

const CANONICAL = `page "Careers" {
  section {
    heading "Join Northwind Health" level=1 size=3rem
    text "We build software for hospitals." color="#525c6b"
  }
  section roles=recruiter {
    heading "Compensation band" level=2
    text "£120,000 – £160,000" weight=700
  }
  section {
    text "priya@northwind.health" pii
    text "+44 7700 900412" pii
  }
  section protected {
    text "Hiring plan Q3"
  }
  section consent=marketing {
    button "Subscribe" href="#subscribe" track=cta_subscribe
  }
  text "© 2026 Northwind Health" align=center
}`;

console.log('── desugared output ──');
console.log(desugar(ENGLISH).split('\n').map((l) => '  ' + l).join('\n'));

const fromEnglish = compilePage(desugar(ENGLISH));
const fromCanonical = compilePage(CANONICAL);

let fail = 0;
const check = (n, ok, d = '') => { if (!ok) fail++; console.log(`\n  ${ok ? '✅' : '❌'} ${n}${ok ? '' : `\n     ${d}`}`); };

try {
  assert.deepEqual(fromEnglish, fromCanonical);
  check('compile(english) deep-equals compile(canonical)', true);
} catch (e) {
  check('compile(english) deep-equals compile(canonical)', false, e.message.split('\n').slice(0, 8).join('\n     '));
}

// Governance survived the surface syntax.
const gov = fromEnglish.root;
check('"visible to recruiter" → roles', JSON.stringify(gov[1].meta?.security?.roles) === '["recruiter"]');
check('"contains personal data" → pii', gov[2].children[0].meta?.security?.pii === true);
check('"is personal" → pii', gov[2].children[1].meta?.security?.pii === true);
check('"is confidential" → protected', gov[3].meta?.security?.protected === true);
check('"needs marketing consent" → consent', gov[4].meta?.security?.consentCategory === 'marketing');

// Canonical AQL still parses through the desugarer untouched (mixed input is fine).
check('canonical passes through unchanged', desugar(CANONICAL).trim() === CANONICAL.trim());

// A bare word we do not understand is a hard error, not a silent empty prop.
let threw = false;
try { desugar('page "p" {\n  text "x" wobble\n}'); } catch { threw = true; }
check('an unknown bare word is an ERROR, not a silent empty prop', threw);


// ── Adversarial cases (these are how a surface syntax dies) ─────────────────
// AppleScript's failure was not that it read like English. It was that nobody could
// guess WHICH English worked. Every case below must have exactly one answer.
{
  const line = (src) => desugar(`page "p" {\n  ${src}\n}`).split('\n')[1].trim();
  const throws = (src) => { try { line(src); return false; } catch { return true; } };

  // A keyword inside quoted TEXT is content, not syntax.
  check('keyword inside quoted text is left alone',
    line('text "visible to all our staff"') === 'text "visible to all our staff"');

  // A phrase that is a prefix of another must not shadow it.
  check('"is personal" and "is confidential" both resolve',
    line('text "x" is personal') === 'text "x" pii' &&
    line('text "x" is confidential') === 'text "x" protected');

  // Registers mix on one line.
  check('English and canonical mix freely',
    line('text "x" is personal size=12px bold') === 'text "x" pii size=12px weight=700');

  // A quoted argument to a phrase.
  check('quoted phrase argument',
    line('text "x" labelled "Contact email"') === 'text "x" aria-label="Contact email"');

  // An unknown bare word is an ERROR. Canonical AQL would silently make it an empty prop.
  check('unknown bare word errors', throws('text "x" bolded'));

  // A phrase running off the end of the line is an ERROR.
  // It used to emit `roles=undefined` — the literal string — which then became a role
  // nobody has. Silent garbage: the exact class this desugarer exists to kill.
  check('missing phrase argument errors', throws('text "x" visible to'));
  check('missing argument on `labelled` errors', throws('text "x" labelled'));

  // And the canonical form is still accepted verbatim.
  check('canonical flags pass through', line('text "x" pii') === 'text "x" pii');
}

console.log(fail ? `\n  ${fail} FAILED\n` : '\n  English AQL is a DESUGARING, not a new parser. Schema, governance,\n  serializer, compiler and conformance suite are all untouched.\n');
process.exit(fail ? 1 : 0);
