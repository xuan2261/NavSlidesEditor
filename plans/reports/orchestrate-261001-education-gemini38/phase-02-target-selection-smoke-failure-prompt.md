# Mandatory failed actual smoke checkpoint: target center occluded by a line

Read-only Kongming counsel. Full16 cook --auto --advice --tdd, Gemini temporarily excluded, same-model independent context local52186/gpt-6.1-sol; no edits/commands/tests/browser/eval/delegation/model switching.
Worktree C:/Work/worktrees/NavSlidesEditor-education-gemini38-cook-261001. Parent pauses source edits/re-diagnosis.

Prior mandatory line-selection counsel completed (199.17s): use real stroke hits / real keyboard Selection Pane, not arbitrary wrapper centers. Its requested actual DOM probe established wrapper center receiver SVG, actual stroke midpoint receiver hit path, effective connected stroke outside authored 1px-high wrapper. No pointer defect was demonstrated.

Subsequent real actions PASSED: ordinary click on transparent hit path selected connector, Start target=target. Selection Pane row connector, Line + Space also selected real canvas wrapper. Free endpoint control saved connections:{} with x1:70,y1:-105,x2:180,y2:0. Reload + reselect path showed Start target empty. These are observed proof; no force/synthetic events/state injection.

New exact failed invocation (Eval):
```js
await phase02IntegrityTab.click('role/button[name="Select slide 6"]');
await phase02IntegrityTab.click('[data-testid="slide-element-connector"] [data-line-hit-target="true"]');
display({freeAfterReload:await phase02IntegrityTab.value('role/combobox[name="Start connector target"]')});
var phase02FreeConnector = await phase02IntegrityTab.run(async({page})=>page.evaluate(async()=>{
const d=await(await fetch('/api/presentations/052933e9-855e-447a-a37d-1f7de06a134e')).json();return d.slides[5].elements.find(e=>e.id==='connector')}));
await phase02IntegrityTab.click('testid/slide-element-target');
// Remaining X=800 commit and full connector equality assertions never ran.
```
Verbatim output:
```text
ToolError: tab.click("testid/slide-element-target") blocked: covered by <path>
    at bZa (C:\Users\Z10PAD8C_Xuan2261\.bun\install\global\node_modules\@oh-my-pi\pi-coding-agent\dist\cli.js:14720:21190)
    at processTicksAndRejections (native:7:39)

display[1]:
{
  "freeAfterReload": ""
}

Command exited with code 1
```
Current tab phase02-final-integrity at editor/052933e9-855e-447a-a37d-1f7de06a134e, active slide6 integrity-shapes. Saved target still x580,y100,w180,h90. Free connector raw wrapper x600,y250,w180,h1; free path starts at slide target center (670,145) from previously resolved x1/y1. Geometry/source inference suggests its existing line hit path covers the target wrapper center; only actual tool covered-by-path output is runtime evidence for this new click. No further inspection/retry/edit after failure.

Request minimal go/no-go: retain normal keyboard Selection Pane to choose the former target (target, Shape row) and resume unchanged X=800 persisted full-connector-equality proof, rather than forced click, fixture reshaping, layering/hit-test source changes. Cite necessary source only; existing pane is a previously verified actual editor selection path. Identify any product-contract risk requiring a different action. No phase completion claim. Two-attachment retention, mixed-source apply, current generated Present/Share/offline zero/citation proof, review/docs remain pending. Final current focused checks:97 tests/9files and6 responsive browser cases PASS.
