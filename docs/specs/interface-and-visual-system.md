# SPEC — Composer interface & visual system (ruled)

Owner: composer-ux-designer (+ composer-a11y-guardian). Ruled by composer-tech-lead. Verified against atomkit 0.7.0
+ atomkit-app on 2026-07-10.

## 1. Accepted

- **The constraint is the design system.** Because every value must survive `resolveStyle` (the DIRECT whitelist)
  and the config token pipeline, the composer is forced into the token-driven, fail-closed discipline it sells.
  This reframe is correct and it is the story.
- The verified craft palette: layered `boxShadow` (elevation/rings), `transform`/`opacity`/`transition` +
  `cubic-bezier` (motion), `gridTemplateColumns "280px 1fr 320px"`, `calc()`, `var(--ak-*)` tokens, `zIndex`
  clamped. Focus ring via `boxShadow` (since `outline` is stripped). Overlay via `position:absolute` (survives)
  inside a relative frame. All verified expressible + safe.
- The **persona switcher is the hero** and it runs the REAL egress path: `Render(stripDocument(doc, persona))` —
  the identical two-step `atomkit-app` runs (`render.ts:31`). Verified: PII masks to `•••••`, role-gated nodes
  vanish, analytics attrs appear only on `ctx.consent.analytics===true`. This is a genuine differentiator.
- The four style core-changes (K14): `cursor` (enumerated keyword whitelist, reject `url()`), single-line
  truncation (`whiteSpace`/`textOverflow`), flex sizing, `gridTemplateRows` — verified all stripped today. Plus
  bindable, boolean/token-coerced ARIA state.

## 2. Corrections (rulings)

- **The state/action/expression/binding RUNTIME the chrome is authored against does not exist on HEAD.** `expr.ts`
  is read-only and **unwired** (verified: no call sites in `render.tsx`/`query.ts`); the compiler emits static TSX.
  Ruling: the chrome ships on a **transitional React host** (the design's own open-question #1) for M1–M4, and
  migrates to pure AQL at **M5**. Remove "pure-AQL, safe by construction, fully expressible today" claims until the
  runtime ships. The mandate is met at M5, not now.
- **C12 — bound styles are DEAD today, and an injection hazard if wired naively.** Verified:
  `resolveStyle({backgroundColor:'{{…}}'})` → `{}` (`clean()` rejects `{`/`}`). Ruling: specify interpolation
  ordering as a security invariant — **interpolate `{{ }}` to a plain value FIRST, THEN run `resolveStyle`/`clean()`
  over the RESOLVED string**, with the corresponding core change so bound styles work without weakening the
  CSS-injection guard. `clean()` sanitizes the literal template, not the post-interpolation value.
- **S1 — the "chrome state cannot read a masked value" guarantee is unfounded and must be made real in code.**
  Verified: `interpolate("{{state.secret}}",{state:{secret:"TOPSECRET"}})` → `"TOPSECRET"`; the interpreter reads
  any own key in whatever scope it is handed, and there is no chrome/canvas isolation. The inspector's
  `state.selected` is the UNMASKED authoring node. Ruling: enforced host-side scope isolation — the host must
  provably never place unmasked/canvas data into a preview-persona expression scope. Assert it with a test, not a
  charter reference.
- **S2 — `navigate` is unanalyzed and unguarded.** The design vouches for a six-verb action system that does not
  exist and cites `Object.create(null)`/proto-guard as existing safeguards (verified: no action runtime, and
  `FUNCTIONS` has no mutation verbs). Ruling: define a `navigate` URL allow-list (via `atomkit-http`, K3) and
  forbid computed/cross-origin targets before any `navigate` verb ships.

## 3. Layout without stripped properties

Verified stripped: `flexGrow`, `gridTemplateRows`, `position:sticky/fixed` (anti-clickjacking drops `position`).
Ruling for M1 (before K14): the shell is a flex column at `h="100vh"`; the body row uses `calc(100vh - 52px - 28px)`
+ per-pane `overflow`; panel headers are fixed-height rows above scrolling bodies (no sticky). K14 replaces the
`calc` coupling with `gridTemplateRows "auto 1fr auto"` / `flexGrow`. Flag the `calc` coupling as brittle until then.

## 4. Keyboard & a11y (a11y-guardian veto)

Every mouse action has a keyboard equivalent and an `aria-live` announcement. Bound `aria-selected/pressed/expanded`
(K14) is a **blocker** — without it tabs/toggles/tree are operable but silent to AT (WCAG 4.1.2), and it ships
green because nothing tests screen-reader output. Gate M5 on an assistive-tech test, not tab-order.

## 5. Guardrail

Download is disabled until a persona is explicitly designated the shipped public persona, and the composer warns on
any role in the document with no matching persona — otherwise the hero becomes a false-confidence generator (an
author could flag `roles=['legal']` with no `legal` persona and never preview that egress).
