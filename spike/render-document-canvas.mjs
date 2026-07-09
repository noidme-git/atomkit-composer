// SPIKE — the `render-document` canvas atom: a live, selectable sub-render.
//
// The composer is a PURE AQL document. The document being EDITED lives in the
// composer's own `state` as a BuilderDocument value. To show it on the canvas,
// the composer needs an atom that:
//   1. takes a document from state          →  props.document
//   2. renders it through an INSTRUMENTED registry (data-ak-id handles)
//   3. emits a `select` event carrying the clicked node's id
//   4. reflects the current selection back in (props.selected) so it can outline
//
// That atom is CODE (it lives in core, @noidmejs/atomkit) — the composer stays
// pure .aql:
//
//   render-document  document={{state.doc}}  selected={{state.selectedId}}
//                    on:select="set(selectedId, event.id)"
//
// This spike prototypes the atom and proves the selection ROUND-TRIP at the data
// layer (no browser needed): render → simulated click → closest(data-ak-id) →
// reducer resolves the node → aria-live string → re-render outlines it. State
// binding uses the SHIPPED expr evaluator (evalExpr) — the real 1.0 mechanism.

import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Render, defaultAtoms, instrumentRegistry, NODE_ID_ATTR, evalExpr, parseDocument,
} from '/Users/noidme/atomkit/dist/index.js';

// ── The document being EDITED (would live in composer state.doc). Uses UUID-ish
//    ids the EDITOR mints — NOT compilePage positional ids, which shift on insert.
const editedDoc = {
  version: 1,
  root: [
    { id: 'u_sect', type: 'section', children: [
      { id: 'u_head', type: 'heading', props: { text: 'Pricing', level: 2 } },
      { id: 'u_row', type: 'row', children: [
        { id: 'u_card1', type: 'box', children: [{ id: 'u_t1', type: 'text', props: { text: 'Free' } }] },
        { id: 'u_card2', type: 'box', children: [{ id: 'u_t2', type: 'text', props: { text: 'Pro' } }] },
      ] },
    ] },
  ],
};
parseDocument(editedDoc); // proves the edited doc is a valid, unique-id document

// ── PROTOTYPE of the core `render-document` atom ─────────────────────────────
// Signature it needs from the interactive atom contract (NEW in core):
//   props.document : BuilderDocument (from state)
//   props.selected : string | undefined (selected node id, from state)
//   p.emit         : (event, payload) => void   ← runtime-supplied; undefined under static Render
// In a browser it also owns a getBoundingClientRect overlay; here we prove the
// data contract (handles + selection reflection). The atom is pure w.r.t. SSR.
function renderDocumentAtom({ props, style, className, ctx }) {
  const doc = props.document;
  if (!doc || !Array.isArray(doc.root)) return null;
  const selected = props.selected;
  // Instrument the inner registry so every inner node gets data-ak-id.
  const inner = instrumentRegistry(defaultAtoms);
  // Mark the selected subtree by tagging the host with data-ak-selected — the
  // browser build draws the overlay from getBoundingClientRect of that element;
  // here it just proves selection is reflected declaratively (no extra element).
  const registry = selected
    ? { ...inner, ...Object.fromEntries(Object.entries(inner).map(([type, def]) => [type, {
        ...def,
        render: (pp) => {
          const el = def.render(pp);
          if (el && pp.node.id === selected && typeof el === 'object' && 'props' in el) {
            return { ...el, props: { ...el.props, 'data-ak-selected': 'true' } };
          }
          return el;
        },
      }]))} : inner;
  return createElement('div', { className, style: { position: 'relative', ...style }, 'data-ak-canvas': 'true' },
    createElement(Render, { document: doc, registry, context: ctx ?? {} }));
}

// ── The composer's canvas, driven by composer state (what .aql would produce) ──
let composerState = { doc: editedDoc, selectedId: undefined };

const paint = () =>
  renderToStaticMarkup(createElement(renderDocumentAtom, {
    props: {
      // These two props come from `document={{state.doc}}` / `selected={{state.selectedId}}`.
      document: evalExpr('state.doc', { state: composerState }),
      selected: evalExpr('state.selectedId', { state: composerState }),
    },
    ctx: {},
  }));

console.log('══ 1. INITIAL CANVAS (nothing selected) ══════════════════════════');
const initial = paint();
console.log(initial);
const handles = [...initial.matchAll(new RegExp(`${NODE_ID_ATTR}="([^"]+)"`, 'g'))].map((m) => m[1]);
console.log('\nhandles rendered :', handles.join(', '));
assert.ok(handles.includes('u_card2'), 'inner node u_card2 must be addressable');
assert.ok(!initial.includes('data-ak-selected'), 'nothing selected yet');

// ── 2. SIMULATE A CLICK on the "Pro" text ────────────────────────────────────
// In the browser: canvas.addEventListener('click', e => {
//   const id = e.target.closest('[data-ak-id]')?.getAttribute('data-ak-id');
//   if (id) atom.emit('select', { id });   ← the ONLY thing the atom does
// });
// We model the event.target ancestor chain (innermost → outermost) and prove the
// closest() lookup resolves the id the same way.
const eventTargetChain = ['u_t2', 'u_card2', 'u_row', 'u_sect']; // DOM ancestors carrying data-ak-id
const closestId = eventTargetChain.find((id) => handles.includes(id)); // = closest('[data-ak-id]')
assert.equal(closestId, 'u_t2', 'closest() must resolve the innermost handle');
console.log('\n══ 2. CLICK on "Pro" text ════════════════════════════════════════');
console.log('closest([data-ak-id]) resolves →', closestId);

// The atom emits; the composer reducer runs `set(selectedId, event.id)`.
// That is exactly the shipped action semantics (whitelisted `set` verb).
const emit = (event, payload) => {
  assert.equal(event, 'select');
  // reducer for `on:select="set(selectedId, event.id)"`:
  composerState = { ...composerState, selectedId: payload.id };
};
emit('select', { id: closestId });
console.log('reducer set(selectedId, event.id) → state.selectedId =', composerState.selectedId);

// ── 3. ARIA-LIVE announcement (keyboard + SR parity) ─────────────────────────
// Selection MUST announce. The string is derived from the resolved node.
const findNode = (nodes, id) => {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children) { const f = findNode(n.children, id); if (f) return f; }
  }
  return null;
};
const nodePath = (nodes, id, trail = []) => {
  for (const n of nodes) {
    const here = [...trail, n];
    if (n.id === id) return here;
    if (n.children) { const f = nodePath(n.children, id, here); if (f) return f; }
  }
  return null;
};
const sel = findNode(composerState.doc.root, composerState.selectedId);
const path = nodePath(composerState.doc.root, composerState.selectedId);
const label = (n) => n.props?.text ? `${n.type} "${n.props.text}"` : n.type;
const ariaLive = `Selected ${label(sel)}, ${path.length} levels deep, inside ${label(path[path.length - 2])}.`;
console.log('\n══ 3. ARIA-LIVE (polite) ═════════════════════════════════════════');
console.log('“' + ariaLive + '”');
assert.ok(ariaLive.includes('text "Pro"'), 'announcement must name the selected node');

// ── 4. RE-PAINT reflects selection declaratively ─────────────────────────────
console.log('\n══ 4. RE-PAINT (selected node now flagged) ═══════════════════════');
const after = paint();
console.log(after);
assert.ok(after.includes('data-ak-selected="true"'), 'selected node must carry the overlay flag');
// The overlay flag is on the SELECTED node's own element — count exactly one.
assert.equal((after.match(/data-ak-selected/g) || []).length, 1, 'exactly one node selected');
// And selection did NOT add or remove any element (still same handle set).
const handlesAfter = [...after.matchAll(new RegExp(`${NODE_ID_ATTR}="([^"]+)"`, 'g'))].map((m) => m[1]);
assert.deepEqual(handlesAfter.sort(), handles.sort(), 'selection must not change the node set');

console.log('\n════════════════════════════════════════════════════════════════');
console.log(' render-document round-trip proven:');
console.log(' state.doc → instrumented render → click → closest(id) → emit(select)');
console.log('  → set(selectedId) → aria-live → re-paint outlines it, 0 elements added');
console.log('════════════════════════════════════════════════════════════════');
