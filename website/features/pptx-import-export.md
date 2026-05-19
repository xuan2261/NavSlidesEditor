# PPTX Import & Export

NavSlides Editor round-trips PowerPoint decks. Import an existing `.pptx` to keep authoring in NavSlides, or export back to `.pptx` to hand a deck to colleagues who live in PowerPoint.

## Import

1. **File → Import → PowerPoint**
2. Pick a `.pptx`
3. The server (`server/services/pptx-import/`) parses the deck, maps each shape to a NavSlides element, and stores the result as a normal presentation

Tested against the corpus runner: `npm run test:corpus` runs semantic and round-trip fidelity tests against `./PPTX/` fixtures.

## Export

- **File → Export → PowerPoint**
- The exporter (`server/services/pptx-exporter.js`) streams a fresh `.pptx` with text, images, shapes, charts, and speaker notes preserved

## Known limits

- Animations and transitions on import map to the closest reveal.js equivalent; exotic PowerPoint motion paths are approximated
- Embedded video assets are extracted and re-linked from the media library
- SmartArt is rasterized to an image on import
