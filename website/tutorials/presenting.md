# Presenting & Export

## Present mode

Click the **Present** button (play icon) in the top-right toolbar to open the full presentation in a new window.

### Controls in present mode

| Key | Action |
|-----|--------|
| `Right` / `Space` | Next slide |
| `Left` | Previous slide |
| `S` | Open speaker notes |
| `F` | Toggle fullscreen |
| `Escape` | Exit fullscreen or close overlay |
| `O` | Overview / slide grid |

## Preview a single slide

To test a single slide without presenting the entire deck:

1. Click the **Preview Slide N** button at the top of the right panel.
2. The current slide opens in a new window, fully rendered in present mode.

This is useful for testing HTML embeds, animations, and interactive features without navigating through the full deck.

## Speaker notes

1. In the editor, click the **Notes** area at the bottom of the properties panel.
2. Type your speaker notes for the current slide.
3. In present mode, press `S` to open the speaker view with notes, timer, and next-slide preview.

## Themes

Change the visual theme in the toolbar under **Theme**:

- Black, White, League, Beige, Sky, Night, Serif, Simple, Solarized, Moon, Dracula

Themes affect the background color, text color, and heading styles. Element-level formatting takes precedence over theme defaults.

## Footer & page numbers

1. Open footer settings in the toolbar.
2. Configure:
   - **Section labels** — show active section in a progress bar
   - **Page numbers** — `n/total` or just `n`
   - **Clock / Timer** — 12h clock, 24h clock, count-up or count-down timer

## Export options

### HTML

Click **Export** > **Download HTML** to export HTML that references the manifest-owned local runtime. Keep referenced runtime and media assets reachable; see [Export & Sharing](/features/export) for standard and offline HTML limits.

### Single slide HTML

Click **Export** > **Export Slide HTML** to download just the current slide.

### PDF

Click **Export** > **Export PDF** to generate a print-ready PDF with one page per slide. Fragment states are expanded into separate pages.

### PowerPoint

Use **Export** > **Export PPTX**, then choose the appropriate mode. See [PPTX Import & Export](/features/pptx-import-export) for Original recovery, validated Edited export, and Reconstructed generation; these do not share one editability or fidelity guarantee.

## Sharing

1. Click the **Share** button in the toolbar.
2. Create a view-only link, optionally with a name, password, or expiration.
3. Viewers need network access to your instance and must satisfy any link password and expiration restrictions. This does not enable collaborative editing.
4. Revoke the link to remove that access. See [Export & Sharing](/features/export#shareable-links).

### Example: exported slide

<div style="border: 1px solid #333; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <iframe src="/NavSlidesEditor/demos/slide-export.html" style="width:100%;height:220px;border:none"></iframe>
</div>
