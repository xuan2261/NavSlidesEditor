---
title: "Validation Report - Editor Ribbon Layout Hardening Plan"
status: complete
created: 2026-05-17
---

# Validation Report - Editor Ribbon Layout Hardening Plan

## Validation Questions

| Question | Answer |
| --- | --- |
| Is root cause known? | Yes. Misused `Button variant="icon"` with visible labels causes clipping. |
| Is there enough evidence? | Yes. `agent-browser` metrics + screenshots in `docs/ui-review/`. |
| Are tests possible before implementation? | Yes. Playwright can measure clipping/overflow and component tests can lock class contracts. |
| Is scope bounded? | Yes. Editor ribbon/header only. No canvas export, backend, plugin, or full UI overhaul. |
| Is plan ordered correctly? | Yes. Baseline tests -> root cause -> sizing -> compaction -> header -> final verification. |

## Acceptance Criteria

- Button tests prove `icon` and `ribbon` variants are distinct.
- E2E layout tests pass at 1280/1024/900/768.
- Existing insertion and text formatting tests pass.
- Build passes.
- Browser final report documents before/after.

## Risks Accepted

- Some horizontal tablist scroll may remain at narrow widths.
- Some low-frequency Insert commands move behind group menus.
- Plan does not solve full mobile editor UX.

## Out Of Scope

- Multi-row ribbon.
- Mobile-first editor redesign.
- Properties panel redesign.
- Slide canvas interaction changes.
- Backend/API changes.

## Recommendation

Ready for `/ck:cook` after user approval.
