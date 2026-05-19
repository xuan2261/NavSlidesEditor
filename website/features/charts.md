# Charts

NavSlides Editor includes a built-in chart editor powered by [Chart.js](https://www.chartjs.org/), letting you create data visualizations directly on your slides without any external tools.

## Inserting a chart

1. Right-click on the slide canvas and choose **Insert → Chart**.
2. A chart dialog opens. Select the chart type:
   - **Bar** — vertical or horizontal bar chart
   - **Line** — line chart with optional fill
   - **Scatter** — X/Y scatter plot with optional trend line
3. Click **Create**. A default chart is placed on the slide with sample data.

## Editing chart data

Double-click the chart element to open the **chart data editor**:

- The editor shows a spreadsheet-style grid with columns for labels and data series.
- Click any cell to edit the value.
- Add rows with the **+ Row** button; add series with **+ Series**.
- Delete rows or series with the trash icon.
- Changes are reflected in the live chart preview above the grid.

## Chart styling

With the chart selected, the right panel exposes styling options:

| Option | Description |
|---|---|
| Chart title | Optional title shown above the chart |
| Legend | Toggle on/off; position (top, bottom, left, right) |
| Colors | Set a color for each data series |
| Bar/line width | Stroke width for line charts |
| Fill | Fill area under line charts |
| Grid lines | Toggle X and Y grid lines |
| Axis labels | Custom labels for X and Y axes |
| Font size | Global font size for labels and title |

## Resizing and positioning

Resize and move the chart element like any other element — drag to reposition, drag corners to scale.

::: tip
For publication-quality charts, consider exporting your data visualization from a dedicated tool (matplotlib, R ggplot2) and inserting it as an image. The built-in chart editor is best for quick, editable in-slide charts.
:::

## Example data format

If you paste data from a spreadsheet, use tab-separated values:

```
Label   Series 1   Series 2
Q1      42         35
Q2      58         47
Q3      63         52
Q4      71         60
```

Paste this directly into the data grid, and NavSlides Editor will parse the labels and series automatically.
