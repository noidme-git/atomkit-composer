# ORG REVIEW — the 37-agent atomkit company

**Author:** COO · **Date:** 2026-07-11 · **Inputs:** five reviews (talent-lead, COO, CTO, CMO, adversarial pre-mortem), each read and re-grounded against the actual charters in `~/.claude/agents/`. Every claim below is cited to a charter file:line or a grep I ran. Where a review over-reached, I corrected it and say so.

---

## 1. Verdict — blunt

**Fixable, not great — and one re-wire away from repeating the failure it already had.** The people and skills are real; the *wiring* is not. The single most damning fact is not in any one charter — it is the gap between the two artifacts: the published chart (`app/docs/ORG.md:22,41,51`) asserts that the CTO reports to the CEO, that "Engineering — under the CTO (15)," and that the strategist has a "dotted line to CEO" — **yet none of those edges exist in the charters.** `cto-agent.md` names no boss and `ceo-agent.md` lists no CTO (grep: zero "reports to" in either; CEO's five reports are cfo/cmo/cro/coo/general-counsel). All 16 engineering charters return zero reporting lines. So the org chart is a confident assertion the definitions do not back — which, by this company's own standing rule (`ORG.md:83-85`, "a *confident* [unverified assertion] is the single firing offense"), is exactly the scar the company says it fires over. That is the shape that already produced **"15 documents, 14 spikes, and zero lines of composer app code"** (`ceo-agent.md:124`, `cto-agent.md:132`): 43% of the org (16 of 37) is supply-side engineering, leaderless and flat under a disconnected CTO, while the business the CEO/CRO/CFO all call the live risk — "one conversation with one regulated-industry buyer" (`cro-agent.md:102-104`, `cfo-agent.md:19-20`) — has zero owners empowered to force it. None of this is fatal. It is a handful of reporting edges, two eng-manager appointments, one retired role, a weekly cadence, and a set of named DRIs. But do not call this org great until the CTO line and the cadence exist in the charters, not just on the chart.

---

## 2. The reporting structure, FIXED

### BEFORE (what the charters actually encode — verified by grep, not what `ORG.md` claims)

```
CEO ── cfo · cmo · cro · coo · general-counsel          [5 reports; CTO absent]
 │
 └── (no line) ────────────────────────────────────────────────────── ✗ severed
                                                                        │
CTO  (reports to NO ONE — cto-agent.md frontmatter names no boss)       │
 └── (no line to any of them) ── 15 ENGINEERS, FLAT, NO MANAGER: ───────┘
       aql-language-designer, aql-runtime-engineer, aql-compiler-engineer,
       aql-security-engineer, aql-syntax-designer, aql-ai-engineer,
       composer-tech-lead (a "tiebreaker", not a manager — composer-tech-lead.md:13),
       composer-atom-designer, composer-molecule-architect, composer-template-builder,
       composer-interaction-engineer, composer-ux-designer, composer-a11y-guardian,
       composer-test-engineer, composer-devrel
composer-business-strategist  (orphan — no reporting line; read-only tools)

CMO ── product-marketing-lead · content-brand-lead · growth-demand-lead · brand-designer   [4]
CRO ── sales-lead · solutions-engineer · partnerships-lead                                 [3]
CFO ── fundraising-lead                                                                     [1]
COO ── talent-lead · revops-lead · data-analytics-lead · customer-success-lead             [4]
GC  ── privacy-counsel · commercial-counsel                                                [2]
```

### AFTER (encode these lines in the charters, so the chart stops being fiction)

```
CEO ── CTO · CFO · CMO · CRO · COO · general-counsel          [span 6 — healthy]
 │
 └── CTO
      ├── Head of Language & Platform   ← PROMOTE aql-runtime-engineer (player-coach)
      │      ├─ aql-language-designer
      │      ├─ aql-compiler-engineer
      │      ├─ aql-syntax-designer
      │      ├─ aql-ai-engineer
      │      └─ core-atom-engineer      ← NEW (or redeploy): interactive + editor-primitive React atoms
      ├── Head of Composer              ← RE-CHARTER composer-tech-lead as EM (elevate to opus)
      │      ├─ composer-atom-designer
      │      ├─ composer-molecule-architect ┐ merge candidate (one mechanism —
      │      ├─ composer-template-builder    ┘ composer-template-builder.md: "reuse the molecule mechanism")
      │      ├─ composer-interaction-engineer
      │      ├─ composer-ux-designer
      │      ├─ composer-a11y-guardian
      │      ├─ composer-test-engineer
      │      └─ composer-devrel          (solid → Head of Composer; DOTTED → content-brand-lead/CMO for public docs)
      └── aql-security-engineer          (DIRECT to CTO — independent of the pods it audits)

CFO ── fundraising-lead* ;  revops-lead DOTTED-line (solid stays COO)
CMO ── product-marketing-lead · content-brand-lead · growth-demand-lead† · brand-designer†
CRO ── sales-lead · solutions-engineer · partnerships-lead
COO ── talent-lead · revops-lead · data-analytics-lead† · customer-success-lead
GC  ── privacy-counsel · commercial-counsel*

composer-business-strategist → RETIRED; scope distributed (see §5)
* = deferred/dormant activity (see §5)   † = dormant until a customer justifies (see §5)
```

**Spans after:** CEO 6, CTO 3, Head of L&P 5, Head of Composer 8 (7 after the molecule/template merge). All healthy. Every one of the 17 orphans is now slotted; the CTO is connected; no IC is manager-less.

### Who owns each contested decision (single DRI, one verb each)

| Contested decision | DRI (owns the number/artifact) | Constrained by | Executed by |
|---|---|---|---|
| **Pricing / packaging** | `product-marketing-lead` designs the tiers & list price (NEW grant — its charter today has *no* pricing scope, `product-marketing-lead.md:7-14`) | CFO owns the floor & unit economics (`cfo-agent.md:12`) | CRO owns discount/deal execution (`cro-agent.md:12`); revops owns quote-to-cash plumbing (`revops-lead.md:10`) |
| **Customer success / onboarding** | `customer-success-lead` owns the *human* onboarding + activation + voice-of-customer motion (`customer-success-lead.md:3`) | — | `composer-ux-designer` owns first-run in-product UX; `composer-devrel` owns technical getting-started/reference |
| **Devrel / public docs** | `composer-devrel` owns technical correctness (solid line, Head of Composer) | — | `content-brand-lead` (CMO) holds editorial/narrative authority over public-facing funnel docs (dotted line) |
| **Per-persona eject** (see §3) | `Head of Language & Platform` runs it as a named working group | — | aql-compiler + aql-runtime + aql-security |
| **Trust package / diligence** | `solutions-engineer` DRI (`solutions-engineer.md:8`) | — | co-authored with privacy-counsel + commercial-counsel |
| **Eng-vs-GTM ties** | CEO decides, CTO present, in the weekly ship review (§7) | — | recorded in the decision log |

> Note on pricing: the talent review said "CFO owns the model, strip pricing from the strategist"; the CRO review said "CRO owns the price model"; the CMO review said "give packaging DESIGN to product-marketing." I adjudicate: **one DRI per verb** — product-marketing *designs* the tiers, CFO *gates* the floor, CRO *executes* the deal. Today five hands touch pricing (CFO economics `cfo:12`, CRO execution `cro:12`, revops operations `revops:3`, strategist packaging `strategist:3`, and product-marketing not at all) and no one *designs* it. This chain fixes that.

---

## 3. Functional gaps — capability missing entirely, ranked, with an owner

1. **A demand-validation / founding-customer gate empowered to STOP supply.** *(Highest.)* The company's own honest-state names demand as the live risk (`cro-agent.md:99-104`, `cfo-agent.md:19-20`), yet there are ~9 code-truth gates (CTO REJECT, CEO KILL, security sign-off `ceo:34`, a11y veto, GC veto, governance gate G2/G5 `ceo:116`) and **zero** gates on whether anyone will pay. → **Owner: CRO**, with a dedicated founding-customer mandate; no new language/interactivity feature ships until one named regulated buyer has reacted to the persona-switch demo.
2. **Product management — one owner turning buyer evidence into a prioritized backlog.** Today owned by committee: CEO ship/kill (`ceo:9`), COO "what ships" (`coo:7`), CTO tech strategy (`cto:7`), composer-tech-lead "core vs composer" (`composer-tech-lead:12`). Nobody translates a buyer into a roadmap — the empty seat that let the team build supply nobody asked for. → **Owner: Head of Product → CEO** (interim: CRO holds the customer's voice, COO holds sequencing).
3. **Interactive + editor-primitive React atoms in core.** The literal blocker to a pure-AQL composer (`cto-agent.md:93-94`): all 19 atoms are presentational (`cto:59`). aql-runtime-engineer owns the interactive-atom *contract* inside `Render` (`aql-runtime-engineer.md:11`) but **no charter owns authoring the React atom components themselves.** → **Owner: new `core-atom-engineer` under Head of Language & Platform.**
4. **Per-persona eject — the "governed page ejects INCOMPLETE" problem.** The CEO and CTO both call it "a first-class product problem" (`ceo-agent.md:108-110`, `cto-agent.md:116-118`): "governed by construction" and "portable by default" do not both hold for one page. No charter owns it. → **Owner: Head of Language & Platform** as a compiler+runtime+security working group, gated like the governance gate.
5. **Corporate security/trust posture (SOC 2 / vendor-security evidence) + the reusable trust package.** The artifact that closes a compliance sale. The *only* certification mention in any charter is a disclaimer — "atomkit... is not a compliance certification" (`privacy-counsel.md:14`). SE answers the questionnaire (`solutions-engineer.md:8`, under CRO) while the legal substance sits under GC — two silos whose charters never reference each other. → **Owner: GC owns cert-readiness; solutions-engineer is DRI of the trust package**, co-authored with privacy + commercial counsel.
6. **A defined operating cadence + a single decision/commitment log.** I (COO) assert I own "the operating cadence" (`coo-agent.md:12`) but **no charter defines a forum, a frequency, or who maintains the log** the CEO cites (`ceo-agent.md`/`ORG.md:75`). This is the mechanism that let motion pass for progress. → **Owner: COO + revops.** *(Process, not a hire.)*
7. **Release engineering / CI across five repos.** CTO satisfaction bar #6 demands "all five repos build, test, CI green" (`cto-agent.md:44`); `atomkit-release` is referenced in every charter as "(CI/CD)" but no charter *owns* it. → **Owner: fold into Head of Language & Platform now; defer a dedicated release engineer.**
8. **Independent platform QA / conformance.** The fail-closed guarantee is tested by its own authors; `composer-test-engineer` is scoped to the composer repo only, so the evaluator, `stripDocument`, and the 21-doc conformance suite have no independent adversary but the security engineer who also *implements* the surface. → **Owner: widen the conformance mandate; defer a dedicated platform-QA hire (interim: security-engineer + rotating red-team).**

---

## 4. Skill gaps + training — what each charter must gain to be great at the actual roadmap

- **`cto-agent`:** add "reports to CEO"; enumerate the two-pod org and its two direct-report leads; expand arbitration from the 3 named engineers (`cto:10-11`) to all 15 via the leads; add an escalation clause (eng-vs-GTM ties resolve at the CEO, CTO present, in the weekly review).
- **`composer-tech-lead` → Head of Composer:** elevate from "tiebreaker" (`composer-tech-lead:13`) to engineering manager with explicit people, prioritization, and demo-cadence authority; **delete the stale ownership of `package.json`/`tsconfig`/`vite`** (`composer-tech-lead:9`) which the mandate in the *same file* forbids (`composer-tech-lead:112`, "no `.js`, no `.ts`, no `.css`, no `package.json`"); re-scope to `app/*.aql`, `atomkit.config.json`, the `npx` build, and the file-ownership map; elevate to opus.
- **New Head of Language & Platform charter** (promote `aql-runtime-engineer`, the natural integrator — "the language designer specifies; the compiler engineer transforms; you make it run," `aql-runtime-engineer.md:7-8`): inherit the CTO's standing ruling that "semantics have exactly one definition — every feature lands in runtime and compiler in the same change, conformance extended, or it does not land" (`cto:18-20`); own the 4 aql ICs + the new core-atom-engineer; own release/CI and the per-persona-eject working group.
- **`sales-lead` + `cro-agent`:** reframe from "pipeline / signed revenue / the first ten customers" (`sales-lead.md:3`) to **pre-revenue discovery** — jobs-to-be-done interviews that actively try to *invalidate* the wedge. There are zero customers to close; the skill is disconfirmation, not closing.
- **`privacy-counsel` + `product-marketing-lead`:** pair with a real regulated-buyer advisor (ex-CISO / health / fintech / gov / HR) so the wedge and ICP are buyer-validated, not internally asserted. privacy-counsel maps the product to law (`privacy-counsel.md:10-15`) but no one on staff has *signed off on a vendor* as the buyer.
- **`solutions-engineer`:** add "the trust package / diligence-answer library" as a *maintained* deliverable, co-authored with both counsels — stop re-answering the same questionnaire per deal.
- **`general-counsel`:** add explicit ownership of SOC 2 / vendor-security-evidence readiness as a named critical-path item for deal #1 (`general-counsel.md:12-13` today stops at "regulatory risk").
- **`product-marketing-lead`:** grant pricing/packaging *design* (tiers, list price, what's-in-each) — the charter has no pricing scope today.
- **`coo-agent` (me):** make "operating cadence" a concrete deliverable — a named weekly ship review with a fixed agenda, plus ownership of the decision/commitment log. It is an aspiration in my charter, not an artifact.
- **`ceo-agent`:** resolve the contradiction *inside* the charter — the standing question "Is that the right fight?... Recommending KILL or PIVOT is a valid, respected outcome" (`ceo:19-22`) versus the OWNER'S RULING "the mandate stands" (`ceo:100-102`). Add a settled-decision clause (see §7).
- **`aql-runtime-engineer`:** name SSR/hydration for a now-stateful runtime as a first-class competency (`aql-runtime-engineer.md:16`), and consider splitting the expression evaluator out given the charter already carries evaluator + actions + if/for + SSR + schema + conformance.

---

## 5. Redundancies to cut, merge, or make dormant — this company has zero revenue

**Verified charter-consistency finding (all five reviews half-saw this; here it is exactly):** the *engineering* charters carry BOTH the "OWNER'S RULING — the mandate stands" and the "WHERE IS THE CODE / ship the composer" blocks; the *commercial* charters carry **neither** (grep: `ceo`/`cto`/`composer-tech-lead` = 1 each; `cro`/`cfo`/`cmo`/`revops`/`product-marketing`/`solutions-engineer`/`sales-lead` = 0 each). So the two halves are briefed to *different settledness of the same decision* — eng is told "build it, it's settled," commercial is told only the CEO's "one conversation beats more code" counsel. That is the pre-mortem's "two camps," grounded. **Fix: propagate ONE reconciled directive to all 37 charters (§7).**

1. **RETIRE `composer-business-strategist`.** Orphan (no reporting line), read-only tools (`strategist.md:4` — no Bash/Edit/Write), predates the CMO/CRO, and duplicates them wholesale: it claims "positioning, ICP, pricing, competitive wedge, and the commercial case" (`strategist:3`) — the union of `product-marketing-lead` (positioning), CRO (ICP/pricing), and CMO (wedge/category). Distribute: positioning → product-marketing, ICP → CRO/sales, pricing → CFO+product-marketing, wedge → CMO. *(All five reviews agree.)*
2. **DORMANT: `growth-demand-lead`.** A full funnel/SEO/channels/conversion engine before a single validated buyer — its own charter concedes "your first job is not scale." Freeze; keep only a fractional "find the ONE channel to the ONE buyer" slice.
3. **DORMANT: `brand-designer`.** A full visual-identity system + marketing site + launch assets before PMF. Scope down to a minimal demo landing page + pitch deck; defer the identity book.
4. **MERGE for now: `revops-lead` + `data-analytics-lead`.** Both own funnel + "the single dashboard" at near-zero usage — under one role's worth of real work today. Keep revops active (instrumentation + single-source-of-truth + pricing ops); park data-analytics dormant until there is usage to analyze. *(Both are mine to call as COO.)*
5. **DEFER active fundraising (`fundraising-lead`).** Raising on an unproven thesis stalls at diligence; keep the data room warm, freeze the raise until the buyer conversation produces a signal.
6. **`commercial-counsel` on-demand** until there is a contract to paper; keep **`privacy-counsel` active** — it produces the DPIA/law-mapping that *is* a sales asset for the wedge (`privacy-counsel:10-15`).
7. **Merge candidate: `composer-molecule-architect` + `composer-template-builder`** — deliberately one mechanism (`composer-template-builder.md`: "reuse the molecule mechanism; do not invent a parallel one"). One composition-and-library owner under tight headcount.
8. **DO NOT MERGE — keep the check:** `composer-ux-designer` (keyboard-parity) vs `composer-a11y-guardian` (veto). This is a healthy designer-proposes / guardian-vetoes control, not a redundancy. Add a RACI so it doesn't *collide*: interaction-engineer builds, a11y-guardian is the sole veto, ux-designer is consulted.

---

## 6. The path to a great team — ordered, concrete

**Do now (org changes, mostly zero hires):**
1. **Wire `CTO → CEO`.** One line in both charters. Repairs the orphan executive and makes the eng-vs-GTM arbiter real. Makes `ORG.md:22` true.
2. **Appoint the two eng leads.** Promote `aql-runtime-engineer` → Head of Language & Platform (player-coach); re-charter `composer-tech-lead` → Head of Composer (EM, opus). Every IC gets a named manager; `aql-security-engineer` stays direct to CTO. Makes `ORG.md:41` true and installs the ship-accountability layer whose absence produced 15-docs/0-code.
3. **Retire `composer-business-strategist`; distribute its scope.** Every remaining orphan is slotted by moves 1–2.
4. **Institute the weekly ship review + one decision/commitment log** (COO + revops). Fixed agenda: top-three this week; the single dependency blocking the most people and its owner; what shipped that a user can touch. Every review ends SHIP / SEQUENCE / STOP, tracked to closure.
5. **Name the DRIs** on pricing, per-persona eject, the trust package, and public docs (§2 table).
6. **Reconcile the briefing.** Propagate one directive to all 37 charters; add the settled-decision clause to the CEO charter (§7). Eng builds the mandate; commercial runs the buyer conversation in parallel — not as a rival thesis.
7. **Make the over-built roles dormant** (growth-demand, brand-designer→landing+deck, data-analytics, fundraising, commercial-counsel on-demand). Redeploy the freed attention to the demo and founder-led buyer sourcing.

**Deferred hires (until a customer justifies):** Head of Product (interim CRO+COO), regulated-buyer advisor (fractional), SOC 2/security-compliance owner (interim GC + security-engineer), dedicated release/CI engineer (interim Head of L&P), independent platform-QA engineer (interim security-engineer + rotation). **The one near-term exception:** `core-atom-engineer` is not really deferrable — it is the literal blocker to the pure-AQL composer (§3.3) — so fund it by redeploying a dormant-role slot, not by waiting.

**Single highest-leverage change:** **Connect and layer engineering — `CTO → CEO`, plus the two named eng leads (moves 1–2).** It is the one move that simultaneously repairs the orphan CTO, all 16 engineering orphans, and the 15-wide flat span, *and* installs the manager who is accountable for whether a demo shipped — the documented root of the near-death "perfect the ground, never build the product." Every other fix (cadence, the demand gate, the DRIs) only binds in engineering once there is a manager to enforce it. The highest-leverage *company* move remains the one buyer conversation — and the new cadence is what forces it onto the calendar.

---

## 7. The rule the CEO must ratify — so the org can decide and ship

> **Single-DRI, default-open decision rights.**
> 1. **Every decision has exactly one accountable DRI.** Two agents never own the same decision. The DRI decides and records it; others advise in writing.
> 2. **Default open.** Work ships unless a *specifically named* gate is red. No gate-holder may block outside their own gate. The named gates are finite and published: CTO technical-correctness, CEO ship/kill, security governance sign-off, a11y keyboard-path, GC legal-exposure, CFO fund, and the governance gate (G2/G5). Nothing else is a stop.
> 3. **One arbitration forum.** Cross-boundary ties (engineering vs go-to-market) resolve at the CEO, with the CTO present, in the weekly ship review — never ad hoc, and escalated to the owner only as a genuine last resort.
> 4. **Settled decisions stay settled.** The pure-AQL mandate is closed (`ceo:100-102`); it is not re-litigated inside delivery. Dissent is recorded in the decision log and revisited on evidence — not re-argued in standups. (This retires the contradiction between `ceo:19-22` and `ceo:100`.)
> 5. **A demand gate with the weight of the governance gate.** No new interactivity/language feature ships until one named regulated buyer has reacted to the persona-switch demo. Code-truth and market-truth are gated with equal rigor.

Ratifying this gives the org what it structurally lacks today: one owner per decision, a bias to ship, a single room where ties break, a closed door on the one decision that must stay closed, and — for the first time — a gate on the risk that actually decides whether the company exists.
