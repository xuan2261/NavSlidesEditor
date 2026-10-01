# Author and edit a presentation

Use the live MCP input schema or `npm run navslides -- TOOL_NAME --help` before
constructing inputs. The examples below are illustrative; IDs and paths must be
replaced with objects and output destinations selected for the actual task.

## Create from an outline or Markdown

1. Turn the user's topic into a coherent narrative in the requested language.
   Resolve material unknowns such as audience and delivery format from the request;
   do not invent research, citations, or speaker claims.
2. Call `authoring_reference` for element defaults, themes, transitions, and tokens.
   Distinguish Reveal theme IDs from design-preset tokens. Discover outline layouts
   in creation help. Use base 960×540 coordinates unless deliberately customizing
   the presentation `resolution`.
3. Prefer `create_presentation` with `outline` for ordinary prose. Each outline
   entry accepts `title`, `bulletPoints`, `notes`, and `layout`. The tool escapes
   outline text; do not rely on HTML embedded in bullet points for styling.
4. Use one creation source: `outline`, `markdown`, raw `slides`, or `templateId`.
   Markdown creation uses the existing UI parser, including `---` and `##` slide
   boundaries. Review returned warnings and the resulting deck; it is not a
   promise to preserve every Markdown construct. To use a `.md` file, read it
   through authorized file access and pass its text as `markdown`; do not send it
   to the file-import tool.
5. Read the result with `get_presentation`, render requested slides with
   `preview_slide` to PNG paths, and inspect those images. Fix clipping, contrast,
   missing media, and content mistakes through the edit workflow below.
6. Re-read the deck after edits, then use `export_presentation` with `format:html`
   and the chosen output path. Report any asset/dependency warnings rather than
   calling an ordinary HTML export a guaranteed self-contained offline artifact.

For example, save this illustrative input as `outline.json` inside the workspace:

```json
{
  "title": "Project kickoff",
  "outline": [
    {
      "title": "Why this project matters",
      "bulletPoints": ["The audience's problem", "The intended outcome"],
      "notes": "Introduce the problem before the solution."
    },
    {
      "title": "Next decision",
      "bulletPoints": ["Agree on the scope", "Choose the first milestone"]
    }
  ]
}
```

```bash
npm run navslides -- create_presentation --input-file outline.json
npm run navslides -- get_presentation --presentation-id DECK_ID
npm run navslides -- get_presentation --presentation-id DECK_ID --detailed
```

The default read is a summary with top-level slide IDs and element IDs/types. Use
`detailed:true` when full content, styling, positions, or child-slide IDs are needed.
Raw `slides` accept `id`, `elements`, and `notes`; obtain element properties from
`authoring_reference` rather than inventing a different slide model.

## Edit an existing deck

1. Locate the deck with `list_presentations`, then call `get_presentation`.
   Preserve slide/element IDs from this read; indexes and display titles are not
   substitutes for identifiers.
2. Before a multi-step destructive rewrite, offer or create a `create_snapshot`
   within the user's authorized task. Snapshotting is a recovery choice, not an
   automatic requirement for every small edit.
3. Discover `edit_presentation` help/schema. Build an `operations` array using
   `add_slide`, `update_slide`, `remove_slide`, `move_slide`, `add_element`,
   `update_element`, or `remove_element`. Supply observed `slideId`/`elementId`
   where required and use `properties` for patches; the live schema owns the
   remaining fields and placement semantics.
   For a text element, rendered rich text lives in `content` (HTML), not guessed
   `text` or slide-title properties. Read its current `content` and patch only the
   requested heading or phrase, preserving surrounding bullets, formatting,
   links, and notes. Do not replace the whole body to change one heading.
4. Call with `dryRun:true` and inspect the proposed summary before applying the
   same intended operations. A dry run is a structural preview, not a PNG or save.
5. Apply to the state you read. Use `expectedGeneration` from the previous read
   for package-backed decks. On conflict, re-read and reconcile instead of blindly
   repeating edits. Other decks are last-writer-wins: warn against editing the
   same deck concurrently with editor autosave, and coordinate the handoff first.
6. Re-read and inspect fresh PNG previews of affected slides. If the requested
   change is absent or unrelated content was lost, correct the authorized edit
   and verify again before exporting or reporting completion.

Use `update_presentation` with `patch` for an intentional metadata change or
explicitly requested raw-content replacement. Obtain user authorization before
setting `confirm:true` for raw slides/layout masters replacement, removals, or
`update_slide` replacement of `elements`/`children`. Prefer targeted operations
for ordinary edits so unrelated content is not silently discarded.

## Reuse a template or attach media

- Discover built-in/user templates with `list_templates`, inspect with
  `get_template`, then call `create_presentation` with the selected `templateId`.
  Read the created deck to obtain its own IDs before editing. Use `save_template`
  when the user wants a reusable design rather than another presentation copy.
- Upload an approved workspace file with `upload_media`, optionally binding it to
  `presentationId`. Set the element's `src` to the exact API URL returned by the
  upload; do not invent an uploads path or use the original local filesystem path.
  Re-read and preview the slide to verify the media actually resolves.
