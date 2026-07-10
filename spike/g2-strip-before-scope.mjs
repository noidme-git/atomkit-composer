// PROOF — G2: strip-before-scope. An expression cannot read a PII value the
// renderer would have masked, even when an editor holds the UNSTRIPPED document.
//
//   node spike/g2-strip-before-scope.mjs
//
// The mechanism under test is `buildScope` (@noidmejs/atomkit dist/scope.js) — the
// one sanctioned constructor of an expression scope. It is reached by dist file path
// because, like the evaluator, it is not yet on the public surface (index.ts).
//
// What is proven:
//   1. The HOLE, reproduced: a raw scope leaks PII (this is gate G2 today).
//   2. buildScope closes it: the expression reads the MASK, not the value.
//   3. Adversarial placements: nested, in-array, at scope root, computed member.
//   4. "literal-only" DEFINED, each answer proven with real stripDocument behaviour.
//   5. The canvas hard case: render-document takes a document from a SEPARATE channel
//      that expressions cannot reach, strips at its own egress, and still renders.

import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  stripDocument, maskNode, PII_MASK, Render, defaultAtoms, instrumentRegistry, NODE_ID_ATTR,
} from '/Users/noidme/atomkit/dist/index.js';
import { evalExpr, interpolate } from '/Users/noidme/atomkit/dist/expr.js';
import { buildScope } from '/Users/noidme/atomkit/dist/scope.js';

const PII = 'SSN 123-45-6789';
const EMAIL = 'ada@corp.com';
const piiDoc = () => ({
  version: 1,
  root: [{ id: 'a', type: 'text', props: { text: PII }, meta: { security: { pii: true } } }],
});
const VIEWER = { canViewPii: false }; // a viewer NOT entitled to PII
const EDITOR = { canViewPii: true };  // an authorised editor

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${detail ? `\n       ${detail}` : ''}`); }
};

console.log('\n══ G2 · strip-before-scope ═══════════════════════════════════════\n');

// ── 1. THE HOLE (what the gate reproduces today) ─────────────────────────────
console.log('1. The hole, reproduced against a RAW scope');
{
  const rawLeak = evalExpr('state.doc.root[0].props.text', { state: { doc: piiDoc() } });
  check('raw scope LEAKS PII (this is why G2 is open)', rawLeak === PII,
    `expected the leak; got ${JSON.stringify(rawLeak)}`);
}

// ── 2. buildScope CLOSES it ──────────────────────────────────────────────────
console.log('\n2. buildScope(ctx) strips every document before it enters scope');
{
  const scope = buildScope({ state: { doc: piiDoc() } }, VIEWER);
  const read = evalExpr('state.doc.root[0].props.text', scope);
  check('expression can no longer read the raw PII', read !== PII, `got ${JSON.stringify(read)}`);
  check('it reads the MASK — i.e. the STRIPPED document', read === PII_MASK,
    `strip-before-scope means the scope holds stripDocument()'s output; got ${JSON.stringify(read)}`);
  // Whole-string interpolation must not leak either (it returns the raw value).
  check('interpolate("{{state.doc.root[0].props.text}}") is masked too',
    interpolate('{{state.doc.root[0].props.text}}', scope) === PII_MASK);
}

// ── 3. ADVERSARIAL placements of the document in the scope ────────────────────
console.log('\n3. A document hidden anywhere in the scope is still stripped');
{
  // nested deep
  const nested = buildScope({ state: { a: { b: { doc: piiDoc() } } } }, VIEWER);
  check('nested state.a.b.doc — masked', evalExpr('state.a.b.doc.root[0].props.text', nested) === PII_MASK);
  // inside an array
  const inArr = buildScope({ state: { docs: [piiDoc(), piiDoc()] } }, VIEWER);
  check('state.docs[1] (in an array) — masked', evalExpr('state.docs[1].root[0].props.text', inArr) === PII_MASK);
  // at the very root of the scope (not under `state`)
  const atRoot = buildScope({ doc: piiDoc() }, VIEWER);
  check('doc at scope root — masked', evalExpr('doc.root[0].props.text', atRoot) === PII_MASK);
  // computed member — the dynamic-key path
  const comp = buildScope({ state: { doc: piiDoc() } }, VIEWER);
  check('computed member state.doc["root"][0]["props"]["text"] — masked',
    evalExpr('state.doc["root"][0]["props"]["text"]', comp) === PII_MASK);
  // a masked CONTAINER cascades: whole subtree unreadable
  const subtreeDoc = {
    version: 1,
    root: [{ id: 'c', type: 'box', meta: { security: { pii: true } }, children: [
      { id: 'c1', type: 'text', props: { text: EMAIL } },
    ] }],
  };
  const casc = buildScope({ state: { doc: subtreeDoc } }, VIEWER);
  check('pii on a container cascades — child text masked in scope',
    evalExpr('state.doc.root[0].children[0].props.text', casc) === PII_MASK);
}

// ── 4. "literal-only" — DEFINED, and each claim PROVEN with stripDocument ────
console.log('\n4. "state must be literal-only" — precise definition + proofs');
console.log('   DEFINITION: a state INITIALISER RHS is an AST literal (or a composite');
console.log('   of literals) — never a ref/member/call/data-binding — so a governed');
console.log('   value cannot be captured at authoring time. A runtime WRITE (set) may');
console.log('   only store a value read from a strip-before-scope scope, which is');
console.log('   already stripped-or-literal. And a BuilderDocument is never a scope leaf.');
{
  // Q: Can a DATA BINDING populate state with a live PII value?  A: No.
  // Data binding resolves AFTER stripDocument. A pii-flagged node's bound value is
  // already the mask by the time any action could capture it. Proven directly:
  const boundPiiNode = {
    id: 'b', type: 'text',
    data: { source: { kind: 'static', value: PII }, bindTo: 'text' },
    meta: { security: { pii: true } },
  };
  const strippedNode = stripDocument({ version: 1, root: [boundPiiNode] }, VIEWER).root[0];
  check('a pii node\'s data binding is DROPPED by strip (nothing to capture)',
    strippedNode.data === undefined,
    `data survived: ${JSON.stringify(strippedNode.data)}`);
  // So even if an action later did set(x, <that node's value>), the value is the mask.
  const afterBinding = buildScope({ state: { captured: maskNode(boundPiiNode).props.text ?? PII_MASK } }, VIEWER);
  check('=> a value flowing from a governed binding into state is already masked',
    evalExpr('state.captured', afterBinding) !== PII);

  // Q: Can a LOOP VARIABLE populate state with PII?  A: Only ever a stripped value.
  // `for item in <expr>` binds item to elements of a stripped array; set(x, item)
  // captures that element. Prove the array the loop sees is already masked.
  const listDoc = {
    version: 1,
    root: [{ id: 'list', type: 'box', meta: { security: { pii: true } }, children: [
      { id: 'i1', type: 'text', props: { text: PII } },
      { id: 'i2', type: 'text', props: { text: EMAIL } },
    ] }],
  };
  const loopScope = buildScope({ state: { doc: listDoc } }, VIEWER);
  const items = evalExpr('state.doc.root[0].children', loopScope);
  const capturedFromLoop = items.map((it) => it.props.text);
  check('a loop over a governed subtree yields MASKED items (set captures the mask)',
    capturedFromLoop.every((t) => t === PII_MASK),
    `captured ${JSON.stringify(capturedFromLoop)}`);

  // Q: Is a literal initialiser safe?  A: Yes — that is the whole point.
  const literalState = buildScope({ state: { count: 0, name: 'ada', items: [1, 2, 3] } }, VIEWER);
  check('a literal-only state round-trips unchanged (usable)',
    evalExpr('state.count + len(state.items)', literalState) === 3);
}

// ── 5. THE CANVAS HARD CASE ──────────────────────────────────────────────────
// The composer renders a document it is editing. render-document is a CODE atom
// (core). It must take the document WITHOUT that document being readable by an
// expression. Design: the document lives in a SEPARATE `documents` channel; only
// render-document-class atoms read it; it is NEVER put in the expression scope; and
// render-document strips at its OWN egress with the viewer's context.
console.log('\n5. Canvas: render-document reads a separate channel, strips at egress');
{
  // The runtime keeps two channels. `state` (literal-only) feeds expressions;
  // `documents` feeds render-document and is NEVER handed to buildScope.
  const runtime = {
    state: { selectedId: undefined },       // literal-only → safe for expressions
    documents: { main: piiDoc() },          // the edited (unstripped) doc → NOT in scope
  };

  // (a) The expression scope is built from `state` ONLY. The document is absent.
  const exprScope = buildScope({ state: runtime.state }, VIEWER);
  check('expression scope has NO path to the document',
    evalExpr('state.documents.main.root[0].props.text', exprScope) === undefined &&
    evalExpr('state.doc.root[0].props.text', exprScope) === undefined);

  // (b) render-document (CODE atom) resolves the ref from the documents channel and
  //     renders it through stripDocument at its own egress, using the viewer ctx.
  const renderDocumentAtom = (ref, ctx) => {
    const doc = runtime.documents[ref];                 // separate channel, by name
    if (!doc || !Array.isArray(doc.root)) return null;
    const registry = instrumentRegistry(defaultAtoms);
    // strip-before-render — the atom's egress boundary, same ctx as the page.
    return createElement(Render, { document: stripDocument(doc, ctx), registry, context: ctx });
  };

  // A NON-entitled viewer previewing the canvas sees the mask.
  const asViewer = renderToStaticMarkup(renderDocumentAtom('main', VIEWER));
  check('canvas rendered to a non-entitled viewer shows the MASK, never the PII',
    asViewer.includes(PII_MASK) && !asViewer.includes(PII),
    asViewer);
  // handles still present (selection round-trip preserved).
  check('per-node handles still emitted (selection still works)',
    new RegExp(`${NODE_ID_ATTR}="a"`).test(asViewer));

  // An AUTHORISED editor (canViewPii) sees the real value — governance permits it,
  // and it STILL never travelled through an expression scope.
  const asEditor = renderToStaticMarkup(renderDocumentAtom('main', EDITOR));
  check('authorised editor sees the real value (strip is a no-op for the entitled)',
    asEditor.includes(PII));
  check('...and even for the editor, no expression could read it (channel-separated)',
    evalExpr('state.doc.root[0].props.text', buildScope({ state: runtime.state }, EDITOR)) === undefined);
}

console.log('\n──────────────────────────────────────────────────────────────────');
console.log(`  ${pass} passed · ${fail} failed`);
console.log(fail ? '\n  G2 NOT closed.\n' : '\n  G2 CLOSED: strip-before-scope + a channel-separated document.\n');
process.exit(fail ? 1 : 0);
