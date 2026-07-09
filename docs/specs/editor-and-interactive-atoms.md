# SPEC — Editor primitive + interactive atoms (ruled)

Owner: composer-interaction-engineer (+ atoms owner). Ruled by composer-tech-lead. Verified against atomkit 0.7.0
on 2026-07-10.

## 1. Accepted

- The canvas is `render-document`: renders a `BuilderDocument` through the shipped `instrumentRegistry`
  (verified: `instrument.ts` landed; `cloneElement` injects `data-ak-id`, no wrapper elements, null atoms get no
  handle). Selection via event delegation + `closest('[data-ak-id]')`; overlay via `position:absolute` inside a
  relative frame (both survive `resolveStyle`).
- The `emit` seam: `AtomRenderProps.emit?(event,payload)` (undefined under static Render). Verified absent in
  `registry.ts` — it is the single new interactivity seam and it leaves the 19 presentational atoms untouched.
- The editor atom pack (drag-source, drop-target/sortable, tree, split-pane, overlay, resize-handle, canvas-host,
  scroll-area, context-menu, modal, toolbar) and the form pack (input/select/textarea/checkbox/radio/switch,
  button-with-`on:click`) as CODE with their own ARIA (the a11y whitelist is too small — verified
  `A11Y_KEYS`/`A11yProps` lack `aria-selected/expanded/grabbed/live`).
- Instrumented handles inherit `compilePage` positional ids, which shift on insert — so the composer mints and owns
  uuid ids (verified: naive positional ids collide; the editor's own ids flow through `instrumentRegistry`
  unchanged).

## 2. Corrections (rulings)

- **C9 / S1 — the security claim is FALSE as designed.** Feeding `render-document document={{state.doc}}` where
  `state.doc` is the **unstripped** document lets any sibling expression `{{state.doc…pii…}}` read the raw PII
  around the mask (verified: `evalExpr("state.doc.root[0].props.text",{state:{doc}})` → `"SSN 123-45-6789"` while
  `stripDocument` → `"•••••"`). This is exactly what `DECISIONS.md:118-129` forbids. **Rulings:**
  1. `render-document` must call `stripDocument(document, previewPersona)` at its **own ingress** and the runtime
     must evaluate expressions over the **stripped** view.
  2. The composer chrome's expression scope must never bind the unstripped canvas document. The authoring context
     (`canViewPii:true`, the inspector's `state.selected`) is separate from any preview persona and must never
     enter a preview scope.
  3. Ship a **failing-first** test: `{{state.doc…pii…}}` renders `•••••`.
- **C12 — the AQL does not parse.** Every unquoted `{{ }}` example splinters the line (verified: `render-document
  document={{state.doc}} …` → roots `["render-document","selected="]`). All interpolated attributes MUST be quoted;
  prove a real `canvas.aql` compiles to the intended tree before authoring composer AQL.
- **C8 / node model — `node.on`, not `props['on:click']`.** AQL currently lands `on:*` into `props` (verified). The
  design's `node.on[event]` lookup requires the K4 schema fields; land `schema.ts` (strict) + `query.ts` serialize
  + round-trip together, and never read an interactive concept out of `props`.
- **S2 — `emit` payloads are a fixed vocabulary of ids/indices/zones/booleans/values, never HTML or handlers.**
  Correct; keep. But `navigate`/`call` from an `on` handler still route through the egress allow-list (K3), not
  `safeHref` alone.

## 3. Contract rules (must be lint-enforced)

- **Editor atoms MUST root a real host element**, never a bare Fragment — verified: `cloneElement` drops
  `data-ak-id` on a Fragment, producing an unselectable node.
- **Keyboard parity is mandatory** (a11y-guardian veto): every pointer gesture is a named `emit` with an identical
  keyboard path into the SAME reducer, announced through an `aria-live` region the canvas-host owns. Bound ARIA
  state (`aria-selected/expanded/pressed`) needs K14 — without it the keyboard works but AT is silent (WCAG 4.1.2
  failure that ships green). This is a **blocker**, tested by an assistive-tech assertion, not a render snapshot.

## 4. Governance for the canvas

`render-document` inherits the app pipeline: strip at ingest → instrument → render (verified: through the
instrumented registry, PII still masks to `•••••` and a `protected` node is still absent — instrumentation wraps
rendering, not the mask). If `stripDocument` is ever forgotten at its ingress, the canvas becomes a PII leak — this
is a hard, tested invariant, not a convention.

## 5. Sequencing

Blocked on core (K4/K6/K9) landing first. Until interactive codegen (M5), every editor + interactive atom is
`RUNTIME_ONLY` (omit + warn) so the 21-doc suite stays green. Ships in M4 (atoms) / M5 (compiled).
