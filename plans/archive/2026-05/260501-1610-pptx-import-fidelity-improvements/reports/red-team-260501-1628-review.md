# Red-Team Review: PPTX Import Fidelity Improvements Plan

Reviewer: adversarial reviewer
Date: 2026-05-01
Files reviewed: plan.md, phase-01, phase-02, phase-03; source files: fidelity-tester.js, mapper.js

---

## Summary

Plan correctly identifies two real bugs and one real architectural issue. Phase 1 fixes are sound. Phase 2 has a critical logic gap. Phase 3 unit detection is fragile on boundary values. Several edge cases are unaddressed.

---

## Phase 1: Fix Fidelity Tester Bugs

### Finding 1: Bug 1 (preserved-objectFit): Correct
**Severity**: Minor
**Location**: fidelity-tester.js:552

Code at line 552 fires when objectFit IS present, reporting it as a gap. Plan correctly identifies this as cosmetic-only (score unchanged). Removing the line is the right fix.

**Verdict**: Correct as stated.

---

### Finding 2: Bug 2 (math type): Partially Correct, Missing Case
**Severity**: Important
**Location**: mapper.js:457-496, fidelity-tester.js:533-604

**What the plan gets right**: Adding a math handler in mapElement that converts to image via picBase64 is the right approach. Score 1.0 for rasterized math is defensible.

**What the plan misses**: The math handler fallback (no picBase64) calls placeholder() directly, returning a nav element with type: shape and importPlaceholderType: math. When evaluateCapture runs, type is normalizeSemanticType(pptxEl.type) which is math. This is NOT handled by the named type branches (text, image, table, chart, group), so it falls through to the shape/diagram/line/other block at line 584. The plan adds step 3 checking type === other but this condition will NEVER match a math element because type is math, not other.

**Suggested fix**: In the fallback block at line 584, add || type === math to the condition and check navEl.importPlaceholderType === math:
```javascript
if (type === "shape" || type === "diagram" || type === "line" || type === "other" || type === "math") {
  if (navEl.importPlaceholderType === "math") return { score: 0.8, gaps: ["math-rasterized"] }
  // ... existing shape scoring
}
```

**Verdict**: Partial. The mapper fix (step 2) is correct. Step 3 addresses the wrong type variable.

---

### Finding 3: math handler - Persistence failure unaddressed
**Severity**: Minor
**Location**: mapper.js:64-72 (proposed)

If element.picBase64 exists but persistImageForElement returns falsy (disk full, permission error), mapImage returns a placeholder with importPlaceholderType: math. Fidelity score is 0.1. The plan does not mention this degradation path. Acceptable to leave as-is.

**Verdict**: Acceptable as-is. Not a blocker.

---

### Finding 4: Spurious dead code in fidelity-tester.js
**Severity**: Minor
**Location**: fidelity-tester.js:200-203, fidelity-tester.js:639-642

Lines 200-203 (if s === line through return rect) are unreachable dead code inside imageSource() after its return at line 101. Variables s, n, img are undefined here. Similarly lines 639-642 after return allowed[src]?.has(dst) || false are dead. Not in plan scope but worth noting for cleanup.

**Verdict**: Not a plan bug, but flag for cleanup.

## Phase 2: Fix Group Geometry Measurement

### Finding 5: Groups still counted in category totals
**Severity**: Critical
**Location**: fidelity-tester.js:234-251 (computeSemanticFidelity)

The plan adds flattenForFidelity to recurse into group children during iteration. This correctly expands source elements for matching. However, categoryScores[group].total is still incremented for each group element (line 237: categoryScores[cat].total += 1). After flattening, each group contributes 1 to the group total but 0 to captured (no nav group to match), producing artificially low group coverage.

The plan Step 4 (Remove group from semanticTypePreferences) does NOT prevent the category total from being incremented. The case group: return [group] removal is cosmetic because without it, default: return [type] still returns [group].

**Concrete example**: Slide with 3 groups (10 children total). computeSemanticFidelity iterates ppts (raw pptxtojson elements), NOT the flattened list. It sees 3 groups, increments group total to 3, and since no nav groups exist (flattened), captured stays 0. Result: 0% group coverage. This is the same problem the plan claims to fix.

**Suggested fix**: Either (a) filter groups out of ppts before the loop, or (b) skip incrementing categoryScores[cat].total when type === group:
```javascript
if (type === "group") {
  // Groups are expanded to children; do not count the container
  for (const child of (pptxEl.elements || [])) {
    // ... recursively process children into categoryScores
  }
  continue
}
categoryScores[cat].total += 1
```

**Verdict**: The plan fix does not actually solve the counting problem.

---

### Finding 6: findMatchingNavElement has no fallback for expanded children exceeding nav elements
**Severity**: Important
**Location**: fidelity-tester.js:481-531

After flattening, source element count increases (group containers replaced by children). If a slide has 5 groups with 20 children but only 15 nav elements, the last 5 children fail to match regardless of correctness. The plan does not address this element-count imbalance.

This is a fundamental limitation of the 1-to-1 greedy matching algorithm. The plan statement The actual group CHILDREN positions are computed correctly is likely true, but the fidelity measurement will under-report due to the matching algorithm running out of nav candidates.

**Suggested fix**: Document this limitation. Consider whether a many-to-one or scoring-based matching would be more appropriate for group-heavy slides. Accept that group-rich slides will show lower-than-expected coverage.

**Verdict**: Acknowledged as a risk but not addressed. The success criterion <10px max drift may not be achievable on group-heavy slides.

---

### Finding 7: Phase dependency P2 blocks on P1: Not justified
**Severity**: Minor
**Location**: phase-02, dependencies: [1]

P2 measures the output of the import pipeline. P1 fixes the math handler in mapElement. P2 flattenForFidelity operates on group elements regardless of math handling. There is no technical dependency.

**Suggested fix**: Remove dependencies: [1] from Phase 2. Run P1 and P2 in parallel or P2 first.

**Verdict**: Spurious dependency.

## Phase 3: Harden Image Property Mapping

### Finding 8: Unit detection: boundary at maxVal === 1.0 is ambiguous
**Severity**: Important
**Location**: mapper.js:258-275 (proposed replacement)

The proposed unit detection uses maxVal > 100 for per-mille, maxVal > 1 for percentage. If maxVal === 1.0 exactly (e.g., rect = {l:0, r:1, t:0, b:0} meaning crop right 100%), the code falls through to the fraction branch with no division. This is accidentally numerically correct but semantically ambiguous. The intent is unclear to future maintainers.

More concerning: if maxVal is 1.5 (percentage, meaning 150% -- invalid), it falls into the percentage branch and divides by 100.

**Suggested fix**: Use >= for the percentage check:
```javascript
if (maxVal > 100) { /* per-mille */ }
else if (maxVal >= 1) { /* percentage: values in [1, 100] */ }
else { /* fraction: values in [0, 1) */ }
```
Also add explicit check for maxVal === 0 to handle the no crop case clearly.

**Verdict**: Functionally works for real pptxtojson data but edge cases exist.

---

### Finding 9: Unit detection: all-zero crops silently treated as fractions
**Severity**: Minor
**Location**: mapper.js:258-275 (proposed)

If rect = {l:0, r:0, t:0, b:0}, maxVal = 0, falls to fraction branch. This means no crop treated as a valid fraction. Correct output but ambiguous intent. The fidelity metric stores cropData: {left:0, right:0, top:0, bottom:0} indistinguishable from a properly detected no crop case.

**Verdict**: Acceptable as-is.

---

### Finding 10: borderType and borderStrokeDasharray field names unverified
**Severity**: Important
**Location**: phase-03:85-94 (proposed additions)

The plan adds:
```javascript
if (element.borderType) img.borderStyle = element.borderType
if (element.borderStrokeDasharray) img.borderDashArray = element.borderStrokeDasharray
```

These field names (borderStyle, borderDashArray) are assumed to exist in the NavSlides image schema. The plan does not verify this against the actual schema or renderer code. If the renderer ignores these fields on images, the additions do nothing.

**Suggested fix**: Before implementing, verify in the client renderer that borderStyle and borderDashArray are respected for image elements. If not, the mapping is pointless.

**Verdict**: Plan assumes schema compatibility without verification.

---

### Finding 11: Phase dependency P3 blocks on P1: Not justified
**Severity**: Minor
**Location**: phase-03, dependencies: [1]

P3 modifies mapImage to fix rect crop detection and add border mappings. P1 adds a math handler that also calls mapImage. But P1 and P3 changes to mapImage are in different code blocks (P1 adds a new call site, P3 modifies the rect and border sections). No merge conflict risk or functional dependency.

**Suggested fix**: Remove dependencies: [1] from Phase 3.

**Verdict**: Spurious dependency.

---

## Unresolved Questions

1. Does the NavSlides schema/renderer actually use borderStyle and borderDashArray on image elements? (Finding 10)
2. Does flattenForFidelity need to handle the case where group children exceed available nav elements? (Finding 6)
3. What is the intended score for a math element with no picBase64 and failed persist -- 0.1 or higher? (Finding 3)

---

## Overall Assessment

Phase 2 is the weakest link. The plan correctly diagnoses the problem but the proposed fix (flatten + remove semanticTypePreferences entry) does not prevent group elements from polluting category totals. The fix needs to explicitly exclude or handle groups from the counting loop.

| Phase | Correctness | Completeness | Risk |
|-------|------------|--------------|------|
| P1 Bug 1 | Correct | Complete | Low |
| P1 Bug 2 | Partial | Missing math-in-fallback-path case | Medium |
| P2 | Incomplete | Groups still counted in totals; element overflow unhandled | High |
| P3 unit detection | Mostly correct | Boundary at 1.0 ambiguous; field names unverified | Medium |