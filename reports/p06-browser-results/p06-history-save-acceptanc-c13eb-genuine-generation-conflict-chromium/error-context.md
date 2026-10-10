# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: p06-history-save-acceptance.spec.js >> P06-12 Use Remote discards a queued edit after a genuine generation conflict
- Location: tests\e2e\p06-history-save-acceptance.spec.js:73:5

# Error details

```
Error: expect(received).toBeTruthy()

Received: false
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e5]:
    - generic [ref=e6]:
      - button "Back" [ref=e7] [cursor=pointer]
      - textbox "Untitled Presentation" [active] [ref=e10]: Conflict queued B
      - toolbar "Quick actions" [ref=e11]:
        - button "Save" [ref=e12] [cursor=pointer]
        - button "Undo" [ref=e18] [cursor=pointer]
        - button "Redo" [disabled]
      - generic [ref=e23]:
        - button "File menu" [ref=e25] [cursor=pointer]:
          - generic [ref=e29]: File
        - tablist "Ribbon tabs" [ref=e31]:
          - tab "Home" [selected] [ref=e32] [cursor=pointer]
          - tab "Insert" [ref=e37] [cursor=pointer]
          - tab "Design" [ref=e40] [cursor=pointer]
          - tab "Transitions" [ref=e48] [cursor=pointer]
          - tab "Animations" [ref=e58] [cursor=pointer]
          - tab "View" [ref=e63] [cursor=pointer]
        - generic [ref=e68]:
          - button "AI" [ref=e70] [cursor=pointer]
          - button "Share" [ref=e76] [cursor=pointer]
          - button "Present" [ref=e85] [cursor=pointer]
    - complementary "PPTX import report unavailable" [ref=e89]:
      - paragraph [ref=e90]: No import diagnostics available for this presentation.
    - generic [ref=e91]:
      - tabpanel "Home" [ref=e94]:
        - generic [ref=e95]:
          - generic [ref=e96]:
            - generic [ref=e98]:
              - button "Paste" [disabled]
              - button "Cut" [disabled]
              - button "Copy" [disabled]
              - button "Duplicate" [disabled]
            - generic [ref=e99]: Clipboard
          - generic [ref=e100]:
            - generic [ref=e101]: Double-click a text box to edit
            - generic [ref=e103]: Text
          - generic [ref=e104]:
            - generic [ref=e106]:
              - button "Toggle grid" [ref=e107] [cursor=pointer]
              - spinbutton "Grid size" [ref=e110]: "40"
              - button "Toggle smart guides" [pressed] [ref=e111] [cursor=pointer]
              - button "Toggle rulers" [ref=e116] [cursor=pointer]
              - button "Zoom in" [ref=e124] [cursor=pointer]
              - button "Zoom out" [ref=e128] [cursor=pointer]
              - button "Fit to window" [ref=e132] [cursor=pointer]
            - generic [ref=e138]: Canvas
          - generic [ref=e139]:
            - generic [ref=e141]:
              - button "Group elements" [disabled]
              - button "Ungroup elements" [disabled]
              - button "Bring forward" [disabled]
              - button "Send backward" [disabled]
              - button "Bring to front" [disabled]
              - button "Send to back" [disabled]
            - generic [ref=e144]: Arrange
      - generic [ref=e145]:
        - generic "Slide navigator" [ref=e146]:
          - generic [ref=e147]:
            - generic [ref=e148]:
              - generic [ref=e149]: Slides
              - generic [aria-hidden] [ref=e150]: "1"
            - navigation "Slides" [ref=e151]:
              - list [ref=e152]:
                - listitem [ref=e153]:
                  - button "Select slide 1" [pressed] [ref=e154] [cursor=pointer]:
                    - generic [ref=e155]: "1"
                    - generic [aria-hidden]:
                      - generic:
                        - generic:
                          - generic:
                            - paragraph: Package Alpha
                  - generic [ref=e156]:
                    - button "Duplicate slide 1" [ref=e157] [cursor=pointer]
                    - button "Cannot delete last slide" [disabled] [ref=e161] [cursor=pointer]
            - generic [ref=e165]:
              - button "Add Slide" [ref=e166] [cursor=pointer]
              - button "Insert Template" [ref=e168] [cursor=pointer]
        - generic "Slide canvas" [ref=e176]:
          - group "text element, \"Package Alpha\"" [ref=e177]:
            - paragraph [ref=e180]: Package Alpha
        - generic "Inspector" [ref=e181]:
          - group "Inspector view" [ref=e182]:
            - button "Properties" [pressed] [ref=e183] [cursor=pointer]
            - button "Design Ideas" [ref=e184] [cursor=pointer]
          - complementary "Properties panel" [ref=e185]:
            - button [ref=e188] [cursor=pointer]:
              - heading "Selection Pane" [level=3] [ref=e189]
            - generic [ref=e192]:
              - button [expanded] [ref=e193] [cursor=pointer]:
                - heading "Presentation Settings" [level=3] [ref=e194]
              - generic [ref=e197]:
                - generic [ref=e198]:
                  - generic [ref=e199]:
                    - text: Auto-slide (s)
                    - spinbutton "Auto-slide (s)" [ref=e200]: "0"
                  - generic [ref=e202] [cursor=pointer]:
                    - checkbox "Enable loop (auto-slide)" [ref=e203]
                    - generic [ref=e204]: Enable loop (auto-slide)
                - generic [ref=e205]:
                  - text: Navigation Mode
                  - combobox "Navigation Mode" [ref=e206] [cursor=pointer]:
                    - option "Default (2D)" [selected]
                    - option "Linear (Flat)"
            - generic [ref=e207]:
              - button [expanded] [ref=e208] [cursor=pointer]:
                - heading "Slide Footer" [level=3] [ref=e209]
              - textbox "Slide footer section name" [ref=e214]:
                - /placeholder: Section name (footer)
            - generic [ref=e216]:
              - button [expanded] [ref=e217] [cursor=pointer]:
                - heading "Speaker Notes" [level=3] [ref=e218]
              - textbox "Speaker notes" [ref=e222]:
                - /placeholder: Add speaker notes here...
  - contentinfo [ref=e223]:
    - generic "Slide 1 / 1" [ref=e224]
    - generic [ref=e225]:
      - generic "NavSlides Editor" [ref=e226]
      - generic "Designed by Xuan Bui Thanh - Department of Fundamental Engineering - Vietnam Naval Academy" [ref=e227]
    - generic [ref=e228]:
      - generic [ref=e229]:
        - button "Normal view" [pressed] [ref=e230] [cursor=pointer]
        - button "Slide Sorter" [ref=e236] [cursor=pointer]
        - button "Present" [ref=e242] [cursor=pointer]
      - generic [ref=e245]:
        - button "Zoom out" [ref=e246] [cursor=pointer]: −
        - slider "Zoom level" [ref=e247] [cursor=pointer]: "85"
        - button "Zoom in" [ref=e248] [cursor=pointer]: +
        - button "Fit to window" [ref=e249] [cursor=pointer]: Fit
        - generic [ref=e250]: 85%
      - generic "Version" [ref=e251]: v1.17.0
```

# Test source

```ts
  1   | import { test as base, expect } from '@playwright/test'
  2   | 
  3   | const API_BASE = process.env.PLAYWRIGHT_API_BASE_URL || '/api'
  4   | const ALLOWED_BASE_URL = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/
  5   | const TRANSIENT_STATUSES = new Set([429, 502, 503, 504])
  6   | 
  7   | export function getBaseUrl() {
  8   |   return process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://127.0.0.1:4173'
  9   | }
  10  | 
  11  | function assertLoopback() {
  12  |   const baseUrl = getBaseUrl()
  13  |   const apiBaseUrl = API_BASE.startsWith('http') ? API_BASE : baseUrl
  14  |   if (!ALLOWED_BASE_URL.test(baseUrl) || !ALLOWED_BASE_URL.test(apiBaseUrl)) {
  15  |     throw new Error(
  16  |       `Refusing API write: PLAYWRIGHT_TEST_BASE_URL=${baseUrl}, API_BASE=${API_BASE} is not a loopback address. ` +
  17  |         `E2E tests perform destructive ops (create/update/delete) and must never run against shared/prod.`
  18  |     )
  19  |   }
  20  | }
  21  | 
  22  | function responseStatus(response) {
  23  |   return typeof response.status === 'function' ? response.status() : response.status
  24  | }
  25  | 
  26  | async function withApiRetry(action, attempts = 5) {
  27  |   let lastResponse
  28  |   for (let attempt = 1; attempt <= attempts; attempt += 1) {
  29  |     lastResponse = await action()
  30  |     if (!TRANSIENT_STATUSES.has(responseStatus(lastResponse)) || attempt === attempts) {
  31  |       return lastResponse
  32  |     }
  33  |     await new Promise((resolve) => setTimeout(resolve, 250 * attempt))
  34  |   }
  35  |   return lastResponse
  36  | }
  37  | 
  38  | /**
  39  |  * Helper: create a presentation via API (bypasses UI).
  40  |  */
  41  | export async function apiCreatePresentation(request, title = 'E2E Test Presentation') {
  42  |   assertLoopback()
  43  |   const res = await withApiRetry(() => request.post(`${API_BASE}/presentations`, {
  44  |     data: {
  45  |       title,
  46  |       theme: 'black',
  47  |       transition: 'slide',
  48  |     },
  49  |   }))
  50  |   if (!res.ok()) {
  51  |     console.error('API Error:', res.status(), await res.text())
  52  |   }
  53  |   expect(res.ok()).toBeTruthy()
  54  |   return res.json()
  55  | }
  56  | 
  57  | /**
  58  |  * Helper: delete presentation permanently via API.
  59  |  */
  60  | export async function apiDeletePresentation(request, id) {
  61  |   assertLoopback()
  62  |   if (!id) return
  63  |   const softDelete = await withApiRetry(() => request.delete(`${API_BASE}/presentations/${id}`))
  64  |   const hardDelete = await withApiRetry(() =>
  65  |     request.delete(`${API_BASE}/presentations/${id}/permanent`)
  66  |   )
  67  |   const acceptable = new Set([200, 404])
  68  |   const softStatus = responseStatus(softDelete)
  69  |   const hardStatus = responseStatus(hardDelete)
  70  |   if (!acceptable.has(softStatus) || !acceptable.has(hardStatus)) {
  71  |     throw new Error(
  72  |       `Cleanup failed for ${id}: soft=${softStatus} hard=${hardStatus}`
  73  |     )
  74  |   }
  75  | }
  76  | 
  77  | /**
  78  |  * Helper: get a presentation by ID.
  79  |  */
  80  | export async function apiGetPresentation(request, id) {
  81  |   assertLoopback()
  82  |   const res = await withApiRetry(() => request.get(`${API_BASE}/presentations/${id}`))
  83  |   if (!res.ok()) {
  84  |     throw new Error(`Failed to fetch presentation ${id}: ${res.status()} ${await res.text()}`)
  85  |   }
  86  |   return res.json()
  87  | }
  88  | 
  89  | /**
  90  |  * Helper: update a presentation.
  91  |  */
  92  | export async function apiUpdatePresentation(request, id, data) {
  93  |   assertLoopback()
  94  |   const res = await withApiRetry(() => request.put(`${API_BASE}/presentations/${id}`, { data }))
> 95  |   expect(res.ok()).toBeTruthy()
      |                    ^ Error: expect(received).toBeTruthy()
  96  |   return res.json()
  97  | }
  98  | 
  99  | /**
  100 |  * Helper: create a share link for a presentation.
  101 |  */
  102 | export async function apiCreateShareLink(request, id) {
  103 |   assertLoopback()
  104 |   const res = await withApiRetry(() => request.post(`${API_BASE}/presentations/${id}/share`, {
  105 |     data: { name: 'E2E Test Link' },
  106 |   }))
  107 |   expect(res.ok()).toBeTruthy()
  108 |   return res.json()
  109 | }
  110 | 
  111 | /**
  112 |  * Helper: create a share link with password (and optional expiresInDays).
  113 |  */
  114 | export async function apiCreateShareLinkWithPassword(request, id, password, opts = {}) {
  115 |   assertLoopback()
  116 |   const res = await withApiRetry(() => request.post(`${API_BASE}/presentations/${id}/share`, {
  117 |     data: { name: opts.name || 'E2E Password Link', password, expiresInDays: opts.expiresInDays },
  118 |   }))
  119 |   expect(res.ok()).toBeTruthy()
  120 |   return res.json()
  121 | }
  122 | 
  123 | /**
  124 |  * Helper: revoke a single share token via DELETE /api/shares/:token.
  125 |  */
  126 | export async function apiRevokeShareToken(request, token) {
  127 |   assertLoopback()
  128 |   const res = await withApiRetry(() => request.delete(`${API_BASE}/shares/${token}`))
  129 |   return res
  130 | }
  131 | 
  132 | /**
  133 |  * Helper: create a version snapshot.
  134 |  */
  135 | export async function apiCreateSnapshot(request, id, name = 'E2E Snapshot') {
  136 |   assertLoopback()
  137 |   const res = await withApiRetry(() => request.post(`${API_BASE}/presentations/${id}/snapshot`, {
  138 |     data: { name },
  139 |   }))
  140 |   expect(res.ok()).toBeTruthy()
  141 |   return res.json()
  142 | }
  143 | 
  144 | /**
  145 |  * Custom test fixture that auto-creates and cleans up a presentation.
  146 |  */
  147 | export const test = base.extend({
  148 |   testPresentation: async ({ request }, use) => {
  149 |     const pres = await apiCreatePresentation(request, 'Auto E2E Fixture')
  150 |     await use(pres)
  151 |     await apiDeletePresentation(request, pres.id)
  152 |   },
  153 | })
  154 | 
  155 | export { expect }
  156 | 
```