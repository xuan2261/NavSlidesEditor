# Using LaTeX & Math

This tutorial is a deep dive into writing mathematical notation and diagrams in NavSlides Editor — from simple inline expressions to complex TikZ figures.

## 1. Inserting a LaTeX block

A **LaTeX block** is a dedicated slide element for display math and diagrams.

1. Right-click anywhere on the slide canvas.
2. Choose **Insert → LaTeX** from the context menu.
3. A LaTeX element is placed on the slide and the **LaTeX editor panel** opens on the right side.
4. The panel has two panes: the left pane is the editor, the right pane is a live preview.

You can move and resize the LaTeX block like any other element after closing the panel.

## 2. Writing display math

Use standard LaTeX delimiters for display math. All of the following work:

```latex
\[ E = mc^2 \]
```

```latex
\begin{equation}
  \oint_{\partial \Sigma} \mathbf{B} \cdot d\boldsymbol{\ell} = \mu_0 I_{\text{enc}}
\end{equation}
```

```latex
\begin{equation*}
  \hat{H} \left| \psi \right\rangle = E \left| \psi \right\rangle
\end{equation*}
```

### Aligned multi-line equations

```latex
\begin{align}
  \nabla \times \mathbf{E} &= -\frac{\partial \mathbf{B}}{\partial t} \\
  \nabla \times \mathbf{B} &= \mu_0 \mathbf{J} + \mu_0 \varepsilon_0 \frac{\partial \mathbf{E}}{\partial t}
\end{align}
```

### Matrices

```latex
\[
  \mathbf{A} = \begin{pmatrix} a_{11} & a_{12} \\ a_{21} & a_{22} \end{pmatrix},
  \quad
  \det(\mathbf{A}) = a_{11}a_{22} - a_{12}a_{21}
\]
```

### Cases (piecewise functions)

```latex
\[
  f(x) = \begin{cases}
    x^2 & \text{if } x \geq 0 \\
    -x  & \text{if } x < 0
  \end{cases}
\]
```

## 3. Using TikZ for diagrams

TikZJax runs in the browser using WebAssembly. Use a `tikzpicture` environment:

### Simple node diagram

```latex
\begin{tikzpicture}[>=stealth, node distance=2.5cm]
  \node[circle, draw] (x) {$x$};
  \node[circle, draw, right of=x] (f) {$f$};
  \node[circle, draw, right of=f] (y) {$y$};
  \draw[->] (x) -- (f) node[midway, above] {\small input};
  \draw[->] (f) -- (y) node[midway, above] {\small output};
\end{tikzpicture}
```

### Commutative diagram

```latex
\begin{tikzpicture}
  \node (A) at (0,2) {$A$};
  \node (B) at (2,2) {$B$};
  \node (C) at (0,0) {$C$};
  \node (D) at (2,0) {$D$};
  \draw[->] (A) -- node[above] {$f$} (B);
  \draw[->] (A) -- node[left]  {$g$} (C);
  \draw[->] (B) -- node[right] {$h$} (D);
  \draw[->] (C) -- node[below] {$k$} (D);
\end{tikzpicture}
```

### Plot / function curve

```latex
\begin{tikzpicture}[scale=1.2]
  \draw[->] (-0.2,0) -- (3.5,0) node[right] {$x$};
  \draw[->] (0,-0.2) -- (0,2.5) node[above] {$y$};
  \draw[domain=0:3, smooth, thick, blue] plot (\x, {exp(-\x)*2});
  \node at (2.5,1.2) [blue] {$y=2e^{-x}$};
\end{tikzpicture}
```

## 4. Inline math in text elements

Inside any **text box**, surround expressions with `$...$`:

- `The variance is $\sigma^2 = \frac{1}{N}\sum_i (x_i - \mu)^2$.`
- `Set $\alpha = 0.05$ for a 95% confidence interval.`

Inline math renders via KaTeX when you exit the text editor (press `Escape`).

## 5. Common KaTeX packages and commands

KaTeX ships with built-in support for the most common LaTeX packages. A selection:

| Package / feature | Example |
|---|---|
| `amsmath` | `\begin{align}`, `\begin{cases}`, `\text{}` |
| `amssymb` | `\mathbb{R}`, `\mathcal{L}`, `\varnothing` |
| `boldsymbol` | `\boldsymbol{\theta}`, `\boldsymbol{\mu}` |
| `physics` (partial) | `\bra{}`, `\ket{}`, `\braket{}` |
| `cancel` | `\cancel{x}`, `\bcancel{x}` |
| `color` | `\color{red}{x}` |

See the [KaTeX support table](https://katex.org/docs/support_table.html) for a full list of supported functions.

## 6. Troubleshooting rendering issues

**"Unknown command" error in preview**
The command is not supported by KaTeX. Check the KaTeX support table and find an equivalent. For example, use `\mathbf` instead of `\bm`.

**Equation renders but is cut off**
The LaTeX block element is too small. Resize it by dragging the corner handles.

**TikZ diagram is blank (no output, no error)**
- Make sure you have `\begin{tikzpicture}` and `\end{tikzpicture}`.
- Some TikZ libraries (`tikz-cd`, `pgfplots`) may not be available in TikZJax. Try removing `\usetikzlibrary{...}` calls if you added any — basic TikZ works without them.

**Inline math not rendering after typing**
Press `Escape` to exit the text editor first. Inline math only renders in view mode.
