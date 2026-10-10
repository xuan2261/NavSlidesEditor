# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: p06-history-restore-acceptance.spec.js >> P06-14 server history restore is reversible with immutable Original downloads
- Location: tests\e2e\p06-history-restore-acceptance.spec.js:38:5

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

Expected: "Package pending projection"
Received: "Package original"

Call Log:
- Timeout 12000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- generic [ref=f2e3]:
  - generic [ref=f2e5]:
    - generic [ref=f2e6]:
      - button "Back" [ref=f2e7] [cursor=pointer]
      - textbox "Untitled Presentation" [ref=f2e10]: Package pending projection
      - toolbar "Quick actions" [ref=f2e11]:
        - 'button "Save failed: STALE_GENERATION" [ref=f2e12] [cursor=pointer]'
        - alert [ref=f2e17]:
          - generic [ref=f2e20]: Save failed
        - button "Undo" [ref=f2e22] [cursor=pointer]
        - button "Redo" [disabled]
      - generic [ref=f2e27]:
        - button "File menu" [ref=f2e29] [cursor=pointer]:
          - generic [ref=f2e33]: File
        - generic [ref=f2e34]:
          - button "Scroll ribbon tabs left" [disabled] [ref=f2e35]
          - tablist "Ribbon tabs" [ref=f2e38]:
            - tab "Home" [selected] [ref=f2e39] [cursor=pointer]
            - tab "Insert" [ref=f2e44] [cursor=pointer]
            - tab "Design" [ref=f2e47] [cursor=pointer]
            - tab "Transitions" [ref=f2e55] [cursor=pointer]
            - tab "Animations" [ref=f2e65] [cursor=pointer]
            - tab "View" [ref=f2e70] [cursor=pointer]
          - button "Scroll ribbon tabs right" [ref=f2e75] [cursor=pointer]
        - generic [ref=f2e78]:
          - button "AI" [ref=f2e80] [cursor=pointer]
          - button "Share" [ref=f2e86] [cursor=pointer]
          - button "Present" [ref=f2e95] [cursor=pointer]
    - complementary "PPTX import report unavailable" [ref=f2e99]:
      - paragraph [ref=f2e100]: No import diagnostics available for this presentation.
    - generic [ref=f2e101]:
      - tabpanel "Home" [ref=f2e104]:
        - generic [ref=f2e105]:
          - generic [ref=f2e106]:
            - generic [ref=f2e108]:
              - button "Paste" [disabled]
              - button "Cut" [disabled]
              - button "Copy" [disabled]
              - button "Duplicate" [disabled]
            - generic [ref=f2e109]: Clipboard
          - generic [ref=f2e110]:
            - generic [ref=f2e111]: Double-click a text box to edit
            - generic [ref=f2e113]: Text
          - generic [ref=f2e114]:
            - generic [ref=f2e116]:
              - button "Toggle grid" [ref=f2e117] [cursor=pointer]
              - spinbutton "Grid size" [ref=f2e120]: "40"
              - button "Toggle smart guides" [pressed] [ref=f2e121] [cursor=pointer]
              - button "Toggle rulers" [ref=f2e126] [cursor=pointer]
              - button "Zoom in" [ref=f2e134] [cursor=pointer]
              - button "Zoom out" [ref=f2e138] [cursor=pointer]
              - button "Fit to window" [ref=f2e142] [cursor=pointer]
            - generic [ref=f2e148]: Canvas
          - generic [ref=f2e149]:
            - generic [ref=f2e151]:
              - button "Group elements" [disabled]
              - button "Ungroup elements" [disabled]
              - button "Bring forward" [disabled]
              - button "Send backward" [disabled]
              - button "Bring to front" [disabled]
              - button "Send to back" [disabled]
            - generic [ref=f2e154]: Arrange
      - generic [ref=f2e155]:
        - generic "Slide navigator" [ref=f2e156]:
          - generic [ref=f2e157]:
            - generic [ref=f2e158]:
              - generic [ref=f2e159]: Slides
              - generic [aria-hidden] [ref=f2e160]: "1"
            - navigation "Slides" [ref=f2e161]:
              - list [ref=f2e162]:
                - listitem [ref=f2e163]:
                  - button "Select slide 1" [pressed] [ref=f2e164] [cursor=pointer]:
                    - generic [ref=f2e165]: "1"
                    - generic [aria-hidden]:
                      - generic:
                        - generic:
                          - generic:
                            - paragraph: Package Alpha
                  - generic [ref=f2e166]:
                    - button "Duplicate slide 1" [ref=f2e167] [cursor=pointer]
                    - button "Cannot delete last slide" [disabled] [ref=f2e171] [cursor=pointer]
            - generic [ref=f2e175]:
              - button "Add Slide" [ref=f2e176] [cursor=pointer]
              - button "Insert Template" [ref=f2e178] [cursor=pointer]
        - generic "Slide canvas" [ref=f2e186]:
          - group "text element, \"Package Alpha\"" [ref=f2e187]:
            - paragraph [ref=f2e190]: Package Alpha
        - generic "Inspector" [ref=f2e191]:
          - group "Inspector view" [ref=f2e192]:
            - button "Properties" [pressed] [ref=f2e193] [cursor=pointer]
            - button "Design Ideas" [ref=f2e194] [cursor=pointer]
          - complementary "Properties panel" [ref=f2e195]:
            - button [ref=f2e198] [cursor=pointer]:
              - heading "Selection Pane" [level=3] [ref=f2e199]
            - generic [ref=f2e202]:
              - button [expanded] [ref=f2e203] [cursor=pointer]:
                - heading "Presentation Settings" [level=3] [ref=f2e204]
              - generic [ref=f2e207]:
                - generic [ref=f2e208]:
                  - generic [ref=f2e209]:
                    - text: Auto-slide (s)
                    - spinbutton "Auto-slide (s)" [ref=f2e210]: "0"
                  - generic [ref=f2e212] [cursor=pointer]:
                    - checkbox "Enable loop (auto-slide)" [ref=f2e213]
                    - generic [ref=f2e214]: Enable loop (auto-slide)
                - generic [ref=f2e215]:
                  - text: Navigation Mode
                  - combobox "Navigation Mode" [ref=f2e216] [cursor=pointer]:
                    - option "Default (2D)" [selected]
                    - option "Linear (Flat)"
            - generic [ref=f2e217]:
              - button [expanded] [ref=f2e218] [cursor=pointer]:
                - heading "Slide Footer" [level=3] [ref=f2e219]
              - textbox "Slide footer section name" [ref=f2e224]:
                - /placeholder: Section name (footer)
            - generic [ref=f2e226]:
              - button [expanded] [ref=f2e227] [cursor=pointer]:
                - heading "Speaker Notes" [level=3] [ref=f2e228]
              - textbox "Speaker notes" [ref=f2e232]:
                - /placeholder: Add speaker notes here...
    - alertdialog [ref=f2e233]:
      - heading "Save conflict" [level=2] [ref=f2e234]
      - paragraph [ref=f2e235]: This presentation changed elsewhere. Reload the remote version or keep your local changes and overwrite the latest version.
      - generic [ref=f2e236]:
        - button "Cancel" [active] [ref=f2e237] [cursor=pointer]
        - button "Use Remote" [ref=f2e238] [cursor=pointer]
        - button "Keep Local" [ref=f2e239] [cursor=pointer]
  - contentinfo [ref=f2e240]:
    - generic "Slide 1 / 1" [ref=f2e241]
    - generic [ref=f2e242]:
      - generic "NavSlides Editor" [ref=f2e243]
      - generic "Designed by Xuan Bui Thanh - Department of Fundamental Engineering - Vietnam Naval Academy" [ref=f2e244]
    - generic [ref=f2e245]:
      - generic [ref=f2e246]:
        - button "Normal view" [pressed] [ref=f2e247] [cursor=pointer]
        - button "Slide Sorter" [ref=f2e253] [cursor=pointer]
        - button "Present" [ref=f2e259] [cursor=pointer]
      - generic [ref=f2e262]:
        - button "Zoom out" [ref=f2e263] [cursor=pointer]: −
        - slider "Zoom level" [ref=f2e264] [cursor=pointer]: "85"
        - button "Zoom in" [ref=f2e265] [cursor=pointer]: +
        - button "Fit to window" [ref=f2e266] [cursor=pointer]: Fit
        - generic [ref=f2e267]: 85%
      - generic "Version" [ref=f2e268]: v1.17.0
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
> 10 | export const saved = async (request, id, read, expected) => expect.poll(async () => read(await apiGetPresentation(request, id)), { timeout: 12000 }).toEqual(expected)
     |                                                                                                                                                      ^ Error: expect(received).toEqual(expected) // deep equality
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
  52 |     await route.continue()
  53 |   })
  54 |   return { entered, release }
  55 | }
  56 | 
```