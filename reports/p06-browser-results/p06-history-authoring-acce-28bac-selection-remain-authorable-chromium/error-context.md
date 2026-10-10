# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: p06-history-authoring-acceptance.spec.js >> P06-07/08 deleted text Undo caret and locked master selection remain authorable
- Location: tests\e2e\p06-history-authoring-acceptance.spec.js:4:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Editing master: Acceptance master')
Expected: visible
Error: strict mode violation: getByText('Editing master: Acceptance master') resolved to 2 elements:
    1) <span>Editing master: Acceptance master</span> aka getByText('Editing master: Acceptance').first()
    2) <span class="min-w-0 truncate tabular-nums" data-testid="statusbar-slide-position" title="Editing master: Acceptance master">Editing master: Acceptance master</span> aka getByTestId('statusbar-slide-position')

Call log:
  - Expect "toBeVisible" getByText('Editing master: Acceptance master') with timeout 5000ms
  - waiting for getByText('Editing master: Acceptance master')

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e5]:
    - generic [ref=e6]:
      - button "Back" [ref=e7] [cursor=pointer]
      - textbox "Untitled Presentation" [ref=e10]: P06 authoring acceptance
      - toolbar "Quick actions" [ref=e11]:
        - button "Save" [ref=e12] [cursor=pointer]
        - button "Undo" [ref=e18] [cursor=pointer]
        - button "Redo" [disabled]
      - generic [ref=e23]:
        - button "File menu" [ref=e25] [cursor=pointer]:
          - generic [ref=e29]: File
        - tablist "Ribbon tabs" [ref=e31]:
          - tab "Home" [ref=e32] [cursor=pointer]
          - tab "Insert" [ref=e37] [cursor=pointer]
          - tab "Design" [active] [selected] [ref=e40] [cursor=pointer]
          - tab "Transitions" [ref=e48] [cursor=pointer]
          - tab "Animations" [ref=e58] [cursor=pointer]
          - tab "View" [ref=e63] [cursor=pointer]
        - generic [ref=e68]:
          - button "AI" [ref=e70] [cursor=pointer]
          - button "Share" [ref=e76] [cursor=pointer]
          - button "Present" [ref=e85] [cursor=pointer]
    - generic [ref=e89]:
      - tabpanel "Design" [ref=e92]:
        - generic [ref=e93]:
          - generic [ref=e94]:
            - button "Change theme" [ref=e97] [cursor=pointer]:
              - generic [ref=e104]: black
            - generic [ref=e105]: Themes
          - generic [ref=e106]:
            - button "Open Layout Manager" [ref=e108] [cursor=pointer]:
              - generic [ref=e113]: Layouts
            - generic [ref=e114]: Layouts
          - generic [ref=e115]:
            - generic [ref=e117]:
              - button "Change slide background" [disabled]:
                - generic: Background
            - generic [ref=e118]: Background
          - generic [ref=e119]:
            - generic [ref=e121]:
              - button "Set size 16:9" [ref=e122] [cursor=pointer]:
                - generic [ref=e125]: 16:9
              - button "Set size 4:3" [ref=e126] [cursor=pointer]:
                - generic [ref=e129]: 4:3
              - button "Set size Wide" [ref=e130] [cursor=pointer]:
                - generic [ref=e134]: Wide
              - button "Set size Ultra" [ref=e135] [cursor=pointer]:
                - generic [ref=e140]: Ultra
            - generic [ref=e141]: Slide Size
          - generic [ref=e142]:
            - generic [ref=e144]:
              - button "Toggle footer" [ref=e145] [cursor=pointer]:
                - generic [ref=e148]: Footer Off
              - button "Toggle page numbers" [ref=e149] [cursor=pointer]:
                - generic [ref=e153]: Numbers Off
              - combobox "Page number format" [ref=e154]:
                - option "1 / 10" [selected]
                - option "1"
            - generic [ref=e155]: Footer
          - generic [ref=e156]:
            - generic [ref=e158]:
              - button "Toggle auto-advance" [ref=e159] [cursor=pointer]
              - button "Toggle loop" [ref=e163] [cursor=pointer]
              - button "Toggle presenter grid" [ref=e169] [cursor=pointer]
              - button "Toggle kiosk mode" [ref=e172] [cursor=pointer]
              - button "Toggle presenter slide menu" [ref=e176] [cursor=pointer]
            - generic [ref=e178]: Navigation
      - generic [ref=e179]:
        - generic "Slide navigator" [ref=e180]:
          - generic [ref=e181]:
            - generic [ref=e182]:
              - generic [ref=e183]: Slides
              - generic [aria-hidden] [ref=e184]: "1"
            - navigation "Slides" [ref=e185]:
              - list [ref=e186]:
                - listitem [ref=e187]:
                  - button "Select slide 1" [pressed] [ref=e188] [cursor=pointer]:
                    - generic [ref=e189]: "1"
                    - generic [aria-hidden]:
                      - generic:
                        - generic:
                          - generic:
                            - paragraph: Local Alpha?
                  - generic [ref=e190]:
                    - button "Duplicate slide 1" [ref=e191] [cursor=pointer]
                    - button "Cannot delete last slide" [disabled] [ref=e195] [cursor=pointer]
            - generic [ref=e199]:
              - button "Add Slide" [ref=e200] [cursor=pointer]
              - button "Insert Template" [ref=e202] [cursor=pointer]
        - generic [ref=e208]:
          - generic [ref=e209]:
            - generic [ref=e210]: "Editing master: Acceptance master"
            - button "Exit master edit" [ref=e211] [cursor=pointer]
          - generic "Slide canvas" [ref=e213]:
            - group "text element, \"Master Alpha\"" [ref=e214]:
              - paragraph [ref=e217]: Master Alpha
        - generic "Inspector" [ref=e218]:
          - group "Inspector view" [ref=e219]:
            - button "Properties" [pressed] [ref=e220] [cursor=pointer]
            - button "Design Ideas" [ref=e221] [cursor=pointer]
          - complementary "Properties panel" [ref=e222]:
            - button [ref=e225] [cursor=pointer]:
              - heading "Selection Pane" [level=3] [ref=e226]
            - generic [ref=e229]:
              - button [expanded] [ref=e230] [cursor=pointer]:
                - heading "Presentation Settings" [level=3] [ref=e231]
              - generic [ref=e234]:
                - generic [ref=e235]:
                  - generic [ref=e236]:
                    - text: Auto-slide (s)
                    - spinbutton "Auto-slide (s)" [ref=e237]: "0"
                  - generic [ref=e239] [cursor=pointer]:
                    - checkbox "Enable loop (auto-slide)" [ref=e240]
                    - generic [ref=e241]: Enable loop (auto-slide)
                - generic [ref=e242]:
                  - text: Navigation Mode
                  - combobox "Navigation Mode" [ref=e243] [cursor=pointer]:
                    - option "Default (2D)" [selected]
                    - option "Linear (Flat)"
  - contentinfo [ref=e244]:
    - 'generic "Editing master: Acceptance master" [ref=e245]'
    - generic [ref=e246]:
      - generic "NavSlides Editor" [ref=e247]
      - generic "Designed by Xuan Bui Thanh - Department of Fundamental Engineering - Vietnam Naval Academy" [ref=e248]
    - generic [ref=e249]:
      - generic [ref=e250]:
        - button "Normal view" [pressed] [ref=e251] [cursor=pointer]
        - button "Slide Sorter" [ref=e257] [cursor=pointer]
        - button "Present" [ref=e263] [cursor=pointer]
      - generic [ref=e266]:
        - button "Zoom out" [ref=e267] [cursor=pointer]: −
        - slider "Zoom level" [ref=e268] [cursor=pointer]: "85"
        - button "Zoom in" [ref=e269] [cursor=pointer]: +
        - button "Fit to window" [ref=e270] [cursor=pointer]: Fit
        - generic [ref=e271]: 85%
      - generic "Version" [ref=e272]: v1.17.0
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | import { historyJourney, text, slide, content, quick, saved } from './helpers/p06-history-acceptance.js'
  3  | 
  4  | test('P06-07/08 deleted text Undo caret and locked master selection remain authorable', async ({ page, browser, request }, info) => {
  5  |   test.setTimeout(120000)
  6  |   await historyJourney({ page, browser, request }, info, ['P06-07', 'P06-08'], async ({ create, receipt }) => {
  7  |     const master = { id: 'master', name: 'Acceptance master', fixedElements: [{ ...text('brand', '<p>Master Alpha</p>'), locked: true }], placeholders: [] }
  8  |     const id = await create('P06 authoring acceptance', { slides: [slide([text('local', '<p>Local Alpha</p>')])], layoutMasters: [master] })
  9  |     await page.goto(`/editor/${id}`)
  10 |     await expect(content(page, 'local')).toContainText('Local Alpha')
  11 |     await content(page, 'local').click()
  12 |     await page.keyboard.press('Delete')
  13 |     await expect(content(page, 'local')).toHaveCount(0)
  14 |     await quick(page).getByRole('button', { name: 'Undo', exact: true }).click()
  15 |     await expect(content(page, 'local')).toContainText('Local Alpha')
  16 |     await expect(page.locator('.ProseMirror')).toHaveCount(0)
  17 |     await content(page, 'local').dblclick()
  18 |     const editor = page.locator('.ProseMirror')
  19 |     await expect(editor).toContainText('Local Alpha')
  20 |     await editor.click()
  21 |     await page.keyboard.press('Control+End')
  22 |     await page.keyboard.type('?')
  23 |     await expect(editor).toContainText('Local Alpha?')
  24 |     await page.keyboard.press('Escape')
  25 |     await saved(request, id, (deck) => deck.slides[0].elements[0].content, '<p>Local Alpha?</p>')
  26 |     receipt.runs.push({ scenarioId: 'P06-07', status: 'pending-identity', deletedTarget: 'local', restoredNextInput: '<p>Local Alpha?</p>', staleEditorCountAfterUndo: 0 })
  27 | 
  28 |     await page.getByRole('tab', { name: 'Design', exact: true }).click()
  29 |     await page.getByRole('button', { name: 'Open Layout Manager', exact: true }).click()
  30 |     await page.getByRole('button', { name: 'Edit master Acceptance master', exact: true }).click()
> 31 |     await expect(page.getByText('Editing master: Acceptance master')).toBeVisible()
     |                                                                       ^ Error: expect(locator).toBeVisible() failed
  32 |     await content(page, 'brand').click()
  33 |     const x = page.getByTestId('prop-x')
  34 |     await expect(x).toHaveValue('100')
  35 |     await x.fill('222'); await x.blur()
  36 |     await expect(x).toHaveValue('222')
  37 |     await quick(page).getByRole('button', { name: 'Undo', exact: true }).click()
  38 |     await expect(x).toHaveValue('100')
  39 |     await quick(page).getByRole('button', { name: 'Redo', exact: true }).click()
  40 |     await expect(x).toHaveValue('222')
  41 |     await saved(request, id, (deck) => ({ x: deck.layoutMasters[0].fixedElements[0].x, locked: deck.layoutMasters[0].fixedElements[0].locked, local: deck.slides[0].elements[0].content }), { x: 222, locked: true, local: '<p>Local Alpha?</p>' })
  42 |     await content(page, 'brand').click()
  43 |     await page.keyboard.press('Delete')
  44 |     await expect(content(page, 'brand')).toHaveCount(0)
  45 |     await expect(x).toHaveCount(0)
  46 |     await quick(page).getByRole('button', { name: 'Undo', exact: true }).click()
  47 |     await expect(content(page, 'brand')).toContainText('Master Alpha')
  48 |     await expect(x).toHaveCount(0)
  49 |     await content(page, 'brand').click()
  50 |     await expect(x).toHaveValue('222')
  51 |     await page.getByRole('button', { name: 'Exit master edit', exact: true }).click()
  52 |     await saved(request, id, (deck) => deck.layoutMasters[0].fixedElements[0].locked, true)
  53 |     await page.reload()
  54 |     await expect(content(page, 'local')).toContainText('Local Alpha?')
  55 |     receipt.runs.push({ scenarioId: 'P06-08', status: 'pending-identity', masterEditUndoRedoX: [222, 100, 222], survivingSelection: true, deletionClearsSelection: true, storedMasterLocked: true, localContentUnchanged: true })
  56 |   })
  57 | })
  58 | 
```