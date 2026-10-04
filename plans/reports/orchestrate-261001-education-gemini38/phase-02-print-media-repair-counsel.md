# Phase02 print/media design counsel

Route: explicit native CLI `local52186/gpt-6.1-sol`, thinking high, installed kongming role, read/glob/grep only, no prewalk/extensions/nested delegation. Same-model counsel; no model-family independence claimed. Settled `bg_39` returned GO for repair design, NO-GO for Phase02 completion. The result was auto-delivered; subsequent proc:// lookup returned not found (tool issue recorded).

## Accepted recommendations
- Remove the partial printed Markdown parser. Use the existing browser Marked vendor before print initialization.
- Carry source as JSON in an HTML-escaped attribute; recover with getAttribute/JSON.parse once. Parse before sanitization, highlighting, and export readiness.
- Extract the existing generated Present Markdown sanitizer into one shared generated-runtime helper; preserve its current ordinary raw-HTML semantics. Do not silently substitute a stronger/different sanitizer policy.
- Preserve print typography and restore scoped code whitespace/overflow styling. Assert exact fenced code text, paragraph structure, ordered-list start, links, highlighting, script sentinel, and literal-entity/closing-script transport in actual generated surfaces.
- Existing regex sanitizer is not comprehensive active-content containment. Direct print insertion has a different containment boundary from an iframe; retain this risk for the Phase14 security gate. This repair does not claim sanitizer hardening.
- Keep media viewport unchanged; put metadata in a sibling region within opacity/rotation/fragment visibility ownership. Unconditionally placing it below the viewport is insufficient because slides clip at their bottom edges.
- For bottom-edge support prefer a bounded, scrollable in-bounds panel away from native controls. Trade-off: it overlays video pixels and needs visual proof. Do not shrink video or change global slide overflow.
- Exempt metadata pointer interaction from canvas drag handling; retain existing SUMMARY keyboard convention. Keep React/escaped generated text and long-content scrolling.

## Remaining runtime proof
Current final safety NO-GO remains. Prove unselected canvas, pointer/keyboard transcript expansion, scrolling to end, bottom-edge and fragment behavior, unchanged media geometry, playback controls/rate/tracks/time range and actual network-blocked offline download. Existing 57 unit and portable-entity pass were caller evidence, not counsel-run checks.

## Runtime cache boundary discovered afterward
The first new print regression reached a blank Present iframe before print. A diagnostic fixture's actual API-served source contained literal encoded `<script>`/`</script>` within Markdown JSON, whereas current source escapes `<` as `\\u003c`. The long-lived isolated API held old CommonJS modules. Its port owner was PID21140, with exact isolated data/uploads directories. Stopped only that verified owner; retained all data. New current-source service on port34102 reached ready (PID22400), reclaiming the abandoned writer lease (epoch4 to5). The superseded supervised process reported exit127; not rerun to confirm. The test against freshly loaded modules passed its canvas/Present checks and reached the intended print RED: multiline paragraph was split into separate paragraphs.
