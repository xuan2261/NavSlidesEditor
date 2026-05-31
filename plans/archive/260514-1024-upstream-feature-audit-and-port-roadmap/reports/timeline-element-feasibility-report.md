# Timeline Element Feasibility Report

Date: 2026-05-14

## Summary

Decision: `defer to separate P2 feature plan`.

Upstream timeline is a real slide element, not equivalent to local `AnimationTimeline.jsx`. It includes date ranges, tick spacing, BCE/negative years, images, descriptions, click-to-expand details, connector offsets, and export HTML.

Do not cherry-pick this series into the current sync branch.

## Upstream Series

| Commit | Finding |
| --- | --- |
| `9d3288ea` | Adds timeline element across properties, canvas, export, server. |
| `78b62e53` | Adds tick spacing and long-range year labels. |
| `a6f42a8b` | Aligns date selects with tick spacing. |
| `778a7646` | Supports negative/BCE years. |
| `fe5deaae` | Adds click-to-expand event details. |
| `2ba20cd3` | Fixes React hook/component extraction issue. |
| `3471ab66` | Adds per-event connector offsets. |
| `56067fde` | Adjusts top-side image/text layout. |
| `2e280692` | Further top-item layout ordering changes. |

## Local Fit

Existing local timeline-like feature is a slide template plus fragment `AnimationTimeline`, not an element renderer. A proper local port would need:

- `timeline` element type in `shared/src/types/presentation.js`
- defaults in `client/src/data/element-defaults.js`
- insert support in `client/src/components/InsertMenu.jsx` and `EditorPage.jsx`
- `client/src/components/canvas/element-renderers/timeline-element-renderer.jsx`
- `client/src/components/properties/timeline-properties.jsx`
- shared renderer in `shared/src/element-renderers.js`
- tests for renderer, properties, export, and import persistence

## Proposed Schema If Accepted Later

```js
{
  type: 'timeline',
  startDate: '2020-01-01' | '-500',
  endDate: '2026-01-01' | '2000',
  tickSpacing: 'auto' | 'month' | 'year' | '10year' | '100year' | '1000year',
  lineColor: '#6366f1',
  dotColor: '#6366f1',
  textColor: '#ffffff',
  fontSize: 11,
  items: [{
    id: '...',
    date: '2024-01-01',
    label: 'Milestone',
    description: '',
    detailedDescription: '',
    image: '',
    side: 'top' | 'bottom',
    connectorOffset: 0
  }]
}
```

## Estimate

- Implementation: 10-14h.
- Tests: 4-6h.
- Review/security/accessibility pass: 2-3h.
- Total: 16-23h.

## Recommendation

Defer. If user approves, create a dedicated P2 plan and implement from local architecture, not from upstream file patches.

## Verification

Planning gate only:

```powershell
git diff --stat
```

## Unresolved Questions

- User go/no-go: timeline as a first-class element or keep current template-based workflow.
