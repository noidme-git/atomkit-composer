# atomkit-composer

A visual, drag-and-drop composer for [atomkit](https://github.com/noidme-git/atomkit). Compose a UI
from atoms on a canvas; download a real, shippable **AQL project** you own.

> Status: **design complete, implementation starting.** Nothing here is usable yet.

## What it is

Think ExtJS Architect / Wix / WordPress Gutenberg, but the artifact you take away is not locked in a
vendor database. It is an `atomkit-app` project:

```
my-ui/
  app/index.aql            # your page, as AQL source
  atomkit.config.json      # tokens, governance context, data allow-list
  package.json
```

Run it with `atomkit-app dev`, ship it with `atomkit-app build`, or eject it to plain React with
`atomkit-compile`. The composer is an authoring surface, not a runtime dependency.

## Why it can exist now

The composer sits on `serialize()` — document → AQL. Until `@noidmejs/atomkit@0.6.0` that function
silently dropped `roles`, `consentCategory`, `hidden`, data bindings and `alt`, so a
compose → save → reload cycle would have quietly turned an admin-only node into a public one. It is
now the exact, tested inverse of `parse()`, and it *throws* rather than drop a field it cannot
express. That is the precondition for a visual editor that cannot silently lose your work.

## Verified constraints

These were established by running the published `@noidmejs/atomkit@0.6.0`, not by reading docs.
They shape the design.

### The composer's own chrome cannot be written in AQL

AQL has no interactive atoms and no event or client-state model. The atom set is `box, section,
container, grid, row, stack, text, heading, link, button, chip, list, icon, image, video, accordion,
accordion-item, divider, spacer` — all presentational. So the palette, canvas chrome and inspector
are React. What *is* AQL is the thing being composed: the canvas renders a real `BuilderDocument`
through atomkit's own `Render` + `defaultAtoms`, so what you see is what ships.

### Node ids are not unique, and not stable under edit

Nothing enforces id uniqueness — not `parseDocument`, not `lint()`, not `Render`:

```
duplicate ids → parseDocument: ACCEPTED    lint(): no complaints
  <style>@media(min-width:768px){.ak-a{font-size:99px !important}}
         @media(min-width:768px){.ak-a{font-size:10px  !important}}</style>
  <h2 class="ak-a">First</h2>          ← silently renders at 10px, not 99px
  <h2 class="ak-a">Second</h2>
```

Two nodes sharing an id share their responsive CSS (`.ak-<id>`) and collide as React keys.

Worse for an editor: `compilePage()` derives ids from tree position, so they **move** when you
insert:

```
before insert:  0:"Keep me big"
after  insert:  0:"New"   1:"Keep me big"     ← every id shifted
```

Any editor state keyed on `id` — selection, undo, per-node CSS — now points at a different node.
The composer must therefore own node identity, and core must gain a uniqueness check.

### `serialize()` refuses five field classes

The composer's UI must not let a user author something that cannot be saved. Verified:

| Field | Serializable? |
|---|---|
| `data.source` static `value` | ⛔ refused |
| api binding `headers` / `body` / `ttl` | ⛔ refused |
| `meta.analytics.props` | ⛔ refused |
| `meta.note` | ⛔ refused |
| plain api binding (`url` + `path` + `bindTo`) | ✅ allowed |

Note the sharp edge: **`meta.note` is exactly the "editor-only note" feature a composer wants**, and
AQL cannot express it. Either AQL gains a `note=` attribute or notes live outside the document.

### `AtomDef.fields` is untyped

`AtomDef.fields` is a bare `string[]` (`["width", "gutter"]`) — its own comment says *"for a future
palette"*. An inspector cannot derive a control from the name `"width"` alone. A typed field schema
is required in core before the inspector can be schema-driven.

## The wedge: governance preview

No other visual builder — Wix, Webflow, Builder.io, Gutenberg — has per-node governance enforced at
egress. atomkit does, and it makes a preview feature that nobody else can ship. One document, three
viewers, verified working today:

| Preview as | Renders |
|---|---|
| anonymous | `Public headline  •••••` |
| admin, PII allowed | `Public headline  ada@corp.com  Board deck link  Q3 revenue` |
| anonymous + analytics consent | adds `data-analytics-id` attributes |

A designer flags a node `pii` and immediately sees what a logged-out visitor sees. That is a
compliance review loop inside the design tool.

## License

MIT
