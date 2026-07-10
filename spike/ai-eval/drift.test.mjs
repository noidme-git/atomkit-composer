// systemPrompt() DRIFT TEST.
//
// systemPrompt() teaches a model the grammar, the atom catalogue, and the
// governance vocabulary. The atom list is already generated from the registry, so
// it cannot drift. But the STYLE / A11Y / SECURITY / DATA / ANALYTICS sections are
// hand-written string literals — they go stale the moment the parser moves, and a
// stale prompt teaches a model to write AQL that SILENTLY becomes an inert prop
// (`box wobble=1` → props.wobble, rendered as nothing).
//
// This test extracts every token the prompt TEACHES and PROBES it against the live
// parser. A style key must land in `.style`; an a11y key in `.a11y`; a governance
// flag in `.meta.security`. If a taught token no longer resolves, the prompt has
// drifted from the language and this test goes red — naming the exact token.
//
// It is behavioural, not structural: it never reads the parser's internal tables
// (which are not exported), so it stays correct across refactors.

import { systemPrompt } from '@noidmejs/atomkit';
import { compilePage, defaultAtoms } from '@noidmejs/atomkit';

// Throw-safe probe: a taught head that the parser/schema rejects is itself drift,
// surfaced as a null node rather than crashing the run.
const node = (head) => { try { return compilePage(`page "p" {\n  ${head}\n}`).root[0]; } catch { return null; } };
const inStyle = (k, n) => !!n && n.style && Object.keys(n.style).length > 0 && !(n.props && k in n.props);
const inA11y = (k, n) => !!n && n.a11y && Object.keys(n.a11y).length > 0 && !(n.props && k in n.props);
// A type-valid probe value per a11y key (tabindex is numeric, aria-hidden boolean).
const a11yVal = (k) => (k === 'tabindex' ? '1' : k === 'aria-hidden' ? 'true' : 'x');

function section(P, from, to) {
  const i = P.indexOf(from);
  if (i < 0) return '';
  const j = to ? P.indexOf(to, i + from.length) : P.length;
  return P.slice(i + from.length, j < 0 ? P.length : j);
}

// Fixed "must-teach" sets: the language HAS these; the prompt MUST keep teaching
// them, and the parser MUST keep honouring them. Add a row here when the parser
// gains a governance/data/analytics concept — the test then demands the prompt too.
const mustTeachSecurity = ['protected', 'pii', 'roles', 'consent'];
const mustTeachData = ['api', 'path', 'bind'];
const mustTeachAnalytics = ['track', 'event', 'category'];

// ── probes ───────────────────────────────────────────────────────────────────
// Parameterised on the prompt text so a NEGATIVE CONTROL can feed a doctored
// prompt and prove the guard is load-bearing (mutation test).
export function runDriftCheck(P = systemPrompt()) {
  const taughtAtoms = section(P, 'ATOMS AVAILABLE (use ONLY these types):', 'RULES:')
    .split('\n').map((l) => l.trim()).filter(Boolean)
    .map((l) => l.split(/\s/)[0]).filter(Boolean);
  const taughtStyle = section(P, 'STYLE keys:', 'RESPONSIVE:')
    .replace(/\([^)]*\)/g, '').split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  const taughtA11y = (section(P, 'A11Y:', '\n').match(/[a-z-]+/g) ?? []);

  const fail = [];
  const F = (where, tok, why) => fail.push({ where, tok, why });

  // Atoms — bidirectional: every taught atom is real, every real atom is taught.
  for (const a of taughtAtoms) if (!(a in defaultAtoms)) F('atom', a, 'taught but not in the registry');
  for (const a of Object.keys(defaultAtoms)) if (!taughtAtoms.includes(a)) F('atom', a, 'in the registry but not taught by the prompt');

  // Style keys — each must land in .style, not silently become a prop.
  for (const k of taughtStyle) if (!inStyle(k, node(`box ${k}=x`))) F('style', k, 'taught but the parser drops it into props (drift)');

  // A11y keys — each must land in .a11y.
  for (const k of taughtA11y) if (!inA11y(k, node(`box ${k}=${a11yVal(k)}`))) F('a11y', k, 'taught but not honoured as an a11y attribute');

  // Governance — taught AND honoured.
  for (const k of mustTeachSecurity) if (!P.includes(k)) F('security', k, 'governance vocab missing from the prompt');
  if (node('box protected').meta?.security?.protected !== true) F('security', 'protected', 'flag no longer sets meta.security.protected');
  if (node('box pii').meta?.security?.pii !== true) F('security', 'pii', 'flag no longer sets meta.security.pii');
  if (JSON.stringify(node('box roles=r').meta?.security?.roles) !== '["r"]') F('security', 'roles', 'no longer sets meta.security.roles');
  if (node('box consent=c').meta?.security?.consentCategory !== 'c') F('security', 'consent', 'no longer sets meta.security.consentCategory');

  // Data + analytics — taught AND honoured.
  for (const k of mustTeachData) if (!P.includes(k)) F('data', k, 'data vocab missing from the prompt');
  if (node('box api=u').data?.source?.url !== 'u') F('data', 'api', 'no longer sets data.source.url');
  if (node('box path=p').data?.source?.path !== 'p') F('data', 'path', 'no longer sets data.source.path');
  if (node('box bind=text').data?.bindTo !== 'text') F('data', 'bind', 'no longer sets data.bindTo');

  for (const k of mustTeachAnalytics) if (!P.includes(k)) F('analytics', k, 'analytics vocab missing from the prompt');
  if (node('box track=t').meta?.analytics?.id !== 't') F('analytics', 'track', 'no longer sets meta.analytics.id');
  if (node('box event=e').meta?.analytics?.event !== 'e') F('analytics', 'event', 'no longer sets meta.analytics.event');
  if (node('box category=c').meta?.analytics?.category !== 'c') F('analytics', 'category', 'no longer sets meta.analytics.category');

  return {
    ok: fail.length === 0,
    failures: fail,
    counts: { atoms: taughtAtoms.length, style: taughtStyle.length, a11y: taughtA11y.length },
  };
}

// NEGATIVE CONTROL: doctor the live prompt to teach a style key the parser does
// NOT honour. The check MUST catch it — otherwise the guard is dead. Returns the
// caught failure (or null if the guard failed to fire).
export function driftNegativeControl() {
  const doctored = systemPrompt().replace('STYLE keys:\n', 'STYLE keys:\n  wobble,\n');
  const r = runDriftCheck(doctored);
  return r.failures.find((f) => f.where === 'style' && f.tok === 'wobble') ?? null;
}

// Run standalone: `node drift.test.mjs`
if (import.meta.url === `file://${process.argv[1]}`) {
  const r = runDriftCheck();
  console.log(`\n  systemPrompt drift check — atoms:${r.counts.atoms} style:${r.counts.style} a11y:${r.counts.a11y}`);
  if (r.ok) console.log('  ✅ every taught token still resolves in the live parser');
  else { console.log('  ❌ DRIFT:'); for (const f of r.failures) console.log(`     [${f.where}] "${f.tok}" — ${f.why}`); }
  const neg = driftNegativeControl();
  console.log(neg ? '  ✅ negative control: an injected bogus style key IS caught (guard is load-bearing)\n'
                  : '  ❌ negative control FAILED: the guard did not catch an injected bogus key\n');
  process.exit(r.ok && neg ? 0 : 1);
}
