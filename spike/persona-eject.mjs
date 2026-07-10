// SPIKE: can a GOVERNED page eject to React without losing its governed content?
//
// Today it cannot. `compileDocumentToReact` drops every node that declares any
// governance, because a single static artifact cannot enforce per-viewer gating and
// must not pretend to. So "governed by construction" and "portable by default" do
// not both hold for the same page — the objection the CEO raised, and the one that
// separates atomkit from MXML (a proprietary language with no exit).
//
// THE WRONG FIX, stated so it is never attempted: emit ONE component that takes a
// `context` prop and gates at render time. That ships every viewer's content to
// every viewer's browser and hides it with a conditional. It is exactly what
// atomkit refuses — governance would become a CSS-class-level lie.
//
// THE IDEA UNDER TEST: nothing says there must be ONE artifact. Eject one bundle
// PER PERSONA, each compiled from a document already stripped for that persona.
// Each file then physically contains only what that viewer may receive. Governance
// survives because it was enforced before compilation; portability survives because
// each file is plain React with no runtime dependency.

import { readFileSync } from 'node:fs';
import { compilePage, stripDocument } from '@noidmejs/atomkit';
import { compileDocumentToReact } from '@noidmejs/atomkit-compiler';

const src = readFileSync(new URL('./index.aql', import.meta.url), 'utf8');
const doc = compilePage(src);

const PERSONAS = {
  public: {},
  recruiter: { roles: ['recruiter'] },
  admin: { canViewPii: true, canViewProtected: true, roles: ['recruiter'], consent: { marketing: true } },
};

/** Governance was enforced by stripDocument. Clear the declarations so the compiler
 *  does not drop nodes a second time — it cannot know they are already accounted for. */
function clearSecurity(nodes) {
  return nodes.map((n) => {
    const out = { ...n };
    if (out.meta) {
      const meta = { ...out.meta };
      delete meta.security;
      if (Object.keys(meta).length) out.meta = meta; else delete out.meta;
    }
    delete out.hidden;
    if (out.children) out.children = clearSecurity(out.children);
    return out;
  });
}

const SECRETS = {
  'salary band': '120,000',
  'recruiter email': 'priya.raghunathan@northwind.health',
  'board hiring plan': 'Budget approved',
};

let fail = 0;
const check = (n, ok, d = '') => { if (!ok) fail++; console.log(`  ${ok ? '✅' : '❌'} ${n}${ok ? '' : `\n       ${d}`}`); };

console.log('\n── Today: one artifact, governance dropped ──');
{
  const warns = [];
  const tsx = compileDocumentToReact(doc, { name: 'Careers', onWarn: (w) => warns.push(w) });
  for (const [name, needle] of Object.entries(SECRETS)) {
    console.log(`   ${tsx.includes(needle) ? '👁 present' : '🚫 dropped '}  ${name}`);
  }
  check('the public content survives', tsx.includes('Join Northwind Health'));
  check('every governed node is dropped, for every viewer',
    !Object.values(SECRETS).some((s) => tsx.includes(s)));
  console.log('   ⇒ a recruiter cannot eject THEIR page at all.');
}

console.log('\n── Proposed: one bundle per persona, each pre-stripped ──');
const bundles = {};
for (const [name, ctx] of Object.entries(PERSONAS)) {
  const seen = stripDocument(doc, ctx);
  const compiled = { ...seen, root: clearSecurity(seen.root) };
  const warns = [];
  bundles[name] = compileDocumentToReact(compiled, { name: `Careers_${name}`, onWarn: (w) => warns.push(w) });
  const has = Object.entries(SECRETS).filter(([, s]) => bundles[name].includes(s)).map(([k]) => k);
  console.log(`   ${name.padEnd(10)} ${bundles[name].length.toString().padStart(5)} bytes · sees: ${has.length ? has.join(', ') : '—'}${bundles[name].includes('•••••') ? ' · PII masked' : ''}`);
  if (warns.length) console.log(`              warnings: ${warns.length}`);
}

console.log();
check('public bundle has the job ad', bundles.public.includes('Join Northwind Health'));
check('public bundle does NOT contain the salary band', !bundles.public.includes('120,000'));
check('public bundle does NOT contain the recruiter email', !bundles.public.includes('priya.raghunathan'));
check('public bundle does NOT contain the board plan', !bundles.public.includes('Budget approved'));
check('public bundle carries the PII mask', bundles.public.includes('•••••'));

check('recruiter bundle DOES contain the salary band', bundles.recruiter.includes('120,000'));
check('recruiter bundle does NOT contain PII', !bundles.recruiter.includes('priya.raghunathan'));
check('recruiter bundle does NOT contain the board plan', !bundles.recruiter.includes('Budget approved'));

check('admin bundle contains PII', bundles.admin.includes('priya.raghunathan'));
check('admin bundle contains the board plan', bundles.admin.includes('Budget approved'));

check('each bundle is standalone React (no atomkit import)',
  Object.values(bundles).every((b) => b.includes("import * as React") && !b.includes('@noidmejs/atomkit')));

check('no bundle carries a governance declaration to gate on at runtime',
  Object.values(bundles).every((b) => !b.includes('canViewPii') && !b.includes('roles')));

check('the public bundle is strictly smaller than the admin bundle',
  bundles.public.length < bundles.admin.length);

console.log(
  fail
    ? `\n  ${fail} CHECK(S) FAILED\n`
    : '\n  A governed page CAN eject completely — as one artifact per persona.\n' +
      '  Governance survives because it was enforced BEFORE compilation.\n' +
      '  Portability survives because each file is plain React, no runtime dep.\n' +
      '  The bytes another viewer would see are not in the file. Not hidden. Absent.\n',
);
process.exit(fail ? 1 : 0);
