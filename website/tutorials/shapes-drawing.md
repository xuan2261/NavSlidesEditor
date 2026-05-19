# Shapes & Drawing

This tutorial covers shape elements, freehand drawing, non-objective compositions, and modular grids.

## Inserting shapes

1. Click the **Shapes** dropdown in the toolbar.
2. Choose from: **Rectangle**, **Rounded Rectangle**, **Circle**, **Triangle**, **Diamond**, **Arrow**, **Star**, or **Line**.
3. The shape appears on the slide. Drag to reposition, drag handles to resize.

## Shape properties

Select a shape to configure in the right panel:

- **Fill** — color picker, or "none" for transparent
- **Stroke** — border color and width
- **Opacity** — 0 (transparent) to 1 (fully opaque)
- **Text** — add a label inside the shape
- **Round Corners** — border radius for rectangles

### Example output

<div style="border: 1px solid #333; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <iframe src="/revealjs_gui/demos/shapes.html" style="width:100%;height:140px;border:none"></iframe>
</div>

## Freehand drawing

1. Click the **Pencil** icon in the toolbar to enter draw mode.
2. Choose a color and stroke width from the drawing toolbar.
3. Draw directly on the slide canvas.
4. Click the pencil icon again (or press `Escape`) to exit draw mode.

Drawn strokes are SVG elements that can be selected, moved, and deleted like any other element.

## Non-objective compositions

Inspired by Bauhaus and De Stijl, these insert randomized geometric compositions.

1. Click **Shapes** > **Non-objective** in the toolbar.
2. A composition of overlapping geometric forms appears.
3. Each shape can be individually selected and edited.

## Modular grid

Creates a grid of identical shapes as a structural framework.

1. Click **Shapes** > **Modular Grid**.
2. Configure the number of columns, rows, gap size, and shape type.
3. Click **Apply** — a grid of shapes fills the slide.
4. Assign content to individual cells as needed.
