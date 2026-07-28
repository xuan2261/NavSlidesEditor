# PPTX Import Release Readiness — 2026-07-28 / Run 1756

> **Decision: BEST-EFFORT SOFTWARE LANE PASS WITH EXPLICIT RESIDUALS.** Fresh final-source focused, full-unit, lint, build, and critical-browser gates pass. Optional qualification lanes remain blocked or separately owned. This aggregate closeout record is not a release authorization.

## Claim ceiling

The product remains a self-hosted, parser-backed, best-effort PPTX importer. This record does not claim native PowerPoint fidelity, OfficeCLI validation, pixel-perfect output, multi-tenant security, crash-safe media consistency, or enabled physical-retention compaction.

## Evidence snapshot

| Gate | Status | Evidence | Claim effect |
| --- | --- | --- | --- |
| Best-effort core | **PASS WITH RESIDUALS** | Fresh final-source focused, full-unit, lint, build, and critical-browser gates pass; optional evidence lanes remain separately blocked/open/skipped | Supports the bounded best-effort software lane only |
| Focused client lifecycle | Pass | Post-final-assertion focused wait: 1 file / 26 tests; combined client lifecycle: 3 files / 69 tests; review approved | Supports the bounded client lifecycle contract only |
| Mapped consumers | Pass | 26 passed | Supports reader-consumer isolation scope |
| Server authority | Pass | 98 passed | Supports current job/visibility/repair boundary |
| Focused reliability | Pass | 163 passed | Supports delivered reliability safeguards |
| Full unit | Pass | 518 test files passed, 1 skipped; 4196 tests passed, 3 skipped; exit 0; duration 1227.75s; command excludes the documented unrelated baseline characterization file | Confirms the current repository unit gate; does not promote optional evidence lanes |
| Build | Pass | Production build completed from the final source state | Build health only |
| Lint | Pass with existing warnings | 0 errors, 27 existing warnings | Warnings are not relabelled as clean output |
| Adversarial | Pass | 10 of 10 cases | Guard/security lane only |
| Corpus metrics | Pass, parser-relative | 11 of 11 decks; semantic 100%; reconstructed round-trip stability 63% | Best-effort regression evidence only |
| Strict/native | **BLOCKED** | Intentionally non-zero for six decks | Not a best-effort pass; no native claim |
| Browser heuristic | Partial | Critical PPTX browser journey passed 1/1 in 38.7s; no full browser-heuristic or visual qualification | Supports the bounded browser smoke journey only |
| Performance | **SKIPPED** | Full lane did not run because the required explicit opt-in was absent | No performance qualification |
| Oracle integrity | **BLOCKED** | Evidence-manifest and visual-comparison prerequisites unavailable | No oracle claim |
| Package-first G0-G4 | Owner-plan open | This plan has handoff status only | No package-first promotion |
| G5 PowerPoint evidence | **BLOCKED** | No owner-bound candidate evidence | No PowerPoint or 1:1 claim |
| Exact-original recovery | Not requalified here | Existing application contract unchanged | Separate from fidelity and release qualification |
| Media consistency | Best-effort only | No durable media manifest/replay evidence | Crash-safe media claim excluded |
| Retention | Dry-run/default-off | No destructive policy or physical compaction enabled | No storage-compaction claim |

## Reconciled lifecycle contract

- Admission to the shared import slot has its own bounded clock; a response-body timeout after acceptance remains an unconfirmed outcome.
- A separate terminal-wait clock begins only after admission succeeds.
- The terminal wait reserves a bounded final status read.
- SSE-to-poll/final recovery uses a wait-owned child transport signal. Queued progress is fenced after handoff, while terminal SSE outcomes remain deliverable; settlement aborts recovery before public completion.
- Automatic timeout recovery reads status only. It does not reconcile, cancel, delete, or fabricate a successful outcome.
- A user-facing unknown outcome requires checking existing presentations before retrying.
- Explicit dashboard Cancel and visible retry countdown controls remain residual work; server-side cancellation states are not promoted to completed dashboard UX.

## Explicit residuals

- Dedicated editor-report navigation/reload coverage and multipart race/stall coverage remain deferred.
- Durable typed-failure persistence across restart/TTL and Windows reparse-point proof remain unqualified.
- Durable media manifest/replay and destructive retention remain outside the current best-effort lane.

These residuals do not authorize a native, visual, performance, package-first, G5, crash-safe-media, or destructive-retention claim.

## Scope changes since the prior matrix

| Change | Reason | Impact |
| --- | --- | --- |
| Replaced one-clock wording with separate admission and terminal-wait clocks | Current behavior starts terminal waiting after admission, preventing queueing from consuming admitted-job time | Safety contract retained; no timeout expansion claim |
| Recorded late-progress guard | Final-status completion after timeout cannot update settled progress | Focused client evidence strengthened |
| Added queued-SSE callback ownership guards | Queued progress is fenced after fallback/final recovery begins; terminal SSE outcomes remain deliverable and settlement aborts the wait-owned recovery transport | Focused client review approved; 69 focused tests pass |
| Preserved admission ambiguity | A response-body deadline can occur after the server has accepted the job, so the dashboard no longer says the import definitely did not start | Users are directed to check existing presentations before retrying |
| Routed non-timeout poll failures through final status | One failed status transport no longer bypasses the reserved bounded durable read | Persistent transport uncertainty becomes the typed unknown outcome |
| Recorded fresh full-unit result | Final-source run passed with 518 files passed, 1 skipped and 4196 tests passed, 3 skipped in 1227.75s | Best-effort software gate is decidable; optional lanes remain independent |
| Aligned unknown-outcome copy | Automatic timeout recovery is read-only and the runtime message now says the outcome is unconfirmed without claiming cancellation | Lifecycle copy matches the documented recovery policy |
| Kept strict/native, browser, performance, oracle, package-first, and G5 independent | Their evidence types and owners differ | No cross-lane promotion |

## Risks and unblock paths

| Risk | Status | Owner | Unblock definition |
| --- | --- | --- | --- |
| Final broad release-gate evidence pending | Closed | Release validation owner | Preserve the exact final unit, lint, build, and critical-browser outcomes in the readiness record |
| Readiness decision promoted before broad gates complete | Closed | Closeout owner | PASS WITH RESIDUALS is supported only by the completed bounded best-effort gates; optional lanes remain separate |
| Unknown-outcome copy conflicts with timeout policy | Closed | Main implementation owner | Keep the focused copy regression and GET-only recovery contract in the client wait suite |
| Strict/native qualification blocked | Open | Strict qualification owner | Provide a successful qualified run or retain blocked status |
| Browser heuristic incomplete | Open | Browser qualification owner | Run and retain full heuristic evidence; do not infer visual fidelity |
| Performance unqualified | Open | Performance owner | Run with approved opt-in and retain measured or structured resource outcome |
| Oracle/G5 evidence unavailable | Open | Package-first/oracle owner | Supply trusted owner-bound evidence and complete independent owner review |
| Media crash consistency unproven | Open | Product policy owner | Approve and validate a durable manifest/replay design, or retain best-effort wording |
| Retention destructive policy unapproved | Open | Operations policy owner | Approve policy, complete dry-run and isolated restore evidence, then consider enablement |

## Next actions

| Owner | Action | Definition of done |
| --- | --- | --- |
| Release validation owner | Preserve final-source broad verification | Exact unit counts/duration, lint warnings, build result, and critical-browser result remain attached to the readiness decision |
| Closeout owner | Keep optional lanes separate | Strict/native, full browser heuristic, performance, package-first, oracle, and G5 rows remain independently blocked/open/skipped |
| Main implementation owner | Track the explicit residuals without widening the claim ceiling | Deferred UX, multipart, durable-restart, media, and retention work remains named rather than silently promoted |
| Browser/performance/oracle owners | Keep their lanes independent | Each lane has a current result or explicit blocker; no result changes best-effort status without its own gate |
| Operations policy owner | Preserve dry-run retention and best-effort media wording | No destructive retention or media cleanup policy is enabled without separately approved restore/replay evidence |

## Publication boundary

This report intentionally contains only aggregate outcomes and declared claim boundaries. It contains no identifiers, secrets, request credentials, raw logs, raw imported content, code references, or local paths.

## Unresolved questions

1. Which job-control authorization method is the approved deployment policy?
2. Should missing-head repair remain read-only classification plus scheduled repair, or gain a separately authorized writer action?
3. Is durable media manifest/replay required for the intended recovery promise, or should media remain explicitly best-effort?
4. What retention age/count/byte policy and authority-tombstone lifetime are acceptable before any destructive compaction?
5. Must imported external media remain always blocked, or is a fully pinned administrator origin policy required?
6. Does the sibling local G5 authority remain in force, or will an owner-approved external trust model supersede it?
