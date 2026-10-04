Act as kit kongming. First read C:/Users/Z10PAD8C_Xuan2261/.omp/agent/agents/kongming.md. Advisory only: read/glob/grep; no edits/tests/build/lint/format/browser execution. Explicit local52186/gpt-6.1-sol, same-model separate-context, no model-family independence. Cook --auto --advice --tdd; Gemini 3.8 temporarily excluded; no commit/push/deploy.

# Phase04 additional reduced-motion smoke failed
Existing native gameplay/keys/portable tests passed. A single instrumented retained-tab touch diagnostic subsequently passed all required 320/768 values, trusted tap, picks===1 and targetability without product changes. The original detached-element failure was not reproduced; no production defect was established. Real Electron renderer enforcement now passed both eval/new Function probes with CSP enforced violations; CSP was unchanged.

A further wheel/confetti reduced-motion check failed at a compound computed-style assertion. No operands were logged; do not infer which failed. No production repair/retry/diagnosis since failure.

Exact code:
await page.click('[data-ns-element-id="local"] [data-ns-command="reset"]');
await page.select('[data-ns-element-id="local"] select','wheel');
await page.tap('[data-ns-element-id="local"] [data-ns-command="pick"]');
const during = await page.evaluate(() => ({animation:getComputedStyle(document.querySelector('[data-ns-element-id="local"] svg')).animationName,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches}));
await page.waitForFunction(() => NavSlidesEducation.mount(document.querySelector('[data-ns-element-id="local"]')).getState().picks===1);
const after = await page.evaluate(() => ({confetti:getComputedStyle(document.querySelector('[data-ns-element-id="local"] .ns-picker-confetti')).display,picks:NavSlidesEducation.mount(document.querySelector('[data-ns-element-id="local"]')).getState().picks}));
await page.focus('[data-ns-element-id="local"] select');
await page.keyboard.press('ArrowDown');
const keyboard = await page.evaluate(() => ({mode:NavSlidesEducation.mount(document.querySelector('[data-ns-element-id="local"]')).getState().mode,indices:Reveal.getIndices()}));
assert(during.reduced && during.animation==='none' && after.confetti==='none' && after.picks===1, 'Reduced motion disables wheel/confetti visuals without losing the result');
assert(keyboard.mode==='dice' && keyboard.indices.h===0 && keyboard.indices.v===0, 'Native select arrows stay inside widget');

Verbatim output:
ToolError: Reduced motion disables wheel/confetti visuals without losing the result
    at assert (C:\Users\Z10PAD8C_Xuan2261\.bun\install\global\node_modules\@oh-my-pi\pi-coding-agent\dist\cli.js:14782:15034)
    at <anonymous> (browser-run-159661dafe78f4ef.js:12:9)
Command exited with code 1

# Read scope
Worktree C:/Work/worktrees/NavSlidesEditor-education-gemini38-cook-261001. Inspect shared/src/education/browser/runtime.css, browser/games/name-picker.js and picker-visuals.js; existing requirements phase-04-standalone-runtime.md (reduced-motion). These manual assertions are not permanent tests.

# Question
Is an exact animationName==='none'/confetti display==='none' assertion supported by the actual product contract or an incidental-style assumption? Recommend a concrete reduced-motion behavioral observation that preserves genuine acceptance, distinguishing computed animation duration/visual stillness and result progress. No weakening real acceptance or claiming a product fix without evidence. Phase04 acceptance remains NO-GO until the stated reduced-motion checks and final review qualify.
