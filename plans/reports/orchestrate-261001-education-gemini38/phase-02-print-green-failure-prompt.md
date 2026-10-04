# Mandatory failed GREEN — print source loses newline boundaries
Read-only counsel; no edits/checks/browser rerun/delegation/model switching. local52186/gpt-6.1-sol, Gemini excluded. Worktree C:/Work/worktrees/NavSlidesEditor-education-gemini38-cook-261001. Cook --auto --advice --tdd Phase02.

Read prior two counsel reports under C:/Work/NavSlidesEditor/plans/reports/orchestrate-261001-education-gemini38/phase-02-code-present-failure-counsel.md and phase-02-walkthrough-green-failure-counsel.md. Parent applied walkthrough `class=nohighlight` (removed explicit language) retaining data-noescape and line spans. Ordinary raw escaped source normal highlighting. Image descriptions inline visually hidden both canvas/generated.

Exact GREEN test: Playwright generated-code-image.spec.js via .playwright/phase02-manual.config.cjs, API34102/Vite55173, project chromium workers1 retries0. Verbatim relevant output:
```
Running 1 test using 1 worker
Error: expect(received).toBe(expected) // Object.is equality
- Expected - 5
+ Received + 1
-
-   const label = "<strong>literal</strong>";
-
-   console.log(label);
-
+    const label = "<strong>literal</strong>";   console.log(label); 
at inspectCode generated-code-image.spec.js:19:48
at generated-code-image.spec.js:88:11
1 failed
```
Line88 is AFTER real File menu > Export PDF popup, not Present. Before this failure actual Present passed all ordinary exact source whitespace/HTML literal/tokens, walkthrough correct active range/styles, accessible description hidden, cropped citation visible below image. Print exact textContent loses newlines. Actual-browser failing run captured artifact://246 in parent and test trace. Parent stopped edits/re-diagnosis.

Inspect exact generatePrintHTML and sanitization/render options/print highlighting path. Find transform introducing lost literal newline, likely generation not API because print uses client exportPDF blob and browser optimized shared. Must distinguish stale optimized shared renderer in Vite (shared module edits API loaded via restarts, Vite dependency may still old) from whitespace cleanup generator defect. Prior stale optimizeDeps seen in this phase. Return smallest cause-directed repair and exact verification scope, not phase approval. No broad nohighlight, do not weaken exact source behavior. If stale client dependency enough force rebuild only owned Vite without changing repo.