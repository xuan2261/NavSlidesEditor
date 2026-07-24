# Red-team & validation — 2026-07-09

## Round 0 (inline at scaffold) — SUPERSEDED

Cosmetic only. Scope critic correctly rejected under-ranking effort as “Low”.

## Round 1 (formal `/ck:plan red-team`) — AUTHORITATIVE

4 lenses: Security Adversary, Assumption Destroyer, Failure Mode Analyst, Scope Complexity Critic.

Reports under `reports/from-code-reviewer-to-planner-red-team-*-plan-review-report.md`.

**Result:** conditional-pass-after-amendments-applied (see `plan.md` ## Red Team Review table RT-01…RT-17).

Key applied fixes: atomic server import→create; no client path; converter sandbox; CI LO required; effort months; Phase 08 split; MVP cut line; oracle ≠ marketing PP.

## Validation

**Status: passed-with-amendments (2026-07-09 user interview).**

| Decision | Detail |
|----------|--------|
| Native product | No Collabora/OnlyOffice runtime |
| No LO runtime | App never shells to LO for user import |
| Oracle measure | Committed golden PNGs + SSIM (optional LO to regenerate goldens) |
| Retention | original.pptx lifetime = presentation |
| Claim language | present-vs-golden SSIM + editable metrics |

Phase 02 amended (V-01).
