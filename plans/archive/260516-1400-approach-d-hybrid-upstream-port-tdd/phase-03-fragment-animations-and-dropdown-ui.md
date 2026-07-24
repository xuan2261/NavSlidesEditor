# Phase 3: Fragment Animations + Animation Dropdown UI

**Priority:** P1
**Status:** pending
**Effort:** 6-8h
**Upstream Commit:** `8050b08a`

---

## Context Links

- [Predict Report](predict-report-5-expert-personas-debate.md) — Persona 3: grouped dropdown, not flat list
- [Brainstorm Report](../260516-1200-upstream-v2-comprehensive-port-brainstorm/upstream-v2-port-audit-and-brainstorm-report.md) — Section 3.3

## Overview

**TDD: Write tests for new animation types FIRST, then implement.**

Add 11 new fragment animation types (strike, slide-up/down/left/right, flip-up/down, semi-fade-out, highlight-current-*) and reorganize the animation dropdown into grouped categories per Persona 3 recommendation.

## TDD Approach

### RED Phase: Write failing tests
1. Create `shared/tests/fragment-animations.test.js`
2. Test that `generateRevealHTML()` outputs CSS for each new animation type
3. Test that `AnimationTimeline.jsx` exports all 24 animation types
4. Run tests — FAIL (new types don't exist yet)

### GREEN Phase: Implement
5. Add new types to `AnimationTimeline.jsx`
6. Add CSS rules to `htmlGenerator.js`
7. Update properties panel dropdown with `<optgroup>` categories
8. Run tests — PASS

## Test File: `shared/tests/fragment-animations.test.js`

```js
describe('fragment animation types', () => {
  const ANIMATION_TYPES = [
    'fade-in', 'fade-out', 'fade-up', 'fade-down', 'fade-left', 'fade-right',
    'grow', 'shrink', 'zoom-in',
    'slide-up', 'slide-down', 'slide-left', 'slide-right',
    'flip-up', 'flip-down',
    'highlight-red', 'highlight-green', 'highlight-blue',
    'highlight-current-red', 'highlight-current-green', 'highlight-current-blue',
    'strike', 'semi-fade-out'
  ]

  test.each(ANIMATION_TYPES)('CSS rule exists for fragment.%s', (type) => {
    const html = generateRevealHTML(fixturePresentation)
    expect(html).toMatch(new RegExp(`\\.fragment\\.${type}`))
  })

  test('slide-up has transform and transition', () => {
    const html = generateRevealHTML(fixturePresentation)
    expect(html).toMatch(/\.fragment\.slide-up\s*\{[^}]*transform/)
    expect(html).toMatch(/\.fragment\.slide-up\.visible/)
  })

  test('strike has text-decoration', () => {
    const html = generateRevealHTML(fixturePresentation)
    expect(html).toMatch(/\.fragment\.strike\s*\{[^}]*text-decoration:\s*line-through/)
  })

  test('semi-fade-out has opacity 0.5 on visible', () => {
    const html = generateRevealHTML(fixturePresentation)
    expect(html).toMatch(/\.fragment\.semi-fade-out\.visible\s*\{[^}]*opacity:\s*0\.5/)
  })
})
```

## Implementation Steps

### Step 1: Write test file (RED)
Create `shared/tests/fragment-animations.test.js`. Run — all FAIL.

### Step 2: Add animation types to AnimationTimeline.jsx
Expand `ANIMATION_TYPES` array from 12 to 23 entries, organized by group:
```js
const ANIMATION_TYPES = [
  // Fade
  { value: 'fade-in', label: 'Fade In', group: 'Fade' },
  { value: 'fade-out', label: 'Fade Out', group: 'Fade' },
  { value: 'fade-up', label: 'Fade Up', group: 'Fade' },
  { value: 'fade-down', label: 'Fade Down', group: 'Fade' },
  { value: 'fade-left', label: 'Fade Left', group: 'Fade' },
  { value: 'fade-right', label: 'Fade Right', group: 'Fade' },
  { value: 'semi-fade-out', label: 'Semi Fade Out', group: 'Fade' },
  // Scale
  { value: 'grow', label: 'Grow', group: 'Scale' },
  { value: 'shrink', label: 'Shrink', group: 'Scale' },
  { value: 'zoom-in', label: 'Zoom In', group: 'Scale' },
  // Slide
  { value: 'slide-up', label: 'Slide Up', group: 'Slide' },
  { value: 'slide-down', label: 'Slide Down', group: 'Slide' },
  { value: 'slide-left', label: 'Slide Left', group: 'Slide' },
  { value: 'slide-right', label: 'Slide Right', group: 'Slide' },
  // Flip
  { value: 'flip-up', label: 'Flip Up', group: 'Flip' },
  { value: 'flip-down', label: 'Flip Down', group: 'Flip' },
  // Highlight
  { value: 'highlight-red', label: 'Highlight Red', group: 'Highlight' },
  { value: 'highlight-green', label: 'Highlight Green', group: 'Highlight' },
  { value: 'highlight-blue', label: 'Highlight Blue', group: 'Highlight' },
  { value: 'highlight-current-red', label: 'Current Red', group: 'Highlight' },
  { value: 'highlight-current-green', label: 'Current Green', group: 'Highlight' },
  { value: 'highlight-current-blue', label: 'Current Blue', group: 'Highlight' },
  // Other
  { value: 'strike', label: 'Strike', group: 'Other' },
]
```

### Step 3: Add CSS rules to htmlGenerator.js
Add fragment animation CSS after the fragment visibility rule:
```css
/* Slide fragments */
.fragment.slide-up { transform: translateY(100%); opacity: 0; }
.fragment.slide-up.visible { transform: translateY(0); opacity: 1; transition: all 0.5s ease; }
.fragment.slide-down { transform: translateY(-100%); opacity: 0; }
.fragment.slide-down.visible { transform: translateY(0); opacity: 1; transition: all 0.5s ease; }
.fragment.slide-left { transform: translateX(100%); opacity: 0; }
.fragment.slide-left.visible { transform: translateX(0); opacity: 1; transition: all 0.5s ease; }
.fragment.slide-right { transform: translateX(-100%); opacity: 0; }
.fragment.slide-right.visible { transform: translateX(0); opacity: 1; transition: all 0.5s ease; }
/* Flip fragments */
.fragment.flip-up { transform: rotateX(90deg); opacity: 0; }
.fragment.flip-up.visible { transform: rotateX(0); opacity: 1; transition: all 0.5s ease; }
.fragment.flip-down { transform: rotateX(-90deg); opacity: 0; }
.fragment.flip-down.visible { transform: rotateX(0); opacity: 1; transition: all 0.5s ease; }
/* Strike */
.fragment.strike { text-decoration: line-through; opacity: 0; }
.fragment.strike.visible { text-decoration: line-through; opacity: 1; transition: all 0.5s ease; }
/* Semi fade */
.fragment.semi-fade-out.visible { opacity: 0.5; }
/* Highlight current */
.fragment.highlight-current-red.visible { background-color: red; }
.fragment.highlight-current-green.visible { background-color: green; }
.fragment.highlight-current-blue.visible { background-color: blue; }
```

### Step 4: Update properties panel dropdown
Find the animation dropdown (likely in `common-element-controls.jsx` or `properties/` files) and reorganize with `<optgroup>`:
```jsx
<select value={element.fragmentAnimation || ''} onChange={...}>
  <option value="">None</option>
  {Object.entries(groupedAnimations).map(([group, types]) => (
    <optgroup key={group} label={group}>
      {types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
    </optgroup>
  ))}
</select>
```

### Step 5: Update CSS snapshot
```bash
npx vitest run shared/tests/html-generator-css.test.js --update
```

### Step 6: Run all tests
```bash
npx vitest run shared/tests/fragment-animations.test.js
npx vitest run shared/tests/html-generator-css.test.js
npm run test
```

## Todo List

- [ ] Create `shared/tests/fragment-animations.test.js` (RED)
- [ ] Verify tests FAIL for new animation types
- [ ] Add 11 new types to `AnimationTimeline.jsx` ANIMATION_TYPES
- [ ] Add fragment CSS rules to `htmlGenerator.js`
- [ ] Update properties panel dropdown with `<optgroup>` categories
- [ ] Update CSS snapshot (GREEN)
- [ ] Verify all fragment animation tests PASS
- [ ] Run `npm run test` — all pass
- [ ] Manual: each new animation type works in present mode

## Success Criteria

- 23 animation types available in dropdown (grouped by category)
- CSS rules for all new fragment types in generated HTML
- Existing animations still work
- All tests pass
- Dropdown organized with `<optgroup>` labels

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| New CSS conflicts with reveal.js built-in fragments | Use high-specificity `.fragment.X.visible` pattern |
| Dropdown change breaks existing animation assignments | Keep all old values in array |
| Fragment CSS bloats generated HTML | Only ~15 new rules, minimal impact |
