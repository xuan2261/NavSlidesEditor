# PPTX Import & Export

NavSlides Editor imports PowerPoint decks for editing and exports presentations back to `.pptx`.

## Import

1. On the **Home dashboard**, choose **Import → Import PPTX**
2. Pick a `.pptx`
3. The server parses the deck, maps supported content to NavSlides elements, stores the presentation, and retains the original uploaded package for eligible zero-loss downloads

## Export

In the editor, open **File → Export PPTX**. Imported decks can expose three
separate fidelity choices:

- **Download Original** recovers the verified immutable source package. It never
  includes NavSlides edits.
- **Export Validated Edited Revision** is available only when current package
  authority and the required validators qualify. Validation or cleanup uncertainty
  blocks this path instead of silently substituting another export.
- **Generate Reconstructed PPTX** creates a new file from the editor model. It is
  not a round-trip export; supported content remains editable where possible, while
  unsupported visuals can use raster or placeholder fallbacks.

## Known limits

- Import and reconstructed export are not byte-for-byte PowerPoint round trips. PowerPoint-specific metadata, advanced animations, transitions, and uncommon effects can be simplified or omitted.
- SmartArt is approximated as editable shapes when its diagram data can be mapped. Complex layouts may be simplified, truncated, or represented by a placeholder.
- Some chart variants, grouped objects, media, fonts, crops, and geometry may be approximated. Import warnings report these cases by category.
- Validated edited export is capability-dependent and does not itself prove
  PowerPoint visual parity. Use **Download Original** whenever recovery of the
  uploaded package is the goal.

Detailed recovery, qualification, and evidence boundaries are maintained in
[Export Fidelity and Known Limitations](https://github.com/xuan2261/NavSlidesEditor/blob/master/docs/export-fidelity-and-limits.md).
