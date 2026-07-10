// PROOF — G5: navigate must not exfiltrate. A navigate target cannot carry data to
// an arbitrary host, and a `call` (data source) routes THROUGH atomkit-http's SSRF
// host allow-list, never around it.
//
//   node spike/g5-safe-navigate.mjs
//
// Two mechanisms under test:
//   * safeNavigate (@noidmejs/atomkit dist/navigate.js) — the navigate host allow-list.
//   * createProxy  (@noidmejs/atomkit-http) — the SSRF allow-list the `call` verb uses.
//
// What is proven:
//   1. The HOLE, reproduced: safeHref passes an https exfil URL unchanged (gate G5).
//   2. safeNavigate blocks off-list destinations, allows allow-listed ones.
//   3. Same-origin (relative / query / fragment) is allowed — and WHY.
//   4. mailto:/tel: default-deny, opt-in allow.
//   5. Adversarial: //host, /\host, userinfo @-trick, javascript:/data:, bare host.
//   6. isHostAllowed matches atomkit-http's hostAllowed byte-for-byte.
//   7. `call` through createProxy: off-list host, param-injected host, and an
//      off-list REDIRECT are each rejected; an allow-listed call succeeds.

import assert from 'node:assert/strict';
import { safeHref } from '/Users/noidme/atomkit/dist/index.js';
import { safeNavigate, isHostAllowed } from '/Users/noidme/atomkit/dist/navigate.js';
import { createProxy } from '/Users/noidme/atomkit-http/dist/index.js';

const PII = 'SSN 123-45-6789';
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${detail ? `\n       ${detail}` : ''}`); }
};

console.log('\n══ G5 · navigate must not exfiltrate ═════════════════════════════\n');

// The policy the host app supplies (via RenderContext for navigate; the SAME list is
// atomkit-http's ProxyConfig.allowHosts for call). Own origin + trusted partners.
const POLICY = { allowHosts: ['app.northwind.health', '.northwind.health'] };
const nav = (u, p = POLICY) => safeNavigate(u, p);

// ── 1. THE HOLE (what the gate reproduces today) ─────────────────────────────
console.log('1. The hole: safeHref blocks schemes, not destinations');
{
  const exfil = `https://attacker.io/?d=${encodeURIComponent(PII)}`;
  check('safeHref PASSES the exfil URL unchanged (this is why G5 is open)',
    safeHref(exfil) === exfil, `safeHref returned ${JSON.stringify(safeHref(exfil))}`);
}

// ── 2. safeNavigate enforces the DESTINATION ─────────────────────────────────
console.log('\n2. safeNavigate blocks off-list hosts, allows allow-listed ones');
{
  const exfil = `https://attacker.io/?d=${encodeURIComponent(PII)}`;
  check('off-list https destination → BLOCKED (null)', nav(exfil) === null,
    `got ${JSON.stringify(nav(exfil))}`);
  check('allow-listed exact host → allowed', nav('https://app.northwind.health/careers') === 'https://app.northwind.health/careers');
  check('allow-listed subdomain (.suffix) → allowed', nav('https://careers.northwind.health/x') === 'https://careers.northwind.health/x');
  check('an empty allow-list blocks EVERY cross-origin host',
    safeNavigate('https://app.northwind.health/x', { allowHosts: [] }) === null);
  check('off-list host still blocked even with a matching query payload removed',
    nav('https://attacker.io') === null);
}

// ── 3. SAME-ORIGIN is safe — relative, query, fragment ───────────────────────
console.log('\n3. Same-origin targets carry no data to a foreign host → allowed');
{
  check('fragment "#section" (no network request at all)', nav('#pricing') === '#pricing');
  check('query "?q=1" (same origin + path; goes to your own server)', nav('?tab=2') === '?tab=2');
  check('absolute path "/careers"', nav('/careers') === '/careers');
  check('relative "./apply"', nav('./apply') === './apply');
  check('relative "../up"', nav('../up') === '../up');
}

// ── 4. mailto:/tel: — default deny, opt-in allow ─────────────────────────────
console.log('\n4. mailto:/tel: are off-device channels → default deny, opt-in');
{
  const mailtoExfil = `mailto:attacker@evil.com?body=${encodeURIComponent(PII)}`;
  check('mailto: blocked by default (a body carries data off-origin)', nav(mailtoExfil) === null);
  check('mailto: allowed when policy opts in',
    safeNavigate('mailto:hi@northwind.health', { ...POLICY, allowMailto: true }) === 'mailto:hi@northwind.health');
  check('tel: blocked by default', nav('tel:+15551234') === null);
  check('tel: allowed when policy opts in',
    safeNavigate('tel:+15551234', { ...POLICY, allowTel: true }) === 'tel:+15551234');
}

// ── 5. ADVERSARIAL — the tricks that look same-origin but are not ────────────
console.log('\n5. Adversarial destinations');
{
  check('protocol-relative "//attacker.io" → host-checked, BLOCKED', nav('//attacker.io/x') === null);
  check('protocol-relative to an ALLOW-listed host → allowed', nav('//app.northwind.health/x') === 'https://app.northwind.health/x' || nav('//app.northwind.health/x') === '//app.northwind.health/x');
  check('backslash "/\\attacker.io" (browsers treat as //) → BLOCKED', nav('/\\attacker.io') === null);
  check('userinfo trick "https://app.northwind.health@evil.com" → host is evil.com, BLOCKED',
    nav('https://app.northwind.health@evil.com/x') === null);
  check('javascript: → BLOCKED', nav('javascript:alert(1)') === null);
  check('data: → BLOCKED', nav('data:text/html,<script>alert(1)</script>') === null);
  check('file: → BLOCKED', nav('file:///etc/passwd') === null);
  check('bare "attacker.io/steal" (no scheme, ambiguous) → BLOCKED', nav('attacker.io/steal') === null);
  check('non-string → BLOCKED', nav(12345) === null && nav(null) === null);
  check('over-long (>2048) → BLOCKED', nav('https://app.northwind.health/' + 'a'.repeat(3000)) === null);
}

// ── 6. isHostAllowed matches atomkit-http's hostAllowed byte-for-byte ────────
// core cannot depend on the http package, so the semantics are re-implemented — and
// must not drift. Re-derive hostAllowed's exact algorithm and diff on a matrix.
console.log('\n6. isHostAllowed ≡ atomkit-http hostAllowed (cross-check, no drift)');
{
  // atomkit-http/src/proxy.ts hostAllowed, reduced to the host-vs-allow decision:
  const httpHostAllowed = (host, allow) => {
    const h = host.toLowerCase();
    return allow.some((a) => {
      const s = a.toLowerCase();
      return s.startsWith('.') ? h === s.slice(1) || h.endsWith(s) : h === s;
    });
  };
  const hosts = ['app.northwind.health', 'northwind.health', 'careers.northwind.health',
    'evil.com', 'northwind.health.evil.com', 'APP.NORTHWIND.HEALTH', 'x.y.northwind.health'];
  const allows = [['app.northwind.health'], ['.northwind.health'], ['app.northwind.health', '.northwind.health'], []];
  let mismatches = 0;
  for (const a of allows) for (const h of hosts) {
    if (isHostAllowed(h, a) !== httpHostAllowed(h, a)) mismatches++;
  }
  check(`${hosts.length * allows.length} host×allow combinations agree`, mismatches === 0,
    `${mismatches} mismatch(es)`);
}

// ── 7. `call` routes THROUGH createProxy — SSRF allow-list enforced ──────────
console.log('\n7. `call` (data source) is SSRF-guarded by atomkit-http createProxy');
{
  // A fetch that records where it was actually asked to go, and can 30x-redirect.
  const calls = [];
  const makeFetch = (behaviour = {}) => async (url) => {
    calls.push(url);
    if (behaviour.redirectTo && calls.length === 1) {
      return new Response(null, { status: 302, headers: { location: behaviour.redirectTo } });
    }
    return new Response(JSON.stringify({ ok: 'reached ' + url }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  // (a) An allow-listed source resolves and actually fetches.
  {
    const proxy = createProxy({
      allowHosts: ['api.northwind.health'],
      sources: { good: { id: 'good', url: 'https://api.northwind.health/patients' } },
      fetchImpl: makeFetch(),
    });
    const r = await proxy.resolve('good');
    check('allow-listed call → ok, fetch reached the upstream', r.ok === true && calls.length === 1);
  }

  // (b) An off-list source host → 403, no fetch.
  {
    calls.length = 0;
    const proxy = createProxy({
      allowHosts: ['api.northwind.health'],
      sources: { bad: { id: 'bad', url: 'https://attacker.io/steal' } },
      fetchImpl: makeFetch(),
    });
    const r = await proxy.resolve('bad');
    check('off-list call host → 403, upstream NEVER fetched', r.ok === false && r.status === 403 && calls.length === 0,
      `status=${r.status} calls=${calls.length}`);
  }

  // (c) A param-injected host cannot escape the allow-list (checked on the RESOLVED url).
  {
    calls.length = 0;
    const proxy = createProxy({
      allowHosts: ['api.northwind.health'],
      sources: { inj: { id: 'inj', url: 'https://{{params.host}}/x' } },
      fetchImpl: makeFetch(),
    });
    const r = await proxy.resolve('inj', { host: 'attacker.io' });
    check('param-injected off-list host → 403, never fetched', r.ok === false && r.status === 403 && calls.length === 0,
      `status=${r.status} calls=${calls.length}`);
  }

  // (d) An allow-listed host that 30x-redirects to an off-list host → 403.
  {
    calls.length = 0;
    const proxy = createProxy({
      allowHosts: ['api.northwind.health'],
      sources: { redir: { id: 'redir', url: 'https://api.northwind.health/go' } },
      fetchImpl: makeFetch({ redirectTo: 'https://attacker.io/exfil' }),
    });
    const r = await proxy.resolve('redir');
    check('allow-listed host redirecting off-list → 403 (every hop re-checked)',
      r.ok === false && r.status === 403,
      `status=${r.status} calls=${JSON.stringify(calls)}`);
  }
}

console.log('\n──────────────────────────────────────────────────────────────────');
console.log(`  ${pass} passed · ${fail} failed`);
console.log(fail ? '\n  G5 NOT closed.\n' : '\n  G5 CLOSED: navigate host allow-list + call via the SSRF proxy.\n');
process.exit(fail ? 1 : 0);
