---
type: report
title: "Element Control Audit Matrix Phase Mapping"
date: 2026-06-17
plan: "260617-0739-element-control-audit-matrix-tdd"
sourceReport: "../260609-0830-element-control-functional-fixes-tdd/reports/260617-element-control-audit-matrix-current-state-report.md"
status: planning-complete
---

# Element Control Audit Matrix Phase Mapping

## Summary

Plan created to turn current source audit into a test-backed matrix for every meaningful element-control pair.

Status vocabulary locked:

| Status | Meaning |
|---|---|
| `works` | UI/state/render path is wired and export is acceptable or not relevant. |
| `partial` | Main path works, but secondary behavior, authoring UI, legacy ambiguity, or test depth is incomplete. |
| `broken` | Control exists but is likely no-op, wrong, or inconsistent in current source. |
| `export-gap` | Editor/canvas works, but HTML/PPTX export is missing, degraded, fallback-only, or format-limited. |

## Source Findings Used

| Finding | Current Status | Plan Phase |
|---|---|---|
| Old opacity HTML/canvas gap is fixed, but PPTX native parity uneven | `partial` / `export-gap` by type | Phase 02, Phase 07 |
| Old markdown color/font size gap is fixed | `works`, needs tests | Phase 04 |
| Image filters/flip/crop/citation paths exist | mixed `works` / `export-gap` | Phase 03, Phase 07 |
| Image border render/export exists, authoring unclear | `partial` | Phase 03 |
| Chart area fill/stacked exist, chart type options mismatch remains | `partial` | Phase 04 |
| Table merged cells render/export exists, authoring unclear | `partial` | Phase 05 |
| SVG content and fill/stroke override exist | `works`, PPTX `export-gap` | Phase 05, Phase 07 |
| Timeline connector control exists | `works`, PPTX `export-gap` | Phase 05, Phase 07 |
| `videoUrl || src` legacy precedence may override user Source edits | `partial` | Phase 03 |
| Audio flags may differ between properties, canvas, and export | `partial` | Phase 03 |
| Game live behavior is broader than element-control matrix | `partial` / `export-gap` | Phase 06 |

## Phase Coverage

| Phase | Purpose | Primary Test Type |
|---|---|---|
| 01 | Matrix source of truth and validator harness | Unit/static validator |
| 02 | Shared geometry, selection, lock, hide, group, z-order, guides | Playwright + helper unit tests |
| 03 | Image, video, audio controls and media export policy | Unit/RTL + Playwright + export unit |
| 04 | Text, code, markdown, HTML, LaTeX, chart controls | RTL + shared renderer + Playwright |
| 05 | Shape, line, table, icon, callout, QR, drawing, SVG, timeline | RTL + renderer/export unit |
| 06 | Game element controls and live-only policy | Unit/RTL + shared/PPTX fallback tests |
| 07 | HTML/PPTX export fidelity and accepted limits | Export unit + browser PPTX audit |
| 08 | Docs, matrix gate, final verification | Static docs + full targeted gates |

## TDD Gates

Minimum per-phase gate:

```bash
npm run test -- <targeted-unit-or-rtl-tests>
```

Browser behavior gate:

```bash
npx playwright test <targeted-spec>
```

Final gate:

```bash
npm run lint
npm run test
npm run matrix:gate
npm run test:pptx:browser-audit
```

Release-grade optional gate:

```bash
npm run test:pptx:strict
```

## Recommendations

- Start with Phase 01. Do not fix controls until matrix schema and validator can fail on missing evidence.
- Treat `export-gap` as acceptable only when docs and tests prove fallback/warning behavior.
- Prefer documenting import-only/read-only capabilities over adding broad UI when scope is ambiguous.
- Keep game live/socket protocol outside this matrix unless a separate game protocol audit is opened.

## Unresolved Questions

- Should `videoUrl` be fully removed after migration, or retained as legacy read fallback only?
- Should table merge/unmerge authoring be added now, or documented as imported/read-only fidelity?
- Should image border authoring be exposed now, or left as render/export-only fidelity?
- Should fallback-only PPTX element types be accepted if warnings and docs are explicit?
