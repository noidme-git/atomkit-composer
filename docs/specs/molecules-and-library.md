# SPEC — Molecules, organisms, templates, variants & the library (ruled)

Owner: composer-molecule-architect (+ aql-language-designer for K12). Ruled by composer-tech-lead. Verified against
atomkit 0.7.0 on 2026-07-10.

## 1. Accepted (this design is sound-with-fixes)

- A molecule is a named atom subtree stored as the **`widget` primitive**, which is verified dead (`parse` emits
  `program.widgets`; nothing consumes it in any repo; the app renders `pages[0]`). This is the natural molecule.
- **v1.0 = INLINE instantiation** (clone → re-mint ids → substitute `{{param}}` literals → splice), which needs
  **zero core render/compile change** — inlined nodes are ordinary atoms. References (`use ref=…`) are deferred to
  v1.1 because a `use` node fails closed in both runtime (`render.tsx:48` → empty) and compiler (omit + warn) —
  verified.
- **Re-mint is mandatory:** verified naive double-instantiation throws `duplicate node id "0"`; re-minted ids are
  accepted.
- Library = pure data: `library/**/*.aql` (`widget` blocks) + one `manifest.json` (JSON config, permitted).
  Identity = `sha256(canonical serialize(body))`. Variants are single-atom `widget`s in the same library; organisms
  and templates are the same mechanism at larger grain (one system, `kind` metadata).

## 2. Corrections (rulings)

- **C15 — duplicate NODE ids are UNREACHABLE from hand-edited `.aql`.** Verified: AQL has no id syntax; an authored
  `id=x` lands in `props.id` and `compileNode` assigns unique tree-path ids (`box id=dup { text "a" id=dup … }` →
  ids `["0","0-0","0-1"]`). **Do not** justify the save-time `parseDocument` guard by "catch dup ids in imported
  `.aql`" — there are none to catch. The real vector is a **programmatically extracted subtree** (save-as-molecule
  from the canvas), which CAN carry arbitrary ids/fields after a bad clone.
- **The widget-validation gap is real** (verified `query.ts:320` runs `parseDocument` on **pages only**). Ruling:
  the composer MUST run `parseDocument({version:1, root:[body]})` at save-to-library **and** at every instantiation,
  covered by a **negative-control test** (a subtree that should be rejected IS rejected). Also land the fix in core
  `parse()` (K12) for hand-edited/imported libraries.
- **Round-trip is value-stable, not raw-JSON-key stable** (verified `pii protected` → `protected pii`). Ruling:
  standardize ALL identity/dedupe/dirty-tracking on canonical `serialize()` strings, never `JSON.stringify(node)` —
  one canonical-compare helper, used everywhere.

## 3. The one core change on the critical path (K12)

`serialize()` emits only a `page` today (verified: `serialize(program)`/`serialize(widget)` throw). Add
`serializeWidget`/`serializeProgram` reusing `serializeNode`, running `assertRepresentable` first, and **unwrapping
the synthetic multi-child box** (`id==='root' && type==='box'` with no own fields) back to top-level body lines so a
re-parse does not double-wrap. Verify unwrap round-trip value-stability with a test — the function does not exist
yet.

## 4. Governance (STANDING)

- A `pii`/`roles`/`protected` flag survives instantiation and serialization intact (verified `pii` round-trip);
  `stripDocument`'s egress masking/cascade still applies to the inlined subtree unchanged.
- Nothing `serialize()` rejects can be saved: molecules are authored/stored as `.aql`, and `parse` cannot produce
  the four un-representable fields (verified each throws when injected). The save gate runs a `canSerialize`
  preflight regardless.

## 5. Deferred (v1.1) — with the security ruling attached

References (`use ref=…`) need a molecule registry + render/compile resolution: new attack surface (self-reference
recursion, per-expansion id re-minting, and the ordering question of `stripDocument` **before vs after** expansion).
Ruling: do NOT ship v1.1 references until recursion caps + **post-expansion `stripDocument`** get a dedicated
security review. Also forbid state/PII in an `href` scope before any live-binding path bakes a dynamic value into a
`safeHref`-passed URL (verified `https://…?x=` is allowed).

## 6. Product limitation (state it plainly)

v1.0 inlining has no single-source-of-truth: editing a molecule does not update placed instances. Provenance
(`{nodeId → moleculeId@version}`) lives in a composer sidecar JSON (arbitrary node fields are schema-rejected;
`meta.note` throws in serialize), enabling a manual "re-sync from molecule". Buyers expecting Figma-component
auto-propagation will be surprised until v1.1 references land.
