# HTML Embeds & p5.js

Embed custom interactive content directly on your slides — D3 visualizations, canvas animations, arbitrary HTML, or p5.js sketches.

## HTML / D3 embed

1. Click **Embed** in the toolbar.
2. A code editor opens with a starter D3 scatter plot.
3. Write any valid HTML — the content renders inside a sandboxed iframe.
4. Click **Apply** to insert. The element previews live on the slide.

The embedded HTML is completely self-contained. It works in present mode, exported files, and shared links. External scripts (D3, Three.js, etc.) can be loaded via CDN.

### Example output

<div style="border: 1px solid #333; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <iframe src="/revealjs_gui/demos/d3-scatter.html" style="width:100%;height:220px;border:none"></iframe>
</div>

## p5.js sketches

1. Click **p5** in the toolbar.
2. A code editor opens pre-loaded with the p5.js library.
3. Write your p5.js sketch using `setup()` and `draw()`.
4. Click **Apply**. The sketch renders live on the slide.

### Example output

<div style="border: 1px solid #333; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <iframe src="/revealjs_gui/demos/p5-stars.html" style="width:100%;height:220px;border:none"></iframe>
</div>

## Manim animations

1. Click **Manim** in the toolbar.
2. Write a Manim scene in the code editor.
3. Click **Render** — the server renders the animation and embeds the video.

::: warning
Manim rendering requires the Manim package installed on the server. Rendering may take several seconds depending on complexity.
:::

## Tips

- HTML embeds receive `EMBED_WIDTH` and `EMBED_HEIGHT` as JavaScript globals — use them to size your canvas responsively.
- Press the **Preview Slide** button in the right panel to test your embed in present mode without navigating through the full deck.
- Embeds support mouse interaction in present mode — hover effects, click handlers, and scroll all work inside the iframe.
