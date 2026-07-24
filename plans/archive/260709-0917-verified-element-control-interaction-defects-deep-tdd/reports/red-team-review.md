# Red-Team Review — Verified Element Control Interaction Defects

**Date:** 2026-07-09  
**Result:** conditional-pass (amendments folded into plan)

## Hostile attacks

### 1. Cut lock policy wrong for PowerPoint parity
**Attack:** Some apps allow cut of locked objects.  
**Response:** Prior locked decision (dup/delete skip locked) is project law. Cut must match. Document as product rule.

### 2. performCut only fixed in pure op
**Attack:** Hook still deletes raw selection.  
**Response:** Phase 1 **requires** performCut use pure `idsToDelete` + survivor selection. BLOCKER if only pure filter.

### 3. Table preserve breaks import cleanup
**Attack:** Wipe was intentional for corrupt import merges.  
**Response:** preserve-valid drops OOB merges — stricter safety than wipe-all for append; still drops invalid. Amendment: Phase 2 MVP = last row/col only.

### 4. Find/replace table match index wrong
**Attack:** Multiple matches in one cell break single replace.  
**Response:** Phase 3 requires per-occurrence segments; recompute matches after replace (existing bar pattern).

### 5. Notice spam / false positives
**Attack:** Type-gated empty style update fires “blocked”.  
**Response:** Phase 4 only when `hasBlockedGroupMutation` true, not empty type-gate.

### 6. Scope creep into UI a11y plan
**Attack:** Concurrent `260709-0913` touches canvas-wrapper.  
**Response:** Phase 5 only defaults + properties; Phase 4 notice self-contained. Cross-plan note in plan.md.

### 7. Overstated findings reintroduced
**Attack:** Plan re-fixes multi-nudge or games.  
**Response:** Explicit out-of-scope section; red-team fails plan if re-added.

## BLOCKERS resolved in plan text
- performCut dual-layer fix (pure + wire)
- table test rewrite called out
- type-gate vs group-block notice distinction

## Residual risks accepted
- No E2E for cut/lock (unit sufficient; prior marquee E2E flake)
- No global toast library

**Verdict:** conditional-pass — cook allowed after validation.
