---
type: report
date: 2026-06-17
topic: elements-controls-teaching-interactivity
status: proposed
---

# Elements Controls Teaching Interactivity Brainstorm

## Summary

Recommended direction: **Option A — Conservative**.

NavSlides already has 19 canonical element types, plugin runtime, HTML embed, game/live stack, and strict element-control audit governance. Adding many new element types would create avoidable renderer, properties, export, PPTX fallback, and test-matrix burden. Best path: add teaching value through presets, plugins, control improvements, and limited game subtypes. Add a canonical element only when state/editing semantics justify it.

## Requirements Captured

| Item | Decision |
|---|---|
| Expected output | Full feature/control proposal matrix |
| Scope | Elements, controls, Insert/Ribbon/Properties UX |
| Priority | Teaching and technical interactivity |
| Preferred approach | Conservative/YAGNI |
| First implementation scope | Agent-proposed P0 + P1 core |

## Codebase Context

| Area | Finding |
|---|---|
| Stack | npm workspace monorepo: React/Vite client, Express server, shared render/export utilities |
| Canonical element source | `client/src/data/element-defaults.js` |
| Current canonical types | text, image, shape, code, latex, html, markdown, chart, video, audio, table, icon, callout, qrcode, drawing, line, svg, timeline, game |
| Insert UX | Ribbon insert panel already exposes basic/content/media/embed/advanced groups, shapes, games, plugins |
| Controls | Properties modules exist for chart, code, game, image, media, misc, shape, table, timeline, common controls |
| Governance | Current element-control audit matrix: 133 rows, 109 works, 11 partial, 13 export-gap, 0 broken |
| Export constraints | HTML/reveal is strong for interactivity; PPTX has accepted fallback/placeholder limits for DOM/live elements |

## Evaluated Approaches

| Approach | Pros | Cons | Verdict |
|---|---|---|---|
| Option A — Conservative | Highest value/risk ratio; minimal schema churn; reuses game/html/plugin/code/latex/chart stack | Some features less natively editable | **Recommended** |
| Option B — Feature-heavy | Strongest visible feature list | High maintenance; audit/export explosion; higher regression risk | Reject for now |
| Option C — Marketplace first | Fastest content value; low schema changes | Less interactive authoring depth | Good supporting track, not primary |

## Full Feature Control Matrix

| # | Candidate | Best form | Teaching fit | Effort | Risk | Export/PPTX impact | Priority | Recommendation |
|---:|---|---|---:|---:|---:|---|---|---|
| 1 | Mermaid diagrams: flowchart, sequence, ER, state, class | New element only if Markdown/HTML control insufficient | Very high | M | M | HTML good; PPTX raster/placeholder | P0 | Do |
| 2 | PhET embed presets | Insert preset/plugin | Very high | S-M | M | HTML interactive; PPTX placeholder | P0 | Do |
| 3 | GeoGebra/Desmos embed presets | Insert preset/plugin | Very high | S-M | M | HTML interactive; PPTX placeholder | P0 | Do |
| 4 | CircuitJS/Falstad presets | Insert preset/plugin | Very high | M | M-H | HTML interactive; PPTX placeholder | P0 | Do, but do not build native engine |
| 5 | Live poll | Game subtype/control enhancement | Very high | M | M-H | Live-only; PPTX static summary/placeholder | P0 | Do |
| 6 | Word cloud | Game subtype | High | M | M | Live-only; PPTX static cloud/placeholder | P1 | Do |
| 7 | Drag/drop labeling and matching | Game subtype | High | M-H | M | Live-only; PPTX answer/placeholder | P1 | Do |
| 8 | Code line focus, step highlight, diff mode | Code controls | Very high | M | L-M | HTML good; PPTX static code acceptable | P1 | Do |
| 9 | LaTeX templates, symbols, snippets, error UX | LaTeX modal/control UX | Very high | S-M | L | Existing LaTeX fallback | P1 | Do |
| 10 | Technical symbol packs: UML, network, circuit, cloud | Shape/SVG presets | High | S-M | L | Existing shape/SVG paths | P1 | Do |
| 11 | Table-to-chart binding | Table/chart control enhancement | High | M-H | M | Existing chart/table behavior; sync edge cases | P2 | Defer until P0/P1 stable |
| 12 | Flowchart connector snapping | Line/control enhancement | High | H | H | PPTX possible if kept simple | P2 | Defer; design carefully |
| 13 | Timeline variants | Timeline presets/controls | Medium | S | L | Existing timeline behavior | P2 | Defer |
| 14 | Interactive whiteboard improvements | Drawing/annotation controls | Medium | M | M | PPTX raster/static | P2 | Defer unless live teaching becomes focus |
| 15 | Branching lesson navigation | Presentation/template controls | Medium | M | M | Reveal links OK; PPTX weak | P2 | Defer |
| 16 | Live captions/subtitles | Live feature | High | H | H | Live-only | P3 | Later; dependency-heavy |
| 17 | Presenter webcam/cameo tile | Live/presenter feature | Medium | M-H | H | PPTX not meaningful | P3 | Later/skip |
| 18 | Mind map | Mermaid/preset | Medium | S-M | L | SVG/raster OK | P2 | Do not create separate element |
| 19 | Native circuit editor | New element | High | Very H | Very H | Export hard | Skip | Use embed/preset |
| 20 | Spreadsheet element | New element | Medium | H | H | Export/sync hard | Skip | Enhance table/chart instead |
| 21 | 3D model editor | Plugin only | Medium | H | H | PPTX weak, perf risk | Skip/P3 | Avoid core |
| 22 | AI activity generator | AI workflow | Medium | H | H | Hard to verify | Skip now | Avoid AI slop |
| 23 | Native virtual lab platform | Platform feature | High | Very H | Very H | HTML-only | Skip | Too broad |

## Recommended First Scope

### P0 — First build slice

| Feature | Recommended shape | Acceptance idea |
|---|---|---|
| Mermaid diagrams | Start as Markdown/HTML-powered diagram authoring; promote to canonical element only if needed | User can insert/edit Mermaid text, preview diagram, export HTML, get explicit PPTX fallback warning |
| STEM simulation presets | Insert presets/plugin templates for PhET, GeoGebra, Desmos, CircuitJS/Falstad | User can paste/select supported embed preset, preview in slide, export HTML with active embed, PPTX placeholder warning |
| Live poll | New game subtype using existing game/live stack | Presenter can create poll, viewers submit, results display live, export does not leak private responses |

### P1 — Follow-up core

| Feature | Recommended shape | Acceptance idea |
|---|---|---|
| Word cloud | Game subtype | Viewers submit words, presenter sees moderated aggregate |
| Drag/drop matching | Game subtype | Author defines prompts/targets/answers; live/player UI validates responses |
| Code walkthrough | Code controls | Author can highlight line ranges and step through focus states |
| LaTeX UX | Modal/control enhancement | Symbol palette, equation snippets, parse/error feedback |
| Technical symbol packs | Shape/SVG presets | Insert panel exposes curated UML/network/circuit/cloud symbol packs |

## Risks

| Risk | Mitigation |
|---|---|
| Element bloat | Default to presets/plugins/controls; require justification for canonical element |
| PPTX fidelity debt | Every live/HTML feature gets explicit fallback warning and matrix row |
| External embed availability | Clearly mark online-only presets; do not promise offline unless assets are bundled |
| Game/live complexity | Add one subtype at a time; reuse room/socket lifecycle; avoid private data in exports |
| UI crowding | Place advanced teaching features under Advanced/Plugins, not primary Basic toolbar |
| Test matrix growth | Add matrix row + unit + export fallback tests per feature before broad rollout |

## Success Metrics

| Metric | Target |
|---|---|
| Audit matrix status | 0 broken rows after each feature |
| Export clarity | All unsupported PPTX paths emit structured warnings |
| Teaching coverage | At least one P0 technical diagram, simulation, and live participation workflow supported |
| UX discoverability | New features reachable from Insert/Advanced with labels, no hidden-only command |
| Regression safety | Unit tests for authoring/render/export; one e2e smoke per feature family |

## Next Steps

1. Convert this brainstorm into a phase plan.
2. Start with P0 scope only: Mermaid, STEM simulation presets, live poll.
3. Define export fallback contracts before implementation.
4. Add audit matrix rows as part of each phase.

## Unresolved Questions

- Whether Mermaid should be a canonical element or initially a Markdown/HTML authoring mode.
- Which STEM providers are mandatory for first release: PhET, GeoGebra, Desmos, CircuitJS/Falstad.
- Whether live poll should support anonymous mode, named players, or both in v1.
