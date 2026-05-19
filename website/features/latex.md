# LaTeX & Math

NavSlides Editor provides first-class support for mathematical notation and diagrams through two complementary systems: **KaTeX** for inline and display math, and **TikZJax** for vector diagrams.

## Inserting a LaTeX block

1. Right-click on the slide canvas and choose **Insert → LaTeX**, or use the **Insert** toolbar button.
2. A LaTeX element is placed on the slide, and the **LaTeX editor panel** opens on the right.
3. Type your LaTeX source in the left pane; the right pane shows a **live preview** that updates as you type.
4. Click elsewhere on the slide to close the editor and see the final rendered output embedded in your slide.

::: tip
You can resize and reposition the LaTeX block just like any other element — drag to move, drag corners to scale.
:::

## Display math with KaTeX

KaTeX is used to render standard LaTeX math notation. Use `\[...\]` or the `equation` environment for display math:

```latex
\[
  \hat{H}\psi = E\psi
\]
```

```latex
\begin{equation}
  \nabla \cdot \mathbf{E} = \frac{\rho}{\varepsilon_0}
\end{equation}
```

### Aligned equations

```latex
\begin{align}
  f(x) &= x^2 + 3x + 2 \\
       &= (x+1)(x+2)
\end{align}
```

### Fractions, sums, and integrals

```latex
\[
  \int_0^\infty e^{-x^2}\, dx = \frac{\sqrt{\pi}}{2}
\]
```

```latex
\[
  \sum_{n=0}^{\infty} \frac{x^n}{n!} = e^x
\]
```

## TikZ diagrams

For vector graphics and complex diagrams, NavSlides Editor supports **TikZJax** — a WebAssembly port of PGF/TikZ that runs entirely in the browser.

### Simple example

```latex
\begin{tikzpicture}
  \draw[thick, ->] (0,0) -- (3,0) node[right] {$x$};
  \draw[thick, ->] (0,0) -- (0,3) node[above] {$y$};
  \draw[blue, thick] (0,0) parabola (2,2);
  \node at (1.5,0.8) [right] {$y = x^2$};
\end{tikzpicture}
```

### Block diagram

```latex
\begin{tikzpicture}[node distance=2cm, auto]
  \node[draw, rectangle] (A) {Input};
  \node[draw, rectangle, right of=A] (B) {Process};
  \node[draw, rectangle, right of=B] (C) {Output};
  \draw[->] (A) -- (B);
  \draw[->] (B) -- (C);
\end{tikzpicture}
```

::: warning
TikZ rendering uses WebAssembly and may take a moment on first load. Complex diagrams with many nodes may be slower to render in the live preview.
:::

## Inline math in text elements

Inside any **text element**, you can include inline math using dollar signs:

- Type `$f(x) = x^2$` to render $f(x) = x^2$ inline with surrounding text.
- Use `$$...$$` for a display-style equation centered within the text block.

Inline math is rendered via **KaTeX** automatically when you exit the text editor.

## Common KaTeX packages and commands

KaTeX supports a large subset of LaTeX. Frequently used commands:

| Command | Output |
|---|---|
| `\frac{a}{b}` | Fraction |
| `\sqrt{x}` | Square root |
| `\vec{v}`, `\mathbf{v}` | Vector notation |
| `\hat{x}`, `\tilde{x}` | Accents |
| `\text{word}` | Text inside math |
| `\begin{pmatrix}...\end{pmatrix}` | Matrix |
| `\left( ... \right)` | Auto-sized delimiters |

See the full [KaTeX support table](https://katex.org/docs/support_table.html) for a complete reference.

## Troubleshooting rendering issues

**Preview shows an error message**
Check the LaTeX source for syntax errors — missing `\end{}`, mismatched braces, or unsupported commands.

**TikZ output is blank**
Make sure you have a `\begin{tikzpicture}...\end{tikzpicture}` block. Some PGF libraries (e.g., `tikz-cd`) may not be available in TikZJax.

**Inline math not rendering**
Exit the text editor (press `Escape`) — inline math renders after you finish editing.
