# Architecture decisions

Each decision below is backed by an experiment that was run, not an argument that was made.
Where a guard is claimed, a mutation test proves the guard is load-bearing: delete it, watch the suite go red.

---

## ADR-001 — The canvas gets per-node DOM handles via `cloneElement`, never wrapper elements

**Status:** accepted, implemented in `@noidmejs/atomkit` (`instrumentRegistry`).

### Context
An editor must hit-test, select, outline and measure every node in a rendered document. But `Render` emits no
per-node DOM handle: it sets `class="ak-<id>"` *only* for nodes that declare responsive overrides. So
`getElementById` and class lookup are both dead ends.

### The rejected option
Wrap each atom in a `<div data-ak-id>`. This works, and it silently destroys every flex and grid layout, because
the wrapper becomes the flex/grid item instead of the atom.

### Decision
Wrap each `AtomDef.render` and `cloneElement` the element the atom *already returns*, injecting `data-ak-id`.
No element is added, removed, or reordered.

### Evidence
Rendering a 14-node document through the instrumented registry:

```
markup byte-identical once the attribute is stripped   ✅
element count unchanged (17 → 17)                      ✅
flex container's first child is still <p>              ✅
grid container's first child is still <img>            ✅
all 14 nodes addressable, no duplicates                ✅
atoms returning null (bad image src, bad icon path)    ✅ stay null
pii still masked, protected still absent               ✅
```

Negative control — re-implement with a wrapper `<div>` per atom:

```
element count unchanged   ❌ (17 → 31)
flex first child is <p>   ❌
grid first child is <img> ❌
```

The negative control ships in `atomkit/test/instrument.test.mjs`. Without it, the suite would pass against an
implementation that breaks every layout on the canvas.

### Consequence
Instrumentation is *code*, and atoms are code, so it lives in core — not in the composer, which the mandate
requires to be pure AQL.

---

## ADR-002 — AQL expressions are interpreted over a validated AST. No `eval`, ever

**Status:** accepted, implemented in `@noidmejs/atomkit` (`parseExpr` / `evaluate` / `interpolate`).

### Context
AQL 1.0 needs `{{state.count > 3}}` to express a conditional, a loop body, or a bound value. Documents are
explicitly allowed to be hostile, stale, or LLM-generated. Expressions are the largest new attack surface in a
language whose entire value proposition is fail-closed governance.

### Decision
A tokenizer and precedence-climbing parser produce a validated AST; an interpreter walks it. `eval`, `new
Function` and `with` are never used. The AST is **pure data** — asserted in test — so it serializes into
documents and round-trips.

Guards: static prototype rejection (`a.constructor`), dynamic prototype rejection (`a[k]` where `k` is
`"__proto__"`), own-property reads only, a function whitelist (a value from scope is never callable), and caps on
source length, AST node count and nesting depth. Evaluation never throws — an unresolvable reference is
`undefined` and renders as nothing.

### Evidence
All eight guards are **mutation-tested**: each is deleted in turn, and the suite must go red.

```
DYNAMIC prototype guard                        ✅ caught
own-property (hasOwn) check                    ✅ caught
function whitelist                             ✅ caught
STATIC prototype guard                         ✅ caught
AST node-count cap                             ✅ caught
SOURCE length cap                              ✅ caught
DEPTH cap                                      ✅ caught
forbidden-identifier guard                     ✅ caught
```

Plus 4000 deterministic fuzz inputs over an alphabet seeded with `constructor`, `__proto__` and `eval`. None
throws; none pollutes a prototype.

### The finding that justifies the whole method
The first version of the test could not see the dynamic prototype guard. Deleting the guard kept the suite green.

Against an object **literal**, the guard is dead code — `Object.hasOwn({}, '__proto__')` is already `false`.
But **atomkit documents are parsed JSON**, and `JSON.parse('{"__proto__": {"pwned": true}}')` creates a genuine
*own* property named `__proto__`. `hasOwn` then returns `true`, and the dynamic guard is the only thing standing.

The test now builds its hostile object with `JSON.parse`, as a real document would. Mutation testing found a hole
in the *test*, not the code — which is exactly its job.

---

## ADR-003 — Governance is enforced by ORDERING: `stripDocument` destroys, then `Render` renders

**Status:** ⚠️ **CORRECTED — the original guarantee was overstated.** See the correction at the end of this ADR.
The ordering rule stands; the claim that it is sufficient does not.

### Context
The product's differentiator is that no other visual builder enforces per-node governance at egress. If state,
expressions or actions can reach a PII-masked value, the differentiator dies.

### The guarantee
`stripDocument` does not *hide* a masked value. It **destroys** it, replacing it with the mask, before the
renderer — and therefore before any expression scope — ever sees the document.

```
authored node props:       {"text":"ada@corp.com"}
after stripDocument:       {"text":"•••••"}

{{props.text}}          →  "•••••"
{{node.props.text}}     →  "•••••"
```

An expression cannot read what does not exist. The guarantee is not the evaluator's sandbox; it is the ordering.

### Consequences, binding on every future feature
1. **Any design that evaluates expressions against the unstripped document breaks governance.** The renderer must
   never hold a reference to the pre-strip document.
2. **A `state` field will need stripping too.** `stripDocument` masks `props` today. The moment a document can
   declare `state { email = "ada@corp.com" }`, state becomes a second channel for the same data and must be
   masked, dropped, or forbidden from holding governed values. **This is an open design item for
   `aql-runtime-engineer` and `aql-security-engineer`, and it must be closed before state ships.**
3. **Actions must not exfiltrate.** A `navigate` verb carrying state in a query string, or a `call` verb hitting a
   data source, must be constrained by the same egress thinking. `atomkit-http` already enforces an SSRF host
   allow-list; actions must route through it, not around it.
4. The compiler must preserve the ordering, and it already fails closed: governed nodes are omitted from compiled
   output entirely, because static output cannot enforce per-viewer gating and must not pretend to.

---

## ADR-004 — The compiler emits expressions as **data**, never as source

**Status:** accepted. Binding on `atomkit-compiler`. Prototype verified.

### Context
`atomkit-compiler` emits TypeScript source. AQL 1.0 expressions must reach that emitted code. The tempting
implementation — interpolate the expression's source text into the generated file — turns every legal expression
into a potential code-injection vector, because a *string literal* may legally contain a backtick, a `${`, a
`</script>`, or a U+2028.

The evaluator itself is not the problem: `"</script>"` is just a string to an interpreter. The problem is
downstream, in whatever file the compiler writes.

### Decision
The compiler parses the expression, validates it into an AST, and emits that **AST as JSON data**, plus a call
into a runtime interpreter:

```js
const value = __akEval({"k":"bin","op":">", ...}, scope);
```

`JSON.stringify` escapes quotes and backslashes. U+2028 and U+2029 are *valid inside JSON strings* but are line
terminators in ES source, so they are escaped explicitly — the same guard `codegen.ts` already applies to emitted
text via its `j()` helper.

The compiler never emits a user-supplied string into a position where it can become syntax.

### Evidence
The same seven hostile expressions — each a perfectly legal AQL expression consisting of one string literal —
through both strategies:

| Payload | Emit source (naive) | Emit AST (chosen) |
|---|---|---|
| `"</script><script>alert(1)</script>"` | contained | ✅ inert value |
| `` "`);process.exit(1);//" `` | ⚠️ **escapes** | ✅ inert value |
| `"${process.env.SECRET}"` | ⚠️ **escapes** | ✅ inert value |
| `"\" + process.env.TOKEN + \""` | contained | ✅ inert value |
| `"a<U+2028>b"` | ⚠️ **escapes** | ✅ inert value |
| `"a<U+2029>b"` | ⚠️ **escapes** | ✅ inert value |
| `"a\\b"` | contained | ✅ inert value |

Naive emission leaks **4 of 7**. AST emission is inert on all seven: each payload round-trips as an exact string
*value*, never as syntax. U+2028 is escaped in the source and preserved in the value.

And the genuinely dangerous forms — `a.constructor("x")()`, `eval("1")`, `require("fs")` — never reach emission at
all; the parser rejects them (3/3).

> The test file for this ADR was itself broken twice while being written: once by a raw backtick inside an inline
> script, once by a raw U+2028 inside a regex. The hazard is not theoretical.

### Consequences
1. The emitted component needs `__akEval`. It must stay **dependency-free apart from React**, so the interpreter is
   inlined into the emitted file rather than imported from `@noidmejs/atomkit` — importing core would resurrect the
   lock-in the compiler exists to prevent. *(Open: `aql-compiler-engineer` to size the inlined interpreter.)*
2. The AST is pure data, which is also what lets `serialize()` round-trip an expression back to AQL text.
3. The conformance suite must gain expression cases in the same change that adds expressions to the runtime,
   because the runtime and the compiler are two implementations of one semantics and have drifted before.

---

## ADR-005 — `state` cannot ship without governance, by construction

**Status:** accepted as a constraint. Closes the open item raised in ADR-003 §2.

### The question
`stripDocument` masks `props`. The moment a document can declare `state { email = "ada@corp.com" }`, state becomes
a second channel for the same data. Does the AQL 1.0 state feature open a governance hole?

### The finding
No — and the reason is a property of the schema, not a promise from a designer.

Since `@noidmejs/atomkit@0.7.0`, **every object in the document is strict**: `parseDocument` rejects unknown keys
at every level. So a `state` field cannot be smuggled in:

```
{ id:"a", type:"text", state:{ email:"..." } }
→ ZodError: unrecognized_keys: ["state"]
```

State can only exist by a deliberate change to `nodeSchema`/`documentSchema`. And by the CTO's standing ruling —
*the schema is a trust boundary* — that change must be accompanied, in the same commit, by the `stripDocument`
handling for it. The strictness makes the omission impossible to make by accident.

Separately, `props` is a permissive record by design (atoms own their prop contract). A nested object hidden there
is already handled: `maskNode` is deny-by-default and **drops every structured value** on a governed node.

```
node with pii, props { text:"x", state:{ email:"ada@corp.com" } }
→ after stripDocument: { "text":"•••••" }          ← the object is gone, not masked
```

### The remaining hazard, and the rule
A **page-level** `state` block belongs to no node, so no node's `meta.security` governs it. It is therefore
**public by construction**: it ships to the browser and appears in the compiled output.

The rule, binding on `aql-language-designer` and `aql-runtime-engineer`:

1. Page-level state is **public**. It must never be initialised from a governed value.
2. A governed node's bound value must never flow *into* state. Data binding resolves after `stripDocument`, so a
   `pii` node's value is already the mask by the time any action could capture it — but this must be asserted by a
   test, not assumed.
3. `lint()` gains a rule: warn when a `pii`/`protected`/`roles`-gated node writes to state.
4. If node-scoped state is ever introduced, `maskNode` masks it exactly as it masks props.

### ⚠️ CORRECTION (added after red-team review)

**The claim "an expression cannot read what does not exist" is CONDITIONAL, and I stated it as absolute.**

It holds only when the expression scope contains the *stripped* document. **An editor holds the UNSTRIPPED
document by definition** — that is what it is editing. The moment the composer does
`render-document document={{state.doc}}`, the authoring document is in an expression scope:

```
render path:  stripDocument(doc, {canViewPii:false}).root[0].props.text  →  "•••••"
editor state: evalExpr("state.doc.root[0].props.text", {state:{doc}})    →  "SSN 123-45-6789"
```

Reproduced against published `@noidmejs/atomkit`. The mask is destructive, but destruction happens on a *copy*;
the original is still in the editor's hand.

`composer-test-engineer` caught this, and `composer-tech-lead` reproduced it independently. It was found because
the AQL 1.0 charter's security proof leaned on this ADR. Had the proof not been red-teamed, the composer would
have shipped a governance bypass in its own preview pane.

**The corrected rule:** ordering is *necessary* but not *sufficient*. The runtime must additionally guarantee
**strip-before-scope** — every expression scope is built from the stripped document — and **state must be
literal-only**, so a governed value can never be captured into it. Enforcement moves to the gate below.

Two further consequences of §3 and §4 above were also found to be **wrong**:

- §3 said actions "must route through" the SSRF allow-list, implying `safeHref` helps. It does not. `safeHref`
  blocks **schemes** (`javascript:`, `data:`, `//host`), never **destinations**:
  `safeHref("https://attacker.io/?d=SSN")` returns the URL unchanged. A `navigate` verb is an exfiltration
  channel that `safeHref` cannot see.
- ADR-005's reliance on schema strictness was over-broad: `props` is an open `z.record` by design, so
  `props.state` and `props["on:click"]` smuggle straight through `parseDocument`. Strictness guards node-level
  keys, not the props bag. (`maskNode`'s deny-by-default now drops them at egress — but that is a *second* line,
  not the first.)

---

## ADR-006 — The governance gate: no interactivity ships until it is green

**Status:** accepted and enforced. `spike/governance-gate.mjs`. **Currently 5 held, 3 OPEN — exit code 1.**

### Why
The AQL 1.0 design review produced six designs. The red team marked **four of six UNSOUND**, found **23 false
claims** — assertions about atomkit that nobody had executed — and raised **15 security holes**. One was a live
bug in published `0.7.0` (`maskNode` spread unknown node-level fields; fixed, ADR-005 §updated). Another refuted
this repo's own ADR-003.

The lesson is not that the designers were careless. It is that **a security argument nobody executed is not a
security argument.** So the gate is executable.

### The gate
`node spike/governance-gate.mjs` exits non-zero while any invariant is open. No `state`, no `on:`, no action verb
lands in the runtime until it exits 0.

| | Invariant | Status | Owner |
|---|---|---|---|
| G1 | `stripDocument` masks PII before render | ✅ held | — |
| G2 | an expression cannot read PII held in state | ❌ **open** | `aql-runtime-engineer`, `aql-security-engineer` |
| G3 | a node-level `state` field does not survive masking | ✅ held *(closed by the ADR-005 fix)* | — |
| G4 | interactive concepts hidden in `props` do not survive masking | ✅ held *(closed by the same fix)* | — |
| G5 | a `navigate` target cannot carry data to an arbitrary host | ❌ **open** | `aql-security-engineer` |
| G6 | an unquoted `{{expr}}` does not silently become empty | ❌ **open** | `aql-language-designer` |
| G6b | a quoted `"{{expr}}"` survives the parser intact | ✅ held | — |
| G7 | expression roots are constrained by the host, not the grammar | ✅ held (informational) | — |

G7 is worth stating plainly, because a design leaned on its opposite: **`parseExpr` has no root allowlist, by
design.** The host defines the scope, and the scope *is* the security boundary. Any safety proof that assumes the
grammar restricts roots is relying on a rule that does not exist.

G6 is a silent-data-loss bug that predates AQL 1.0: `box document={{state.doc}}` does not error. `{` opens a
block, so the value parses to the empty string. Silence is worse than a throw.

### The rule this encodes
G3 and G4 were **open when the red team found them, and are held now** — because the fix landed within the hour.
That is the loop. A gate is only useful if it is executable, if it is run, and if red means stop.

---

## ADR-007 — The owner overrules the pivot. The mandate stands.

**Status:** accepted by the owner, 2026-07-10. Binding.

### The ruling
The CEO ruled **PIVOT**: ship the governance wedge on presentational atoms with a React chrome, and treat pure-AQL
as research. Their satisfaction bar scored **1 clean pass of 7**, and they declined to sign off.

**The owner overruled it.** The composer will be authored entirely in AQL. Anything else is generated by the
compiler.

That is the owner's prerogative, and the decision is recorded here in full — including the case against it, because
a decision whose counter-argument is not written down cannot be revisited honestly.

### The case against, which we now carry as engineering risk
The CEO's evidence stands even though their recommendation did not:

1. **Standalone declarative UI languages have failed before.** MXML/Flex died as a proprietary language tied to one
   vendor runtime. JSX won by *not* being a separate language.
2. **A proprietary runtime manufactures the lock-in regulated buyers refuse** — and undermines atomkit's own answer
   to it.
3. **"The composer is written in its own language" is not a buying signal.** Gutenberg's editor is React. Figma is
   not made of Figma.

### What we must therefore engineer
- **The compiler is the price of the mandate.** Any AQL page must eject to standalone React the customer owns. That
  escape hatch is what separates this from MXML. It is not a nice-to-have; it is the answer to objection 2.
- **The known gap becomes a first-class product problem.** A *governed* page today ejects **incomplete**: the
  compiler omits governed nodes, correctly, because static output cannot enforce per-viewer gating and must not
  pretend to. So *governed by construction* and *portable by default* do not both hold for the same page. Verified:

  ```
  // atomkit-compiler: omitted 2 governed/hidden node(s) — static output cannot enforce
  // runtime governance (role/consent/PII gating); render those via the @noidmejs/atomkit runtime.
  ```

  Either close it, or scope the promise precisely. Silence is not an option.
- **The governance gate still binds.** 6 held, 2 open. No `state`, no `on:`, no action verb ships until G2 and G5
  are HELD. The mandate does not suspend the gate; it makes closing it urgent.

---

## ADR-008 — English AQL is a desugaring, not a new parser

**Status:** accepted. Prototype verified against published `@noidmejs/atomkit@0.8.0`.

### Context
The owner: *"I want this AQL as similar as English so that this can be a standard language, anyone can build
websites, also AI friendly."*

The fear is that this means a new grammar — and therefore a new schema, a new serializer, a second parser to keep
in lockstep with the compiler, and a fresh conformance problem. It does not.

### Decision
English AQL is a **surface syntax** that lowers to canonical AQL by a phrase-rewriting pass, before the existing
parser ever runs.

```
text "priya@northwind.health" contains personal data     →   text "priya@northwind.health" pii
section visible to recruiter                             →   section roles=recruiter
section needs marketing consent                          →   section consent=marketing
button "Subscribe" links to "#subscribe" tracked as cta   →   button "Subscribe" href="#subscribe" track=cta
heading "Join us" level 1 size 3rem                      →   heading "Join us" level=1 size=3rem
```

### Evidence
For a full governed page written both ways:

```
✅ compile(english) deep-equals compile(canonical)
✅ "visible to recruiter"      → meta.security.roles = ["recruiter"]
✅ "contains personal data"    → meta.security.pii = true
✅ "is confidential"           → meta.security.protected = true
✅ "needs marketing consent"   → meta.security.consentCategory = "marketing"
✅ canonical AQL passes through the desugarer unchanged (mixed input is fine)
✅ an unknown bare word is an ERROR, not a silent empty prop
```

`deepEqual`, not "looks similar".

### Consequences
1. **Schema, governance, `serialize()`, the compiler and the 21-document conformance suite are untouched.** One
   grammar for the machine; two registers for the human.
2. **It fixes a live bug on the way.** Today `text "x" wobble` yields `props.wobble = ""` — a bare word becomes a
   silent empty prop, with no error. Same silent-failure class as the `{` bug that split a node in two. The
   desugarer refuses unknown words and names them.
3. **`serialize()` emits canonical.** So a compose → save → reload cycle returns canonical AQL, losing the author's
   English phrasing. For a tool aimed at non-programmers that is a data-loss bug, not a cosmetic one. Either the
   composer resugars on save, or the phrasing is stored alongside. **Open — owned by `aql-syntax-designer`.**
4. **The AI claim becomes measurable.** Two registers, one document model, so an eval harness can compare model
   success rates directly. Owned by `aql-ai-engineer`. A claim of "AI friendly" without a number is marketing.
5. The cautionary tale is AppleScript: *reads like English* degenerated into *unguessable which English works*.
   Every phrase must lower to exactly one canonical form, and the error message must name the nearest valid phrase.
