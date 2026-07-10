# CTO Ruling — 2026-07-10

Author: CTO. Every claim below was executed on this machine (Node v25.8.0, satisfies `engines >=22`).
"Ran" means I executed it; "unverified" means I did not. I re-verified the facts I depend on rather than
trusting the briefing.

Two rulings. Both are blunt on purpose.

- **Ruling 1 (ship `@noidmejs/atomkit@0.8.0`): REWORK.** Split the release. Ship the security fix +
  `instrumentRegistry`. Carve the expression evaluator out of the published surface.
- **Ruling 2 (AQL 1.0 direction): REWORK.** The direction is sound and the spec has already absorbed the
  red-team. No code may be written until `G2` (strip-before-scope) and `G6` (`{{ }}` parse) are HELD.

---

## What I ran (evidence log)

| Check | Command / file | Result |
|---|---|---|
| atomkit build + full suite | `npm run build && npm test` | GREEN (7 suites incl. expr 4000-fuzz, instrument neg-control, regressions) |
| compiler conformance @ 0.7.0 baseline | `atomkit-compiler npm test` | GREEN, 21 docs |
| compiler conformance @ **0.8.0 candidate** | overlaid new `dist/` into compiler `node_modules`, re-ran | **GREEN, 21 docs** — 0.8.0 does not break conformance |
| maskNode leak in **published 0.7.0** | ran installed `dist/security.js` (`{ ...node, props }`, line 65) through `stripDocument` | LEAKS SSN, PII-via-`state`, action string |
| maskNode fix | reproduced OLD spread impl vs `security.ts:81-110` (explicit rebuild) | fix drops `secret`/`state`/`on`; SSN/PII/action gone |
| evaluator call sites | `grep` across all repo `src/` | **ZERO**. Nothing evaluates `{{ }}` anywhere |
| G2 strip-before-scope | `evalExpr('state.doc.root[0].props.text', {state:{doc:piiDoc}})` | returns raw `"SSN 123-45-6789"` — LEAK |
| G5 navigate exfil | `safeHref('https://attacker.io/?d=SSN%20123-45-6789')` | returned **unchanged** — exfil channel open |
| G6 `{{ }}` vs `{ }` | `parse('page "p" { box document={{state.doc}} }')` | `props.document === ""` — silent empty, no error |
| G6 quoted | `parse('... text "count: {{state.n}}" ...')` | survives literal; `interpolate(...)` → `"count: 5"` |
| schema node-level strict (#6) | `parseDocument` with `state`/`on`/`when`/`each`/`bindings` at node level | all **REJECTED** (good) |
| props open-record smuggle (#7) | `parseDocument` with `props:{ state, 'on:click', when }` | **ACCEPTED** — smuggles |
| serialize drop (K5) | `serialize` on node with unknown `state` field | **silently dropped**, no throw |
| FUNCTIONS export | `import * as ak; ak.FUNCTIONS.__injected = ...` | **assignable** — exported mutable singleton |
| http / app | `npm run build && npm test` | both GREEN |

Compiler `node_modules` restored to pristine 0.7.0 afterward; no source file mutated.

---

# RULING 1 — `@noidmejs/atomkit@0.8.0`: **REWORK**

The proposed 0.8.0 bundles three things. Two are done. One is premature and freezes a surface we are already
planning to change. **Do not ship them as one release.**

## Bar-by-bar

**Bar 1 — runtime and compiler agree; conformance green, covers every new feature.** MET for what ships, with
one honest caveat. I ran the 21-doc conformance suite against the 0.8.0 candidate `dist/` (overlaid into the
compiler's `node_modules`): GREEN. But "covers every new feature" is *vacuous* for the evaluator: it has **zero
call sites** in the runtime renderer or the compiler, so there is no shared semantic for conformance to test.
`instrumentRegistry` is runtime-only by design (static compiled output is not instrumented) and is covered by
`test/instrument.test.mjs`. Conformance does not, and cannot yet, exercise `expr.ts` — because nothing renders
an expression.

**Bar 2 — every new schema field round-trips.** MET, vacuously. 0.8.0 adds **no** schema field and no
`serialize` change. The evaluator's `Expr` AST is not a schema field and does not pass through
`parseDocument`/`serialize` today. Nothing to round-trip.

**Bar 3 — evaluator fuzzed with hostile input, cannot escape.** MET for the *sandbox*. `test/expr.test.mjs` ran
green: 4000 deterministic fuzz cases, static + dynamic prototype guards (`expr.ts:200,242,262`), own-property
reads only (`expr.ts:260-272`), function whitelist (`expr.ts:231`), isolated DoS caps, AST asserted pure data.
I independently confirmed the dynamic `__proto__` guard returns `undefined` against a `JSON.parse`d hostile
object. I did **not** personally re-run the 8-guard delete-each mutation loop (ADR-002 claims it); the negative
controls (`rejects(...)`) are present and green. "Cannot escape the interpreter" is proven. That is **not** the
same as "governance holds" — see Bar 4.

**Bar 4 — a masked value is unreachable from state, expressions, and actions, proven by a test.** **UNMET for
the direction; technically MET for 0.8.0's actual behavior — and that gap is the whole problem.** I ran the
governance gate's G2: `evalExpr('state.doc.root[0].props.text', {state:{doc: piiDoc}})` returns the raw
`"SSN 123-45-6789"`. The evaluator will read a masked value the instant a host puts an **unstripped** document
in scope. In 0.8.0 nothing feeds it a document (zero call sites), so no code path reaches a masked value today —
but shipping the evaluator now publishes a loaded gun whose only safety is "the host must build scope from the
stripped doc," an invariant **no shipped code enforces**. `Render` itself masks via `maskNode` at
`render.tsx:54`, so the render path is safe; the evaluator is the unwired hazard.

**Bar 5 — every important test has a demonstrated negative control.** MET. `instrument.test.mjs` ships the
wrapper-`<div>` negative control (I read it; it asserts the structural checks fail against the naive impl).
For maskNode I *personally* reproduced the OLD `{ ...node, props }` implementation and watched it leak the SSN,
the PII-bearing `state`, and the action string — then confirmed `security.ts:81-110` drops all three. The
regression at `test/regressions.test.mjs:162-205` is that guard.

**Bar 6 — all repos build, test, CI green on the Node matrix.** MET locally. atomkit, compiler (baseline **and**
against the 0.8.0 candidate), http, app: all GREEN on Node v25.8.0. The 22/24/26 CI matrix is CI's job —
**unverified by me**. `atomkit-composer` has no buildable code yet (docs + spikes); `atomkit-release` is CI
config — both N/A for 0.8.0.

**Bar 7 — published surface intentional; no accidental exports, no unversioned breaking change.** **UNMET.**
`index.ts:12` (`export * from './expr.js'`) would freeze **ten** new value exports plus the `Expr`/`BinOp`/`Scope`
types as a semver commitment. Three defects:
1. **`FUNCTIONS` is an exported, mutable singleton** (`expr.ts:52`). I set `ak.FUNCTIONS.__injected` from outside
   and it stuck. A hostile *document* cannot reach it, but exporting the evaluator's internal function table,
   writable, process-wide, is an accidental surface and a foot-gun. It must be `Object.freeze`d or not exported.
2. **`parseExpr`'s contract is contested and slated to change.** The AQL 1.0 spec §4 (K2) proposes *adding a
   reference-root allowlist inside `expr.ts`*, while the governance gate G7 says there is deliberately no root
   check. Publishing `parseExpr` now freezes a function both documents want to redefine — an unversioned
   breaking change in waiting.
3. **`interpolate`/`evalExpr`/`parseExpr`/`evaluate` are inert** (zero call sites). Publishing an inert public
   API invites external consumers to pin a contract that is not settled.

`instrumentRegistry`/`NODE_ID_ATTR` are the opposite: stable contract (inject an attr via `cloneElement`; there
is no design flux about it), negative-controlled test, and a real imminent consumer (the composer canvas).

## The two specific sub-questions

- **"Is shipping an unused public API right?"** No. It prematurely freezes a surface (Bar 7). Keep `expr.ts` on
  `main`, tested in CI, but **remove it from the published surface** until it has a call site and its contract
  (root allowlist: yes/no) is decided.
- **"The maskNode fix is live — does that argue for shipping now regardless?"** Yes — and that is exactly why I
  **reject the bundling**, not the fix. I reproduced the leak in *installed* `0.7.0` (`dist/security.js:65`).
  Ship the fix now; do not make a live security patch wait behind a premature evaluator.
- **"`parseExpr` accepts any bare identifier as a `ref` root (#5) — defect or correct?"** **Correct.** The host
  defines the scope; the scope *is* the boundary. A grammar-level root allowlist is not a real control (it cannot
  know what the host placed in scope, and a host can name its roots `state`/`event` regardless). #5 is not an
  evaluator defect — it is the demolition of a *design* that assumed the rule existed. The proof must be rebuilt
  on strip-before-scope, not on a grammar rule. (This is *also* why freezing `parseExpr` now is wrong: the team
  is still arguing about whether to add the very check #5 is about.)

## Ruling 1 verdict — REWORK. The specific defect and the fix

**Defect:** the release as proposed violates **Bar 7** — it publishes the full `expr.ts` surface (a mutable
`FUNCTIONS` table + an `Expr`/`parseExpr` contract the AQL 1.0 spec explicitly plans to change) with **zero call
sites**, and it does so while **Bar 4** (masked value unreachable from expressions) is only vacuously satisfied
because the evaluator is unwired.

**Fix — split the release:**
- **Ship `0.8.0` = the `maskNode` security fix + `instrumentRegistry`/`NODE_ID_ATTR`.** Both are done, tested,
  negative-controlled, conformance-green, contract-stable, with real consumers. Minor bump is correct semver
  (additive exports + a bugfix). The security fix should not wait.
- **Hold the evaluator out of the published surface.** Remove `export * from './expr.js'` from `index.ts` (keep
  the file, keep the tests running in CI). It re-enters the surface in the release that (a) gives it a call site
  in the render path so conformance can cover it, (b) settles the root-allowlist question, (c) freezes/hides
  `FUNCTIONS`, and (d) lands strip-before-scope so Bar 4 holds for real.
- **Version plan (Bar 7):** publish `0.8.0`. Downstream pins `^0.7.0` = `>=0.7.0 <0.8.0`, so **nothing
  auto-consumes it** — a deliberate bump is required. `atomkit-app` renders at egress (`stripDocument`) and
  should bump to `^0.8.0` (its own patch release) to consume the governance fix. Whether `http`/`compiler` call
  `maskNode` should be checked before their next release (not blocking 0.8.0). npm never re-uses a version — do
  not tag `0.8.0` until the evaluator is carved out, or the inert surface is frozen forever.

---

# RULING 2 — AQL 1.0 direction: **REWORK** (salvageable)

The spec at `docs/specs/aql-1.0-language.md` has already done the hard, honest thing: it re-ran the charter
against `dist/`, tabled the charter's false claims (§1), chose typed node-fields over wrapper atoms (§6 — correct:
fail-closed, strict, no duplicate ids), chose AST-as-data for the compiler (ADR-004 — correct), and named
strip-before-scope + literal-only state as the real invariants (§8). The direction is sound. It is **REWORK, not
APPROVE**, because three governance gates are still OPEN and the gate correctly exits 1.

## Which of the 15 holes are real (I verified the load-bearing ones)

**REAL, load-bearing:**
- **G2 strip-before-scope leak.** I ran it: an expression over the *unstripped* document returns the raw SSN.
  This is *the* governance-critical hole. The mask is destructive, but the editor holds the original by
  definition (ADR-005 correction is right).
- **G5 navigate exfiltration.** I ran `safeHref('https://attacker.io/?d=SSN...')` → **returned unchanged.**
  `url.ts:3-13` blocks *schemes* (`javascript:`, `data:`, `//host`), never *destinations*. A `navigate` verb
  guarded by `safeHref` is an open exfil channel.
- **G6 `{{ }}` / `{ }` collision.** I ran the real parser: `box document={{state.doc}}` →
  `props.document === ""`. Silent data loss. `{` opens a block; the interpolation syntax collides.
- **#7 props open-record smuggle.** I ran it: `parseDocument` accepts `props:{ state, 'on:click', when }`
  (`schema.ts:195` is `z.record(z.string(), z.unknown())`). Node-level strictness (`schema.ts:192`) does **not**
  guard the props bag.
- **#1 maskNode fail-open.** Was live in published 0.7.0; now fixed. Reproduced both directions.
- **#4 evaluator has zero call sites.** True. The `{{ }}` feature is entirely unwired today.

**REAL but NOT a defect (noise as a "security hole", signal as a killed proof):**
- **#5 no root allowlist.** Correct by design (G7). It is *noise* as a vulnerability and *load-bearing* as the
  refutation of any proof that assumed the rule existed.
- **#6 "schema change not listed."** The strict schema *correctly rejects* the new node fields (I confirmed all
  five). The criticism was of a stale design doc; the spec now lists the schema change (K4). Documentation
  defect, since closed.

## Is `{{ }}` viable? No, except quoted. Here is the syntax that is.

`{{ }}` is **not viable in an unquoted/value position** — `{` opens a block, so it silently parses to `""`.
It **is viable inside quoted string values** (I confirmed `"count: {{state.n}}"` survives and `interpolate`
resolves it). Ruling:
1. **Interpolation is quoted-only.** `{{ }}` lives only inside string literals: `text "count: {{state.n}}"`.
2. **A bare `{{` in value position is a parse ERROR.** Fail loud, not silent-empty. (This is G6's fix.)
3. **Expression-valued node fields do not use `{{ }}` at all.** `when`, `each.in`, and `on` hold a *canonical
   expression string* directly (`when="state.count > 3"`), parsed by `parseExpr`. This sidesteps the
   block-delimiter collision entirely, because the expression is the whole value, never embedded in `{...}`.

## Minimum provably-safe subset that could ship first (READ-ONLY reactivity)

1. **State** — page-level and node-level, **literal-only** (§3). Literal-only is the load-bearing rule: state
   can never be seeded from a governed value. `maskNode` already drops node-level `state` (G3 held); page-level
   state is public-by-construction (ADR-005) and must never be initialised from a governed value.
2. **Expressions** via the existing evaluator, **read-only**, **only under strip-before-scope** (G2 must be
   HELD first).
3. **`when`** (conditional render) and **`each`** over state/loop-vars only — *not* fetched arrays (§6). Pure,
   no exfil surface.
4. **Quoted interpolation** with the G6 fix.

**Deferred out of the first subset (do not build yet):**
- **All actions** (`set/toggle/append/remove/navigate/call`). `navigate`/`call` are the exfil surface (G5) and
  require routing through `atomkit-http`'s host allow-list, which is unbuilt. Read-only reactivity ships first;
  actions are a *separate later gate*.
- **Governed iteration over fetched arrays** (v1.1 — needs the resolved array masked before iteration).
- **Interactive atoms that emit events** (depend on actions).

## Order the core changes (and which are breaking)

1. **G6 parser fix** — bare `{{` in value position throws; `{{ }}` quoted-only. Behavior change; blast radius
   ~zero (today it silently yields `""`). Treat as a bugfix, note it.
2. **maskNode deny-by-default (K1)** — ALREADY LANDED (the 0.8.0 fix). Non-breaking.
3. **schema.ts: five optional strict fields + reject reserved keys inside `props` (K4 + §2).** Optional fields
   are additive. Rejecting `state`/`on:*`/`when`/`each`/`bindings` inside props is stricter validation —
   breaking only for a document that was smuggling them (i.e. the hole). Effectively a security fix.
4. **strip-before-scope in the runtime + literal-only state enforcement (G2).** Runtime discipline, no public
   API break. **The single most important change.**
5. **expr.ts root-allowlist DECISION.** Per G7, the answer is *no grammar allowlist*; the change is
   documentation + strip-before-scope, **not** a `parseExpr` behavior change. If you instead add K2's allowlist,
   it is a **breaking change to `parseExpr`** — decide before publishing `expr.ts` (ties directly to Ruling 1).
6. **serialize + assertRepresentable for all five fields (K5).** Additive to the API, but **must land in the
   same commit as the schema fields** or Bar 2 (round-trip) breaks the moment a field exists.
7. **Conformance: `when`/`each`/expression cases**, added in the **same change** that wires expressions into
   *both* the runtime render path and the compiler (ADR-004 emit-AST-as-data). Runtime and compiler land
   together — standing ruling.
8. **Actions** — separate later change, gated on `atomkit-http` host-allow-list routing (G5).

## Ruling 2 verdict — REWORK. The single change that must happen before any code is written

**Rebuild the governance proof on `strip-before-scope` + `literal-only state`, and make the runtime enforce that
every expression scope is constructed from the STRIPPED document — i.e. drive `G2` from OPEN to HELD in
`spike/governance-gate.mjs` before a line of state/expression runtime code exists.**

The entire "expressions cannot read masked values" guarantee currently rests on a grammar rule that does not
exist (G7) and is refuted by execution (G2 returns the raw SSN). Syntax, schema fields, and serialize are
mechanical. Strip-before-scope is the load-bearing invariant, and it is presently **false**. Nothing else in
AQL 1.0 may be written until it is true.

The governance gate exiting 1 is the correct state. It is doing its job. Keep it red until it isn't.

---

## Bars I am explicitly calling UNMET

- **Ruling 1 / Bar 7** — the published surface is not intentional: mutable `FUNCTIONS`, a contested
  `parseExpr`/`Expr` contract, and inert exports would be frozen by publish. Blocks shipping `expr.ts` in 0.8.0.
- **Ruling 1 / Bar 4** — satisfied only vacuously (evaluator unwired). Not a true guarantee; do not treat it as
  one.
- **Ruling 2 / G2, G5, G6** — OPEN. G2 and G6 block all AQL 1.0 code; G5 blocks actions specifically.
- **Ruling 1 / Bar 6 (CI matrix)** — green locally on Node v25.8.0; the 22/24/26 matrix is unverified by me.

Approving any of these would be the unforgivable act. I am not approving them.
