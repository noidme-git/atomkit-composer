// THE GOVERNANCE GATE.
//
// No interactivity — no `state`, no `on:`, no actions — ships in AQL until this
// file exits 0. It now exits 0: all eight invariants HELD.
//
// This exists because a design review claimed governance was "closed by
// construction". It was not. The proof rested on a grammar rule that does not
// exist, a maskNode backstop that failed open, and safeHref blocking exfiltration
// that it does not block.
//
// The last two holes are now closed by real, executed mechanisms (each with its own
// standalone proof in this directory): G2 by strip-before-scope — `buildScope` strips
// every document with the render ctx before an expression can read it, and the canvas
// renders the authoring doc through a SEPARATE documents channel (g2-strip-before-
// scope.mjs) — and G5 by `safeNavigate`, a navigate host allow-list that enforces the
// DESTINATION, with `call` routed through atomkit-http's SSRF proxy (g5-safe-navigate.mjs).
//
//   node spike/governance-gate.mjs
//
// Each check states the invariant, then the attack. A check that passes today is
// marked HELD. A check that fails is a precondition for AQL 1.0.

import { stripDocument, safeHref, maskNode, parse } from '@noidmejs/atomkit';
// The evaluator is deliberately NOT part of the published surface until it has a
// call site and a settled contract (CTO ruling on the 0.8.0 candidate). The gate
// reaches the module directly, because the gate's whole job is to test what is not
// yet safe to expose. buildScope (strip-before-scope, G2) and safeNavigate (the
// navigate host allow-list, G5) are the same not-yet-public interactivity layer,
// reached the same way.
import { evalExpr } from './node_modules/@noidmejs/atomkit/dist/expr.js';
import { buildScope } from './node_modules/@noidmejs/atomkit/dist/scope.js';
import { safeNavigate } from './node_modules/@noidmejs/atomkit/dist/navigate.js';

const PII = 'SSN 123-45-6789';
const piiDoc = { version: 1, root: [{ id: 'a', type: 'text', props: { text: PII }, meta: { security: { pii: true } } }] };

let held = 0, open = 0;
const gate = (id, invariant, ok, detail) => {
  if (ok) { held++; console.log(`  ✅ HELD  ${id}  ${invariant}`); }
  else { open++; console.log(`  ❌ OPEN  ${id}  ${invariant}\n           → ${detail}`); }
};

console.log('\n══ Governance gate for AQL 1.0 ══\n');

// ── G1. The render path masks. This is the guarantee the product is sold on. ──
gate('G1', 'stripDocument masks PII before render',
  stripDocument(piiDoc, { canViewPii: false }).root[0].props.text === '•••••',
  'the mask itself is broken');

// ── G2. An expression must not read a masked value through STATE. ────────────
// The mask is destructive, so it holds — but ONLY if the scope holds the stripped
// document. An editor holds the authoring (unstripped) document by definition.
// Any `render-document document={{state.doc}}` puts it in an expression scope.
// FIX (strip-before-scope): the scope is built ONLY by `buildScope`, which strips
// every document with the render ctx before it can be read; the canvas renders the
// authoring doc through a SEPARATE documents channel (see g2-strip-before-scope.mjs),
// never through an expression. Proof: spike/g2-strip-before-scope.mjs.
{
  const raw = evalExpr('state.doc.root[0].props.text', { state: { doc: piiDoc } });     // the hole
  const scope = buildScope({ state: { doc: piiDoc } }, { canViewPii: false });           // the fix
  const leaked = evalExpr('state.doc.root[0].props.text', scope);
  gate('G2', 'an expression cannot read PII held in state',
    leaked !== PII,
    `evalExpr over a buildScope() scope still returned ${JSON.stringify(leaked)} — bypass survives.`);
  console.log(`           strip-before-scope: raw scope reads ${JSON.stringify(raw)}; ` +
    `buildScope reads ${JSON.stringify(leaked)} (the mask).`);
}

// ── G3. maskNode must fail closed on node-level fields. ─────────────────────
{
  const masked = maskNode({ id: 'a', type: 'text', props: { text: PII }, state: { ssn: PII }, meta: { security: { pii: true } } });
  gate('G3', 'a node-level `state` field does not survive masking',
    masked.state === undefined && !JSON.stringify(masked).includes(PII),
    `maskNode leaked: ${JSON.stringify(masked)}`);
}

// ── G4. `props` is an open record. Interactive concepts must not smuggle through it. ──
{
  const smuggled = { version: 1, root: [{ id: 'a', type: 'text', props: { text: 'x', state: { ssn: PII }, 'on:click': 'navigate("https://evil")' }, meta: { security: { pii: true } } }] };
  const out = JSON.stringify(stripDocument(smuggled, { canViewPii: false }));
  gate('G4', 'interactive concepts hidden in props do not survive masking',
    !out.includes(PII) && !out.includes('navigate'),
    `stripDocument leaked: ${out}. FIX: state/on/when/each are first-class STRICT schema fields, ` +
    'and those key names are rejected inside props.');
}

// ── G5. A navigate action must not exfiltrate. ──────────────────────────────
// safeHref blocks SCHEMES (javascript:, data:, //host), never DESTINATIONS — an
// https exfil URL passes it unchanged. FIX: `navigate` routes through `safeNavigate`,
// which enforces the DESTINATION host against an allow-list (the SAME list
// atomkit-http uses for `call`). Same-origin (relative/query/fragment) stays allowed.
// Proof: spike/g5-safe-navigate.mjs.
{
  const exfil = `https://attacker.io/?d=${encodeURIComponent(PII)}`;
  const policy = { allowHosts: ['app.example.com'] }; // the host app's own origin
  gate('G5', 'a navigate target cannot carry data to an arbitrary host',
    safeNavigate(exfil, policy) === null,
    `safeNavigate returned ${JSON.stringify(safeNavigate(exfil, policy))} — exfil not blocked.`);
  console.log(`           safeHref(exfil) = ${JSON.stringify(safeHref(exfil))} (passes); ` +
    `safeNavigate(exfil, allowHosts) = ${JSON.stringify(safeNavigate(exfil, policy))} (blocked).`);
}

// ── G6. The interpolation syntax must not silently swallow a value. ─────────
// `{` opens a block in AQL. An unquoted `{{expr}}` in a value position does not
// error — it parses to the empty string. Silent data loss is worse than a throw.
{
  let props;
  try { props = parse(`page "p" {\n  box document={{state.doc}}\n}`).pages[0].document.root[0].props; }
  catch { props = { document: '__threw__' }; }
  gate('G6', 'an unquoted {{expr}} does not silently become empty',
    props.document !== '',
    `parsed to props.document = ${JSON.stringify(props.document)} — no error, no value. ` +
    'FIX: {{ }} is quoted-only, and a bare `{{` in a value position is a parse error.');

  // Quoted interpolation is unambiguous and must keep working.
  const quoted = parse(`page "p" {\n  text "count: {{state.n}}"\n}`).pages[0].document.root[0].props.text;
  gate('G6b', 'a quoted "{{expr}}" survives the parser intact',
    quoted === 'count: {{state.n}}',
    `got ${JSON.stringify(quoted)}`);
}

// ── G7. The evaluator must not be reachable from an unexpected root. ────────
// parseExpr accepts ANY bare identifier as a root. That is correct — the HOST
// defines the scope — but it means the scope is the whole security boundary.
{
  const anyRoot = evalExpr('secret', { secret: 42 });
  gate('G7', 'expression roots are constrained by the host, not the grammar',
    anyRoot === 42,
    'informational');
  console.log('           note: parseExpr has no root allowlist. That is BY DESIGN — the scope is the');
  console.log('           boundary. Any design whose safety proof relies on a grammar-level root');
  console.log('           restriction is relying on something that does not exist.');
}

console.log(`\n  ${held} held · ${open} OPEN\n`);
if (open) {
  console.log('  AQL 1.0 interactivity is BLOCKED until every gate above is HELD.');
  console.log('  Owners: aql-security-engineer (G2,G4,G5), aql-runtime-engineer (G2,G3),');
  console.log('          aql-language-designer (G6).\n');
}
process.exit(open ? 1 : 0);
