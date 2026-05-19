# Academic Slides

This tutorial shows how to build a polished academic talk: section footers, LaTeX equations, TikZ diagrams, two-column layouts, and offline export.

## 1. Choosing the Academic preset

1. Create a new presentation and select the **Academic** template.
2. Once in the editor, click **Design** in the top toolbar.
3. Under **Presets**, click **Academic**. This applies:
   - A clean serif/sans-serif font pairing
   - A subtle header color
   - Numbered slide footers ready for section labeling

## 2. Setting up the footer sequence

The footer system displays a section progress bar at the bottom of every slide.

1. Click **Slide → Footer Settings** (or the footer icon in the toolbar).
2. In the **Sections** panel, add your section names:
   - Introduction
   - Methods
   - Results
   - Discussion
3. Assign the current slide range to each section by clicking **Assign Slides**.
4. Choose a footer style — dots, labels, or a progress bar.
5. Click **Apply to All Slides**.

::: tip
The footer automatically highlights the active section as you advance through the presentation. This gives your audience a constant sense of where you are in the talk.
:::

## 3. Adding LaTeX equations

1. Navigate to a slide where you want to show a result (e.g., the Results section).
2. Right-click the canvas and choose **Insert → LaTeX**.
3. In the LaTeX editor panel, type a display equation:

```latex
\[
  \chi^2 = \sum_{i=1}^{N} \left(\frac{y_i - f(x_i;\boldsymbol{\theta})}{\sigma_i}\right)^2
\]
```

4. The live preview shows the rendered equation on the right.
5. Click outside the panel to embed the equation on the slide.
6. Resize and reposition the LaTeX block as needed.

## 4. Adding a TikZ diagram

For a methods diagram or schematic:

1. Insert another LaTeX block.
2. In the editor, type a TikZ diagram:

```latex
\begin{tikzpicture}[node distance=1.8cm]
  \node[draw, rectangle, rounded corners] (obs) {Observations};
  \node[draw, rectangle, rounded corners, right of=obs, xshift=1cm] (model) {Model};
  \node[draw, diamond, below of=model] (fit) {Fit?};
  \node[draw, rectangle, rounded corners, below of=fit] (out) {Best-fit params};

  \draw[->] (obs) -- (model) node[midway, above] {input};
  \draw[->] (model) -- (fit);
  \draw[->] (fit) -- node[right] {yes} (out);
  \draw[->] (fit.west) -- ++(-0.8,0) |- node[left, near start] {no} (model.west);
\end{tikzpicture}
```

## 5. Creating a two-column layout

Reveal.js uses HTML, so you can use a **two-column grid** inside a slide:

1. Insert a **Text Box** and resize it to occupy the left half of the slide.
2. Insert a second **Text Box** (or image/LaTeX block) on the right half.
3. Use **Align → Left edge** on the left element and **Align → Right edge** on the right element to snap them into position.

Alternatively, use the **Layout** button in the toolbar to select a two-column preset, which inserts pre-positioned placeholder boxes.

## 6. Using code blocks with syntax highlighting

1. Inside a text box, click the toolbar's **code block** button.
2. Select the language from the dropdown (e.g., Python, R, Julia).
3. Type or paste your code:

```python
import numpy as np
from scipy.optimize import minimize

def neg_log_likelihood(theta, x, y, sigma):
    model = theta[0] * x + theta[1]
    return 0.5 * np.sum(((y - model) / sigma) ** 2)

result = minimize(neg_log_likelihood, x0=[1, 0], args=(x_data, y_data, sigma_data))
```

4. The code renders with syntax highlighting using highlight.js.

## 7. Exporting offline HTML for conference use

Before your talk, export the presentation as an offline bundle:

1. Click **File → Export → Offline HTML**.
2. Wait for the asset inlining to complete (typically 5–15 seconds).
3. Save the `.html` file to a USB drive or your laptop.
4. Open the file in any browser — no internet required.

::: tip
Test the offline export before the conference. Open the file on the computer you'll use to present, not just your development machine.
:::
