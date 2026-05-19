# Getting Started

## What is NavSlides Editor?

NavSlides Editor is a self-hostable, browser-based WYSIWYG presentation editor built on top of [reveal.js](https://revealjs.com/). It gives you the visual polish of modern slide tools without requiring a cloud account — run it on your laptop, a home server, or a Docker container.

Unlike editing raw Markdown or HTML reveal.js files, NavSlides Editor lets you:

- **Click and type** directly on slide elements with rich formatting
- **Drag, resize, and rotate** text boxes, images, shapes, and code blocks visually
- **Preview instantly** — no build step, no reload
- **Export anywhere** — HTML, offline HTML, PDF, or PPTX

## Key capabilities

- **Rich text formatting** via TipTap: headings, bold/italic/underline, font size & color, highlight, lists, tables, and code blocks
- **LaTeX & TikZ** — write display math or full TikZ diagrams in a split-pane editor with live preview
- **Charts** — insert bar, line, and scatter charts from the element menu
- **Slide navigation** — vertical stacks, reorderable slides, speaker notes
- **Themes & presets** — 11 built-in reveal.js themes plus 6 design presets (Academic, Minimal, Dark Tech, etc.)
- **Footer sequences** — automatic section progress footers for academic talks
- **Export options** — standalone HTML, offline HTML (CDN inlined), PDF, PPTX, shareable links, GitHub push
- **Cloud sync** — Proton Drive, S3, Google Drive, or any rclone remote

## Choose your installation method

NavSlides Editor can be run in three ways:

| Method | Best for |
|--------|----------|
| **Docker** (recommended) | Servers, always-on setups, teams |
| **Desktop App** | Single-user, offline, local files |
| **Node.js from source** | Development, customization |

See the [Installation guide](/guide/installation) for step-by-step instructions.

## Opening the editor

Once running, navigate to `http://localhost:3002` in your browser. You'll land on the **home screen**, which shows:

- **New Presentation** — create a blank deck or pick a template
- **Recent files** — re-open presentations you've worked on before
- **Open file** — load an existing `.json` presentation file from disk

## Your first slide

1. Click **New Presentation** on the home screen.
2. Choose a template (or start blank).
3. Click the title text on the first slide and start typing.
4. Use the formatting toolbar that appears at the top to change font, size, or color.
5. Press **Escape** to deselect and return to slide-selection mode.
6. Click the **+** button in the slide panel to add a new slide.

## Next steps

- [Installation](/guide/installation) — detailed setup for Docker, desktop, and source
- [Your First Presentation](/tutorials/first-presentation) — a full walkthrough from blank deck to exported file
