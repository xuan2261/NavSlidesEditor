---
title: "Debug Verification Baseline"
status: verified
created: 2026-08-10
tags: [debug, evidence, security, export, pptx]
---

# Debug Verification Baseline

## Context

Fresh adversarial re-review of the whole-project findings. Claims were challenged
against source, existing tests, and isolated runtime probes. This report is the
evidence boundary for the remediation plan, not an implementation result.

## Verified Results

| Claim | Verdict | Corrected severity | Runtime/source evidence |
|---|---|---:|---|
| Viewer escalates to remote/speaker and receives notes | Confirmed | High | Existing socket test accepts tokenless controller and broadcasts notes. |
| Default Docker/Electron/server exposure | Confirmed, conditional | High when reachable | Listener omits host; Docker publishes all interfaces; ingress is not auth. |
| Active uploaded SVG | Partial | Medium | Isolated real upload + Chromium navigation returned `image/svg+xml`; `onload` changed the document title. Passive `<img>` remained outside this claim. |
| Portable HTML/GitHub export | Confirmed | High | Generated HTML contained ten root-relative framework references. |
| CRC before limits | Confirmed | Medium | A 4.6 KiB archive containing 4 MiB data invoked five inflation workers before a 1 KiB budget rejection. |
| Mid-drain cancellation ghost row | Confirmed | Low | Isolated coordinator probe ended `{row:true, head:false, status:"cancelled"}`. |
| Zero-applied drain false success | Confirmed | Low | Isolated coordinator probe ended `{row:false, head:true, status:"done"}`. |
| Crash-persistent import media | Confirmed | Low | File and `pptx-import` hash entry survived isolated storage restart without transaction commit. |
| Generic game START/SPIN blocker | Partial | Low | Button has no handler, but current production Present uses shared static HTML rather than this React branch. |
| All oversized source files are violations | Rejected | Informational | Project standards treat legacy hotspots as candidates, not automatic release failures. |

## Fresh Verification

- Focused nine-file regression run: 170 tests passed.
- Earlier focused review run: 78 tests passed.
- Audit suite: 36 tests passed.
- ESLint: zero errors and 28 warnings.
- Passing tests do not disprove the defects. Several encode current unsafe
  behavior or omit the relevant ordering/race/navigation assertion.

## Scope Decision

- Remediate all confirmed and partial actionable findings.
- Exclude line-count-only refactoring.
- Keep trusted author HTML/CSS/JS policy.
- User selected: this remediation blocks the active package-first PPTX plan.

## Unresolved Questions

None.
