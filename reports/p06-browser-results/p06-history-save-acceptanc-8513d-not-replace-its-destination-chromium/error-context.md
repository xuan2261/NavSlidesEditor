# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: p06-history-save-acceptance.spec.js >> P06-09/10 queued save persists and a pending route save cannot replace its destination
- Location: tests\e2e\p06-history-save-acceptance.spec.js:7:5

# Error details

```
Error: route.continue: Route is already handled!
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e5]:
    - generic [ref=e6]:
      - button "Back" [ref=e7] [cursor=pointer]
      - textbox "Untitled Presentation" [active] [ref=e10]: Route queued B
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
  1  | import { expect } from '@playwright/test'
  2  | import { executionIdentityGate, finishExecutionIdentity } from './execution-identity-gate.js'
  3  | import { apiCreatePresentation, apiDeletePresentation, apiGetPresentation, apiUpdatePresentation } from '../fixtures/test-fixtures.js'
  4  | 
  5  | export const text = (id, content, x = 100) => ({ id, type: 'text', x, y: 100, width: 400, height: 80, content, fontSize: 24 })
  6  | export const slide = (elements) => ({ id: 'slide', elements, notes: '', background: { type: 'color', color: '#101010' } })
  7  | export const titleInput = (page) => page.getByPlaceholder('Untitled Presentation')
  8  | export const quick = (page) => page.getByRole('toolbar', { name: 'Quick actions' })
  9  | export const content = (page, id) => page.getByTestId(`slide-element-${id}`)
  10 | export const saved = async (request, id, read, expected) => expect.poll(async () => read(await apiGetPresentation(request, id)), { timeout: 12000 }).toEqual(expected)
  11 | 
  12 | export async function historyJourney({ page, browser, request }, info, scenarioIds, journey) {
  13 |   const receipt = { status: 'running', scenarioIds, production: 'isolated npm start, actual HTTP API; barriers never synthesize bodies', runs: [], pageErrors: [] }
  14 |   const ids = []
  15 |   page.on('pageerror', (error) => receipt.pageErrors.push(error.message))
  16 |   const create = async (title, body) => {
  17 |     const deck = await apiCreatePresentation(request, title)
  18 |     ids.push(deck.id)
  19 |     if (body) await apiUpdatePresentation(request, deck.id, body)
  20 |     return deck.id
  21 |   }
  22 |   let journeyError = null
  23 |   let identityError = null
  24 |   try {
  25 |     await executionIdentityGate(receipt, 'before', browser)
  26 |     await journey({ create, receipt, ids })
  27 |     expect(receipt.pageErrors).toEqual([])
  28 |     receipt.status = 'passed'
  29 |   } catch (error) {
  30 |     receipt.status = 'failed'; receipt.error = error.message
  31 |     journeyError = error
  32 |   } finally {
  33 |     identityError = await finishExecutionIdentity(receipt, browser)
  34 |     await info.attach('p06-browser-receipt', { body: Buffer.from(JSON.stringify(receipt, null, 2)), contentType: 'application/json' })
  35 |     await page.unrouteAll({ behavior: 'ignoreErrors' })
  36 |     for (const id of ids) await apiDeletePresentation(request, id)
  37 |   }
  38 |   if (journeyError) throw journeyError
  39 |   if (identityError) throw identityError
  40 | }
  41 | 
  42 | // Hold only one actual HTTP transaction. Release forwards the captured request unchanged.
  43 | export async function holdNextSave(page, id) {
  44 |   let arrive, release
  45 |   const entered = new Promise((resolve) => { arrive = resolve })
  46 |   const released = new Promise((resolve) => { release = resolve })
  47 |   await page.route(`**/api/presentations/${id}`, async (route) => {
  48 |     if (route.request().method() !== 'PUT') return route.continue()
  49 |     await page.unroute(`**/api/presentations/${id}`)
  50 |     arrive(route.request().postDataJSON())
  51 |     await released
> 52 |     await route.continue()
     |                         ^ Error: route.continue: Route is already handled!
  53 |   })
  54 |   return { entered, release }
  55 | }
  56 | 
```