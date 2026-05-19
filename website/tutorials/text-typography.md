# Text & Typography

This tutorial covers the text tools: inserting text boxes, formatting, inline math, and text paths.

## Inserting a text box

1. Click the **Text** button in the toolbar (or press `T`).
2. A text element appears on the slide. Double-click it to start typing.
3. Press `Escape` when you're done editing.

## Formatting text

With text selected inside a text box, use the toolbar to:

- **Bold** / **Italic** / **Underline** / **Strikethrough**
- **Font family** — choose from 30+ built-in fonts (Barlow, Inter, Playfair Display, Computer Modern, etc.)
- **Font size** — type a custom size or pick from the dropdown
- **Text color** — click the color swatch to open the picker
- **Alignment** — left, center, or right
- **Lists** — ordered or unordered

::: tip
You can mix fonts, sizes, and colors within the same text box by selecting individual words and applying different styles.
:::

## Inline math

You can insert LaTeX math expressions directly inside running text.

1. Double-click a text box to enter edit mode.
2. Type a LaTeX expression between dollar signs: `$E = mc^2$`
3. Press `Space` after the closing `$` — the expression renders inline.
4. To edit the math, click on the rendered expression. A math editor appears in the right panel.

### Example output

<div style="border: 1px solid #333; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <iframe src="/revealjs_gui/demos/inline-math.html" style="width:100%;height:140px;border:none"></iframe>
</div>

## Text on a path

Text Path lets you place text along a curved line.

1. Click the **Text Path** button in the toolbar (the curved-T icon).
2. A text path element appears with default text on a sine wave.
3. Double-click to edit the text content.
4. In the right panel, adjust the **path type** (wave, arc, circle) and **amplitude**.
