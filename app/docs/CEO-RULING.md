# CEO RULING — atomkit-composer direction

Date: 2026-07-10. Author: CEO. Method: every technical claim below was executed against the live
`dist/` of the published packages, not read from docs. Market claims are cited to sources and dated.

## The ruling: **PIVOT**

I am pivoting the **mandate**, not the product and not the ecosystem.

- **KEEP** the product thesis: a visual composer whose differentiator is *per-node governance enforced at
  egress* plus *eject to standalone React you own*. That is real, verified, and unique.
- **KEEP** the invariant that makes the CANVAS pure AQL: *atoms are code, everything above is data.*
- **REJECT** the mandate as literally written — "pure AQL, no JS/TS/CSS, the composer authored in the
  language it composes, the compiler transforms everything." Expanding AQL into a full declarative UI
  language (state + safe expressions + whitelisted actions + control flow + an interactive atom pack + a
  compiler that emits real React) is the wrong fight. It is a multi-quarter language program that puts
  atomkit in a ring with React, Svelte and HTMX, manufactures the exact lock-in enterprise buyers fear
  most, and buys engineering pride rather than a customer. I engage this honestly below; it is the crux.

The team's own `BUILD-ORDER.md` already half-anticipated this: M1 ships the wedge without the language, and
the pure-AQL chrome is the *last* milestone. My ruling makes that explicit and load-bearing: **M0+M1 is the
product; M2–M5 is a research track funded only by a paying design partner who asks for interactivity.**

---

## Why the mandate is the wrong fight (the three questions, answered with evidence)

### 1. Is expanding AQL into a full declarative UI language the right fight? — No.

The history of standalone declarative UI languages is a graveyard, and the survivors prove the rule:

- **MXML / Adobe Flex** (2004) was a mature declarative markup + scripting UI language. It died with Flash
  (2020). Cause of death named repeatedly in the record: it was *a proprietary, isolated language tied to a
  single vendor runtime.* ([MXML — Wikipedia](https://en.wikipedia.org/wiki/MXML))
- **XAML** survives only welded to Microsoft's runtime (WPF/UWP), itself in decline.
- **JSX won.** And it won precisely by **not being a separate language** — "JSX is embedded within
  JavaScript itself rather than being a proprietary, isolated technology, allowing greater ecosystem
  flexibility and independence from any single vendor."
  ([Flex & Air](https://flexandair.com/a-modern-equivalent-to-mxml-exploring-svelte-and-jsx/),
  [kevinsuttle.com](https://kevinsuttle.com/posts/jsx-2-adobe-flex))

A "pure AQL full UI language, no JS" is the MXML bet re-taken in 2026. The market has already ruled on it.

It also collides head-on with the single strongest enterprise procurement concern about low-code:
**vendor lock-in.** "The most dangerous lock-in happens at the data level as soon as company data is
trapped in proprietary formats… A real export is source code — compilable code, in a language with a public
specification." ([Planet Crust](https://www.planetcrust.com/how-to-avoid-vendor-lock-in-when-using-enterprise-software-on-a-low-code-platform),
[mrc](https://www.mrc-productivity.com/blog/2026/05/the-low-code-vendor-lock-in-test-five-questions-before-you-sign/))
A proprietary full-AQL runtime is the definition of what they refuse to buy. atomkit's own answer to lock-in
— the compiler that ejects to React — is undermined by the mandate that creates a proprietary language for
it to eject *from*.

And the closest commercial analog to "compose your own code components visually" — **Plasmic** — did
**$1.2M revenue with an 11-person team in 2025** ([Tracxn](https://tracxn.com/d/companies/plasmic/__QaKkw4g7sKpcxo6g3Mhaay89khPJA1R-6pYUKaYnAe8)).
That is a viable niche business, not a Wix-scale category. "Compose code components visually" is a small
market before you add the burden of inventing a language for it.

**Verdict: the language expansion is an engineer's cathedral.** The most sophisticated new engineering in
the repo — a mutation-tested, no-`eval` safe expression evaluator — has **zero call sites** (verified:
`evaluate`/`interpolate`/`evalExpr`/`parseExpr` are exported from `index.ts` but called nowhere in
`render.tsx`/`data.tsx`/`atoms.tsx`). The team built the hardest, most speculative part of a language before
proving one customer wants the product it would power. That is the tell.

### 2. Is per-node governance-at-egress a real procurement trigger, or a fantasy? — Real, but sold to a different buyer than the builder.

- **The capability maps to a budgeted category.** Dynamic data masking — "masking in real time based on a
  user's role and permissions, so different users see different versions of the same data" — is exactly what
  `stripDocument` does, and it is a recognized compliance control under GDPR/HIPAA/CPRA.
  ([OvalEdge](https://www.ovaledge.com/blog/data-masking-techniques),
  [Tonic.ai](https://www.tonic.ai/guides/pii-data-compliance-checklist))
- **But the incumbents deliver it in the data layer** (Immuta, Snowflake DDM, Tonic, K2view, IRI/Perforce),
  not the UI-document layer. The buyer — data governance / CISO — shops there. Doing it at *render egress*,
  closest to the viewer, is genuinely novel; it is also a layer where that buyer is not currently shopping.
- **The nearest builder that monetizes governance is Retool** — and it sells on "RBAC, audit logs, secrets
  management, permission enforcement… so apps inherit them automatically," gated to Enterprise pricing.
  ([Retool](https://retool.com/govern-enterprise-apps)) The reason to buy is governance; **the reason is
  never a proprietary language.** Retool ships escape hatches to real JavaScript.

So the wedge is real. The honest read: **the CISO buys governance, the marketer buys the builder, and today
those are two people.** The commercial job is to make the governed page the thing the marketer ships and the
CISO signs off — one artifact, two approvals. That is achievable on the presentational atoms we already
have. It does not require the language.

### 3. Is "the composer written in the language it composes" a buying signal or vanity? — Vanity.

No market leader is built out of its own output. Gutenberg's editor is React, not blocks. Figma is C++/WASM,
not Figma files. Webflow, Framer and Builder.io are React apps. Zero customers have ever selected a tool
because it was made of itself. The `commercial-strategy.md` spec already ruled this "an owner conviction, not
a buying signal… a dogfooding proof, not revenue," and I affirm that ruling. Dogfooding is a fine *internal*
quality bar. It is not a reason a stranger pays.

---

## 4. The smallest thing someone pays for, and when we learn

**The smallest payable unit:** a marketer or ops person at a regulated company assembles a page from content
blocks; flags a block PII / role-gated / consent-gated; the page renders masked for the wrong viewer (the
data physically never reaches the client); and engineering can eject the page to standalone React they own.
That is M1 on the 19 presentational atoms. No state, no actions, no language.

**When we learn:** the moment one named regulated design partner reacts to that demo. The
`commercial-strategy.md` open item #5 is the real gate — *"Is there a named regulated design partner? The
paid-pilot case rests on one."* It is unverified and it is the highest-leverage unknown in the whole program.

**The fastest honest path to that learning is not more code — it is a design-partner conversation gated on a
thin M1.** Given the composer contains **zero `.aql` today** (verified: `find … -name '*.aql' | wc -l` → 0),
the risk is not "can we build the language." It is "will anyone buy the governed page." Spend the next
increment reducing *that* risk, not building M2–M5.

One gap that pilot must confront, verified by execution below: the eject path is fail-*closed* but
*incomplete* for the regulated page — a governed node is silently dropped from the ejected React. The pilot
must scope around this (governed nodes render through the runtime; the ejected file carries a governed
placeholder that hydrates) or it is not honestly "eject your governed page."

---

## 5. My satisfaction bar — item by item, with the evidence I personally ran

| # | Bar | Status | Evidence I executed |
|---|-----|--------|---------------------|
| 1 | A named user story runs end to end | **UNMET** | `find /Users/noidme/atomkit-composer -name '*.aql' \| wc -l` → **0**. No app, no user flow. The closest thing that runs is a library call (`stripDocument`), not a user story. |
| 2 | Every doc claim executed | **PARTIAL** | Core ADR claims I re-ran pass: `stripDocument` masks PII (anon→`•••••`, privileged→real value); `maskNode` drops hand-authored `secret`/`state` fields; evaluator has no `eval`/`new Function`/`with`. But composer **specs** assert M2–M5 behavior that *cannot* be executed — the code doesn't exist — and `commercial-strategy.md` self-labels its market claims "unverified." Code claims: green. Product claims: unexecutable. |
| 3 | Tests have negative controls proven able to fail | **MET (library) / N/A (product)** | `node --test` in core → 7 pass / 0 fail; compiler → 2 files pass, 21-doc conformance corpus confirmed (`grep -c` → 21). The wrapper-`div` negative control (ADR-001) and the 8 mutation-tested evaluator guards (ADR-002) are genuine. There is no composer test suite because there is no composer. |
| 4 | Security engineer signs off IN WRITING that governance is unreachable from state/expressions/actions | **UNMET** | There is no running state/expression/action layer — the evaluator has **zero call sites** (verified). So governance is trivially unreachable from them *because they do not run*. The sign-off that governance *survives* them is exactly M0, which is unbuilt. The strategy spec states the designed interactive layer is *fail-OPEN* for governance. No written sign-off on running interactive code exists. |
| 5 | A11y guardian signs off every interaction has a keyboard path | **UNMET / N/A** | There are no interactions. `Button` renders `type:'button'` with **no handler** (verified, `atoms.tsx:85`); zero input/select/textarea atoms. Nothing to sign off yet. |
| 6 | What v1 does NOT do is written down | **MET** | `BUILD-ORDER.md §8` is explicit and honest (no interactivity before M0 green; pure-AQL chrome is last; interactive nodes not statically compiled before M5). Reproduced in the box below. |
| 7 | Commercial case in two sentences without hedging | **MET for the pivoted product; UNMET for the mandate** | I can state the governed-composer case without hedging (below). I **cannot** state a non-hedged commercial case for the pure-AQL-language mandate — which is itself the finding. |

**Score: 1 clean MET (#6), 1 MET-for-library (#3), 1 partial (#2), 4 UNMET (#1, #4, #5, #7-for-mandate).**
This is a project with excellent engineering hygiene and no product. I will not sign off. The bar is not met.

---

## The verified facts this ruling stands on (I ran every one)

- Governance masks PII at egress: anonymous viewer sees `{"text":"•••••"}`, privileged sees the real value.
  (`stripDocument`, `security.ts:146`)
- `maskNode` fails closed: a hand-authored node carrying `secret` / `state` fields comes back as
  `{id,type,props}` only — the extra fields are dropped, not masked-through. (`security.ts:81`; this is the
  bug the red team found in `@0.7.0`, now fixed.)
- The safe expression evaluator exists and never uses `eval`/`new Function`/`with` — and has **zero call
  sites** in the render pipeline. It evaluates nothing today. (`expr.ts`, exported only via `index.ts`)
- The compiler emits **zero** handlers/hooks (grep: 0 for `onClick`/`useState`), and **drops governed
  nodes**: compiling a page with a `pii` block, the emitted React contains the public headline and **not**
  the PII value — the governed node vanishes. Fail-closed, but the regulated page ejects incomplete.
  (`compiler/index.ts:26-40`)
- 19 atoms, all presentational; `Button` = `type:'button'`, no handler; no input/select/textarea.
- AQL parses `widget "Name"` into `AqlWidget` — and **nothing** consumes it in any of the four repos. A
  dead, half-built language feature. (`query.ts:304`)
- `serialize()` throws on static data / api headers/body/ttl / analytics props / `meta.note`
  (`query.ts:413-416`) and cannot round-trip an interactive document.
- Core 7/7 tests pass; compiler 21-doc conformance green; `npm audit` → **0 vulnerabilities**.
- Composer repo: **0 `.aql`**, a 328-line spike, docs only. There is no product.

---

## The new direction (what we build, in one page)

**Product name (working):** the *governed content composer*.

**Who it is for:** teams at regulated companies (healthcare, fintech, gov, insurance) that cannot ship a
marketing or portal page through an ungoverned CMS, and whose engineering org refuses proprietary lock-in.

**What it does:** a visual builder — React chrome (palette / inspector / layers / undo), like every
competitor — whose **canvas is real AQL** (`Render(stripDocument(doc, persona), …)`). Every block can be
flagged role- / PII- / consent-gated; governance is enforced at **egress**, so the wrong viewer never
receives the data. Any page **ejects to standalone React the customer owns.**

**The two pillars, and their honest state today:**
1. *Governed by construction* — VERIFIED and working on presentational content.
2. *Portable by default (eject to React)* — VERIFIED to work for public content; has a **named gap** for
   governed nodes (they drop on eject). Close that gap or scope the pilot around it before selling pillar 2.

**Milestones (adopting the team's own sequencing, re-weighted):**
- **M0 — governance survives (the gate).** Not because interactivity ships next, but as *insurance*: prove
  that if state/actions are ever added, they cannot become a PII exfiltration channel. Fund it. Keep it green.
- **M1 — the wedge, shippable.** The composer on 19 presentational atoms, React chrome, governed canvas,
  eject. **This is the product.** Ship it to one design partner.
- **M2–M5 (state, actions, editor atoms, pure-AQL chrome, compiler interactive mode) — RESEARCH TRACK.**
  Funded only when a paying design partner asks for interactivity. Not v1. Not the mandate.

---

## What v1 explicitly does NOT do (say it plainly, no one is surprised)

- It is **not** a pure-AQL project. Its chrome is React, exactly like Gutenberg, Webflow, Framer and Builder.
  Only the canvas is AQL. The mandate's "no JS/TS/CSS in the composer" is deferred to a research track.
- It ships **no interactivity** — no state, no actions, no expressions, no forms. The evaluator stays dark
  until M0 proves governance survives it.
- It does **not** compete with React/Svelte/HTMX. AQL is a document format for composing governed content,
  not a general UI language.
- It does **not** claim "eject your governed page to React" until the governed-node-drop gap is closed;
  until then it ejects *public* content and renders governed content through the runtime.
- It does **not** have a named paying design partner yet. That is the next thing we go get.

---

## The two sentences for the owner

**Commercial case (the product I will fund):**
atomkit-composer is a visual page builder for regulated teams: every block carries per-viewer governance —
role, PII, consent — enforced at egress, so the wrong viewer *physically never receives* the data rather than
having it hidden client-side, and any page ejects to standalone React the customer owns with no proprietary
runtime. We sell the one thing Wix, Webflow and Builder.io structurally cannot — content that is compliant by
construction and portable by default — to the compliance-owning buyer who today cannot ship a page through an
ungoverned CMS.

**The respectful pushback (the mandate I am declining):**
Turning AQL into a full "no-JS" declarative UI language is the one bet I will not make — it is the exact bet
that killed MXML/Flex, it manufactures the proprietary lock-in that is enterprises' number-one low-code
objection, and no market leader (Wix, Webflow, Framer, Gutenberg, Figma) is built in its own language, so
"the composer is written in what it composes" wins pride, not a customer. Keep the invariant that already
makes the *canvas* pure AQL — atoms are code, everything above is data — ship the governed composer on the
19 atoms we have, and put the language behind a paying design partner who asks for it; otherwise we spend
quarters building a cathedral to fight React while the thing that actually sells — governance-at-egress plus
eject-to-React — sits finished and unshipped.

---

## Ruling, restated

**PIVOT.** New direction: the governed content composer (M0 gate + M1 wedge), React chrome, AQL canvas,
governance-at-egress and eject-to-React as the two pillars. The full declarative-language mandate is demoted
from requirement to design-partner-funded research. Go find the one regulated design partner; that
conversation, not more language engineering, is the next dollar of spend.

**Sources:**
- [MXML — Wikipedia](https://en.wikipedia.org/wiki/MXML)
- [A Modern Equivalent to MXML? — Flex & Air](https://flexandair.com/a-modern-equivalent-to-mxml-exploring-svelte-and-jsx/)
- [What JSX 2.0 could glean from Adobe Flex — kevinsuttle.com](https://kevinsuttle.com/posts/jsx-2-adobe-flex)
- [Plasmic — 2026 Company Profile — Tracxn](https://tracxn.com/d/companies/plasmic/__QaKkw4g7sKpcxo6g3Mhaay89khPJA1R-6pYUKaYnAe8)
- [Data Masking Techniques — OvalEdge](https://www.ovaledge.com/blog/data-masking-techniques)
- [PII Data Compliance Checklist — Tonic.ai](https://www.tonic.ai/guides/pii-data-compliance-checklist)
- [Retool — Enterprise Security and Governance](https://retool.com/govern-enterprise-apps)
- [Avoiding Vendor Lock-In on Low-Code — Planet Crust](https://www.planetcrust.com/how-to-avoid-vendor-lock-in-when-using-enterprise-software-on-a-low-code-platform)
- [The Low-Code Vendor Lock-In Test — mrc](https://www.mrc-productivity.com/blog/2026/05/the-low-code-vendor-lock-in-test-five-questions-before-you-sign/)
- [Framer vs Webflow vs Wix Studio 2026 — comparison](https://www.we-optimizz.com/post/framer-vs-webflow-wordpress-wix)
