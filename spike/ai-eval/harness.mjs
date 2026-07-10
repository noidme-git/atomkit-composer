// THE AI EVAL HARNESS — single entry point.  `node spike/ai-eval/harness.mjs`
//
// "AI friendly" as a measured number. This runs every hand-written fixture through
// the deterministic validator, prints a scorecard, PROVES the validator scored the
// labelled fixtures correctly (self-check), demonstrates the repair loop closing,
// and runs the systemPrompt drift check. Exit 0 iff every self-check holds.
//
// ⚠️  THE MODEL SUCCESS RATE IS UNMEASURED. No LLM is invoked here. The fixtures are
//     stand-ins. To measure a real model, wire a `complete()` into `generate()`
//     (see the footer) and feed its outputs to `evaluateOutput` — the scoring is
//     unchanged; only the LIVE column gets populated.

import { evaluateOutput, toRepair } from './lib.mjs';
import { CASES, REPAIRED_CAREERS } from './cases.mjs';
import { runDriftCheck, driftNegativeControl } from './drift.test.mjs';

let selfCheckFailures = 0;
const bar = (n) => '█'.repeat(Math.round(n / 10)).padEnd(10, '·');

console.log('\n══════════════════════════════════════════════════════════════════════');
console.log('  AQL AI-AUTHORING EVAL HARNESS   ·   deterministic · no model invoked');
console.log('══════════════════════════════════════════════════════════════════════');

const agg = { total: 0, pass: 0, byRegister: {} };

for (const c of CASES) {
  console.log(`\n▸ PROMPT [${c.id}]  "${c.prompt}"`);
  for (const f of c.fixtures) {
    const r = evaluateOutput(f.source, c.expect);
    agg.total++;
    if (r.verdict === 'pass') agg.pass++;
    const reg = (agg.byRegister[f.register] ??= { total: 0, pass: 0 });
    reg.total++; if (r.verdict === 'pass') reg.pass++;

    // self-check: verdict matches the label, and (for fails) the NAMED gate fired.
    const verdictOk = r.verdict === f.verdict;
    const gateOk = !f.failGate || (r.stages[f.failGate] && r.stages[f.failGate].ok === false);
    const selfOk = verdictOk && gateOk;
    if (!selfOk) selfCheckFailures++;

    const mark = r.verdict === 'pass' ? '✅' : '❌';
    const chk = selfOk ? '' : `   ‹SELF-CHECK MISMATCH: wanted ${f.verdict}/${f.failGate}›`;
    console.log(`   ${mark} [${bar(r.score)}] ${String(r.score).padStart(3)}  ${f.label}${chk}`);
    // first failing gate + one repair line, so the scorecard shows WHY.
    if (r.verdict === 'fail' && r.repair[0])
      console.log(`        └─ ${r.firstFail}: ${r.repair[0].message.slice(0, 96)}${r.repair[0].message.length > 96 ? '…' : ''}`);
  }
}

// ── the repair loop, closing deterministically ───────────────────────────────
console.log('\n──────────────────────────────────────────────────────────────────────');
console.log('  REPAIR LOOP  (subtly-wrong → structured instruction → fixed)');
console.log('──────────────────────────────────────────────────────────────────────');
{
  const careers = CASES.find((c) => c.id === 'careers');
  const broken = careers.fixtures.find((f) => f.label.startsWith('subtly-wrong: forgot pii'));
  const r1 = evaluateOutput(broken.source, careers.expect);
  console.log(`\n  round 1 — model output verdict: ${r1.verdict}  (leak gate: ${r1.stages.leak.ok ? 'ok' : 'LEAKED ' + JSON.stringify(r1.stages.leak.leaked)})`);
  console.log('  structured repair returned to the model (never swallowed):');
  for (const inst of toRepair(r1, careers.expect)) console.log(`    • [${inst.code}] ${inst.message}`);

  // The model "applies" the instruction (here: the hand-written repaired output).
  const r2 = evaluateOutput(REPAIRED_CAREERS, careers.expect);
  console.log(`\n  round 2 — repaired output verdict: ${r2.verdict}  (leak gate: ${r2.stages.leak.ok ? 'ok — nothing leaks' : 'STILL LEAKING'})`);
  const loopClosed = r1.verdict === 'fail' && r2.verdict === 'pass';
  if (!loopClosed) selfCheckFailures++;
  console.log(`  ${loopClosed ? '✅' : '❌'} loop ${loopClosed ? 'CLOSES' : 'DID NOT CLOSE'}: a validation failure became an instruction that fixed the doc.`);
}

// ── systemPrompt drift ───────────────────────────────────────────────────────
console.log('\n──────────────────────────────────────────────────────────────────────');
console.log('  SYSTEMPROMPT DRIFT CHECK  (the prompt must track the language)');
console.log('──────────────────────────────────────────────────────────────────────');
{
  const d = runDriftCheck();
  const neg = driftNegativeControl();
  console.log(`\n  probed  atoms:${d.counts.atoms}  style:${d.counts.style}  a11y:${d.counts.a11y}  + governance/data/analytics`);
  if (d.ok) console.log('  ✅ every token systemPrompt() teaches still resolves in the live parser');
  else { console.log('  ❌ DRIFT DETECTED:'); for (const f of d.failures) console.log(`     [${f.where}] "${f.tok}" — ${f.why}`); }
  console.log(`  ${neg ? '✅' : '❌'} negative control: an injected bogus key IS caught (guard is load-bearing)`);
  if (!d.ok || !neg) selfCheckFailures++;
}

// ── the number ───────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════════════════');
console.log('  SCORECARD');
console.log('──────────────────────────────────────────────────────────────────────');
console.log(`  fixtures scored          ${agg.total}`);
console.log(`  fixtures passing all gates ${agg.pass}/${agg.total}   ← these are HAND-WRITTEN, not a model`);
for (const [reg, s] of Object.entries(agg.byRegister))
  console.log(`    register ${reg.padEnd(10)} ${s.pass}/${s.total} pass`);
console.log(`  harness self-checks      ${selfCheckFailures === 0 ? 'ALL PASS' : selfCheckFailures + ' FAILED'}`);
console.log('');
console.log('  ┌────────────────────────────────────────────────────────────────┐');
console.log('  │  MODEL SUCCESS RATE: UNMEASURED                                 │');
console.log('  │  No LLM was invoked. The pass-rate above is over hand-written   │');
console.log('  │  fixtures and only proves the SCORER is correct. To measure a   │');
console.log('  │  real model, populate the LIVE column (footer) and re-run.      │');
console.log('  └────────────────────────────────────────────────────────────────┘');
console.log('\n  To measure a model (pseudocode):');
console.log('    import { generate } from "@noidmejs/atomkit";');
console.log('    for (const c of CASES) {');
console.log('      const { source } = await generate({ prompt: c.prompt, complete: yourLLM });');
console.log('      const r = evaluateOutput(source, c.expect);   // same scorer, LIVE input');
console.log('    }  // aggregate r.verdict === "pass" across cases × trials = the number.\n');

process.exit(selfCheckFailures === 0 ? 0 : 1);
