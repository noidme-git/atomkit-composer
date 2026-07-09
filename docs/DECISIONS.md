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

**Status:** accepted. This is the constraint every AQL 1.0 feature must preserve.

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
