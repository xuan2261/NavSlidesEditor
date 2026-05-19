# Your First Presentation

This tutorial walks you through creating a complete presentation from scratch — from blank deck to exported HTML file.

## 1. Creating a new presentation

1. Open NavSlides Editor in your browser (default: `http://localhost:3002`).
2. On the home screen, click **New Presentation**.
3. A dialog appears asking you to name your presentation. Enter a name (e.g., "My First Deck") and click **Create**.

## 2. Choosing a template

After clicking Create, you'll be offered a choice of starting templates:

- **Blank** — a single empty slide with no pre-placed elements
- **Title Slide** — a slide with a centered title and subtitle placeholder
- **Academic** — title slide + outline slide with footer sequence
- **Minimal** — clean layout, single font, no decoration

For this tutorial, choose **Title Slide**.

## 3. Editing the title slide

You'll see a slide with two text placeholders: a large title and a smaller subtitle.

1. **Double-click the title** ("Click to add title") to enter edit mode.
2. Type your presentation title — for example, *Introduction to Reveal.js*.
3. Press `Escape` to finish editing the title.
4. **Double-click the subtitle** and type your name or a short description.
5. Press `Escape` again.

To change the font size:
1. Double-click the title to re-enter edit mode.
2. Select all the text (`Ctrl+A`).
3. Use the font size box in the toolbar and change it to your preferred size.
4. Press `Escape`.

## 4. Adding a new slide

1. In the **slide panel** on the left, click the **+** button at the bottom, or right-click an existing slide and choose **Add Slide After**.
2. A new blank slide appears.
3. Click the new slide thumbnail to navigate to it.

## 5. Adding a text box and an image

**Add a text box:**
1. Right-click on the blank slide canvas and choose **Insert → Text Box**.
2. A text box appears. Double-click it and type some content.
3. Use the toolbar to format your text (bold, color, size, etc.).

**Add an image:**
1. Right-click on the canvas and choose **Insert → Image**.
2. A file picker opens. Choose an image from your computer.
3. The image appears on the slide. Drag it to position it, and drag the corners to resize.

## 6. Applying a theme

1. Click the **Design** button in the top toolbar (or go to **Slide → Theme**).
2. The theme panel opens on the right, showing 11 built-in reveal.js themes.
3. Click **Sky** (or any theme you like) to apply it.
4. The background and typography update across all slides immediately.

## 7. Adding a slide transition

1. Click on a slide in the left panel to select it.
2. Open the **Slide Settings** panel (right-click → Slide Properties, or the gear icon in the slide panel).
3. Under **Transition**, choose **Fade** from the dropdown.
4. You can also set the transition speed: Slow, Normal, or Fast.

## 8. Presenting

1. Click the **Present** button (play icon) in the top toolbar, or press `F`.
2. The presentation enters full-screen mode via reveal.js.
3. Use the **arrow keys** to advance slides.
4. Press **S** to open the **speaker notes** window in a separate browser tab.
5. Press **Escape** to exit full-screen.

## 9. Exporting as HTML

1. Click **File → Export → HTML**.
2. Save the `.html` file to your computer.
3. Open the file in any browser — your presentation is self-contained and shareable.

::: tip
If you plan to present without an internet connection (e.g., at a conference), choose **File → Export → Offline HTML** instead to inline all assets.
:::

Congratulations — you've built and exported your first presentation!

**Next steps:**
- [Academic Slides tutorial](/tutorials/academic-slides) — footers, LaTeX, two-column layouts
- [Using LaTeX & Math](/tutorials/using-latex) — deep dive on equations and TikZ diagrams
