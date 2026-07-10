# atomkit-composer

A visual composer for [atomkit](https://github.com/noidme-git/atomkit), **authored entirely in AQL**.

No `.js`. No `.ts`. No `.css`. No `package.json`. No `node_modules`. The compiler transforms.

```bash
npx @noidmejs/atomkit-app dev      # http://localhost:3300
npx @noidmejs/atomkit-app build    # → out/  (static HTML + React you own)
```

Everything generated lives in `out/`, which is gitignored. The repo is `app/*.aql`, a config file, and docs.

## What runs today

The shell, the canvas, the governance preview, the palette, the layers tree and the inspector. The canvas is not a
mock: it is the real renderer, rendering real atoms, through the real egress path. The PII on it shows as `•••••`
because `stripDocument` removed the value before the page was rendered — not because a CSS rule hid it.

**10.9 KB of HTML. Zero `<script>` tags. Zero stylesheets.**

## What does not run today, and why

| | |
|---|---|
| Click a palette item to insert a node | needs request params in an expression scope |
| Select a node | same |
| Edit a property | needs input atoms and an action model |
| Drag and drop | needs client state and events |
| Undo / redo | needs client state |

AQL has 19 atoms, all presentational. There is no input atom, no event model, no client state. `Button` renders
`type="button"` with no handler. So the composer's canvas can be AQL today; its *controls* cannot.

The page says so, on the page. An honest boundary beats a demo that lies.

## What unblocks it

Two governance gates, in `atomkit/tools/gates/`:

```
G2w  the renderer evaluates expressions ONLY through evalInScope     ❌ open
G5w  every navigation path routes through safeNavigate               ❌ open
```

`buildScope()` and `safeNavigate()` exist and are sound. Neither has a call site, and **a primitive nobody is
forced to use is a library, not an invariant.** Nothing interactive ships until both are wired.

That is not bureaucracy. A composer holds the *unstripped* authoring document by definition — it is the thing being
edited. The moment that document reaches an expression scope, an expression reads straight around the mask. A
composer that leaks a masked value in its own preview pane has destroyed the only thing that makes it worth
building.

Run `node atomkit/tools/gates/governance-gate.mjs`. It exits 1. It is meant to.

## Why this exists

Every visual builder — Wix, Webflow, Framer, Builder.io, Gutenberg — lets you hide content. None of them lets you
*withhold* it. In atomkit, a node marked `pii` or `roles=recruiter` is removed from the document **before the page
is rendered**, so the bytes a viewer is not entitled to were never sent. Not `display:none`. Not blurred. Absent.

And any page ejects to standalone React you own. That escape hatch is the price of asking anyone to adopt a new
language.

## Docs

- [`docs/DECISIONS.md`](docs/DECISIONS.md) — the ADR log. Every decision is backed by an experiment that was run,
  and where a claim turned out to be wrong (ADR-003) it is corrected in place rather than quietly patched.
- [`docs/TEAM.md`](docs/TEAM.md) — the agent team, and the rule they now all carry: *a milestone ends in something
  the owner can run.*
- [`docs/CEO-RULING.md`](docs/CEO-RULING.md) / [`docs/CTO-RULING.md`](docs/CTO-RULING.md) — including the ruling the
  owner overruled, preserved so the decision can be revisited honestly.
