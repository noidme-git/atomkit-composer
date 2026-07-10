# SPEC — Commercial strategy (ruled)

Owner: composer-business-strategist. Ruled by composer-tech-lead. Code claims verified against the live repos on
2026-07-10; market claims are **unverified** (WebSearch snapshots not reproducible in this environment).

## 1. Accepted (the verified half)

- **The governance wedge is orthogonal to the language and is the sellable asset.** Verified: `stripDocument` runs
  at egress before render (`render.ts:31`), independent of any interactivity; the canvas is already real AQL. The
  wedge ships on the 19 presentational atoms. → This directly shapes the build order: **M1 ships the wedge without
  the language.**
- **"The composer is written in the language it composes" is an owner conviction, not a buying signal.** This is a
  structural argument (no competitor is built out of its own output), not a market-data claim, so I weight it. It
  is a dogfooding proof, not revenue.
- **The interactive layer, as designed, is fail-open for governance** (verified S1–S8 in BUILD-ORDER §3). The
  strategist's instinct to not bet the roadmap on the language is corroborated by the code, not just the market.

## 2. Corrections (rulings) — these were used as evidence and are FALSE

- **C13 — the 21-document conformance suite EXISTS and PASSES.** Verified: `grep -c "^  \['" …` → `21`;
  `node --test` → `pass 1 fail 0`. Do NOT argue "thin conformance" or a softer "no lock-in" guarantee on this
  basis. The self-inflicted miss (line-count instead of reading the CORPUS) is exactly the failure "verify by
  execution" exists to prevent.
- **C14 — the composer repo is not "zero source."** Verified: a 328-line spike (`spike/*.mjs`). The "app is
  unbuilt" thesis holds; the inventory is stale.
- **The market case is unverified here.** Plasmic positioning, Framer/Webflow/Retool pricing, and "no HIPAA-
  compliant CMS" are WebSearch snapshots I cannot reproduce. They are directionally reasonable but must not
  override a decision built on verified code. I do not let them.

## 3. The ruling I carry into the build order

- **Ship the wedge as content-governance now (M1)** on presentational atoms — the safe, verified path.
- **Fund M0 (governance-survives-state) regardless** — it is the prerequisite for any interactivity and the highest-
  leverage risk. This is the one place I over-rule "don't fund the language": you must fund the *gate*, because
  without it the wedge itself is unsafe the moment interactivity is added.
- **Treat the full declarative-language expansion as incremental, behind the M0 gate**, not as one big commercial
  bet. If interactivity is pursued for a buyer, build the **governed-form slice** (M3) first and stop there until a
  paying design partner asks for more.
- **The security narrative, corrected:** governance-at-egress is a moat **for presentational content, today**
  (verified fail-closed on the 19 atoms), and **fail-open for the interactivity the pivot introduces** (verified).
  Never assert the moat without that caveat.

## 4. The gaps the strategy correctly names (and the build order honors)

- Governance must become **deny-by-default at the node level** before interactivity ships (K1/M0). Governance-at-
  egress is not "done"; it covers today's presentational fields only.
- The **compiler drops governed nodes** (`index.ts:26-40`) — so a governed interactive node cannot be statically
  ejected; "eject to React you own" has a fail-closed hole for exactly the regulated case. Mapped in M5.
- **`serialize()` cannot round-trip interactive documents** yet (K5/K12) — the "pure AQL composer" mandate cannot
  save its own interactive output until those land. Sequenced, not skipped.

## 5. Open, owner-facing

- Is there a named regulated design partner? The paid-pilot case rests on one. (Unverified — needs a warm intro.)
- Is there appetite for SOC 2 / BAA? If not, the regulated-buyer wedge is unreachable regardless of masking quality,
  and the ICP should change — where the wedge is worth less. This is the owner's call, not the tech lead's.
