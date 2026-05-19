# Code, LaTeX & Markdown

This tutorial covers code blocks, LaTeX/TikZ elements, and Markdown blocks.

## Code blocks

1. Click **Code** in the toolbar.
2. A code block element appears. Double-click it to open the code editor.
3. Select a language from the dropdown (Python, JavaScript, TypeScript, C++, etc.).
4. Write or paste your code. Syntax highlighting is applied automatically.
5. Click **Apply** to save.

### Example output

<div style="border: 1px solid #333; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <iframe src="/revealjs_gui/demos/code-block.html" style="width:100%;height:260px;border:none"></iframe>
</div>

## LaTeX & TikZ

1. Click the **TeX** button in the toolbar.
2. A LaTeX element appears. Double-click it to open the LaTeX editor.
3. Enter LaTeX code — display math, aligned equations, or TikZ diagrams.
4. A live preview renders on the left as you type.
5. Click **Apply** to save.

### Example output

<div style="border: 1px solid #333; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <iframe src="/revealjs_gui/demos/latex-equation.html" style="width:100%;height:100px;border:none"></iframe>
</div>

::: tip
For TikZ diagrams, the editor uses TikZJax for client-side rendering. Wrap your code in `\begin{tikzpicture}...\end{tikzpicture}`.
:::

## Markdown blocks

1. Click the **Markdown** button in the toolbar (or find it under the insert menu).
2. A markdown element appears. Double-click it to edit.
3. Write standard Markdown — headings, lists, links, bold/italic, code blocks.
4. The rendered output appears when you deselect the element.

Markdown blocks are useful for quickly inserting formatted text without manual styling.
