Act as kit kongming. First read C:/Users/Z10PAD8C_Xuan2261/.omp/agent/agents/kongming.md. Advisory only: no edits/tests/build/lint/format/browser execution. Use read/glob/grep only. Exact model local52186/gpt-6.1-sol; separate-context same-model counsel, no model-family independence. User resumed full cook --auto --advice --tdd, temporarily excludes Gemini 3.8, no commit/push/deploy.

# Phase04 failed browser verification
Actual UI Present/Preview/Share and downloaded network-blocked file gameplay have passed manually. A permanent consumer-visible regression file tests tuple isolation, leave/resume, old-generation reset, native keys and UI portable download. Its first runner attempt failed at config loading; no test ran.

Command:
npx playwright test --config .tmp/phase04.playwright.config.cjs --project=chromium --workers=1 --reporter=line --retries=0
cwd: C:/Work/worktrees/NavSlidesEditor-education-gemini38-cook-261001

Verbatim output:
Error: Cannot find module './tests/e2e/global-setup.js'
Require stack:
- C:\Work\worktrees\NavSlidesEditor-education-gemini38-cook-261001\node_modules\playwright\lib\common\index.js
- C:\Work\worktrees\NavSlidesEditor-education-gemini38-cook-261001\node_modules\playwright\lib\program.js
- C:\Work\worktrees\NavSlidesEditor-education-gemini38-cook-261001\node_modules\@playwright\test\cli.js
    at Function._resolveFilename (node:internal/modules/cjs/loader:1383:15)
    at Function.resolve (node:internal/modules/helpers:157:19)
    at resolveScript (C:\Work\worktrees\NavSlidesEditor-education-gemini38-cook-261001\node_modules\playwright\lib\common\index.js:697:18)
    at C:\Work\worktrees\NavSlidesEditor-education-gemini38-cook-261001\node_modules\playwright\lib\common\index.js:497:128
    at Array.map (<anonymous>)
    at new FullConfigInternal (C:\Work\worktrees\NavSlidesEditor-education-gemini38-cook-261001\node_modules\playwright\lib\common\index.js:497:117)
    at loadConfig (C:\Work\worktrees\NavSlidesEditor-education-gemini38-cook-261001\node_modules\playwright\lib\common\index.js:1277:22)
    at processTicksAndRejections (node:internal/process/task_queues:105:5)
    at Object.loadConfigFromFile (C:\Work\worktrees\NavSlidesEditor-education-gemini38-cook-261001\node_modules\playwright\lib\common\index.js:1490:10)
    at runTests (C:\Work\worktrees\NavSlidesEditor-education-gemini38-cook-261001\node_modules\playwright\lib\cli\testActions.js:46:18)
    at _Command.<anonymous> (C:\Work\worktrees\NavSlidesEditor-education-gemini38-cook-261001\node_modules\playwright\lib\program.js:55:7) {
  code: 'MODULE_NOT_FOUND',
  requireStack: [
    'C:\\Work\\worktrees\\NavSlidesEditor-education-gemini38-cook-261001\\node_modules\\playwright\\lib\\common\\index.js',
    'C:\\Work\\worktrees\\NavSlidesEditor-education-gemini38-cook-261001\\node_modules\\playwright\\lib\\program.js',
    'C:\\Work\\worktrees\\NavSlidesEditor-education-gemini38-cook-261001\\node_modules\\@playwright\\test\\cli.js'
  ]
}
Wall time: 4.23 seconds
Command exited with code 1

# Changed harness
.tmp/phase04.playwright.config.cjs imports ../playwright.config.js, spreads base, sets absolute testDir and outputDir, selects standalone-runtime-lifecycle.spec.js, clears webServer to reuse coordinator-owned isolated dev servers (client55173/API34102). It did NOT resolve inherited relative globalSetup './tests/e2e/global-setup.js'. Production root config stays unchanged. No retry/edit/re-diagnosis performed after failure.

Read only .tmp/phase04.playwright.config.cjs, playwright.config.js and tests/e2e/global-setup.js if needed. Return precise GO for minimal throwaway config repair if supported, otherwise diagnostic steps. Do not weaken/disable global setup or permanent test assertions to rescue the runner. No Phase04 acceptance until the actual regression tests and all other required receipts pass.
