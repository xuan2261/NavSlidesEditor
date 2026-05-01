---
phase: 4
title: "Chart Data Import + Multi-Series Editor"
status: complete
priority: P1
effort: "3-4 days"
dependencies: [phase-00-sanitizer-hardening, phase-01-rich-html-preservation]
---

# Phase 4: Chart Data Import + Multi-Series Editor

## Overview

Import chart data from PPTX and render as editable Chart.js component. **Scope corrected from plan review:** chart properties panel only edits `datasets[0]`. Multi-series editing requires panel rewrite.

## Context Links

- Review finding: `plans/reports/debug-260425-1102-pptx-full-fidelity-plan-review.md` — P1-C Chart scope underestimated
- Existing ChartRenderer: `client/src/components/SlideCanvas.jsx:2075-2120` (Chart.js iframe)
- Existing chart properties: `client/src/components/properties/chart-properties.jsx`
- Existing chart export: `client/src/utils/export-pptx-core.js#getNativeChartDefinition()`
- Existing isNativeChartType: `client/src/utils/export-pptx-core.js:isNativeChartType()`
- Schema: `client/src/data/element-defaults.js` — chart defaults
- pptxtojson schema: `plans/reports/researcher-260425-0946-pptxtojson-schema.md` §5e

## Requirements

**Chart type mapping** (pptxtojson → NavSlides):
```
pptxtojson.chartType          → NavSlides chartType
lineChart, line3DChart        → 'line'
barChart, bar3DChart          → 'bar'        (barDir determines bar/col)
pieChart, pie3DChart          → 'pie'
doughnutChart                 → 'doughnut'
radarChart                     → 'radar'
areaChart, area3DChart        → 'bar'        (approximate — no native area)
scatterChart                  → 'line'        (x-values as labels)
bubbleChart                   → 'bar'        (approximate — no native bubble)
stockChart                    → 'line'       (approximate)
surfaceChart, surface3DChart  → 'bar'        (approximate)
→ fallback: 'bar'
```

**Import:**
- Parse chart data from pptxtojson output
- Map data series: `ChartItem[]` → `chartData.datasets[]`
- Extract labels, colors, chart type
- Store `_pptxChartMeta` sidecar with original pptxtojson chart data for fidelity

**Multi-series editing (NEW — from review):**
- Rewrite chart-properties panel to support unlimited series
- Add/remove series
- Edit per-series: label, data values, color
- Edit chart type switching

**Export:**
- `getNativeChartDefinition()` already exists — verify it handles multi-dataset charts
- Test round-trip: bar chart import → edit → export → re-import data matches

## Architecture

**Chart element schema** (existing — no change needed):
```js
{ type: 'chart', chartType: 'bar', chartData: { labels, datasets: [{ label, data, color }] } }
```

**pptxtojson → NavSlides data transform:**
```js
// CommonChart: multiple series
{
  chartData: {
    labels: data[0].values.map(v => v.x || labels[idx]),
    datasets: data.map((series, i) => ({
      label: series.key || `Series ${i + 1}`,
      data: series.values.map(v => v.y),
      color: colors[i] || DEFAULT_COLORS[i],
    }))
  }
}

// ScatterChart: x/y pairs
{
  chartData: {
    labels: xValues,  // x-axis as labels
    datasets: [{ label: 'Series 1', data: yValues, color: colors[0] }]
  }
}
```

## Related Code Files

**Create:**
- `server/services/pptx-import/chart-mapper.js` — pptxtojson → NavSlides chart schema

**Modify:**
- `server/services/pptx-import/mapper.js` — add `if (element.type === 'chart') return [mapChart(element)]`
- `client/src/components/properties/chart-properties.jsx` — full rewrite for multi-series editing
- `client/src/utils/export-pptx-core.js` — verify multi-dataset handling in `getNativeChartDefinition()`
- `server/services/pptx-import/mapper.test.js` — chart import tests

## Implementation Steps

1. **Create `chart-mapper.js`**
   - `mapChartType(pptxType: string): navslides chartType`
   - `mapChartData(chartElement): { labels, datasets }`
   - For common charts: transform `data[]` (ChartItem[]) to datasets array
   - For scatter: extract x/y arrays
   - For bubble: approximate with scatter + size data
   - Handle `colors[]` → dataset `color` field
   - Handle `barDir` for bar charts (bar vs column)
   - Handle `holeSize` for doughnut
   - Handle `marker` for line charts
   - Add `_pptxChartMeta` sidecar: store original pptxtojson data for reference

2. **Update `mapper.js` — chart element handling**
   - Add `mapChart(element)` function returning `[chartElement]`
   - Call from `mapElement()`: `if (element.type === 'chart') return [mapChart(element)]`
   - Track chart element stats

3. **Rewrite chart properties panel (`chart-properties.jsx`)**
   - **Series list:** render all datasets, not just `datasets[0]`
   - **Add series:** button to add new dataset with default values
   - **Remove series:** button to delete dataset
   - **Per-series editing:**
     - Series label input
     - Values textarea (comma-separated)
     - Color picker
   - **Chart type:** switch between bar/line/pie/doughnut/radar/polarArea
   - **Labels:** comma-separated input
   - **Maintain backward compat:** if `datasets` has only 1 item, works as before

4. **Verify chart export (`export-pptx-core.js`)**
   - `getNativeChartDefinition()` handles multiple datasets — verify
   - Test: multi-series bar chart → export → PPTX contains all series
   - If `getNativeChartDefinition()` only handles first dataset, fix it

5. **Add tests in `mapper.test.js`**
   - Test bar chart → correct labels, multiple datasets, colors
   - Test pie chart → single dataset, correct data
   - Test line chart → correct structure
   - Test multi-series → all datasets in array
   - Test unsupported type → fallback to 'bar'
   - Test scatter → approximate as line
   - Test round-trip: import → export → re-import → data values match (within float tolerance)
   - Test chart element renders in SlideCanvas

## Success Criteria

- [ ] Bar chart from PPTX → renders as Chart.js bar in editor
- [ ] Multi-series bar chart → all series visible and editable
- [ ] Pie/doughnut/line/radar charts → render correctly
- [ ] Add series → new dataset appears in chart and properties panel
- [ ] Remove series → dataset removed from chart and panel
- [ ] Edit series values → chart updates in real-time
- [ ] Edit series color → chart updates
- [ ] Export PPTX → chart data preserved (all series)
- [ ] Round-trip fidelity: data values match within 0.01 float tolerance

## Risk Assessment

**Risk:** Chart rendering via Chart.js iframe ≠ PowerPoint visual.
**Mitigation:** Acknowledge and document. Data fidelity (exact values) is the goal, not pixel-perfect rendering.
**Risk:** Chart.js does not support all chart types pptxtojson can parse.
**Mitigation:** Fallback to 'bar' for unsupported types. Store original data in `_pptxChartMeta` for reference.
