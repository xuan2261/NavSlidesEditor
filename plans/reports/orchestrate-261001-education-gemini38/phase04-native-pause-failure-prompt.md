Act as kit kongming. First read C:/Users/Z10PAD8C_Xuan2261/.omp/agent/agents/kongming.md. Advisory only; no edits, tests, browser execution, build, lint or formatter. Tools read/glob/grep only. Exact model local52186/gpt-6.1-sol; separate-context same-model counsel, no family independence. User resumed cook --auto --advice --tdd, temporarily excludes Gemini, no commit/push/deploy. This is Phase04's objective failed actual-browser checkpoint; coordinator stopped edits/diagnosis pending counsel.

Workspace C:/Work/worktrees/NavSlidesEditor-education-gemini38-cook-261001. Read known files shared/src/education/browser/reveal-lifecycle.js, mount.js, shared/src/education/runtime-session.js, shared/src/education/browser/games/name-picker.js, shared/src/education/game-defaults.js, shared/src/education/game-config-schemas.js, shared/src/htmlGenerator.js and phase04 plan as needed. Do not scout unrelated code.

Actual browser URL http://127.0.0.1:55173/api/presentations/3ea3ae6d-1cb7-40e5-bf87-2b43c3d88540/present, real Reveal/vendor assets, API port34102. Fixture: resolution960x540, parent and child use layout lesson, fixed inherited name-picker, parent also local name-picker id local. second parent also inherits, last hides inherited via layoutOverrides. Config supplied animationDuration:700, weighted:true, items a/b/c with weights1/3/2. Native runtime expected four roots. User criteria: leaving active leaf pauses pending local selection, returning preserves progress.

Exact browser sequence in tab.run:
state = [...document.querySelectorAll('[data-ns-game]')].map(root=>({slide:root.closest('[data-ns-effective-slide-id]').dataset.nsEffectiveSlideId,element:root.dataset.nsElementId,state:NavSlidesEducation.mount(root).getState()}));
initial asserted roots.length===4 (PASS).
await page.click('[data-ns-element-id="local"] [data-ns-command="pick"]');
await page.evaluate(()=>Reveal.slide(0,1));
await new Promise(resolve=>setTimeout(resolve,900));
paused=state(); assert(paused[0].state.phase==='picking' && paused[0].state.picks===0, 'Leaving must pause pending selection');
Output verbatim: ToolError: Leaving must pause pending selection at assert ... Command exited with code 1.
No later assertions ran. Do not assume actual paused state: browser failure did not print it. Existing native/session JSDOM tests exercise isolated state and timers; they alone cannot prove browser lifecycle.

Question: Source-derived most plausible causes and smallest safe diagnostic/repair; identify any fixture/runtime normalization mismatch before classifying pause as broken. Check active-leaf lifecycle, allowed animation duration, static asset publication, mount idempotency. Do not guess actual state or declare acceptance. Return GO for concrete repair or diagnostic steps, NO-GO for phase acceptance, necessary before/after real-browser proof.
