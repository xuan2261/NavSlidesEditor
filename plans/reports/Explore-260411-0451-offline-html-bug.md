# Offline HTML Export Bug Investigation Report

## Status: MULTIPLE CRITICAL ISSUES FOUND

The offline export feature has **at least 3 distinct bugs** preventing html-type elements from rendering:

---

## 1. **htmlGenerator.js: Incomplete HTML encoding for html element** (CRITICAL)

**File**: `shared/src/htmlGenerator.js`, lines 95-97

**Current code**:

```javascript
if (el.type === 'html') {
  const srcdoc = (el.content || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  return `<iframe${fragClass}${fragIdx} srcdoc="${srcdoc}" ...`
}
```

**Problem**: Only encodes `&` and `"`, but MISSING encoding of `<` and `>`:

- When `el.content = "<script>alert('hi')</script>"`, this becomes raw HTML inside srcdoc
- Browser interprets `<script>` as a literal script tag, not escaped text
- **This prevents the HTML element from rendering at all** - browser treats literal tags as structure

**Comparison** - markdown and chart elements DO encode properly:

- Line 110-111 (markdown): `srcdoc.replace(/&/g, '&amp;').replace(/"/g, '&quot;')` → SAME BUG!
- But markdown wraps in `<!doctype html>...` (full document), so browser quirks mode helps
- Line 133 (chart): SAME incomplete encoding - `chartSrc.replace(/&/g, '&amp;').replace(/"/g, '&quot;')`

**Root cause**: Incomplete encoding applied uniformly across element types

---

## 2. **offlineExport.js: Re-encoding step missing `<` and `>`** (CRITICAL)

**File**: `client/src/utils/offlineExport.js`, lines 176-179

**Current code**:

```javascript
if (changed) {
  // Re-encode back to HTML entities for srcdoc attribute
  const encoded = inner.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  replacements.push({ from: srcdocMatch[0], to: `srcdoc="${encoded}"` })
}
```

**Problem**: When offlineExport processes srcdoc:

1. It decodes: `&lt;`, `&gt;`, `&amp;`, `&quot;` to `<`, `>`, `&`, `"`
2. It modifies inner HTML (inlines scripts, adds styles, etc.)
3. It RE-ENCODES, but ONLY does `&` → `&amp;` and `"` → `&quot;`
4. **Missing**: Does NOT re-encode `<` → `&lt;` and `>` → `&gt;`

**Flow example**:

```
htmlGenerator creates:  srcdoc="&lt;script&gt;...&lt;/script&gt;"
offlineExport decodes:  srcdoc contains literal <script>...</script>
offlineExport inlines:  srcdoc contains <script>inlined_d3</script> + original content
offlineExport re-encodes: srcdoc="<script>inlined_d3</script>..." ← WRONG! < and > not escaped
Browser reads:         Sees literal <script> tag as HTML, not escaped content
Result:                No output (or incorrect rendering)
```

**Why this breaks html elements specifically**: The inlining step adds literal `<script>`, `<style>` tags. Without proper re-encoding, these become HTML structure instead of escaped srcdoc content.

---

## 3. **htmlGenerator.js: html element missing `<!doctype html>` wrapper** (MODERATE)

**File**: `shared/src/htmlGenerator.js`, lines 95-97

**Problem**: Compare to markdown (line 110) and chart (line 132):

- Both include `<!doctype html><html><head>...` wrapper
- Both include CSS reset: `<style>*{margin:0;padding:0}...`
- html element type uses **RAW USER CONTENT** with no wrapper

**Impact**:

- Browser quirks mode issues (no doctype = older rendering)
- No CSS normalization for iframe
- Potential font/styling inheritance problems
- D3 visualizations may render but with layout issues

**Not fixing this**: If raw HTML is user-provided (like D3 with `<svg>`), a full doctype wrapper could break it. But should document this limitation.

---

## 4. **Regex srcdoc pattern handles multiline content correctly** ✓

**File**: `client/src/utils/offlineExport.js`, line 90

```javascript
const srcdocRegex = /srcdoc="([^"]*)"/g
```

**Status**: WORKING as expected

- Pattern correctly captures content between `srcdoc="..."`
- Newlines are captured correctly
- No issues here

---

## 5. **Script tag regex fixes already applied** ✓

**File**: `client/src/utils/offlineExport.js`, lines 122, 133

Lines correctly use `><\/script>` NOT `><\?\/script>` (FIXED in commit a7d4c5c1)

---

## Summary Table

| Issue                         | Location                   | Severity | Impact                          | Fix Required                      |
| ----------------------------- | -------------------------- | -------- | ------------------------------- | --------------------------------- |
| Incomplete encoding (initial) | `htmlGenerator.js:96`      | CRITICAL | Raw `<>` in html elements       | Add `&lt;`/`&gt;` encoding        |
| Incomplete re-encoding        | `offlineExport.js:178`     | CRITICAL | Modified content not re-encoded | Add `&lt;`/`&gt;` re-encoding     |
| Missing doctype wrapper       | `htmlGenerator.js:95-97`   | MODERATE | Quirks mode, styling issues     | Optional: add wrapper (breaking?) |
| ~~Script close tag bug~~      | `offlineExport.js:122,133` | FIXED    | Already fixed                   | ✓ Resolved                        |

---

## Why Markdown/Chart Elements Sometimes Work

- Both wrap content in full `<!doctype html>...` structure
- Even with incomplete encoding, browser can parse if doctype is present
- CSS reset and proper structure provides fallback rendering
- But technically they have the SAME encoding bug (just masked)

---

## Recommended Fix Order

1. **Fix offlineExport.js line 178**: Add `&lt;` and `&gt;` re-encoding (CRITICAL)

   ```javascript
   const encoded = inner
     .replace(/&/g, '&amp;')
     .replace(/</g, '&lt;')
     .replace(/>/g, '&gt;')
     .replace(/"/g, '&quot;')
   ```

2. **Fix htmlGenerator.js line 96**: Add complete encoding (CRITICAL)

   ```javascript
   const srcdoc = (el.content || '')
     .replace(/&/g, '&amp;')
     .replace(/</g, '&lt;')
     .replace(/>/g, '&gt;')
     .replace(/"/g, '&quot;')
   ```

3. **Also fix markdown/chart encoding** (CRITICAL) - same root cause
   - Line 111: markdown encoding incomplete
   - Line 133: chart encoding incomplete

4. **Optional**: Consider adding doctype wrapper for html elements if safe
   - Need to test if raw D3 visualizations break with wrapper
   - May need user option to control this

---

## Test Plan

After fixes:

1. Export offline HTML with html element containing `<script src="..."></script>`
2. Verify srcdoc attribute contains `&lt;script` (not `<script`)
3. Test D3 visualization renders in offline export
4. Test with raw SVG content (ensure no double-wrapping breaks it)
