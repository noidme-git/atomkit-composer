# SPEC — Compiler codegen for AQL 1.0 (ruled)

Owner: aql-compiler-engineer. Ruled by composer-tech-lead. Verified against atomkit-compiler 0.4.0 on 2026-07-10.

## 1. Accepted

- **Interpret, don't transpile.** Emit every author byte only as a `j()` (JSON.stringify) literal handed to
  atomkit's own bundled `evaluate`/`reduce`; never into an identifier, tag, call, or template-literal position.
  This is the correct injection-safety discipline and it matches the house style (`codegen.ts` already routes
  author strings through `j()`).
- **Bundle the runtime's own interpreter** (esbuild → React-free IIFE) so compiler semantics == runtime semantics
  by construction. Verified: `evaluate` bundles to a self-contained IIFE with no `require`/`import`.
- **RUNTIME_ONLY bridge.** Verified precedent `RUNTIME_ONLY = {'video'}` (`codegen.ts:23`).

## 2. Corrections (rulings)

- **C11 — the one-line evidence is wrong.** `compilePage('page{ … button "Inc" … text "{{…}}" … }')` merges the
  button and both texts into ONE button node. The claimed 3-node output only appears with **newline separation**.
  Fix the finding's example before citing it.
- **S10 — the "0 executions" proof is unreproducible.** No committed prototype, no `action.ts`, no `reduce` export
  (verified). `esbuild` **silently** binds a missing named export to `undefined`, so `useReducer(undefined, …)`
  would throw at runtime with no build-time signal. Rulings:
  1. Do not cite "0 executions" until the H1–H6 corpus runs against **committed** `action.ts`/`reduce`.
  2. Add a **build-time guard**: a missing prelude export fails the compile.
- **S7 — drift guard is mandatory.** `emitNode` does not inspect `when/each/on/bindings`; once K4 adds them, a known
  atom bearing `when` would compile unconditional → runtime ≠ compiled. Add the RUNTIME_ONLY guard on any
  interactive-field-bearing node (omit + warn) until interactive codegen lands.

## 3. Governance in the compiler (STANDING + one gap)

- The compiler already fails closed on governed nodes: `isGoverned/stripGoverned` drop `protected/roles/pii/
  consent/hidden` nodes (`index.ts:26-40`). Keep.
- **Gap to close (S1-adjacent):** `isGoverned` inspects only `meta.security`+`hidden`. A node carrying PII in a
  `state`/binding field **without** `meta.security.pii` would compile into cleartext React. Ruling: the compiler
  must refuse to emit interactive fields on any node it received as stripped/masked, and must treat document-level
  `state` as un-shippable in static output unless it is provably free of governed values (static compile has no
  per-viewer ctx — the same reason governed nodes are omitted).

## 4. Interactive codegen (M5)

- `state` → `React.useReducer(__AQL.reduce, INITIAL)`, `INITIAL = j(doc.state)` (JSON literal, author data).
- `on:<event>` → parsed by `action.ts` to an Action AST, emitted as JSON, dispatched via the bundled reducer.
- `when` → `{__truthy(__ev(<AST>, scope)) ? (…) : null}` — **fail CLOSED**: if `when` will not parse, emit
  `{null}` + warn (matches the runtime `evalExpr(bad)→undefined→falsy→hidden`). This was a real found-bug in the
  prototype (fail-open) — it is now a design rule.
- `each` → `__arr(__ev(<AST>, scope)).map((__v,__i)=>{ const s=__bind(scope,"<as>",__v); … })` — the loop-var NAME
  is a **JSON string** to `__bind`, never an emitted identifier; per-iteration keys `"<nodeid>::"+__i`.

## 5. Conformance (the anti-drift spine)

- Keep the 21-doc suite green (verified passing). Presentational docs take the unchanged static path → green by
  construction.
- Grow it: interactive SSR-parity (compiled initial render == runtime `Render`), **event-parity** (fire on both the
  runtime store and the compiled `useReducer`; diff post-dispatch DOM — the only way to catch reducer drift), and a
  hostile-injection block (payloads appear only in JSON literals; no side effect on compile+render).

## 6. Dependency-free output

Verified: the interpreter/reducer prelude bundles to a self-contained IIFE and the emitted component's only import
is React. The "no lock-in" claim holds for interactive output — plain React you own plus a copy of a ~200-line pure
interpreter you also own.
