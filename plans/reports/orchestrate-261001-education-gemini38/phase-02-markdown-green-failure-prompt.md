# Kongming: Phase02 failed GREEN verification
Explicit local52186/gpt-6.1-sol, installed kongming role, read-only read/glob/grep. No Gemini/model switching, nested delegation, commands, tests/build/lint/formatters, browser actions, edits or questions. Worktree C:/Work/worktrees/NavSlidesEditor-education-gemini38-cook-261001. Parent stopped edits/re-diagnosis for this failed-verification checkpoint. Earlier design counsel phase-02-print-media-repair-counsel.md remains design-GO only.

## Change believed complete
Removed renderMarkdownEmphasis/renderMarkdownInline/renderSafeMarkdownHtml partial parser. Added shared/src/generated-markdown-runtime.js serializing the existing generated sanitizer under explicit __nsSanitizeMarkdown name. Printed renderer now emits HTML-escaped JSON attribute data-markdown-content instead of immediate HTML. shared/src/htmlGenerator.js loads existing Marked vendor, parses/sanitizes containers before highlighting/readiness, and scopes pre/code CSS. Present uses same helper with existing JSON less-than escaping. Deleted obsolete static source-string Markdown tests, replaced by real printed-markdown.spec.js.

## Previous checks and environment
57 field regressions passed. Portable literal-entity download regression passed. First print test reached a stale server Present frame: actual served script lacked current less-than escaping. Verified owned isolated API process/datadir, replaced it, then test passed canvas/Present and reached intended RED on split print paragraph. Current backend uses standard node --watch server/index.js with a scoped preload for port34102 and same fixture data/uploads. Vite remains the long-lived existing port55173 process. No build/lint/project-wide suite (phase contract).

## Exact failed GREEN command
npx playwright test tests/e2e/education/printed-markdown.spec.js tests/e2e/education/generated-code-image.spec.js --config=.playwright/phase02-manual.config.cjs --project=chromium --workers=1 --retries=0 --reporter=line
Targets: PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:55173, PLAYWRIGHT_API_BASE_URL=http://127.0.0.1:34102/api.

## Verbatim output

Running 2 tests using 1 worker

[1/2] [chromium] › tests\e2e\education\generated-code-image.spec.js:53:5 › generated Present and print preserve source, walkthrough and accessible cropped citation
[2/2] [chromium] › tests\e2e\education\printed-markdown.spec.js:32:5 › PDF print preserves Markdown code literals, blank lines and paragraph structure
  1) [chromium] › tests\e2e\education\printed-markdown.spec.js:32:5 › PDF print preserves Markdown code literals, blank lines and paragraph structure 

    Error: expect(locator).toHaveText(expected) failed

    Locator: locator('p').filter({ hasText: 'Paragraph first line' })
    Timeout: 5000ms
    - Expected  - 1
    + Received  + 0

      Paragraph first line
    - continues here.

    Call log:
      - Expect "toHaveText" locator('p').filter({ hasText: 'Paragraph first line' }) with timeout 5000ms
      - waiting for locator('p').filter({ hasText: 'Paragraph first line' })
        14 × locator resolved to <p>Paragraph first line</p>
           - unexpected value "Paragraph first line"


      14 |   await expect(root.getByRole('heading', { name: 'Markdown parity', exact: true })).toBeVisible()
      15 |   await expect(root.locator('p').filter({ hasText: 'Paragraph first line' }))
    > 16 |     .toHaveText('Paragraph first line\ncontinues here.')
         |      ^
      17 |   await expect(root.locator('p code')).toHaveText('<strong>literal</strong>')
      18 |   await expect(root.locator('pre code')).toHaveText(fenced, { useInnerText: false })
      19 |   expect(await root.locator('pre code').textContent()).toBe(fenced)
        at inspectMarkdown (C:\Work\worktrees\NavSlidesEditor-education-gemini38-cook-261001\tests\e2e\education\printed-markdown.spec.js:16:6)
        at C:\Work\worktrees\NavSlidesEditor-education-gemini38-cook-261001\tests\e2e\education\printed-markdown.spec.js:59:5

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results\education-printed-markdown-cc2f1-nes-and-paragraph-structure-chromium\test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results\education-printed-markdown-cc2f1-nes-and-paragraph-structure-chromium\video-1.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #3: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results\education-printed-markdown-cc2f1-nes-and-paragraph-structure-chromium\video-2.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #4: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results\education-printed-markdown-cc2f1-nes-and-paragraph-structure-chromium\video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results\education-printed-markdown-cc2f1-nes-and-paragraph-structure-chromium\error-context.md


  1 failed
    [chromium] › tests\e2e\education\printed-markdown.spec.js:32:5 › PDF print preserves Markdown code literals, blank lines and paragraph structure 
  1 passed (17.4s)

STDERR:

Exit: 1

## Counsel requested
Why can actual PDF HTML still contain split paragraphs when the partial parser is absent from disk? Inspect current Vite shared CommonJS bridge/config and PDF caller as needed; do not run anything. Give smallest diagnostic distinguishing stale transformed modules from current parser/runtime bug. Parent must capture actual popup HTML/runtime/source identity rather than re-pin test or weaken assertions. No source changes/restarts have been made since failed GREEN; no completed Phase02 claim.