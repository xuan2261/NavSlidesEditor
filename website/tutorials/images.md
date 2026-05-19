# Images

This tutorial covers inserting images and the interactive features: click-to-expand and popup text.

## Inserting an image

**From a URL:**
1. Click the **Image** button in the toolbar.
2. Paste the image URL in the prompt and click OK.

**By uploading:**
1. Click the small upload arrow next to the Image button.
2. Select a file from your computer. It's uploaded to the server and inserted on the slide.

## Adjusting an image

Select an image to see its properties in the right panel:

- **Object Fit** — `contain` (letterbox), `cover` (fill and crop), `fill` (stretch), `none` (native size)
- **Brightness / Contrast / Grayscale** — filter sliders
- **Round Corners** — adjustable border radius
- **Crop** — double-click the image to enter crop mode; drag the handles to crop

## Click to expand

This feature lets the audience click an image during a presentation to see it at full viewport size.

1. Select the image element.
2. In the right panel, check **Click to expand in present mode**.
3. In present mode, hovering the image shows a subtle indigo outline. Clicking it opens a full-screen lightbox.
4. Click outside the image or press `Escape` to close.

### Example output

<div style="border: 1px solid #333; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <iframe src="/revealjs_gui/demos/expand-image.html" style="width:100%;height:260px;border:none"></iframe>
</div>

## Popup text

Show a text tooltip when an image is clicked during presentation.

1. Select the image element.
2. In the right panel, find **Pop-up text (present mode)** and enter your caption.
3. Choose the **Position** (Below, Centered, or Side) and **Font size**.
4. In present mode, clicking the image shows the text box. Click away or press `Escape` to dismiss.

::: tip
You can enable **both** click-to-expand and popup text on the same image. When clicked, the image expands to full viewport and the popup text appears beside the expanded image.
:::

### Example output

<div style="border: 1px solid #333; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <iframe src="/revealjs_gui/demos/popup-image.html" style="width:100%;height:260px;border:none"></iframe>
</div>
