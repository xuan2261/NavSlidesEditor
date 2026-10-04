# Mandatory failed GREEN counsel — walkthrough after code repair
Read-only, no edits/checks/browser reruns/delegation/model switch; local52186/gpt-6.1-sol, Gemini excluded. Worktree C:/Work/worktrees/NavSlidesEditor-education-gemini38-cook-261001. Cook --auto --advice --tdd Phase02. Read previous counsel C:/Work/NavSlidesEditor/plans/reports/orchestrate-261001-education-gemini38/phase-02-code-present-failure-counsel.md.

Parent applied proposed split to shared/src/element-renderers.js renderCode: ordinary escaped raw source, no data-trim; walkthrough renderCodeLines, existing language-javascript nohighlight class and added data-noescape. Shared/canvas image description given absolute1px clipping style; removed obsolete source-text tests, added actual product Present+ExportPDF regression tests/e2e/education/generated-code-image.spec.js.

Expected RED proved exact raw source replaced by literal renderer span tags. GREEN after API restart command: Playwright via node CLI `test --config=.playwright/phase02-manual.config.cjs tests/e2e/education/generated-code-image.spec.js --project=chromium --workers=1 --retries=0`, env API34102/Vite55173. Exact output retained artifact://233 in parent; relevant verbatim:
```
Running 1 test using 1 worker
Error: expect(locator).toHaveText(expected) failed
Locator: locator('[data-code-line]')
Timeout: 5000ms
- Array [
- "const a = 1;",
- "const b = 2;",
- "return a + b;",
- ]
+ Array []
14 × locator resolved to 0 elements
at inspectCode generated-code-image.spec.js:23:23
at generated-code-image.spec.js:80:5
1 failed
```
Ordinary exact source whitespace/HTML literal + .hljs-keyword const + no strong passed before failing walkthrough line nodes. Test stops before description/print. Parent stopped edits/re-diagnosis immediately. Please inspect exact served server/vendor/reveal.js/dist/plugin/highlight.js and distinguish whether nohighlight recognized/ignored, line children removed by plugin, init semantics/config. Propose smallest cause-directed repair retaining syntax-highlighting ordinary + walkthrough own styles with escaped authored text, no global disable/no dropping walkthrough/no duplicate runtime. Note prior recommendation did not protect line nodes; need evidence not replay failed test. Return bounded repair counsel, not phase approval.