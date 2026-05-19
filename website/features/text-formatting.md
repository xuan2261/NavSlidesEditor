# Text & Formatting

NavSlides Editor uses [TipTap](https://tiptap.dev/) as its rich text engine, giving you full control over typography directly on the slide canvas.

## Activating the text editor

Double-click any text element to enter editing mode. A **formatting toolbar** appears above or below the element with all available options.

::: tip
You can also single-click a text element to select it, then press `Enter` to start editing.
:::

## Headings

Use the heading dropdown in the toolbar to set the level:

- **Heading 1** — large title text
- **Heading 2** — subtitle / section heading
- **Heading 3** — sub-section
- **Paragraph** — normal body text

## Inline styles

| Style | Toolbar button | Shortcut |
|---|---|---|
| Bold | **B** | `Ctrl+B` |
| Italic | *I* | `Ctrl+I` |
| Underline | U&#x0332; | `Ctrl+U` |
| Strikethrough | ~~S~~ | `Ctrl+Shift+X` |
| Highlight | H | `Ctrl+Shift+H` |
| Inline code | `{ }` | `` Ctrl+` `` |
| Inline math | ∑ | via toolbar |

## Text color & highlight

Click the **A** (text color) or **highlight** icon in the toolbar to open a color picker. You can choose:

- A preset palette color
- A custom hex or RGB value
- Transparent (to remove highlight)

## Font family & size

- **Font family** — choose from a curated set of web-safe and Google Fonts (serif, sans-serif, monospace, display)
- **Font size** — type a value in the size box or use the up/down arrows; size is in points relative to the slide

## Text alignment

| Alignment | Shortcut |
|---|---|
| Left | `Ctrl+Shift+L` |
| Center | `Ctrl+Shift+E` |
| Right | `Ctrl+Shift+R` |
| Justify | `Ctrl+Shift+J` |

## Lists

- **Bullet list** — toolbar bullet icon or `Ctrl+Shift+8`
- **Ordered list** — toolbar number icon or `Ctrl+Shift+7`
- Nest items by pressing `Tab`; un-nest with `Shift+Tab`

## Tables

Insert a table from the toolbar's **Table** button. After inserting:

- Click a cell to edit its content
- Right-click for row/column add/delete options
- Drag column borders to resize

## Code blocks

Insert a fenced code block from the toolbar. Select the language from the dropdown for syntax highlighting (powered by highlight.js).

```python
# Example Python code block on a slide
def greet(name: str) -> str:
    return f"Hello, {name}!"
```

## Links

Select text and click the **link** icon in the toolbar (or press `Ctrl+K`) to add a hyperlink. Links open in a new tab when clicked in presentation mode.

## Inline math

Type a LaTeX expression surrounded by `$` signs inside any text element, or use the toolbar's **math** (∑) button:

- `$E = mc^2$` renders inline as $E = mc^2$
- Inline math is rendered via KaTeX

::: tip
For full display-math equations or TikZ diagrams, use a dedicated **LaTeX block** element instead. See [LaTeX & Math](/features/latex) for details.
:::
