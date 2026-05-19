# Animations & Fragments

## Entry animations

Make elements animate in when a slide becomes active.

1. Select an element.
2. In the right panel, find **Animation** > **Entry Animation**.
3. Choose a preset:

| Animation | Description |
|-----------|-------------|
| Fade In | Simple opacity fade |
| Fade Up/Down/Left/Right | Fade + directional slide |
| Zoom In / Zoom Out | Scale from smaller/larger |
| Slide Up/Down/Left/Right | Full offscreen slide |
| Flip X / Flip Y | 3D rotation flip |

4. Set **Duration** (ms) and **Delay** (ms).

### Example output

<div style="border: 1px solid #333; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <iframe src="/revealjs_gui/demos/animations.html" style="width:100%;height:200px;border:none"></iframe>
</div>

## Animation timeline

For fine-grained control over animation ordering:

1. Click the **Timeline** button in the top toolbar.
2. A timeline panel opens at the bottom showing all animated elements.
3. Drag elements to reorder their sequence.
4. Adjust delays to stagger entry times.

## Fragments

Fragments let you reveal elements step-by-step within a single slide (advancing with arrow keys or clicks).

1. Select an element.
2. In the right panel, enable **Fragment**.
3. Choose the fragment animation: fade-in, fade-up, highlight, etc.
4. Set the **fragment index** to control the reveal order (lower numbers appear first).

In present mode, each click or arrow press reveals the next fragment before advancing to the next slide.

::: tip
Combine fragments with entry animations for maximum impact — the fragment controls *when* the element appears, and the entry animation controls *how* it appears.
:::
