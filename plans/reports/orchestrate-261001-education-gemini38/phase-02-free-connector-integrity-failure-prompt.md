# Mandatory failed verification: complete free connector comparison after target movement

READ ONLY Kongming, local52186/gpt-6.1-sol independent context (not family-independent), Gemini temporarily excluded. Full16 cook --auto --advice --tdd. No edits, commands/tests/browser/eval/delegation/model switch. Worktree C:/Work/worktrees/NavSlidesEditor-education-gemini38-cook-261001. Parent stops edits/re-diagnosis now.

97 affected tests/9files and6 responsive cases PASS. Prior line-wrapper and target-center failures were harness selection admission; counsel authorized the product keyboard Selection Pane. Real stroke and pane selection succeeded. Real Free endpoint saved connections:{}, reload showed empty Start target. Current actual fixture editor/052933e9-855e-447a-a37d-1f7de06a134e, slide6 integrity-shapes.

Last invocation selected target through pane successfully, then ordinary X position edit580→800 and Enter. Persisted API condition x===800 completed. Full connector comparison then FAILED. Cause open; do not assume geometry mutation vs property-order/incidental-representation difference. Comparison used JSON.stringify, not structural deep equality. Actual post-move object was local to failed tab.run and NOT returned; not yet inspected after failure.

Exact invocation:
```js
await phase02IntegrityTab.click('role/button[name="Selection Pane"]');
await phase02IntegrityTab.press('Space',{selector:'role/listitem[name="target, Shape"]'});
display(await phase02IntegrityTab.run(async ({page})=>page.evaluate(()=>({selected:[...document.querySelectorAll('[data-selected="true"][data-testid^="slide-element-"]')].map(n=>n.dataset.testid)}))));
await phase02IntegrityTab.click('role/button[name="Selection Pane"]');
display({targetBefore:await phase02IntegrityTab.value('role/spinbutton[name="X position"]')});
await phase02IntegrityTab.fill('role/spinbutton[name="X position"]','800');
await phase02IntegrityTab.press('Enter',{selector:'role/spinbutton[name="X position"]'});
display(await phase02IntegrityTab.run(async ({page}, free) => {
await page.waitForFunction(async () => {const d=await(await fetch('/api/presentations/052933e9-855e-447a-a37d-1f7de06a134e')).json();return d.slides[5].elements.find(e=>e.id==='target').x===800},{timeout:15000});
const observed=await page.evaluate(async()=>{const d=await(await fetch('/api/presentations/052933e9-855e-447a-a37d-1f7de06a134e')).json();return {target:d.slides[5].elements.find(e=>e.id==='target'),connector:d.slides[5].elements.find(e=>e.id==='connector')}});
if(JSON.stringify(observed.connector)!==JSON.stringify(free)) throw Error('Free connector changed with former target');
return observed
},{args:[phase02FreeConnector]}))
```
Verbatim output:
```text
Error: Free connector changed with former target
    at <anonymous> (browser-run-1595c468c8b8eff1.js:4:336)
    at processTicksAndRejections (native:7:39)

display[1]:
{
  "selected": [
    "slide-element-target"
  ]
}

display[2]:
{
  "targetBefore": "580"
}

Command exited with code 1
```

Last displayed saved free connector baseline (host variable re-fetched after reload, not displayed separately):
```json
{"id":"connector","type":"line","x":600,"y":250,"width":180,"height":1,"name":"connector","stroke":"#111111","strokeWidth":2,"x1":70,"y1":-105,"x2":180,"y2":0,"connections":{}}
```
Fixture target originally x580,y100,width180,height90, type shape. Empty attachment patch is now explicit{} in ShapeProperties.connectionPatch. Unit detachment regression uses uncomplicated nonnegative/default local points, not this actual resolved negative local y1 case.

Ask: GO/no-go for bounded diagnostic comparing actual saved post-move object against retained baseline structurally, then cause-aligned fix if consumer-visible fields drift. Inspect the real line geometry/mutation/serialization chain as needed. Distinguish key-order/empty-vs-absent contract normalization from endpoint/geometry/style mutation; do not weaken complete structural equality or rerun the failed invocation to confirm it. If a product defect is source-supported, name exact boundary and regression using observed geometry, not a fixture reshaping or special-case workaround. No suppression, no unrelated source edit. Remaining two-attachment, mixed-source, current generated Present/Share/offline zero/citation, independent review/docs gates remain open.
