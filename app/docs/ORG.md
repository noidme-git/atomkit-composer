# The atomkit company

38 specialist agents across engineering, product, go-to-market and control functions. Each is a real definition in
`~/.claude/agents/`, and — as of the org review — **every reporting line below exists in the actual charter**,
verifiable by grep. The earlier version of this file asserted an org chart the charters did not contain; that was
the company's own firing offense (claiming the unverified), and it is fixed.

The wedge, once: atomkit builds *governed-by-construction* UI. A `pii`/`roles`/`protected`/`consent` node is
**removed before the page renders** — the bytes a viewer isn't entitled to were never sent. No visual builder does
this. The whole company exists to get that in front of a paying, compliance-driven buyer.

---

## Org chart (matches the charters)

```
                                        CEO
        ┌──────────┬──────────┬──────────┼──────────┬──────────────┐
       CTO        CMO        CRO        CFO        COO       General Counsel
        │
        ├── aql-security-engineer         (direct — audits the platform, must be independent)
        ├── composer-test-engineer        (direct — independent QA, must not report to who it red-teams)
        │
        ├── Head of Language & Platform
        │      ├── aql-language-designer      ├── aql-syntax-designer
        │      ├── aql-runtime-engineer       ├── aql-ai-engineer
        │      ├── aql-compiler-engineer      └── core-atom-engineer  ⭐ NEW — the unblocking hire
        │
        └── Head of Composer  (composer-tech-lead, now a manager, not a tiebreaker)
               ├── composer-atom-designer        ├── composer-ux-designer
               ├── composer-molecule-architect   ├── composer-a11y-guardian (keeps keyboard veto)
               ├── composer-template-builder     ├── composer-interaction-engineer (sole DnD owner)
               └── composer-devrel (dotted → content-brand/CMO for public editorial)
```

| Executive | Reports | Function |
|---|---|---|
| **CTO** | Head of L&P · Head of Composer · aql-security-engineer · composer-test-engineer | Engineering (17) |
| **CMO** | product-marketing · content-brand · growth-demand¹ · brand-designer¹ | Marketing (4) |
| **CRO** | sales-lead · solutions-engineer · partnerships-lead | Revenue (3) |
| **CFO** | fundraising-lead¹ | Finance (1) |
| **COO** | talent-lead · revops-lead · data-analytics-lead¹ · customer-success-lead | Ops/People/Data (4) |
| **General Counsel** | privacy-counsel · commercial-counsel¹ | Legal (2) |

¹ **dormant / fractional** until a validated buyer justifies the spend (see below).

---

## What the org review changed (2026-07-11)

Five reviews — talent, COO, CTO, CMO, and an adversarial pre-mortem — reached one verdict: **fixable, not great,
one re-wire from repeating the failure.** Full detail in [ORG-REVIEW.md](ORG-REVIEW.md). Applied:

1. **Engineering is wired into the company and layered.** The CTO now reports to the CEO (it reported to no one).
   The 15 flat engineers now sit under two real managers — **Head of Language & Platform** and **Head of
   Composer** — with `aql-security-engineer` and `composer-test-engineer` reporting to the CTO directly so QA and
   security stay independent of what they review. *This was the single highest-leverage change: it repaired the
   orphan CTO, all 17 orphans, and the 15-wide flat span at once, and installed the manager accountable for
   whether a thing shipped — the documented root of the "15 docs, 14 spikes, zero code" near-death.*
2. **`core-atom-engineer` created** — the interactive + editor-primitive atoms the whole pure-AQL mandate is
   blocked on had no owner. Now they do.
3. **`composer-business-strategist` retired** — a redundant orphan duplicating the CMO, CRO and product-marketing.
4. **The strategic contradiction is resolved.** The company had been briefed two ways (build pure-AQL vs. pure-AQL
   is a losing bet). One reconciled directive now runs in every charter — see below.

## The one strategy (in every charter — pending owner ratification)

> The **wedge ships now** on the 19 presentational atoms. **Pure-AQL stands** as the platform bet the owner chose.
> **Interactivity is gated on demand** — no interactive feature ships to customers until a named regulated buyer
> has reacted to the governance demo. Go-to-market gets the demo in front of the buyer; engineering ships the
> wedge and builds the interactive layer behind the gate, ready the moment demand is proven.

Nobody is told to stop building; nobody is told to build ahead of demand. This is the reconciliation the CEO and
the composer tech lead independently reached. **The owner must ratify it or replace it — it is the single most
important open decision in the company.**

## Decision rights (the CEO must ratify)

1. **One DRI per decision** — exactly one accountable owner, never a committee.
2. **Default open** — ship unless a *named* gate is red. You may not block outside your own gate.
3. **One arbitration forum** — cross-boundary ties (eng vs go-to-market) resolve at the CEO, CTO present, in a
   **weekly ship review**. The COO owns that cadence and the single decision log.
4. **Settled stays settled** — the pure-AQL mandate is not re-argued; dissent is recorded, not relitigated.
5. **A demand gate with the weight of the security gate** — no interactivity ships until a real buyer has reacted.

## Dormant until a customer justifies them

The company is ~40% engineering for zero revenue; the go-to-market half over-builds for a product no buyer has
seen. These stay dormant/fractional, and their headcount is redeployed to the demo and buyer-sourcing:
`growth-demand-lead` (keep a fractional "one channel" slice), `brand-designer` (landing page + deck only),
`data-analytics-lead` (fold under revops for now), `fundraising-lead` (data room warm, not raising),
`commercial-counsel` (on-demand). **Kept active:** `privacy-counsel` — the DPIA/GDPR mapping *is* a sales asset.

## Still-open gaps (owners assigned, work not done)

- **Product management** — one owner turning buyers into a backlog (today a committee). Deferred hire.
- **SOC 2 / trust posture + the security-questionnaire package** — the document that closes a compliance sale is
  produced ad-hoc across two silos. → General Counsel (readiness) + solutions-engineer (package).
- **Pricing DESIGN** — execution is owned, tier design is not. → product-marketing designs, CFO gates, CRO executes.
- **Per-persona eject** working group → Head of Language & Platform.

## The standing rule

> **No agent asserts what it has not verified.** An engineer verifies by executing; a marketer, lawyer or CFO by
> citing a source. This file itself broke that rule once and was corrected. A confident fabrication — an invented
> stat, an unbacked reporting line, a claim the code doesn't deliver — is the single firing offense.
