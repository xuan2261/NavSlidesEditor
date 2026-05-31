# Export And HTML Embed Reliability Port Report

Date: 2026-05-14

## Summary

Phase 03 completed with one targeted port:

- Ported px-based text flow spacing from upstream commit `53173592` into shared reveal and print HTML CSS.
- Confirmed HTML embed present path remains an isolated `srcdoc` iframe.
- Confirmed PDF/print path remains `data-pdf-iframe` with runtime Blob initialization.
- No data URL/blob URL change was applied to present HTML embeds because local tests and architecture already preserve the intended trusted iframe behavior.

## Changed Files

- `shared/src/htmlGenerator.js`
- `shared/tests/htmlGenerator.test.js`
- `shared/tests/element-renderers.test.js`

## Decisions

| Upstream commit | Decision | Reason |
| --- | --- | --- |
| `cde1b2e9` | `already-aligned` | Local present HTML embeds already use isolated iframe and preserve trusted scripts. |
| `347d6ad8` | `already-aligned` | Local print/PDF path uses separate `data-pdf-iframe`; no present-mode blob dependency needed. |
| `53173592` | `port` | Baseline tests proved main reveal/print text spacing still used `em`; patched to px values. |
| `edfc1ba5` | `defer/adapt` | Non-TikZ LaTeX present path can be revisited in Phase 04; no Phase 03 blocker. |

## Verification

Passed:

```powershell
npm run test -- shared/tests/element-renderers.test.js shared/tests/htmlGenerator.test.js
npm run test -- client/src/utils/offlineExport.test.js server/routes/pptx-export.test.js
npm run lint
npm run build
```

Tester subagent result: `DONE`.

Code-reviewer result: `DONE`, no blocking or non-blocking findings.

## Residual Risk

- Manual browser/PDF smoke was not run in this phase.
- Markdown iframe internal styling still uses its own isolated spacing rules and was intentionally left out of this main reveal/print text spacing patch.

## Unresolved Questions

None.
