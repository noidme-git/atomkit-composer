<!--
Synthesized from a design panel: 2 recon agents (prior art across ExtJS Architect,
Wix, Gutenberg, Builder.io, Puck, Craft.js, GrapesJS, Framer, Webflow; plus an
atomkit editor-readiness audit), 3 independent architectures (MVP-first,
extensibility-first, governance-first), 3 judge panels (feasibility, architecture,
product), and a chief-architect synthesis. Verified against atomkit 0.7.0 /
siblings 0.4.0 at HEAD.
-->

I've verified everything against the real 0.7.0/0.4.0 source. The most important correction: the task's constraint #3 ("there is NO node-id uniqueness validation anywhere") is **false at HEAD** — `assertUniqueIds` throws inside `parseDocument` (schema.ts:250-266) and `lint()` ships a non-throwing `unique-id` rule (lint.ts:25). That collapses the single hardest-sounding "required core change." Here is the synthesized plan.

---

# atomkit-composer — Implementation Plan (Chief Architect's synthesis)

**Grounding note.** Verified against the live repos at HEAD: atomkit **0.7.0**, atomkit-http/compiler/app **0.4.0** (ahead of the brief's 0.6.0/0.3.0). Several "facts" in the brief and both proposals are stale and are corrected inline below — most consequentially, node-id uniqueness is now enforced.

---

## 1. Recommendation

**Winner: the governance-first architecture**, hardened with the platform-first architecture's typed-manifest bones grafted in as a *design target*, not a v0.1 dependency.

The two panels split: the feasibility judge picked governance-first (fastest compelling demo, ~zero core changes), the architecture judge picked platform-first (the typed `AtomDef` manifest is the more durable substrate). They are ~80% the same app; the real deltas are **sequencing** and **honesty**. I break the tie on the axis the brief actually privileges — a shippable, differentiated demo by one engineer — and buy back the longevity by shaping the local schemas so they graduate into core verbatim later.

**Grafted from platform-first:** the richer `FieldDef` shape with a `target` discriminator (ship local, move to `AtomDef.fieldDefs` at M6); manifest-declared containment (`accepts`/`allowedParents`) as the eventual source of truth; `lower()` as the *roadmap* answer for custom-atom export; a single `Exporter` plugin interface from day one.

**Grafted from the runner-up's own detail into the winner:** the side-by-side Admin-vs-Anonymous persona **diff** (the money demo); `data.allowHosts` computed as the **union** of every authored `api=` host; **conformance tests** pinning the local style-control map against core; **fflate** over jszip; File System Access `showDirectoryPicker()` primary with zip fallback; layers-tree governance glyphs + PII-cascade subtree tint; "require a chosen public persona to Download."

**One-sentence thesis.** Build a static, no-phone-home React SPA whose canvas *is* atomkit's own `Render(stripDocument(doc, persona))`, ship the governance-preview wedge — the one category (regulated/enterprise UI) no incumbent occupies — first and with zero core changes, and carry a typed field-manifest locally so it can graduate into core `AtomDef.fieldDefs` once proven.

---

## 2. What must change in atomkit core FIRST

**Blunt answer: nothing is a hard blocker. v0.1 (M0–M4) ships with ZERO core changes.** The composer owns identity, instrumentation, the inspector schema, and the export gate locally. Both proposals over-stated the required core surface; the audit's headline blocker is already closed. Ordered by leverage:

| # | Package | Change | Breaking? | Verdict / why |
|---|---------|--------|-----------|---------------|
| — | @noidmejs/atomkit | **Node-id uniqueness** | — | **ALREADY DONE — do nothing.** `assertUniqueIds` throws in `parseDocument` (schema.ts:250-266); `lint()` emits a non-throwing `unique-id` warning (lint.ts:25). The proposed `checkIds`/`validateDocument` is redundant. Composer maintains uniqueness as a store invariant and uses `lint(doc)` for a non-throwing surface. |
| 1 | @noidmejs/atomkit | **`AtomDef.fieldDefs?: FieldDef[]`** + export a **`STYLE_CONTROLS`** map (style-key → control kind + enum, derived from the private `STYLE_KEYS`, query.ts:26) | No (additive; leave `fields:string[]`) | **The one real ask — but parallel, not blocking.** Today `AtomDef.fields` is a bare `string[]` (registry.ts:30), `STYLE_KEYS` is module-private, `styleSchema` is `z.record(z.string(), z.unknown())` (schema.ts:169). Composer ships these **locally** through v0.1; land in core at M6 once the shape is proven on `defaultAtoms` + one custom atom, then delete the local mirror. |
| 2 | @noidmejs/atomkit | **`canSerialize(doc): {ok, issues[]}`** — non-throwing preflight mirroring `assertRepresentable` | No (additive) | Nice-to-have. `serialize()` throws on exactly four field classes (query.ts:410-417: static data value, api headers/body/ttl, `analytics.props`, `meta.note`). Composer ships a ~15-line local mirror now; retire when core exports one. |
| 3 | @noidmejs/atomkit | **`CURRENT_DOCUMENT_VERSION` + `migrate(doc)`**, routed through `parseDocument` | No (additive; `version:1` unchanged) | **`document.version` is dead** — declared, always `1`, never branched on (query.ts:302, schema.ts:237). Composer owns its **own** `formatVersion` for the project file, so this is deferrable. Recommend before any core doc-schema change ever ships. |
| 4 | @noidmejs/atomkit | **`AtomDef.accepts?`/`allowedParents?`/`defaults?`/`icon?`/`lower?`** | No (additive) | The platform payoff (custom atoms get drop-rules + zero-dependency export for free). Deferred to **M6**. Composer uses a local containment table until then. |
| 5 | @noidmejs/atomkit | **`DataBound` fetch → `credentials:'omit'`** + optional client allow-list hook | **Yes** | The only breaking change and **off the composer's critical path**: `data.tsx:35` fetches with browser-default (same-origin) credentials and no allow-list. Composer never raw-fetches author URLs in preview (see §7), so this is a core hardening PR on its own track, not a composer blocker. |
| 6 | @noidmejs/atomkit | (Roadmap) interactive atom pack (`input`/`select`/`textarea`/`form`) + declarative action model | No (additive atoms) | Out of scope for v0.1. The atom set is `box…spacer` only (atoms.tsx:156-181); `Button` renders `type="button"` with no handler. Composed apps are presentational until this lands. |

---

## 3. Repo + stack

New standalone repo `atomkit-composer` (sibling to the others). **Vite + React 18 + TypeScript**, emitted as a fully static bundle. No server, no CDN, no fonts, no analytics, no `fetch` to anywhere — CSP-clean and offline-capable. The output is likewise self-contained (see §7).

| Dependency | Why it earns its place |
|---|---|
| **@noidmejs/atomkit** (^0.7.0) | The runtime *is* the product. Canvas = `Render({document, registry, context})`; reuse `parse`/`serialize`/`compilePage`, `defaultAtoms`, `createBuilder`, `stripDocument`/`isNodeVisible`/`PII_MASK`, `lint`, `parseDocument`, `systemPrompt`/`generate`. Never reimplement rendering, governance, or serialization → cannot drift from what ships. |
| **react** + **react-dom** 18 | Non-negotiable: atoms *are* React components (`AtomComponent = (p) => ReactNode`, registry.ts:21). The host must be the same React they render into — that is what makes the canvas === runtime. |
| **@noidmejs/atomkit-compiler** (^0.4.0) | The "Download ejected React" exporter. Verified **browser-safe**: `compileDocumentToReact(doc)` / `compileToReact(aql)` (index.ts:43,74) import only `compilePage` + `emitNode`; only `cli.ts` touches `node:fs`/`node:path`. Runs client-side, no server. |
| **zustand** (~1 KB) | Single store (project + selection + preview-persona + history). Fine-grained selectors so one inspector keystroke re-renders one node, not the canvas. |
| **immer** | Structural-sharing immutable edits over the plain-JSON `BuilderDocument` (verified `structuredClone`-safe; `stripDocument` never mutates its input, security.ts:126). Deep insert/move/delete stay one-liners. |
| **@dnd-kit/core** + **@dnd-kit/sortable** | Chosen over react-dnd specifically for its first-class **`KeyboardSensor`** + touch support — the accessibility requirement (§5) is free. Headless, so we draw our own drop indicators. |
| **fflate** (~3 KB, zero deps) | In-browser zip for the download fallback. ~10× smaller supply chain than jszip — it matters for a security-positioned tool. |
| **Native**: `crypto.randomUUID`, File System Access API | Node identity + folder-write download. No dependency. |
| **zod** | Already transitive via atomkit; reused only to validate plugin manifests at M6. Never re-declared. |

**Not** dependencies: `@noidmejs/atomkit-app` (Node-only — it is the download *target*, §7) and `@noidmejs/atomkit-http` (server-side connector).

---

## 4. The document model

**Editor-native project format — not AQL, not a bare `BuilderDocument`.** AQL provably cannot hold identity: `compileNode` derives every id from tree path (`path.join('-')`, query.ts:259,271); `serialize()` emits no id; re-`parse()` re-derives fresh path ids. A `serialize → parse` round-trip therefore destroys any editor id.

```
ComposerProject {
  formatVersion: 1;                       // composer's OWN version — BuilderDocument.version is dead
  pages:    { pageId; route; title; doc: BuilderDocument }[];
  tokens:   Record<string,string>;        // → atomkit.config.json tokens
  config:   { title; description; lang; port };
  personas: { id; label; ctx: RenderContext }[];   // ctx is core's security.ts type
  publicPersonaId: string;                // the persona that maps to the shipped config
}
```

**Node identity.** Every node minted in the editor gets `id = 'n_' + crypto.randomUUID()`. The `n_` prefix guarantees it (a) matches the renderer's selector gate `/^[A-Za-z0-9_-]+$/` (render.tsx:58) so `.ak-<id>` responsive CSS stays valid, and (b) never starts with a digit (a bare uuid can, breaking the `.ak-…` class). uuids are strictly better than path ids for a live editor: verified that inserting a sibling in a path-id doc renumbers everything after it (`C: 0-1 → 0-2`), busting React keys and focus/element state; uuids are stable across insert/move.

The two id-spaces never cross. uuids live only in `ComposerProject`; the shipped `.aql` lets core re-derive deterministic path ids at download (unique-within-a-tree by construction). **On import of external `.aql`**: `parse()` → normalize pass re-stamps every node with a fresh uuid before the first edit. Identity never round-trips through AQL.

**Uniqueness invariant.** Insert mints a new uuid; copy/paste/duplicate runs `reIdSubtree(node)` (deep-clone + re-mint *every* id), so duplicates are structurally impossible. Dev assert = `lint(doc).filter(w => w.rule === 'unique-id')` (non-throwing, already ships).

**Undo/redo.** `history { past: BuilderDocument[]; future: BuilderDocument[] }` of `structuredClone` snapshots at each commit boundary. Field-level edits to the same node coalesce (300 ms debounce) into one entry. Every mutation is a pure `(project) => project` immer reducer; undo is popping a snapshot. Because uuids are stable, undo restores exact node identity.

**Round-trip.** compose (edit `page.doc` in the store) → **on Download only**: `serialize(doc)` per page → `app/<route>.aql`; core re-derives path ids on the customer's next `parse`. Lossless for representable docs (verified `parse(serialize(doc))` deep-equals). The AQL text view is **read-only live preview** in v0.1 (see §9 / risk 2); editable AQL is deferred because re-parsing re-keys selection.

---

## 5. Drag-and-drop semantics

**Containment-only. No absolute positioning** — the industry consensus (Wix Editor→Studio, Framer auto-layout) and atomkit's grain (`grid/row/stack/section` are already container atoms).

- **Containment source of truth:** `defaultAtoms[type].container === true` (box, section, container, grid, row, stack, list, accordion, accordion-item), refined by a composer-local `containmentRules` table core does not police: `accordion` accepts only `accordion-item`; leaf atoms (text/heading/link/button/chip/icon/image/video/divider/spacer) accept no children. **Eventual home:** `AtomDef.accepts`/`allowedParents` (core change #4, M6).
- **Insertion — three zones** from pointer-Y within the hovered node's *measured* rect (measured off the instrumented DOM, §M0): top 25% → **before**, bottom 25% → **after**, middle 50% → **into** (append) *only if* the node is a container that `accepts(childType)`, else the middle band falls back to **after**. Draw a before/after indicator line or an into-highlight box in the overlay layer.
- **Drop algorithm:** resolve target container + index from the drop-zone id → containment check (reject with a red flash on failure) → build node from `FieldDef.default`s + fresh uuid (palette drop) or detach-then-insert (canvas move, ids preserved) → immer splice by id-path → push undo snapshot → `lint` unique-id assert.
- **Reorder** is the same path with an existing node.

**Keyboard-accessible equivalent (first-class — atomkit sells accessibility; a mouse-only editor would be hypocritical).** Two redundant paths:
1. **dnd-kit `KeyboardSensor`**: Space to pick up, arrows to move through a precomputed ordered list of *legal* insertion slots (derived from `containmentRules`), each announced via `aria-live` ("Insert Text into Section, position 2 of 3"), Space to drop, Esc to cancel.
2. **Non-drag command path**: toolbar Move up/down/into/out + shortcuts (Cmd+↑/↓/→/←) call the **exact same** move reducer; the layers/tree panel offers the same moves via its own keyboard nav.

Drag is never the only way to place a node.

---

## 6. The inspector

**Schema-driven, zero per-atom hand-coding.** For the selected node: look up its `AtomDef`, read its `FieldDef[]`, group by `FieldDef.group`, render one control per `FieldDef.control` from a control registry.

**The exact typed field schema (ship local now, shaped to become core `AtomDef.fieldDefs`):**

```ts
interface FieldDef {
  name:    string;
  target:  'prop' | 'style' | 'a11y' | 'data' | 'meta';   // where the value is written
  control: 'text' | 'textarea' | 'number' | 'select' | 'boolean'
         | 'color' | 'token' | 'dimension' | 'url' | 'icon' | 'json';
  label:   string;
  options?: { value: string; label: string }[];  // select
  default?: unknown;
  min?: number; max?: number; step?: number;      // number/dimension
  unit?: string;                                   // dimension
  group?: string;                                  // panel section
  help?: string;
  showIf?: { field: string; equals: unknown };     // conditional controls
  responsive?: boolean;                            // exposes sm/md/lg override columns
}
```

The `target` discriminator (grafted from platform-first) is what lets one schema drive Content/Style/A11y/Data/Governance from a single object — Gutenberg `block.json` attributes + Puck typed fields + GrapesJS traits, unified.

- **`target:'style'`** writes `node.style`, or `node.style.responsive[bp]` when the sm/md/lg toggle is active (desktop-first cascade matching core's `BREAKPOINTS` sm640/md768/lg1024, query.ts:46).
- **Legacy atoms** (all of `defaultAtoms` declare only `fields:string[]`) get FieldDefs synthesized by looking each name up in the local **`STYLE_CONTROLS`** map (mirror of the private `STYLE_KEYS`) + a prop-name→control heuristic.
- **`target:'meta'`** carries the four governance controls (§8) → `node.meta.security`.
- **Serialize gate — serialize-by-construction.** Controls that would author an un-representable field are badged and disabled: the Data tab exposes **only** `api.url` / `path` / `method(GET|POST)` / `bind` — never headers/body/ttl, never a static data value, never an `analytics.props` free-map or `meta.note` (the four verified `assertRepresentable` throwers, query.ts:410-417). The doc can never become un-Downloadable.
- Every control is sanitized live through the same `clean()`/`safeDim` path atoms use (style.ts), so authors see rejects immediately.
- **Custom-inspector escape hatch** (M6): a plugin may register a full custom panel per atom type when the generic schema isn't enough.

**Drift control (grafted).** Two conformance tests guard the local maps until core exports land: (a) import `defaultAtoms`, assert every `def.fields` entry has a descriptor (fails CI if core adds a field); (b) per style control, emit AQL and assert `parse(serialize(x))` reproduces the value (catches `STYLE_KEYS` divergence, leveraging the verified lossless round-trip).

---

## 7. Export

**100% in-browser, no server.** Download = a runnable **atomkit-app** project (the `create.ts` `templateFiles` scaffold shape).

**Preflight gate — all green to enable the Download button:**
1. `parseDocument(page.doc)` per page — strict schema + **id-uniqueness** (throws; caught and surfaced as issues).
2. `lint(doc)` — a11y warnings surfaced non-blocking (img-alt, control-name, …).
3. Local `canSerialize(doc)` — non-throwing mirror of `assertRepresentable`, returns `{id, field, reason}[]` so Download disables gracefully with a per-node fix-list instead of catching a `serialize()` throw.

**Emitted files (byte-shape matching `atomkit-app/src/create.ts`):**
- `app/<route>.aql` per page — `serialize(page.doc)`; route `/` → `app/index.aql`, `/about` → `app/about.aql` (mirroring `router.ts` `toRoute`). This is where uuids drop and core re-derives path ids downstream (correct).
- `atomkit.config.json` — `{ title, description, lang, port: 3300, tokens, context, data }` where `context` is the **public persona** mapped exactly as `config.ts` `renderContext` does it (`canViewProtected`/`canViewPii`/`roles` + `consent.analytics === true`), **defaulted least-privilege** (matching `config.ts` `DEFAULTS`), and `data.allowHosts` = the **union of every `api=` host actually bound in the project** (grafted — the shipped SSRF list is precisely and only what the author used; empty = fail-closed).
- `package.json` (devDep `@noidmejs/atomkit-app` `^0.4.0`; scripts `dev`/`build`/`start`), `.gitignore`, `public/robots.txt`, `README.md` — matching `create.ts`.

**Download mechanism (browser, never uploads):** File System Access `showDirectoryPicker()` writes the project tree straight into a user-chosen folder (Chromium/Edge — feels like a real scaffold); fallback is `fflate.zipSync(fileMap)` → Blob → `URL.createObjectURL` → hidden `<a download="my-app.zip">` (Firefox/Safari). Then `npm i && npm run dev` serves the **exact** page the author composed at `localhost:3300` — because the canvas *is* `Render` + `defaultAtoms`, there is zero preview/production drift.

**Second exporter (the plugin seam, M5):** "Download ejected React" runs `compileDocumentToReact(doc)` in-browser → `components/*.tsx` whose only dependency is React; governed nodes fail closed (the compiler omits `protected`/`roles`/`pii`/`consent`/`hidden` nodes entirely, index.ts `stripGoverned`). Both exporters implement one interface — `Exporter: (input: {pages, docs, aql, tokens, config}) => FileMap` — so a future "Download as Vue" is a plugin, not a fork.

**Live preview never raw-fetches author URLs** (constraint #6, verified `data.tsx` sends same-origin credentials with no allow-list): api-bound nodes render their authored fallback (`props.text`) behind a "sample data" chip; real resolution happens only later, server-side, under `allowHosts` in atomkit-app's SSR bake.

---

## 8. Governance as the wedge

This is the reason to exist and it ships (after the instrumentation spike) **before** drag-drop.

**Authoring.** A Governance group on every node's inspector maps 1:1 to `node.meta.security` (schema.ts:124-133): `protected` (boolean), `roles` (tag input), `pii` (boolean), `consentCategory` (select) — exactly the four fields AQL round-trips (verified). The layers tree shows a lock/eye/shield glyph on any governed node; flagging a **container** `pii` tints its whole subtree in the canvas, because `stripDocument` cascades PII masking to descendants (security.ts:131-133) — the author learns the cascade instead of being surprised by it.

**Personas.** A project-level editor defines named `RenderContext`s: Anonymous `{}`, Member `{roles:['member']}`, Admin `{canViewProtected:true, canViewPii:true, roles:['admin']}`, "EU / consent denied" `{consent:{analytics:false}}`.

**Preview as viewer — the production egress path, not a mock.** A persistent "Viewing as: [Anonymous ▾]" bar renders the canvas as:

```
Render({ document: stripDocument(activeDoc, persona.ctx),
         registry: defaultAtoms, context: persona.ctx })
```

— the **identical two-step the shipped app runs** (`atomkit-app/src/render.ts:31-34`). Switch persona and you watch PII flip to `•••••` (`PII_MASK`, security.ts:39), `protected`/role-gated nodes vanish, and `data-analytics-*` attributes appear/disappear (render.tsx:70 emits them only when `ctx.consent?.analytics === true`, fail-closed). `stripDocument` returns a copy and never mutates the source (verified), so toggling is instant and non-destructive.

**The money demo (grafted):** a side-by-side diff renders Admin and Anonymous simultaneously so a compliance reviewer sees exactly what the public loses. While *editing* (not previewing), the canvas uses an author context (`canViewProtected:true, canViewPii:true`) so governed nodes stay selectable, each with a chrome badge and a persistent "public delta" banner.

**Why it beats Wix / Webflow / Builder.io.** None of the 11 surveyed tools model roles/PII/consent at all. Here governance is authored at design time, previewed per-viewer through the **real** strip path, **enforced at egress** before HTML leaves the server (`stripDocument` runs before data resolution and before render), and carried into ejected TSX (the compiler fails closed). The exported config defaults to least privilege, so a shipped page cannot leak governed content just by being served. This reframes atomkit's apparent weaknesses as compliance virtues: the inert atom set (no arbitrary JS) becomes "auditable, fail-closed output a CISO signs off on"; the id-less AQL becomes irrelevant because identity lives in the editor. It opens a category (regulated/enterprise UI) the incumbents structurally cannot occupy.

---

## 9. Milestones

**M0 — Instrumentation spike + read-only canvas** *(the true first risk — both panels flagged that both proposals waved at it).*
The canvas is `Render` + `defaultAtoms`, but **`Render` emits no per-node DOM handle** — it sets `class="ak-<id>"` *only* for nodes that declare `responsive` overrides (render.tsx:59). So `getElementById('node-'+id)` (platform-first's claimed mechanism) does not exist. Fix: a **composer-owned instrumented registry** built via `createBuilder` that wraps each atom's `render` and `cloneElement`s its returned root element to inject `data-ak-id={node.id}` (fallback: a `display:contents` span for atoms that return `null`/fragments — no layout box, so flex/grid children are untouched). Selection via event delegation (`e.target.closest('[data-ak-id]')`); the selection outline + drop indicators live in a separate absolutely-positioned overlay layer, measured with `canvasRoot.querySelector('[data-ak-id="…"]').getBoundingClientRect()`. **No wrapper divs that break flex/grid.**
*Demoable:* load the scaffold's `app/index.aql`, click any node (including a flex/grid child) — the outline draws correctly, no layout shift.

**M1 — Governance preview (the wedge, first).** Minimal Governance panel (the four `meta.security` controls only) on the selected node + Personas editor + "Viewing as" bar + `stripDocument→Render` + side-by-side Admin/Anonymous diff + live analytics-consent toggle + layers-tree glyphs. *(A minimal security-only inspector precedes the full inspector so governance is actually authorable here — closing the architecture panel's critique.)*
*Demoable:* flag a text `pii` → Anonymous masks to `•••••`; mark a section `roles=admin` → it disappears for Anonymous, returns for Admin; deny analytics consent → `data-analytics-*` vanish.

**M2 — Drag-drop + identity + undo/redo.** dnd-kit palette→canvas insert + reorder with containment rules + three-zone algorithm + `KeyboardSensor` with `aria-live` slot announcements + toolbar move parity + uuid minting + `reIdSubtree` on paste + immer history with 300 ms coalescing + `lint` unique-id assert.
*Demoable:* build a hero from an empty canvas by dragging; rebuild it keyboard-only; undo/redo; ids stay unique.

**M3 — Full schema-driven inspector + tokens + responsive.** Control registry per `FieldDef.control`; local `FieldDef` + `STYLE_CONTROLS` with conformance tests; sm/md/lg responsive editing; token pickers fed by `project.tokens`; serialize-gated disabled controls.
*Demoable:* select any node, edit prop/style/responsive via typed controls, live re-render; a custom atom's fieldDefs drive its panel with zero composer code.

**M4 — Export to shippable atomkit-app** *(= end of v0.1).* Preflight gate (`parseDocument` + `lint` + local `canSerialize`) + per-page `serialize` → `app/*.aql` + `atomkit.config.json` (public persona + `allowHosts` union) + `package.json`/`README` matching `create.ts` + FS-Access dir write / fflate zip fallback + read-only live AQL preview pane.
*Demoable:* Download → `npm i && npm run dev` → the exact page at `localhost:3300`.

**M5 — Eject exporter + exporter seam + AI-assist.** `compileDocumentToReact` in-browser → `components/*.tsx` (React-only dep); the `Exporter` interface formalized; optional "generate a section" via `systemPrompt`/`generate` → validated AQL → drop on canvas as schema-valid governed nodes.
*Demoable:* Download-as-React yields React-only TSX; prompt "pricing section" → real nodes appear on the canvas.

**M6 — Core upstreaming + platform.** Land additive `AtomDef.fieldDefs` + exported `STYLE_CONTROLS` (+ optional `accepts`/`allowedParents`/`lower`/`icon`) in core; migrate composer off its local schemas; `ComposerPlugin` API (atoms/panels/exporters/inspectors); sample third-party atom pack with `lower()`.
*Demoable:* install a plugin — its atom appears with a correct inspector + drop rules + a "Download as X" exporter, zero composer-source edits.

**What v0.1 (M0–M4) explicitly does NOT do:**
- **No forms / interactivity.** No input/select/textarea atoms, no events, no client state (verified). Composed apps are presentational — marketing/content/governed pages. This is a separate core atom-pack + action-model milestone. Set this expectation loudly.
- **No editable AQL round-trip** — read-only live preview only; editable AQL re-imports and re-keys selection (deferred).
- **No live client data fetch** — api-bound nodes preview their fallback; real data is baked server-side at build.
- **No plugin SDK / custom-atom export** (`lower`/pack-mode) — M6.
- **No separate mobile canvas** — you edit sm/md/lg override *values*, not a second surface.

---

## 10. Top risks and how each is retired

1. **Un-instrumented canvas** (the shared blind spot both panels named). *Retire:* it is **M0**, the first deliverable — composer-owned registry injecting `data-ak-id` + overlay layer measured off the instrumented DOM + event-delegation selection. `getElementById('node-'+id)` is verified non-viable and explicitly rejected.
2. **Drag-drop iceberg** (both panels: under-priced; realistically a quarter-plus). *Retire:* scope M2 to containment-slot DnD only (no absolute mode); lean on dnd-kit's sortable + `KeyboardSensor`; draw indicators from the M0 overlay. The governance wedge (M1) ships *before* it, so value isn't hostage to the hardest code.
3. **`STYLE_CONTROLS`/`FieldDef` drift** from core's private `STYLE_KEYS`. *Retire:* conformance tests (import `defaultAtoms`; per-control serialize round-trip) fail CI on divergence; delete the local map when core exports `STYLE_CONTROLS` (M6).
4. **`serialize()` throw-set is a moving target.** *Retire:* pin the atomkit version; a test asserts the local `canSerialize` mirror matches `assertRepresentable`'s throw set; prefer core `canSerialize` when it lands.
5. **Governance false confidence** (author assumes preview covers all viewers). *Retire:* require a chosen "public persona" to enable Download; warn when any node references a role no persona covers.
6. **`fieldDefs` becomes a public API third parties pin to** (the platform trap). *Retire:* keep it **local** through v0.1 (no third parties yet); pressure-test the shape on `defaultAtoms` + one custom atom; only *then* land it in core (M6) — earns "design it right" without blocking the demo.
7. **Client-fetch credential leak** (constraint #6, breaking core change). *Retire:* composer never raw-fetches author URLs in preview (fallback + "sample data" chip); recommend `credentials:'omit'` as a separate core PR off the critical path.
8. **Dead `document.version` / no migrate.** *Retire:* composer owns its own `formatVersion`; v0.1 emits `version:1` docs that `parse` unchanged; recommend core `CURRENT_DOCUMENT_VERSION` + `migrate()` before any core doc-schema change.

---

## 11. Open questions for the product owner

1. **Is v0.1 scoped to presentational / governed pages (no interactive forms)?**
   *Recommended default: **Yes.*** Ship the governed-content/marketing composer first; the interactive atom pack + declarative action model is a separate core milestone. This is the biggest expectation-setting call and only you can make it — a tool called a "composer" that can't build a working form will surprise buyers unless we name the boundary loudly.
2. **v0.1 atom set: `defaultAtoms` only, or open to custom third-party atoms from the start?**
   *Recommended default: **`defaultAtoms` only.*** It keeps the `FieldDef`/containment manifest **local and unpinned** through v0.1 (risk 6), and defers `lower()`/pack-mode export (the one genuine architectural crack the architecture panel flagged) to M6.
3. **Do we fund the parallel core PR (`AtomDef.fieldDefs` + `STYLE_CONTROLS`) during v0.1, or entirely after?**
   *Recommended default: **Start it in parallel around M3, but keep the composer on local schemas until it's published.*** The composer never blocks on a core release; conformance tests keep the local mirror honest; we cut over at M6.