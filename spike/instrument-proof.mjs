// SPIKE — instrumented-render proof for the atomkit-composer canvas.
//
// Question this answers: can a visual editor address every rendered node WITHOUT
// changing the markup that ships? A composer needs a per-node DOM handle to
// hit-test clicks, draw a selection overlay, and measure drop zones. But
// `Render` deliberately emits NO handle: it only sets class="ak-<id>" for nodes
// that declare responsive overrides. `getElementById` and class lookup are both
// dead ends.
//
// The approach under test: `instrumentRegistry` (shipped in @noidmejs/atomkit
// 0.7.0) wraps each atom's `render` and `cloneElement`s the returned root to
// inject `data-ak-id`. No wrapper element is added, so flex/grid layout is
// untouched; an atom that returns null stays null.
//
// This spike consumes the REAL shipped primitive (not a reimplementation) and
// runs it through react-dom/server, printing the markup diff and asserting the
// invariants the composer depends on. Run: `node instrument-proof.mjs`.

import assert from 'node:assert/strict';
import { createElement, cloneElement, isValidElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
// Consumed from the built core by absolute path (the composer repo has no build).
import {
  Render,
  defaultAtoms,
  compilePage,
  instrumentRegistry,
  NODE_ID_ATTR,
} from '/Users/noidme/atomkit/dist/index.js';

const render = (doc, registry, ctx = {}) =>
  renderToStaticMarkup(createElement(Render, { document: doc, registry, context: ctx }));
const stripHandles = (s) => s.replace(new RegExp(` ${NODE_ID_ATTR}="[^"]*"`, 'g'), '');
const elementCount = (s) => (s.match(/<[a-z]/g) || []).length;
const allNodeIds = (nodes, acc = []) => {
  for (const n of nodes) { acc.push(n.id); if (n.children) allNodeIds(n.children, acc); }
  return acc;
};

// A document that exercises every worry: a FLEX row and a GRID (wrapper divs
// would break these), an <img> and a <button> as layout children, plus two
// atoms that render NOTHING (unsafe image src, invalid icon path → null).
const doc = compilePage(`page "canvas" {
  row {
    text "Left"
    button "Click me"
  }
  grid cols=3 {
    image src=/hero.webp alt="Hero"
    heading "Title" level=3 size=14px md:size=3rem
    chip "New"
  }
}`);
// Inject the two null-rendering atoms as extra roots (compilePage can't author
// an unsafe src, that's the point of the safety filter).
doc.root.push(
  { id: 'bad-img', type: 'image', props: { src: 'javascript:alert(1)' } }, // safeImageSrc → null
  { id: 'bad-icon', type: 'icon', props: { path: '<script>' } },            // invalid path → null
  { id: 'survivor', type: 'text', props: { text: 'still here' } },
);

const instrumented = instrumentRegistry(defaultAtoms);
const plain = render(doc, defaultAtoms);
const inst = render(doc, instrumented);

console.log('════════════════════════════════════════════════════════════════');
console.log(' UNINSTRUMENTED (what ships)');
console.log('════════════════════════════════════════════════════════════════');
console.log(plain);
console.log();
console.log('════════════════════════════════════════════════════════════════');
console.log(' INSTRUMENTED (what the composer canvas renders)');
console.log('════════════════════════════════════════════════════════════════');
console.log(inst);
console.log();
console.log('════════════════════════════════════════════════════════════════');
console.log(' DIFF: instrumented with data-ak-id stripped  vs  plain');
console.log('════════════════════════════════════════════════════════════════');
console.log('byte-identical after stripping data-ak-id :', stripHandles(inst) === plain);
console.log('element count plain / instrumented        :', elementCount(plain), '/', elementCount(inst));
console.log('handles injected                          :', (inst.match(new RegExp(NODE_ID_ATTR, 'g')) || []).length);
console.log();

// Show, node by node, that the ONLY textual difference is the injected attribute.
const handles = [...inst.matchAll(new RegExp(`${NODE_ID_ATTR}="([^"]+)"`, 'g'))].map((m) => m[1]);
console.log('handles, in document order                :', handles.join(', '));
console.log();

// ── INVARIANT 1: markup is byte-identical apart from the attribute ────────────
assert.equal(stripHandles(inst), plain, 'INV1 FAILED: instrumented markup differs beyond data-ak-id');

// ── INVARIANT 2: no element added or removed (no wrapper divs) ────────────────
assert.equal(elementCount(inst), elementCount(plain), 'INV2 FAILED: element count changed');

// ── INVARIANT 3: flex/grid children are still the atoms themselves ────────────
// If a wrapper div existed, the flex/grid item would be that div, not the atom,
// silently collapsing the layout. Assert the first child after each container.
const firstChildTag = (markup, styleFragment) => {
  const at = markup.indexOf(styleFragment);
  const gt = markup.indexOf('>', at);
  const m = markup.slice(gt + 1).match(/^\s*<([a-z]+)([^>]*)>/);
  return m ? { tag: m[1], attrs: m[2] } : null;
};
const flexChild = firstChildTag(inst, 'display:flex');
const gridChild = firstChildTag(inst, 'display:grid');
assert.equal(flexChild?.tag, 'p', 'INV3 FAILED: flex container gained a wrapper');
assert.ok(flexChild.attrs.includes(NODE_ID_ATTR), 'INV3 FAILED: flex child not tagged');
assert.equal(gridChild?.tag, 'img', 'INV3 FAILED: grid container gained a wrapper');
assert.ok(gridChild.attrs.includes(NODE_ID_ATTR), 'INV3 FAILED: grid child not tagged');
console.log('flex container → first child              :', `<${flexChild.tag}>  (tagged: ${flexChild.attrs.includes(NODE_ID_ATTR)})`);
console.log('grid container → first child              :', `<${gridChild.tag}>  (tagged: ${gridChild.attrs.includes(NODE_ID_ATTR)})`);

// ── INVARIANT 4: null-rendering atoms are NOT conjured into existence ─────────
assert.ok(!inst.includes('bad-img'), 'INV4 FAILED: null image atom got a handle');
assert.ok(!inst.includes('bad-icon'), 'INV4 FAILED: null icon atom got a handle');
assert.ok(inst.includes(`${NODE_ID_ATTR}="survivor"`), 'INV4 FAILED: sibling of null atom lost its handle');
console.log('null atoms (bad-img, bad-icon)            : no handle conjured; survivor keeps its handle ✓');

// ── INVARIANT 5: every RENDERED node is addressable exactly once ──────────────
// This is the selection substrate: closest('[data-ak-id]') must resolve to a
// unique node. Rendered nodes = all nodes minus the two that return null.
const rendered = allNodeIds(doc.root).filter((id) => id !== 'bad-img' && id !== 'bad-icon');
assert.deepEqual([...handles].sort(), rendered.sort(), 'INV5 FAILED: rendered nodes not 1:1 with handles');
assert.equal(new Set(handles).size, handles.length, 'INV5 FAILED: duplicate handle');
console.log('addressability                            : every rendered node ↔ exactly one handle ✓');

// ── INVARIANT 6: governance still holds through the instrumented registry ─────
const pii = compilePage('page "p" {\n  text "ada@corp.com" pii\n  text "board only" protected\n}');
const piiOut = render(pii, instrumented, {});
assert.ok(!piiOut.includes('ada@corp.com'), 'INV6 FAILED: PII leaked');
assert.ok(piiOut.includes('•••••'), 'INV6 FAILED: PII mask missing');
assert.ok(!piiOut.includes('board only'), 'INV6 FAILED: protected node rendered');
console.log('governance                                : PII masked, protected omitted — mask not bypassed ✓');

// ── EDGE: a Fragment-root atom cannot receive a handle (documented limit) ─────
// cloneElement on a Fragment injects data-ak-id as a Fragment prop, which React
// drops (Fragment accepts only key/children). So an atom whose ROOT is a bare
// Fragment is UNADDRESSABLE. None of the 19 default atoms do this, but any new
// editor atom MUST return a real host element (or null), never a bare Fragment.
const fragOut = renderToStaticMarkup(
  cloneElement(createElement(Fragment, null, createElement('i', null, 'x')), { [NODE_ID_ATTR]: 'frag' }),
);
assert.ok(!fragOut.includes(NODE_ID_ATTR), 'a Fragment unexpectedly kept the handle');
console.log('fragment-root edge                        : Fragment drops the handle → atoms must root a host element ✓');

// ── NEGATIVE CONTROL: the naive wrapper-div implementation DOES break things ──
// Proves the invariants above can actually fail — a test that cannot fail is
// worthless.
const wrapped = Object.fromEntries(Object.entries(defaultAtoms).map(([type, def]) => [type, {
  ...def,
  render: (p) => {
    const el = def.render(p);
    if (!isValidElement(el)) return el;
    return createElement('div', { [NODE_ID_ATTR]: p.node.id }, el);
  },
}]));
const bad = render(doc, wrapped);
assert.notEqual(stripHandles(bad), plain, 'NEG CONTROL FAILED: wrapper not detected as different');
assert.ok(elementCount(bad) > elementCount(plain), 'NEG CONTROL FAILED: extra elements not detected');
assert.notEqual(firstChildTag(bad, 'display:flex')?.tag, 'p', 'NEG CONTROL FAILED: flex wrapper not detected');
console.log();
console.log('NEGATIVE CONTROL (wrapper-div impl)       : +' + (elementCount(bad) - elementCount(plain)) +
            ' elements, flex first child now <' + firstChildTag(bad, 'display:flex')?.tag + '> — invariants correctly catch it ✓');

console.log();
console.log('════════════════════════════════════════════════════════════════');
console.log(' ALL INVARIANTS HELD — instrumented-render is a sound canvas substrate');
console.log('════════════════════════════════════════════════════════════════');
