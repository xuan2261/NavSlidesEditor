# Mandatory failed browser-smoke counsel: line wrapper click

Full accepted 16-phase cook --auto --advice --tdd. Gemini is temporarily excluded by the user; use the existing explicit local52186/gpt-6.1-sol independent context. READ ONLY: read/glob/grep only. No source/config edits, shell, tests, browser, eval, nested delegation, model switch. Counsel is advisory, not family-independent review.

Worktree: C:/Work/worktrees/NavSlidesEditor-education-gemini38-cook-261001.
Parent pauses edits/re-diagnosis after this first failed actual smoke invocation.

## Current completed evidence
- New consumer regression file client/src/components/properties/selection-authoring-consumer-integrity.test.jsx: initial expected RED 10 failures / 2 passes. Confirmed final-attachment discard, plain-primary mirror-only rich-label hazard, mixed lock/source gaps, numeric-zero loss.
- Bounded fixes applied to ShapeProperties (empty connection object, disabled plain-label write when a rich label is selected), CommonElementControls / FormatTabContent (mixed lock), MediaProperties / FormatTabContent (owner-aware mixed source, canonical legacy video resolution), shared generated citation pointer behavior and table nullish cell conversion.
- Final affected checks: 9 files / 97 tests PASS. Existing GameProperties accessibility test emits act warnings; not a source-error failure.
- Final narrow-controls Playwright: all 6 cases PASS, one worker, zero retries, isolated API 34102/api and editor 55173, 320/768/1365px. Real touch/keyboard shape-kind and Format left/center/right; canvas-focused Ctrl+Z/Ctrl+Y; complete snapshots, numeric X=0 delta, mixed opacity, fourth element unchanged, reload. Preserve documented ribbon-focus shortcut stand-down.
- Actual browser-managed editor fixture 052933e9-855e-447a-a37d-1f7de06a134e has cloned original all19 slides plus shape/lock/media consumer slides (6/7/8). Original all19 fixture remains unchanged. Table cell [1][1] is numeric 0; image citationLink is http://127.0.0.1:55173/api/health. No share has been created in this new fixture.
- Browser tab name phase02-final-integrity, 1365x900. Two-shape rich/plain selection shows native plain label disabled, rich output strong text remains Rich retained. Actual checkbox indeterminate=true checked=false aria-checked=mixed; ribbon aria-pressed=mixed. Screenshot visually inspected: coherent styled editor, both controls visibly mixed.
- Native checkbox click persisted both locks true; ribbon Enter then persisted both locks false via bounded real API condition. No history/persistence failure observed on these paths.

## Failure: exact attempted invocation
JavaScript Eval (host-retained browser API), title: Proving final connector detachment survives a former-target move; timeout 60:

```js
await phase02IntegrityTab.click('role/button[name="Select slide 6"]');
await phase02IntegrityTab.click('testid/slide-element-connector');
await phase02IntegrityTab.select('role/combobox[name="Start connector target"]','');
display(await phase02IntegrityTab.run(async ({page}) => {
  await page.waitForFunction(async () => {
    const d=await(await fetch('/api/presentations/052933e9-855e-447a-a37d-1f7de06a134e')).json();
    const e=d.slides[5].elements.find(e=>e.id==='connector');
    return e.connections&&Object.keys(e.connections).length===0
  },{timeout:15000});
  return await page.evaluate(async()=>{
    const d=await(await fetch('/api/presentations/052933e9-855e-447a-a37d-1f7de06a134e')).json();
    return d.slides[5].elements.find(e=>e.id==='connector')
  })
}));
var phase02FreeConnector = await phase02IntegrityTab.run(async({page})=>page.evaluate(async()=>{
  const d=await(await fetch('/api/presentations/052933e9-855e-447a-a37d-1f7de06a134e')).json();
  return d.slides[5].elements.find(e=>e.id==='connector')
}));
await phase02IntegrityTab.click('testid/slide-element-target');
await phase02IntegrityTab.fill('role/spinbutton[name="X position"]','800');
await phase02IntegrityTab.press('Enter',{selector:'role/spinbutton[name="X position"]'});
display(await phase02IntegrityTab.run(async ({page}, free) => {
  await page.waitForFunction(async () => {
    const d=await(await fetch('/api/presentations/052933e9-855e-447a-a37d-1f7de06a134e')).json();
    return d.slides[5].elements.find(e=>e.id==='target').x===800
  },{timeout:15000});
  const observed=await page.evaluate(async()=>{
    const d=await(await fetch('/api/presentations/052933e9-855e-447a-a37d-1f7de06a134e')).json();
    return d.slides[5].elements.find(e=>e.id==='connector')
  });
  if(JSON.stringify(observed)!==JSON.stringify(free)) throw Error('Free connector changed with former target');
  return {targetX:800,freeConnectorUnchanged:observed}
},{args:[phase02FreeConnector]}))
```

Verbatim output:
```text
ToolError: tab.click("testid/slide-element-connector") timed out after 8000ms
    at #j (C:\Users\Z10PAD8C_Xuan2261\.bun\install\global\node_modules\@oh-my-pi\pi-coding-agent\dist\cli.js:14721:18100)
    at processTicksAndRejections (native:7:39)

Command exited with code 1
```
First Select slide 6 completed. Line-wrapper click failed. Detach, move, and subsequent assertions NEVER ran. No connector endpoint/move proof is claimed. No forced click, retry, timeout widening, synthetic selection/state mutation, or source edit afterward.

Fixture line (API authored, not yet re-inspected after failure):
```js
{id:'connector',name:'connector',type:'line',x:600,y:250,width:180,height:1,
 stroke:'#111111',strokeWidth:2,x1:0,y1:0,x2:180,y2:0,
 connections:{start:{targetId:'target',anchor:'center'}}}
```
Target: shape id/name target, x580 y100 width180 height90. Shape slide also contains plain and rich shapes. Actual line DOM/hit geometry has NOT been inspected; cause is open.

## Request
Give go/no-go for bounded next diagnostic/action. Determine from relevant source whether clicking the thin line element wrapper is the supported selection contract, or whether selection requires stroke hit testing / the existing keyboard Selection Pane. Identify exact files/sections to inspect. Distinguish harness admission/selection from a product defect; do not claim the line selectable or attachment fix runtime-correct without actual evidence.

Keep acceptance unchanged: real selection -> Free endpoint -> saved/reloaded empty attachment -> moving former target does not change connector; other attachment stays when only one freed. No forced click, callbacks-only substitute, source state injection, or unrelated selection rewrite. Also still pending: actual mixed-source apply, regenerated Present/Share/normal UI offline download with zero cell and clickable citation, current-source independent review and phase reconciliation. Phase02 remains incomplete.
