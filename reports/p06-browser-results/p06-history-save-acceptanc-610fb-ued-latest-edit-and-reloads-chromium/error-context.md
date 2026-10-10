# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: p06-history-save-acceptance.spec.js >> P06-11 actual connection failure retries the queued latest edit and reloads
- Location: tests\e2e\p06-history-save-acceptance.spec.js:44:5

# Error details

```
Error: route.abort: Route is already handled!
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e5]:
    - generic [ref=e6]:
      - button "Back" [ref=e7] [cursor=pointer]
      - textbox "Untitled Presentation" [active] [ref=e10]: Retry latest B
      - toolbar "Quick actions" [ref=e11]:
        - button "Saving..." [disabled] [ref=e12] [cursor=pointer]
        - button "Undo" [ref=e16] [cursor=pointer]
        - button "Redo" [disabled]
      - generic [ref=e21]:
        - button "File menu" [ref=e23] [cursor=pointer]:
          - generic [ref=e27]: File
        - tablist "Ribbon tabs" [ref=e29]:
          - tab "Home" [selected] [ref=e30] [cursor=pointer]
          - tab "Insert" [ref=e35] [cursor=pointer]
          - tab "Design" [ref=e38] [cursor=pointer]
          - tab "Transitions" [ref=e46] [cursor=pointer]
          - tab "Animations" [ref=e56] [cursor=pointer]
          - tab "View" [ref=e61] [cursor=pointer]
        - generic [ref=e66]:
          - button "AI" [ref=e68] [cursor=pointer]
          - button "Share" [ref=e74] [cursor=pointer]
          - button "Present" [ref=e83] [cursor=pointer]
    - generic [ref=e87]:
      - tabpanel "Home" [ref=e90]:
        - generic [ref=e91]:
          - generic [ref=e92]:
            - generic [ref=e94]:
              - button "Paste" [disabled]
              - button "Cut" [disabled]
              - button "Copy" [disabled]
              - button "Duplicate" [disabled]
            - generic [ref=e95]: Clipboard
          - generic [ref=e96]:
            - generic [ref=e97]: Double-click a text box to edit
            - generic [ref=e99]: Text
          - generic [ref=e100]:
            - generic [ref=e102]:
              - button "Toggle grid" [ref=e103] [cursor=pointer]
              - spinbutton "Grid size" [ref=e106]: "40"
              - button "Toggle smart guides" [pressed] [ref=e107] [cursor=pointer]
              - button "Toggle rulers" [ref=e112] [cursor=pointer]
              - button "Zoom in" [ref=e120] [cursor=pointer]
              - button "Zoom out" [ref=e124] [cursor=pointer]
              - button "Fit to window" [ref=e128] [cursor=pointer]
            - generic [ref=e134]: Canvas
          - generic [ref=e135]:
            - generic [ref=e137]:
              - button "Group elements" [disabled]
              - button "Ungroup elements" [disabled]
              - button "Bring forward" [disabled]
              - button "Send backward" [disabled]
              - button "Bring to front" [disabled]
              - button "Send to back" [disabled]
            - generic [ref=e140]: Arrange
      - generic [ref=e141]:
        - generic "Slide navigator" [ref=e142]:
          - generic [ref=e143]:
            - generic [ref=e144]:
              - generic [ref=e145]: Slides
              - generic [aria-hidden] [ref=e146]: "1"
            - navigation "Slides" [ref=e147]:
              - list [ref=e148]:
                - listitem [ref=e149]:
                  - button "Select slide 1" [pressed] [ref=e150] [cursor=pointer]:
                    - generic [ref=e151]: "1"
                  - generic [ref=e152]:
                    - button "Duplicate slide 1" [ref=e153] [cursor=pointer]
                    - button "Cannot delete last slide" [disabled] [ref=e157] [cursor=pointer]
            - generic [ref=e161]:
              - button "Add Slide" [ref=e162] [cursor=pointer]
              - button "Insert Template" [ref=e164] [cursor=pointer]
        - generic "Slide canvas" [ref=e172]
        - generic "Inspector" [ref=e173]:
          - group "Inspector view" [ref=e174]:
            - button "Properties" [pressed] [ref=e175] [cursor=pointer]
            - button "Design Ideas" [ref=e176] [cursor=pointer]
          - complementary "Properties panel" [ref=e177]:
            - button [ref=e180] [cursor=pointer]:
              - heading "Selection Pane" [level=3] [ref=e181]
            - generic [ref=e184]:
              - button [expanded] [ref=e185] [cursor=pointer]:
                - heading "Presentation Settings" [level=3] [ref=e186]
              - generic [ref=e189]:
                - generic [ref=e190]:
                  - generic [ref=e191]:
                    - text: Auto-slide (s)
                    - spinbutton "Auto-slide (s)" [ref=e192]: "0"
                  - generic [ref=e194] [cursor=pointer]:
                    - checkbox "Enable loop (auto-slide)" [ref=e195]
                    - generic [ref=e196]: Enable loop (auto-slide)
                - generic [ref=e197]:
                  - text: Navigation Mode
                  - combobox "Navigation Mode" [ref=e198] [cursor=pointer]:
                    - option "Default (2D)" [selected]
                    - option "Linear (Flat)"
            - generic [ref=e199]:
              - button [expanded] [ref=e200] [cursor=pointer]:
                - heading "Slide Footer" [level=3] [ref=e201]
              - textbox "Slide footer section name" [ref=e206]:
                - /placeholder: Section name (footer)
            - generic [ref=e208]:
              - button [expanded] [ref=e209] [cursor=pointer]:
                - heading "Speaker Notes" [level=3] [ref=e210]
              - textbox "Speaker notes" [ref=e214]:
                - /placeholder: Add speaker notes here...
  - contentinfo [ref=e215]:
    - generic "Slide 1 / 1" [ref=e216]
    - generic [ref=e217]:
      - generic "NavSlides Editor" [ref=e218]
      - generic "Designed by Xuan Bui Thanh - Department of Fundamental Engineering - Vietnam Naval Academy" [ref=e219]
    - generic [ref=e220]:
      - generic [ref=e221]:
        - button "Normal view" [pressed] [ref=e222] [cursor=pointer]
        - button "Slide Sorter" [ref=e228] [cursor=pointer]
        - button "Present" [ref=e234] [cursor=pointer]
      - generic [ref=e237]:
        - button "Zoom out" [ref=e238] [cursor=pointer]: −
        - slider "Zoom level" [ref=e239] [cursor=pointer]: "85"
        - button "Zoom in" [ref=e240] [cursor=pointer]: +
        - button "Fit to window" [ref=e241] [cursor=pointer]: Fit
        - generic [ref=e242]: 85%
      - generic "Version" [ref=e243]: v1.17.0
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test'
  2   | import { randomUUID } from 'node:crypto'
  3   | import { apiGetPresentation, apiUpdatePresentation } from './fixtures/test-fixtures.js'
  4   | import { historyJourney, titleInput, quick, holdNextSave, saved, slide } from './helpers/p06-history-acceptance.js'
  5   | import { createHistoryPackage } from './helpers/p06-history-package.js'
  6   | 
  7   | test('P06-09/10 queued save persists and a pending route save cannot replace its destination', async ({ page, browser, request }, info) => {
  8   |   test.setTimeout(120000)
  9   |   await historyJourney({ page, browser, request }, info, ['P06-09', 'P06-10'], async ({ create, receipt }) => {
  10  |     const id = await create('Route original', { slides: [slide([])] })
  11  |     const other = await create('Route destination', { slides: [slide([])] })
  12  |     await page.goto(`/editor/${id}`)
  13  |     await expect(titleInput(page)).toHaveValue('Route original')
  14  |     const held = await holdNextSave(page, id)
  15  |     await titleInput(page).fill('Route pending A')
  16  |     const body = await held.entered
  17  |     expect(body.title).toBe('Route pending A')
  18  |     await titleInput(page).fill('Route queued B')
  19  |     await expect(quick(page).getByRole('button', { name: 'Saving...', exact: true })).toBeVisible()
  20  |     held.release()
  21  |     await saved(request, id, (deck) => deck.title, 'Route queued B')
  22  |     const routeSave = await holdNextSave(page, id)
  23  |     await titleInput(page).fill('Route in-flight C')
  24  |     expect((await routeSave.entered).title).toBe('Route in-flight C')
  25  |     // SPA navigation occurs while a real PUT is suspended, not after a fabricated response.
  26  |     await page.evaluate((destination) => {
  27  |       history.pushState({}, '', `/editor/${destination}`)
  28  |       window.dispatchEvent(new PopStateEvent('popstate'))
  29  |     }, other)
  30  |     await expect(titleInput(page)).toHaveValue('Route destination')
  31  |     routeSave.release()
  32  |     await saved(request, id, (deck) => deck.title, 'Route in-flight C')
  33  |     await expect(titleInput(page)).toHaveValue('Route destination')
  34  |     expect((await apiGetPresentation(request, other)).title).toBe('Route destination')
  35  |     await page.goto(`/editor/${id}`)
  36  |     await expect(titleInput(page)).toHaveValue('Route in-flight C')
  37  |     await expect(quick(page).getByRole('button', { name: 'Undo', exact: true })).toBeDisabled()
  38  |     await page.reload()
  39  |     await expect(titleInput(page)).toHaveValue('Route in-flight C')
  40  |     receipt.runs.push({ scenarioIds: ['P06-09', 'P06-10'], status: 'pending-identity', heldBody: body.title, successorPersisted: 'Route queued B', routePendingPersistedAndReloaded: 'Route in-flight C', destinationUnchanged: true })
  41  |   })
  42  | })
  43  | 
  44  | test('P06-11 actual connection failure retries the queued latest edit and reloads', async ({ page, browser, request }, info) => {
  45  |   test.setTimeout(120000)
  46  |   await historyJourney({ page, browser, request }, info, ['P06-11'], async ({ create, receipt }) => {
  47  |     const id = await create('Retry original', { slides: [slide([])] })
  48  |     await page.goto(`/editor/${id}`)
  49  |     await expect(titleInput(page)).toHaveValue('Retry original')
  50  |     let arrive, release
  51  |     const entered = new Promise((resolve) => { arrive = resolve })
  52  |     const released = new Promise((resolve) => { release = resolve })
  53  |     await page.route(`**/api/presentations/${id}`, async (route) => {
  54  |       if (route.request().method() !== 'PUT') return route.continue()
  55  |       await page.unroute(`**/api/presentations/${id}`)
  56  |       arrive(route.request().postDataJSON())
  57  |       await released
> 58  |       await route.abort('connectionfailed')
      |                   ^ Error: route.abort: Route is already handled!
  59  |     })
  60  |     await titleInput(page).fill('Retry A')
  61  |     expect((await entered).title).toBe('Retry A')
  62  |     await titleInput(page).fill('Retry latest B')
  63  |     release()
  64  |     await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible()
  65  |     await page.getByRole('button', { name: 'Retry', exact: true }).click()
  66  |     await saved(request, id, (deck) => deck.title, 'Retry latest B')
  67  |     await page.reload()
  68  |     await expect(titleInput(page)).toHaveValue('Retry latest B')
  69  |     receipt.runs.push({ scenarioId: 'P06-11', status: 'pending-identity', transportFailure: 'connectionfailed, no invented API body', retryAndReload: 'Retry latest B' })
  70  |   })
  71  | })
  72  | 
  73  | test('P06-12 Use Remote discards a queued edit after a genuine generation conflict', async ({ page, browser, request }, info) => {
  74  |   test.setTimeout(120000)
  75  |   await historyJourney({ page, browser, request }, info, ['P06-12'], async ({ ids, receipt }) => {
  76  |     const { id } = await createHistoryPackage(request, ids, 'Conflict original')
  77  |     await page.goto(`/editor/${id}`)
  78  |     await expect(titleInput(page)).toHaveValue('Conflict original')
  79  |     const held = await holdNextSave(page, id)
  80  |     await titleInput(page).fill('Conflict local A')
  81  |     const pending = await held.entered
  82  |     await titleInput(page).fill('Conflict queued B')
  83  |     const remote = await apiGetPresentation(request, id)
  84  |     await apiUpdatePresentation(request, id, { ...remote, title: 'Remote authoritative', aggregateGeneration: remote.aggregateGeneration, idempotencyKey: `p06-remote-${randomUUID()}` })
  85  |     held.release()
  86  |     const dialog = page.getByRole('alertdialog', { name: 'Save conflict' })
  87  |     await expect(dialog).toBeVisible()
  88  |     await dialog.getByRole('button', { name: 'Use Remote', exact: true }).click()
  89  |     await expect(titleInput(page)).toHaveValue('Remote authoritative')
  90  |     // Advance beyond the save debounce: a discarded queued successor must never land.
  91  |     const start = Date.now()
  92  |     await expect.poll(async () => ({
  93  |       title: (await apiGetPresentation(request, id)).title,
  94  |       quiet: Date.now() - start >= 2000,
  95  |     }), { timeout: 6000, intervals: [250, 500] }).toEqual({ title: 'Remote authoritative', quiet: true })
  96  |     await page.reload()
  97  |     await expect(titleInput(page)).toHaveValue('Remote authoritative')
  98  |     receipt.runs.push({ scenarioId: 'P06-12', status: 'pending-identity', heldBody: pending.title, discardedQueued: 'Conflict queued B', remoteAndReload: 'Remote authoritative' })
  99  |   })
  100 | })
  101 | 
```