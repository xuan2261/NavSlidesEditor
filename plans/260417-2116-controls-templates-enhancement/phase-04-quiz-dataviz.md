# Phase 4: Quiz & Data Visualization Templates

## Context
- Follows same pattern as Phase 3 (HTML embed simulations)
- Targets education/assessment use case
- [built-in-templates.json](file:///d:/NCKH_2025/revealjs_gui/server/data/built-in-templates.json)

## Overview
- Priority: P1
- Status: ✅ Completed
- Thêm 8 templates: 5 quiz types + 3 data visualization dashboards

## Requirements

### 5 Quiz Templates

| # | Template ID | Type | Mô tả |
|---|------------|------|--------|
| 1 | `quiz-multiple-choice` | general | 4 options, click to answer, instant feedback (✅/❌) |
| 2 | `quiz-true-false` | general | Statement list, toggle True/False, show score |
| 3 | `quiz-fill-blank` | general | Text with `___` input fields, check button |
| 4 | `quiz-ordering` | general | Drag items to correct order, validate sequence |
| 5 | `quiz-matching` | general | Match terms to definitions (click pairs) |

### 3 Data Viz Templates

| # | Template ID | Category | Mô tả |
|---|------------|----------|--------|
| 6 | `viz-dashboard` | corporate | 4 KPI numbers + 2 chart embeds (bar + pie) |
| 7 | `viz-trend-report` | academic | Line chart with annotations + summary text |
| 8 | `viz-comparison-chart` | engineering | Side-by-side bar charts + comparison table |

### New Category
```
{ id: 'quiz', name: 'Trắc nghiệm', nameEn: 'Quiz', icon: 'check-circle' }
```

## Architecture

### Quiz HTML Pattern
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, sans-serif; background: transparent; color: white; padding: 16px; }
    .option { padding: 12px 16px; margin: 6px 0; border: 2px solid rgba(255,255,255,0.2); border-radius: 8px; cursor: pointer; transition: all 0.2s; }
    .option:hover { border-color: #6366f1; background: rgba(99,102,241,0.1); }
    .option.correct { border-color: #22c55e; background: rgba(34,197,94,0.15); }
    .option.wrong { border-color: #ef4444; background: rgba(239,68,68,0.15); }
    .feedback { margin-top: 12px; padding: 10px; border-radius: 6px; font-size: 14px; }
  </style>
</head>
<body>
  <h3 style="margin-bottom:16px">Question text here</h3>
  <div id="options"></div>
  <div id="feedback"></div>
  <script>
    // Quiz logic — answer validation, feedback display, score tracking
  </script>
</body>
</html>
```

### Data Viz Pattern
- Uses Chart.js from vendor (already available: `/vendor/chart.js/dist/chart.umd.js`)
- Each viz template has 2-3 slides:
  1. Title + overview
  2. Dashboard/chart slide (html embed with chart.js)
  3. Analysis text slide

## Template Structures

### quiz-multiple-choice (4 slides)
- Slide 1: Title "Bài kiểm tra trắc nghiệm"
- Slide 2: HTML embed — Question 1 (4 options, click to select, instant ✅/❌)
- Slide 3: HTML embed — Question 2 (different question)
- Slide 4: Text — Summary / Instructions for teachers

### quiz-true-false (4 slides)
- Slide 1: Title "Đúng hay Sai?"
- Slide 2: HTML embed — 5 statements with True/False toggle buttons
- Slide 3: HTML embed — Score display + correct answers
- Slide 4: Text — Review & discussion

### quiz-fill-blank (3 slides)
- Slide 1: Title "Điền vào chỗ trống"
- Slide 2: HTML embed — Paragraph with `<input>` blanks, "Check" button
- Slide 3: Text — Answer key + explanations

### quiz-ordering (3 slides)
- Slide 1: Title "Sắp xếp đúng thứ tự"
- Slide 2: HTML embed — Clickable items, number them 1-N, validate
- Slide 3: Text — Correct order + explanation

### quiz-matching (3 slides)
- Slide 1: Title "Nối cột"
- Slide 2: HTML embed — Left column (terms), right column (definitions), click to match
- Slide 3: Text — Answer key

### viz-dashboard (3 slides)
- Slide 1: Title "Dashboard Tổng quan"
- Slide 2: 4 text elements (KPI cards) + 2 html embeds (Chart.js bar + pie)
- Slide 3: Text — Key insights + analysis

### viz-trend-report (3 slides)
- Slide 1: Title "Báo cáo xu hướng"
- Slide 2: HTML embed — Chart.js line chart with annotations
- Slide 3: Text — Trend analysis + recommendations

### viz-comparison-chart (3 slides)
- Slide 1: Title "Phân tích so sánh"
- Slide 2: HTML embed — Side-by-side grouped bar chart
- Slide 3: Table element — Comparison data table

## Related Code Files

### Modify
- `server/data/built-in-templates.json` — Append 8 templates
- `server/routes/marketplace.js` — Add `quiz` category

## Implementation Steps

1. **Add quiz category** to marketplace.js CATEGORIES

2. **Create quiz templates** — each with self-contained HTML + CSS + JS
   - Multiple choice: click handler, answer validation, color feedback
   - True/False: toggle buttons, score counter
   - Fill blank: input validation, string comparison
   - Ordering: click-to-number, sequence validation
   - Matching: two-column click pairing, line drawing between matches

3. **Create data viz templates**
   - Dashboard: load Chart.js from vendor, create 2 charts in one html embed
   - Trend: line chart with gradient fill, annotation plugin simulation
   - Comparison: grouped bar chart, custom legend

4. **Append to built-in-templates.json**
   - Validate JSON after append
   - Test API: GET /api/marketplace/templates?category=quiz

## Todo List

- [x] Add `quiz` category to marketplace.js
- [x] Create quiz-multiple-choice template (4 slides)
- [x] Create quiz-true-false template (4 slides)
- [x] Create quiz-fill-blank template (3 slides)
- [x] Create quiz-ordering template (3 slides)
- [x] Create quiz-matching template (3 slides)
- [x] Create viz-dashboard template (3 slides)
- [x] Create viz-trend-report template (3 slides)
- [x] Create viz-comparison-chart template (3 slides)
- [x] Validate JSON structure
- [x] Test quiz interactions in present mode
- [x] Test chart rendering in present mode
- [x] Build test

## Success Criteria
- ✅ 71 total built-in templates (63 + 8)
- ✅ All 5 quiz types interactive with feedback
- ✅ All 3 data viz templates render charts correctly
- ✅ Quiz templates work offline (no external deps)
- ✅ Data viz uses vendor Chart.js (already bundled)
