# Transitions

Control how slides change during your presentation.

## Built-in transitions

Set the global transition in the editor toolbar under **Transition**:

| Transition | Description |
|-----------|-------------|
| None | Instant switch |
| Fade | Cross-fade between slides |
| Slide | Slides move horizontally |
| Convex | 3D convex rotation |
| Concave | 3D concave rotation |
| Zoom | Zoom in/out |

You can also set a **per-slide transition** in the right panel under **Slide transition**, overriding the global default.

## Differential Rotation

A custom physics-inspired transition where horizontal bands sweep across at different speeds — fast at the center (equator), slow at the edges (poles) — mimicking how stars rotate.

1. Set the transition to **Differential Rotation** (globally or per-slide).
2. In present mode, advancing to the next slide triggers the shear animation.

### How it works

16 horizontal bands cover the screen, each sliding off at a constant velocity proportional to cos²(latitude). Thin separator lines in Bauhaus primary colors (red, blue, yellow) mark the band boundaries. The animation runs ~1.4 seconds for the slowest band.

### Example output

<div style="border: 1px solid #333; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <iframe src="/revealjs_gui/demos/dr-transition.html" style="width:100%;height:240px;border:none"></iframe>
</div>

## Transition speed

For any transition, set the speed in the right panel:

- **Fast** — quick transitions for rapid pacing
- **Default** — standard timing
- **Slow** — deliberate, dramatic transitions

## Auto-animate

For morphing transitions between slides:

1. In the right panel, enable **Auto-Animate** on the slide.
2. Duplicate the slide and rearrange elements.
3. Elements with the same `data-id` (auto-assigned) smoothly morph between positions, sizes, and styles.
