# Kongming: Phase02 failed integrated rich-label verification
Read-only counsel; no edits/checks/delegation/model switching. Explicit local52186/gpt-6.1-sol, Gemini excluded by resumed user authorization. Accepted cook --auto --advice --tdd in C:/Work/worktrees/NavSlidesEditor-education-gemini38-cook-261001. Parent STOPPED edits/re-diagnosis pending advice.

Changes: extracted exact existing TipTap schema and preserveBlockColors into editor-rich-text-extensions.js; focused ShapeRichLabelEditor with atomic text/textHtml updates, single selection lock gate, target revocation, emitUpdate:false external sync; ShapeProperties rich/plain authority branch; PropertiesPanel keyed by effective slide.id + element.id and forwards slideLocked. Imported fit caches invalidated via existing useSlideOperations. Integrated shared SVG transform, chart authoring options and citation outside image crop, generated table pre-wrap. Removed incidental source-serialization chart tests rather than repinning.

Command:
```
npx vitest run shared/tests/editor-control-render-parity.test.js shared/tests/svg-paint-overrides.test.js shared/tests/element-renderers.test.js shared/tests/htmlGenerator.test.js client/src/components/properties/shape-rich-label-editor.test.jsx client/src/hooks/editor-controller/use-editor-rich-text-controller.test.js client/src/components/canvas/element-renderers/chart-element-renderer.test.jsx client/src/components/canvas/element-renderers/svg-element-renderer.test.jsx client/src/components/canvas/canvas-element-wrapper.test.jsx client/src/components/properties/editor-authoring-field-ownership.test.jsx
```
Verbatim output:

 RUN  v5.0.1 C:/Work/worktrees/NavSlidesEditor-education-gemini38-cook-261001

 ❯ |client-jsdom| client/src/components/properties/shape-rich-label-editor.test.jsx (6 tests | 2 failed) 787ms
   ❯ shape rich label document authoring (6)
     × persists an edited document without losing imported marks, blocks, or rendered authority 351ms
     × synchronizes external undo/redo without writes and preserves selection/composition on own echoes 139ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  |client-jsdom| client/src/components/properties/shape-rich-label-editor.test.jsx > shape rich label document authoring > persists an edited document without losing imported marks, blocks, or rendered authority
AssertionError: expected '' to be 'Arial' // Object.is equality

- Expected
+ Received

- Arial

 ❯ client/src/components/properties/shape-rich-label-editor.test.jsx:73:35
     71|     expect(span.style.color).toBe('rgb(18, 52, 86)')
     72|     expect(span.style.fontSize).toBe('24px')
     73|     expect(span.style.fontFamily).toBe('Arial')
       |                                   ^
     74|     expect(span.style.fontWeight).toBe('600')
     75|     expect(document.querySelector('p').style.textAlign).toBe('right')

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  |client-jsdom| client/src/components/properties/shape-rich-label-editor.test.jsx > shape rich label document authoring > synchronizes external undo/redo without writes and preserves selection/composition on own echoes
AssertionError: expected [ { …(2) }, { …(2) } ] to have a length of 1 but got 2

- Expected
+ Received

- 1
+ 2

 ❯ client/src/components/properties/shape-rich-label-editor.test.jsx:116:32
    114|     act(() => app.state().setPresentation({ slides: [{ id: 'slide', el…
    115|     expect(editor.getText()).toContain('Original')
    116|     expect(app.state().writes).toHaveLength(1)
       |                                ^
    117|     act(() => app.state().setPresentation({ slides: [{ id: 'slide', el…
    118|     expect(editor.getText()).toContain('OriXginal')

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯


 Test Files  1 failed | 9 passed (10)
      Tests  2 failed | 170 passed (172)
   Start at  20:43:10
   Duration  11.50s (environment 41%, import 40%, tests 9%, transform 7%, setup 2%, worker 1%)


Tests were authored before production and expected RED recorded: five rich authoring tests absent textbox; four generated parity tests demonstrated lost fields. Current nine other suites GREEN; rich 4/6 GREEN, two failing. No diagnosis or repairs yet. Please inspect installed TipTap behavior and exact failed assertions; separate genuine formatting/data-loss from nested semantic DOM formatting and composition-generated write counts. Recommend conservative scoped repair/verification; do not waive semantic font preservation or undo/redo/selection/composition safety. No Phase02 approval.