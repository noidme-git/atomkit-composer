// The AI eval harness — the DETERMINISTIC core.
//
// "AI friendly" is a measured number, not a slogan. This module turns a single
// (prompt, model-output) pair into a scored report by running the output through
// the SAME gates a rendered document must survive:
//
//   desugar → parse → parseDocument (strict, unique-id) → known-atom check →
//   lint → governance-flags-present → egress-leak probe (stripDocument).
//
// Two of these gates are ones `generate()` in atomkit@0.8.0 does NOT run today:
//   • known-atom     — parse() accepts `type: z.string()`, so `carousel` is
//                      "schema-valid" and renders to null with no signal. VERIFIED.
//   • lint           — generate() never calls lint(); a11y defects reach render.
// The harness runs them so the number reflects a real render pipeline, and every
// failure is emitted as a STRUCTURED repair instruction (never swallowed) so the
// same object can be handed back to a model.
//
// No model is invoked here. The "model outputs" are hand-written fixtures labelled
// good / subtly-wrong / hostile, and the harness proves it scores them correctly.

import { parse, parseDocument, lint, stripDocument, defaultAtoms } from '@noidmejs/atomkit';
import { desugar } from './desugar.mjs';

// ── tree helpers ─────────────────────────────────────────────────────────────
export function walk(nodes, fn, ancestors = []) {
  for (const n of nodes ?? []) {
    fn(n, ancestors);
    if (n.children) walk(n.children, fn, [...ancestors, n]);
  }
}

function collectTypes(doc) {
  const types = [];
  walk(doc.root, (n) => types.push(n.type));
  return types;
}

/** Find the node whose text contains `needle`, plus its ancestor chain (root→node). */
function findByText(doc, needle) {
  let hit = null;
  walk(doc.root, (n, ancestors) => {
    if (hit) return;
    const t = n.props?.text;
    if (typeof t === 'string' && t.includes(needle)) hit = { node: n, path: [...ancestors, n] };
  });
  return hit;
}

/** A requirement is satisfied if the node OR any ancestor carries it (cascade/gate). */
function pathSatisfies(path, require) {
  const secs = path.map((n) => n.meta?.security ?? {});
  if (require.pii && !secs.some((s) => s.pii === true)) return false;
  if (require.protected && !secs.some((s) => s.protected === true)) return false;
  if (require.roles) {
    const ok = secs.some((s) => Array.isArray(s.roles) && require.roles.every((r) => s.roles.includes(r)));
    if (!ok) return false;
  }
  if (require.consent && !secs.some((s) => s.consentCategory === require.consent)) return false;
  return true;
}

// ── the validator ────────────────────────────────────────────────────────────
// `expect.flags`     : [{ label, text, require:{pii?,protected?,roles?,consent?}, english, canonical }]
// `expect.leakProbe` : { ctx, sensitive:[...substrings that must NOT reach this viewer] }
export function evaluateOutput(source, expect = {}, registry = defaultAtoms) {
  const stages = {};
  const R = { source, canonical: null, doc: null, stages, repair: [] };

  // 1. desugar (English surface → canonical). Canonical passes through untouched.
  let canonical;
  try {
    canonical = desugar(source);
    R.canonical = canonical;
    stages.desugar = { ok: true };
  } catch (e) {
    stages.desugar = { ok: false, error: e.message };
    return finalize(R, expect);
  }

  // 2. parse — this internally runs parseDocument on every page (query.ts:331).
  let doc;
  try {
    const prog = parse(canonical);
    doc = prog.pages[0]?.document ?? { version: 1, root: [] };
    R.doc = doc;
    stages.parse = { ok: true };
  } catch (e) {
    stages.parse = { ok: false, error: e.message };
    return finalize(R, expect);
  }

  // 3. schema — strict + unique-id, explicitly (defence-in-depth / editor path).
  try {
    parseDocument(doc);
    stages.schema = { ok: true };
  } catch (e) {
    stages.schema = { ok: false, error: e.message };
    return finalize(R, expect);
  }

  // 4. known-atom — THE GAP generate() does not close. An unknown type is
  //    schema-valid but renders to null. Here it is a first-class failure.
  const unknown = [...new Set(collectTypes(doc).filter((t) => !(t in registry)))];
  stages.knownAtoms = { ok: unknown.length === 0, unknown };

  // 5. lint — generate() never calls this. WCAG-oriented warnings.
  const warnings = lint(doc);
  stages.lint = { ok: warnings.length === 0, warnings };

  // 6. governance — does the compiled doc carry the flags the brief implied?
  const missing = [];
  for (const f of expect.flags ?? []) {
    const found = findByText(doc, f.text);
    if (!found) { missing.push({ ...f, reason: 'node-not-found' }); continue; }
    if (!pathSatisfies(found.path, f.require)) missing.push({ ...f, reason: 'flag-missing' });
  }
  stages.governance = { ok: missing.length === 0, missing };

  // 7. leak — the end-to-end proof: strip for the unauthorized viewer, assert the
  //    sensitive strings are GONE (absent or masked), not merely styled away.
  if (expect.leakProbe) {
    const stripped = JSON.stringify(stripDocument(doc, expect.leakProbe.ctx));
    const leaked = expect.leakProbe.sensitive.filter((s) => stripped.includes(s));
    stages.leak = { ok: leaked.length === 0, leaked };
  } else {
    stages.leak = { ok: true, leaked: [] };
  }

  return finalize(R, expect);
}

// ── scoring + repair ─────────────────────────────────────────────────────────
const GATE_STAGES = ['desugar', 'parse', 'schema', 'leak']; // a fail here = hard fail

function finalize(R, expect) {
  const s = R.stages;
  const present = Object.keys(s);
  const okCount = present.filter((k) => s[k].ok).length;
  R.score = Math.round((okCount / present.length) * 100);
  const gateOk = GATE_STAGES.every((g) => !(g in s) || s[g].ok);
  const allOk = present.every((k) => s[k].ok);
  R.verdict = gateOk && allOk ? 'pass' : 'fail';
  R.firstFail = present.find((k) => !s[k].ok) ?? null;
  R.repair = toRepair(R, expect);
  return R;
}

/** Turn failures into model-facing, structured repair instructions. NEVER swallowed. */
export function toRepair(R, expect = {}, registry = defaultAtoms) {
  const out = [];
  const s = R.stages;
  if (s.desugar && !s.desugar.ok)
    out.push({ code: 'SYNTAX', message: `AQL did not parse: ${s.desugar.error}` });
  if (s.parse && !s.parse.ok)
    out.push({ code: 'PARSE', message: `Document rejected by the parser/schema: ${s.parse.error}` });
  if (s.schema && !s.schema.ok)
    out.push({ code: 'SCHEMA', message: `Strict schema rejected the document: ${s.schema.error}` });
  if (s.knownAtoms && !s.knownAtoms.ok) {
    const known = Object.keys(registry).join(', ');
    for (const t of s.knownAtoms.unknown)
      out.push({ code: 'UNKNOWN_ATOM', atom: t,
        message: `"${t}" is not a registered atom. Use ONLY: ${known}. Compose the effect from these; do not invent atoms.` });
  }
  if (s.lint && !s.lint.ok)
    for (const w of s.lint.warnings)
      out.push({ code: 'A11Y', node: w.id, rule: w.rule, message: `Accessibility: ${w.message}` });
  if (s.governance && !s.governance.ok)
    for (const m of s.governance.missing)
      out.push({ code: 'GOVERNANCE', label: m.label,
        message: `The brief said "${m.label}" (${m.text}) must be ${describe(m.require)}. ` +
          `Mark it — English: \`${m.english}\`; canonical: \`${m.canonical}\`.` });
  if (s.leak && !s.leak.ok)
    out.push({ code: 'LEAK', leaked: s.leak.leaked,
      message: `Egress leak: ${JSON.stringify(s.leak.leaked)} reached an unauthorized viewer. ` +
        `A governing flag (pii / roles / protected / consent) is missing on the node or its container.` });
  return out;
}

function describe(r) {
  const parts = [];
  if (r.pii) parts.push('personal data (pii)');
  if (r.protected) parts.push('confidential (protected)');
  if (r.roles) parts.push(`visible only to ${r.roles.join(', ')} (roles)`);
  if (r.consent) parts.push(`gated on ${r.consent} consent`);
  return parts.join(' and ') || 'governed';
}
