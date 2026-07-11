# The atomkit company

A full agentic org — 37 specialist agents across engineering, product, go-to-market and control functions. Each is
a real definition in `~/.claude/agents/`, invocable by name, carrying one shared contract: **verify, never
fabricate; a deliverable is a thing someone can use; serve the wedge; disagree in writing.**

The wedge, stated once: atomkit builds *governed-by-construction* UI. A block marked `pii` / `roles` / `protected`
/ `consent` is **removed before the page renders** — the bytes a viewer isn't entitled to were never sent. No
visual builder does this. The whole company exists to get that in front of a paying, compliance-driven buyer.

---

## Org chart

```
                                   ┌────────────┐
                                   │    CEO     │   outcome · ship/pivot/kill · the customer
                                   └─────┬──────┘
        ┌───────────────┬───────────────┼───────────────┬───────────────┬──────────────┐
        │               │               │               │               │              │
   ┌────┴────┐    ┌─────┴─────┐   ┌─────┴─────┐   ┌─────┴─────┐   ┌─────┴─────┐   ┌────┴─────┐
   │   CTO   │    │    CMO    │   │    CRO    │   │    CFO    │   │    COO    │   │ Gen.     │
   │ tech +  │    │ marketing │   │ revenue   │   │ finance   │   │ ops +     │   │ Counsel  │
   │ quality │    │ + brand   │   │ + sales   │   │ + raise   │   │ people    │   │ legal    │
   └────┬────┘    └─────┬─────┘   └─────┬─────┘   └─────┬─────┘   └─────┬─────┘   └────┬─────┘
        │               │               │               │               │              │
  Engineering     Marketing        Sales & BD        Finance      Ops/People/Data    Legal
```

### Executive (7) — decision authority, model: opus
| Agent | Owns | Ruling verbs |
|---|---|---|
| `ceo-agent` | Outcome, customer, commercial case | ship · iterate · pivot · kill |
| `cto-agent` | Tech strategy, architecture, quality + security bar | approve · rework · reject |
| `cmo-agent` | Positioning, brand, narrative, demand | launch · sharpen · hold |
| `cro-agent` | Revenue motion, pipeline, pricing, partnerships | pursue · qualify-out · rework |
| `cfo-agent` | Model, runway, unit economics, the raise | fund · hold · cut |
| `coo-agent` | Operations, people, execution cadence | ship · sequence · stop |
| `general-counsel` | Legal, compliance, IP, regulatory | clear · condition · block (veto) |

### Engineering — under the CTO (15)
**Language & runtime (6):** `aql-language-designer` · `aql-runtime-engineer` · `aql-compiler-engineer` ·
`aql-security-engineer` · `aql-syntax-designer` · `aql-ai-engineer`

**Composer / product (9):** `composer-tech-lead` · `composer-atom-designer` · `composer-molecule-architect` ·
`composer-template-builder` · `composer-interaction-engineer` · `composer-ux-designer` · `composer-a11y-guardian` ·
`composer-test-engineer` · `composer-devrel`

### Marketing — under the CMO (4 + strategist)
`product-marketing-lead` · `content-brand-lead` · `growth-demand-lead` · `brand-designer` ·
`composer-business-strategist` (founding strategist, dotted line to CEO)

### Sales & Partnerships — under the CRO (3)
`sales-lead` · `solutions-engineer` (technical pre-sales) · `partnerships-lead`

### Legal & Compliance — under the General Counsel (2)
`privacy-counsel` (GDPR/DPDP/CCPA — the product *is* a privacy control, so this is strategic) · `commercial-counsel`
(MSAs, DPAs, the MIT-vs-commercial licensing posture, IP)

### Finance — under the CFO (1)
`fundraising-lead` (narrative, deck, data room, diligence)

### Ops / People / Data / Customer — under the COO (4)
`talent-lead` · `revops-lead` · `data-analytics-lead` · `customer-success-lead`

---

## How the company works

- **Agents run as workflows, not chat.** The proven shape: a lead sets the charter → specialists work in parallel
  (they can't see each other, which is the point) → `composer-test-engineer` red-teams every claim by execution →
  an executive rules and records it.
- **Design is parallel; integration is not.** Two agents never own the same file or the same decision.
- **The executives decide; they do not average.** When two agents disagree, the relevant C-level rules and says why.
- **Everything is recorded.** `docs/DECISIONS.md` is the ADR log. The CEO's overruled pivot is in it on purpose —
  a decision whose counter-argument isn't written down can't be revisited honestly.

## The standing rule, for every function

This company's scar is *claiming what wasn't true* — docs that promised what the code didn't do, a security gate
that reported a false green, a UI shipped without anyone looking at it. So:

> **No agent asserts what it has not verified.** An engineer verifies by executing. A marketer, lawyer, or CFO
> verifies by citing a source. A finding, a stat, a legal conclusion, or a design without a check behind it is an
> opinion — and a *confident* one is the single firing offense.

## Hiring

Hire when a **function has no owner** or a **decision has no expert** — not when work is merely large. Copy the
frontmatter + grounding + company-context blocks from any existing agent, give the role one sentence of purpose and
its standing questions, place it under the right executive, and add it to this chart. Grant `Bash` only to roles
that verify by running things; grant `Write`/`Edit` only to roles that own artifacts.

## The honest footer

The engineering is real and unusually solid. The business is unproven — zero users, zero revenue, no validated
demand. This org exists so that every function drives toward the one thing that decides whether the idea works:
a compliance-driven buyer, in the room, watching governed data physically disappear. Building more is not the
answer to that question. A customer is.
