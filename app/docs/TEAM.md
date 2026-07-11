# The atomkit-composer team

> This is the engineering/product team. For the **full company org** — executive, marketing,
> sales, legal, finance, ops — see [ORG.md](ORG.md).

A standing team of specialist agents. Each is a real definition in `~/.claude/agents/<name>.md`, invocable by
name, sharing one grounding contract: **verify by executing, cite `file:line`, never publish, never guess.**

## The mandate they all serve

> "i want this project as pure aql project, no js, no ts, no css anything… compilor should transform if needed"

That is a *language* constraint, not an app constraint. It is achievable only because of one invariant:

> **Atoms are code. Everything above is data.**

Atoms are React components shipped by `@noidmejs/atomkit`. A pure-AQL project is a repo of `.aql` + JSON config
that composes them. So the composer can be pure AQL — once core ships the atoms and the language features it
needs. That is the program.

## Roster

### Language & runtime
| Agent | Owns |
|---|---|
| `aql-language-designer` | AQL 1.0 grammar and semantics: state, safe expressions, actions, `if`/`for`, the interactive atom contract |
| `aql-runtime-engineer` | The renderer half — making it actually run, and hydrate, without losing fail-closed governance |
| `aql-compiler-engineer` | `atomkit-compiler`: AQL → standalone React, and the 21-document conformance suite that stops the two implementations drifting |
| `aql-security-engineer` | The adversary on staff. Expressions, actions and state are new attack surface against a language whose whole pitch is fail-closed governance |

### The composer
| Agent | Owns |
|---|---|
| `composer-tech-lead` | Architecture, module boundaries, the file-ownership map, integration. Tiebreaker. Says no |
| `composer-atom-designer` | The atom property system: typed `FieldDef`s, predefined + custom properties, atom variants, the inspector's control registry |
| `composer-molecule-architect` | Molecules, organisms, and the library. Owns the dead AQL `widget` primitive and "save back to the library" |
| `composer-template-builder` | Templates, the gallery, starter projects |
| `composer-interaction-engineer` | Canvas instrumentation, hit-testing, drag-and-drop, keyboard equivalents, undo/redo |
| `composer-ux-designer` | Information architecture, the visual system, the craft bar. The persona switcher as hero |
| `composer-a11y-guardian` | WCAG on both sides — the composer's UI *and* the pages it emits. Has veto over mouse-only interactions |

### Function
| Agent | Owns |
|---|---|
| `composer-test-engineer` | Makes green mean something. Every important test gets a negative control: inject the bug, prove the test catches it |
| `composer-business-strategist` | Positioning, ICP, pricing, the wedge. The person in the room willing to say the plan is wrong |
| `composer-devrel` | Docs, tutorials, the language reference, onboarding. Every sample must actually run |

## How the team works

Agents run as a workflow, not a chat. The shape that has worked:

1. **Charter** — one agent sets the authoritative frame (the language charter, the file-ownership map).
2. **Design** — specialists work in parallel against that charter. They cannot see each other, which is the point.
3. **Red-team** — `composer-test-engineer` tries to *refute* every design before a line is written, by running
   commands against the real repos. A claim it cannot reproduce is a false claim.
4. **Synthesize** — `composer-tech-lead` rules on the corrections, the security findings, and the conflicts, and
   writes the build order.

Design is parallel; integration is not. Two agents never own the same file.

## Hiring

Hire when a *file has no owner* or a *question has no expert* — not when work is merely large.

1. Copy the frontmatter and the `## Grounding contract` section from any existing agent.
2. Give the role a single sentence of purpose, then the standing questions it must answer with executable proof.
3. Add it to the roster above, and to the file-ownership map in `BUILD-ORDER.md`.
4. Grant `Bash` only if it must verify by execution. Grant `Write`/`Edit` only if it owns files.

Three roles were hired this way after the mandate landed, because the language expansion created work nobody
owned: `aql-runtime-engineer` (the renderer had no owner — the designer specifies, the compiler transforms, but
somebody must make it *run*), `aql-security-engineer` (state, expressions and actions are three new attack
surfaces), and `composer-devrel` ("very user friendly" is a documentation claim as much as a UI one).

## The standing rule

atomkit's history is of documentation that promised more than the code delivered. `SECURITY.md` claimed the dev
server bound localhost while it bound every interface. The app README claimed the ejected component kept a
client-side fetch, and codegen never emitted one. The test suite asserted responsive CSS was *emitted* while the
override never applied at any viewport.

So: **no agent asserts what it has not run.** A finding without a failing test is an opinion.
