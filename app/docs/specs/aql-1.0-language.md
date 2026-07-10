# SPEC — AQL 1.0 Language (ruled)

Owner: aql-language-designer + aql-runtime-engineer. Ruled by composer-tech-lead. Normative. Every figure here was
re-verified by execution against atomkit 0.7.0 `dist/` on 2026-07-10. This ruling **supersedes the original
Language Charter** where they conflict; the corrections below are load-bearing.

## 0. Status of the Charter

The Charter is accepted in shape (five optional typed fields + a safe interpreter + whitelisted actions + `if`/`for`
as node fields + an interactive atom contract) and **rejected in its factual specifics**, because it was written
against a stale snapshot. The interpreter already exists and differs.

## 1. Corrections that redefine the spec

| Charter claim | Reality (verified) |
|---|---|
| `expr.ts` is NEW | Exists: `git log 91ef9bd`; `index.ts: export * from './expr.js'`. |
| ref root MUST be state/event/loopvar (parse error) | **No root check.** `parseExpr("document.cookie")` accepted; `evalExpr("secret",{secret:42})→42`. |
| AST `{k:'ref',root,path}` + `{k:'tpl'}` | Actual: `{k:'ref',name}` + `{k:'member',obj,prop}` + `{k:'index'}`; templates via regex `interpolate`. |
| caps 512/64/32/16/8 | `MAX_SOURCE=1000, MAX_NODES=200, MAX_DEPTH=32`. |
| `FNS = …contains,default,num,str…` | `FUNCTIONS = len,upper,lower,trim,includes,startsWith,endsWith,not,min,max,abs,round,floor,ceil,join,first,last,fallback`. |
| serialize round-trips new fields | `serialize()` **silently drops** unknown node fields. |
| `{{ }}` anywhere | `{{ }}` survives **only inside quoted values**; a bare `{{` opens a block (`query.ts:132`). |

## 2. The five typed fields (K4, additive, strict)

```ts
type Literal = string | number | boolean | null | Literal[] | { [k:string]: Literal };
interface BuilderDocument { version:number; root:BuilderNode[]; state?:Record<string,Literal>; meta?:{…}; }
interface BuilderNode {
  /* existing */
  state?: Record<string, Literal>;          // reactive scope (literal-only)
  on?: Record<string, string>;              // event → canonical action-list string
  when?: string;                            // canonical expression; render iff truthy
  each?: { as:string; in:string; key?:string };
  bindings?: Record<string, string>;        // prop/style-key → canonical template string
}
```

All OPTIONAL → a document omitting them validates and round-trips unchanged (verified: strict schema rejects them
today, so adding them as known-optional is purely additive). **Reject reserved keys inside `props`** (`state`,
`on:*`, `when`, `each`, `bindings`) — verified those smuggle through the open `z.record` today.

## 3. State

`state { k = <literal> }`. Own mini-parser (like `page`/`widget`), because the generic tokenizer splits on spaces.
**Literal-only** — an initial value may not reference `data`, props, or another node. This is the load-bearing rule
for governance: state can never be seeded from a server-held value. Scope resolution is innermost-first (loop var →
nearest node `state` → page `state`). Caps: ≤128 vars/scope, literal nesting ≤8, plus a **runtime** state-size cap
(the 100k source cap does NOT bound runtime `append`/`set` growth — Charter error).

## 4. Expressions — use the existing module

`parseExpr / evalExpr / evaluate / interpolate` from `expr.ts`. Grammar is Pratt-parsed, no `eval`/`new Function`
(confirmed absent). **New in 1.0 (K2): a reference-root allowlist enforced in `expr.ts`** — a ref whose root is not
`state`/`event`/`<loopvar>` is a parse error. This is the enforcement point the governance proof needs; without it
the "disjoint namespace" claim is vacuous (verified: `document.cookie` parses today). Prototype guard stands
(`__proto__/prototype/constructor` rejected; own-property reads only — probes return `undefined`). Interpolation is
regex-based and **quoted-only**; the linter flags a bare `{{`; `\{{` escapes literal braces.

## 5. Actions — `action.ts` (NEW; does not exist)

Six verbs: `set / toggle / append / remove / navigate / call`. Stored as canonical round-trippable strings.
Write-path reuses the prototype guard. **`navigate`/`call` targets route through `atomkit-http`'s SSRF/host
allow-list (K3)** — `safeHref` is a scheme filter, not an exfiltration control (verified: it passes
`https://attacker.io/?ssn=…` unchanged). `call(name)` is nullary + host-registered in v1.0. One reducer, shared by
runtime and compiler (bundled, never reimplemented), so there is zero drift.

## 6. Control flow — node fields, not wrapper atoms

`when` (from `if=`) and `each` (from `for=`) are typed node fields. Wrapper atoms lose: an unregistered `<if>`/`<for>`
fails closed to `null` (`render.tsx:48`) and would force operands into untyped `props`. Node fields are strict,
round-trippable, and mint no extra id (matters — `parseDocument` rejects duplicate ids). `each.in` = `state`/loop
vars only in v1.0 (governed iteration over fetched arrays deferred).

## 7. Interactive atom contract

`AtomRenderProps.emit?(event,payload)` (undefined under static `Render`); `AtomDef.emits?:string[]`;
`AtomDef.valueProp?:string`. Verified absent in `registry.ts` today. Standardized payload vocabulary
(`event.value/checked/id/index/zone/expanded/key/command/ratio`). Static Render leaves `emit` undefined → the 19
presentational atoms and the 21-doc suite are untouched.

## 8. Governance invariants (preconditions, not add-ons)

1. **Strip-before-scope** — evaluate over the stripped doc; the renderer never references the pre-strip document
   (`DECISIONS.md:118-129`).
2. **Literal-only state** + mask/forbid governed state at egress.
3. **Deny-by-default `maskNode`** at node level (K1).
4. **Root allowlist** in `expr.ts` (K2).
5. **`serialize`/`assertRepresentable` cover all five fields** (K5) — verified they silently drop today.
6. **Actions via egress allow-list** (K3).

## 9. Round-trip & serialize (K5)

Extend `serialize()` with presence-guarded branches for all five fields and extend `assertRepresentable` to throw
on anything AQL cannot express. Round-trip is value-stable and text-idempotent, **not raw-JSON-key stable**
(verified: author order `pii protected` serializes to `protected pii`). Dirty-tracking/dedupe must compare
canonical `serialize()` strings, never `JSON.stringify(node)`.

## 10. Open items handed forward

- Governed iteration over fetched arrays (v1.1) — requires masking the resolved array before iteration.
- Node-level (`widget`) state round-trip depends on `serializeWidget` (K12, M4).
- `event` payload schema must be closed and defined per atom before the security proof's "event = viewer's own
  input" premise is airtight.
