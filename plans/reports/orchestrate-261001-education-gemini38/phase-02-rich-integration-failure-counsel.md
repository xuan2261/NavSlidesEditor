## Decision

**Keep Phase02 blocked.** The font failure has a concrete installed-parser hazard; the write-count failure does not establish that external undo emitted the second write. Neither warrants relaxing formatting or synchronization guarantees.

Read-only inspection completed. No edits, command/check runs, delegation, or model switching.

## 1. Font preservation: investigate parsing before changing the assertion

The failing assertion in `client/src/components/properties/shape-rich-label-editor.test.jsx:70–74` inspects the **first** `p span`. It does not establish whether Arial exists on another element covering `Revised`.

However, installed-source evidence identifies a stronger explanation than DOM nesting alone:

- `preserveBlockColors()` in `client/src/hooks/editor-controller/editor-rich-text-extensions.js:43–80` wraps the original font-family/font-weight span with a new color/font-size span.
- Installed TipTap TextStyle **3.31.3** enables `mergeNestedSpanStyles` by default. Its compiled implementation, `client/node_modules/@tiptap/extension-text-style/dist/index.js:17–25`, concatenates:
  ```js
  `${closestParentSpanStyleOfChild};${childStyle}`
  ```
- `cssstyle` **3.0.0** serializes declarations with trailing semicolons. This creates a boundary resembling:
  ```css
  color: rgb(18, 52, 86); font-size: 24px;;font-family: Arial; font-weight: 600
  ```
- In installed `rrweb-cssom`, a semicolon encountered in `before-name` is appended to the property-name buffer rather than ignored (`node_modules/rrweb-cssom/lib/parse.js:333–354`). The next property becomes `;font-family`.
- `cssstyle` rejects unknown property names (`node_modules/cssstyle/lib/CSSStyleDeclaration.js:64–67`). The custom `FontFamily` extension reads only `el.style.fontFamily`.

**[INFERENCE] This chain explains the exact symptom: color and size survive; the first child declaration, font-family, disappears.** It was not executed here. It may be a jsdom-specific parse loss rather than browser-visible production loss.

### Conservative next action

Inspect the edited text node’s `textStyle` attributes and the complete saved paragraph—not merely its first span.

- **Arial absent from the editor model:** actual parse/data loss in that runtime. A selector change cannot repair it.
- **Arial present in the model and applied to all of `Revised`:** replace the positional assertion with a semantic formatting assertion.
- **Model preserves Arial but rendering loses it:** investigate serialization/rendering separately.

For a DOM assertion, verify formatting on the text-bearing descendant and its ancestor chain. Finding *any* Arial span is insufficient. Font-family must apply to the edited run; numeric weight and semantic bold/italic/underline/strike must remain preserved.

Do not disable nested-style merging blindly: the imported block wrapper and inner span carry different attributes. If a shared preprocessing repair is needed, preserve inheritance and child overrides rather than special-casing Arial or this fixture.

## 2. Undo/redo: the assertion does not locate the extra write

The test sequence at `shape-rich-label-editor.test.jsx:101–119` performs:

1. Selection change.
2. Composition start.
3. Explicit text insertion.
4. Composition end.
5. External undo.
6. First write-count assertion.

There is **no checkpoint after composition settles and before undo**. Therefore, “two writes after undo” does not prove “undo produced a write.”

Installed behavior supports this distinction:

- ProseMirror View **1.42.4** flushes DOM changes at composition start.
- Composition end may schedule a microtask flush and schedules composition finalization after 20 ms (`client/node_modules/prosemirror-view/src/input.ts:517–577`).
- DOM reconciliation can dispatch document-changing transactions.
- TipTap emits `update` only when the resulting document differs, unless explicitly suppressed (`client/node_modules/@tiptap/core/src/Editor.ts:747–758`).

The shape editor uses the correct installed v3 API:

```js
editor.commands.setContent(html, { emitUpdate: false })
```

That command sets `preventUpdate`; the component also has a synchronous `synchronizing` guard. Its own-echo branch returns without replacing content when saved HTML already equals `editor.getHTML()`.

**[INFERENCE] A composition-related transaction could account for the second write. Its timing and content remain unproven.** It could also expose a real reconciliation defect; do not assume it is harmless.

### Conservative next action

Temporarily distinguish writes and transactions at these boundaries:

- Before composition.
- After insertion/own echo, while composition remains active.
- After composition finalization.
- Immediately after external undo.
- After undo’s deferred work settles.
- Likewise for redo.

Inspect both patches and their text/formatting, plus transaction steps and composition metadata.

Then make the permanent regression enforce the actual contract:

- Own echo preserves selection **and** active composition.
- After legitimate composition work settles, capture the latest edited document and write-count baseline.
- External undo and redo produce **zero additional writes**, immediately and after deferred work.
- Restored documents retain their formatting.

Do not simply change `1` to `2`, nor move the baseline to hide an unexplained write.

## Verification recommendation

Once the parent resumes, first resolve these two boundaries in the focused rich-label suite. Then rerun the supplied ten-suite integration command and exercise the real rich-label surface, including composition, external undo/redo, empty-document reload, target switching, and lock gating.

The supplied **170 passed / 2 failed** result remains the only runtime evidence considered here. **No Phase02 approval.**