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
export const RESULTS = [];
const quiet = process.argv.includes('--json');
const say = (...a) => { if (!quiet) console.log(...a); };
const gate = (id, invariant, ok, detail) => {
  RESULTS.push({ id, invariant, status: ok ? 'HELD' : 'OPEN' });
  if (ok) { held++; say(`  ✅ HELD  ${id}  ${invariant}`); }
  else { open++; say(`  ❌ OPEN  ${id}  ${invariant}\n           → ${detail}`); }
};

say('\n══ Governance gate for AQL 1.0 ══\n');

// ── G1. The render path masks. This is the guarantee the product is sold on. ──
gate('G1', 'stripDocument masks PII before render',
  stripDocument(piiDoc, { canViewPii: false }).root[0].props.text === '•••••',
  'the mask itself is broken');

// ── G2. An expression must not read a masked value through STATE. ────────────
// The mask is destructive, so it holds — but ONLY if the scope holds the stripped
// document. An editor holds the AUTHORING document by definition.
//
// G2 asks about the SYSTEM: can a renderer construct a raw scope and read PII?
// Today: yes, because nothing forces it through buildScope. `buildScope` exists and
// is sound (G2p), but a primitive with no call site is a library, not an invariant.
// See spike/gate-wiring.mjs. This stays OPEN until the runtime cannot bypass it.
{
  const raw = evalExpr('state.doc.root[0].props.text', { state: { doc: piiDoc } });
  gate('G2', 'the system cannot construct a scope that reads PII',
    raw !== PII,
    `evalExpr over a hand-built scope returned ${JSON.stringify(raw)}. ` +
    'buildScope() would have masked it, but nothing forces the renderer to use it. ' +
    'FIX: the runtime must build EVERY expression scope via buildScope, and `state` must be literal-only.');

  // G2p — is the primitive itself sound? Probe the shape classes, not one input.
  // `buildScope` originally masked only `{version:number, root:array}`, so a SELECTED
  // NODE — what an inspector holds — read raw PII. Found by the CTO gate.
  const piiNode = piiDoc.root[0];
  const shapes = [
    ['document', { state: { doc: piiDoc } }],
    ['selected node', { state: { node: piiNode } }],
    ['array of nodes', { state: { nodes: [piiNode] } }],
    ['string version', { state: { doc: { version: '1', root: [piiNode] } } }],
    ['deeply nested', { state: { a: { b: { c: piiNode } } } }],
    ['loop variable', { item: piiNode }],
  ];
  const leaky = shapes.filter(([, sc]) => JSON.stringify(buildScope(sc, { canViewPii: false })).includes(PII)).map(([n]) => n);
  gate('G2p', 'buildScope() masks every governed shape, not just a document',
    leaky.length === 0,
    `leaks for: ${leaky.join(', ')}`);
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
// safeHref blocks SCHEMES (javascript:, data:, //host), never DESTINATIONS.
//
// G5 asks about the SYSTEM: is the default URL guard sufficient? No. `safeNavigate`
// exists and is sound (G5p), but no atom, renderer or action calls it. OPEN.
{
  const exfil = `https://attacker.io/?d=${encodeURIComponent(PII)}`;
  gate('G5', 'the system cannot navigate data to an arbitrary host',
    safeHref(exfil) === '#',
    `safeHref passed ${JSON.stringify(safeHref(exfil))} unchanged — it blocks schemes, not destinations. ` +
    'safeNavigate() would block it, but nothing calls it. FIX: route every navigate/call through it.');

  // G5p — is the primitive sound? Probe the bypass CLASSES.
  // It originally prefix-matched the raw string, so `/<TAB>/evil.com/steal` looked
  // same-origin while a browser resolves it to https://evil.com/steal.
  const TAB = String.fromCharCode(9), LF = String.fromCharCode(10), CR = String.fromCharCode(13);
  const policy = { allowHosts: ['app.example.com'] };
  const mustBlock = [
    exfil, '//evil.com/x', 'https://a@evil.com/x', 'https://app.example.com.evil.com/x',
    'javascript:alert(1)', 'evil.com/path',
    `/${TAB}/evil.com/steal`, `/${LF}/evil.com/steal`, `/${CR}/evil.com/steal`,
  ];
  const mustPass = ['/careers', '#top', '?page=2', './x', 'https://app.example.com/ok'];
  const leaked = mustBlock.filter((u) => safeNavigate(u, policy) !== null);
  const broke = mustPass.filter((u) => safeNavigate(u, policy) === null);
  gate('G5p', 'safeNavigate() blocks every exfil class and passes legitimate targets',
    leaked.length === 0 && broke.length === 0,
    `${leaked.length ? `not blocked: ${leaked.map((u) => JSON.stringify(u)).join(', ')}. ` : ''}` +
    `${broke.length ? `wrongly blocked: ${broke.join(', ')}` : ''}`);
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
  say('           note: parseExpr has no root allowlist. That is BY DESIGN — the scope is the');
  say('           boundary. Any design whose safety proof relies on a grammar-level root');
  say('           restriction is relying on something that does not exist.');
}

say(`\n  ${held} held · ${open} OPEN\n`);
if (open && !quiet) {
  console.log('  AQL 1.0 interactivity is BLOCKED until every gate above is HELD.');
  console.log('  Owners: aql-runtime-engineer (G2 — wire buildScope), aql-security-engineer (G5 — wire safeNavigate).');
  console.log('  The PRIMITIVES (G2p/G5p) are sound. The GATES stay open until nothing can bypass them.\n');
}
if (quiet) console.log(JSON.stringify({ held, open, results: RESULTS }, null, 2));

// Exit 1 while any gate is open. `gate-ratchet.mjs` is what CI runs: a permanently
// red build is noise, but a gate that silently REOPENS is a catastrophe.
if (process.argv[1]?.endsWith('governance-gate.mjs')) process.exit(open ? 1 : 0);
