# PPTX Import & Export

NavSlides Editor imports PowerPoint decks for editing and exports presentations back to `.pptx`.

## Import

1. On the **Home dashboard**, choose **Import → Import PPTX**
2. Pick a `.pptx`
3. The server parses the deck, maps supported content to NavSlides elements, stores the presentation, and retains the original uploaded package for eligible zero-loss downloads

Tested against the corpus runner: `npm run test:corpus` runs semantic and round-trip fidelity tests against `./PPTX/` fixtures.

## Export

- In the editor, choose **File → Export PPTX**.
- An imported presentation that has not been edited can download the **original uploaded bytes** when the original package is still available.
- After a local edit, a server-recorded edit, or when the original package is unavailable, NavSlides uses its **client-side reconstructed export**. Supported text, images, shapes, tables, charts, and notes remain editable where possible; unsupported visual elements can use a raster fallback.

## Known limits

- Import and reconstructed export are not byte-for-byte PowerPoint round trips. PowerPoint-specific metadata, advanced animations, transitions, and uncommon effects can be simplified or omitted.
- SmartArt is approximated as editable shapes when its diagram data can be mapped. Complex layouts may be simplified, truncated, or represented by a placeholder.
- Some chart variants, grouped objects, media, fonts, crops, and geometry may be approximated. Import warnings report these cases by category.
- Original-byte export is available only while the presentation remains unedited and its stored original package passes server validation.
