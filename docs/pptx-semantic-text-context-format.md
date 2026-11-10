# PPTX semantic text context encoding

This is the internal source-data contract implemented by the semantic importer.
It does not qualify native rendering, edited export, or the full PPTX acceptance
matrix.

## Versions and source identity

The table below describes text-context payloads in the schema 2 envelope.
Current schema 3 source graphs additionally intern shapes, declarations,
identities and source inventories. `semanticStyle` decodes their context records
into the checked version 1 shape consumed by materialization; wire records are
not expanded by treating their integer references as literal IDs. Payload and
semantic-envelope versions are independent:

| Payload version | Representation                                                  |
| --------------- | --------------------------------------------------------------- |
| 1               | Expanded source layers, theme, provenance and font requests     |
| 2               | Per-context declaration dictionary with local layer references  |
| 3               | Version 2 layer references plus shared immutable source records |

Existing version 1 and 2 sources remain readable. The producer compacts shared
contexts to payload version 3 before canonical source-graph compaction.
Normalizing an existing document does not transcode its source records.

Version 3 retains occurrence, definition, host-slide, placeholder, relationship,
paragraph and run identities in the context. Its `resourcesId` identifies a
source style of kind `text-context-resources`. That style has a version 1
payload containing a `records` dictionary. Each `record-N` entry contains a
`kind` and `value`; supported kinds are `theme`, `provenance`, `font` and
`declaration`.

The context's theme, provenance and font-request fields reference those records.
Its declaration dictionary maps local `layer-N` IDs to shared declaration
records. Body, paragraph and run layer lists retain their local references and
ordering. Sharing uses exact record values, not effective font or paint
equivalence. Supplemental scripts, lexical font metadata, source receipts,
explicit false/zero declarations and their original order remain present.

## Validation and budgets

The codec expands version 3 through the version 2 representation into the same
version 1 context consumed by layout, font collection and family rendering.
Every expanded context still passes source ownership, relationship, component,
declaration and provenance validation. Missing pools or records, wrong record
kinds, foreign owners, forged source data, unknown fields and unused shared
records reject admission. The payload version 3 resource format belongs to the
schema 2 envelope; schema 3 resources are read through the semantic record adapter.

Source records are not package authority. Server baseline comparison remains
the trust boundary, including same-document clipboard source-style comparison.
The dictionary does not change Original or grant export qualification.

Default generic snapshot limits remain 500 slides, 20,000 elements, depth 16
for legacy JSON, 100,000 passthrough object keys, 8 MiB strings and 50 MiB
encoded bytes. Arrays contribute indexed keys. Schema 1 and 2 semantic data,
plugin data, nested lookalike envelopes and generated compatibility chart
copies continue to contribute to the passthrough key count.

After successful semantic validation, only the canonical root schema 3 graph
uses its existing typed structural limits instead of being charged again to
the generic key budget: 8 MiB canonical bytes, 1,100,000 visited values and
depth 256, with all catalog, source, ownership and per-record checks retained.
Aggregate strings, encoded snapshot bytes and applicable element counts still
include the graph. This explicitly authorized admission change does not grant
package authority, native rendering qualification or an edited-export gate.

Decoded growth also counts against the existing default 8 MiB whole-semantic
byte budget. Each context checks reference growth before constructing effective
arrays. Whole-document validation rejects provable overflow early, while
crediting all not-yet-decoded payload bytes so the final budget is independent
of context insertion order.

The implementation lives in `shared/src/pptx-semantic-text-context-codec.js`,
`shared/src/pptx-semantic-text-context.js` and
`shared/src/pptx-geometry-style-records.js`. Producer integration is in
`server/services/pptx-import/semantic-projector.js`. Regression coverage is in
`tests/pptx-semantic/semantic-native-snapshot-budget.test.js` and the chart,
OMML and text-context persistence tests beside it.

## Import-time parsed-part ownership

One explicit text-context batch owns a cloned inventory and a private parsed-XML
cache. Each occurrence still reads and checks the byte length and SHA-256 of
every used part, including relationship parts, before reusing its exact XML's
deeply frozen parse tree. Definition and locator associations are checked again
for each occurrence. Boundaries, node/path maps, receipt arrays, relationship
arrays and emitted declaration data remain occurrence-local, preserving receipt
order and preventing a later occurrence from changing an earlier result.

The cache is discarded when the batch finishes. Independent calls do not reuse
ZIP or inventory identity, and no atomic snapshot of the whole ZIP is implied:
each occurrence retains its existing first-read part semantics. Standalone list
style admission continues to hash and independently parse its supplied XML to
verify locator/node association and native ownership; caller-supplied nodes or
flags do not grant access to cached parsing authority.

## Checked property-scope resolution

`resolveProperties({ scope, layers, theme })` resolves all properties of one
explicit body, paragraph or run scope. It owns one descriptor-checked clone and
validates every declaration and theme field before resolving any result,
including unused or ineligible layers. The existing checked `resolveProperty`
entrypoint shares the same private precedence and provenance implementation.

Batching retains the strictest individual property-envelope node, depth and byte
limits, duplicate-ID checks, placeholder ambiguity and explicit false/zero/empty
declarations. Returned authored values, resolved values and dependency arrays do
not retain caller-owned objects or alias other properties. No caller-object
cache or unchecked resolver grants a validation exemption.

## Run hyperlinks and source slide references

Canonical text and table-cell runs carry optional `hyperlinks.click` and
`hyperlinks.hover` records. These are run-local source declarations, not inherited
visual run properties and not detached element actions. Each descriptor retains
its inventoried hyperlink `componentId`, relationship identity and supported
declarations, including explicit false flags and tooltips. Unsafe relationships,
executable actions, sound children and unrepresented extension semantics reject
admission rather than disappearing from the imported body.

External source links contain an existing canonical safe URL/email action.
Internal source jumps instead contain immutable `sourceId` and `targetPartUri`,
with no editor slide ID or canonical action inside the source definition.
`sourceId` is the SHA-256 of the code-unit-sorted inventoried part URI/hash tuples.
The semantic envelope's optional `sourceSlides` array maps that source namespace
and part URI to an imported stable project slide ID and source part hash. Empty
native target slides are included even when they have no definitions.

Source slide records survive reorder, duplication and deletion unchanged.
Deleting the actual target makes resolution explicitly unresolved; duplicating
a slide does not register an ambiguous alias or redirect a source jump. Different
packages with the same slide filenames and identical empty target bytes do not
share a namespace. Missing source namespaces or missing live targets never
produce an invalid canonical action with a null slide ID.

The native run/trigger inspector reuses the existing action controls and commits
only the selected occurrence's action (or null to disable it). Text uses the
canonical text transaction; table cells use `table.edit/replaceCellText`. Source
definitions, descriptors, Original and unrelated occurrences remain unchanged.
Canonical inline splits may retain a source hyperlink reference on the original
run and its existing `~N` authored segments. Source bindings themselves remain
unique. This contract does not grant native export or full task20 qualification.

## Inherited edits and authored slide metadata

`inheritance.edit` defaults to the selected occurrence. Its explicit `all` scope
requires the exact impact preview for the current command, source dependencies,
occurrences and lock state. The editor submits the entire result in one existing
presentation-state transaction, so undo restores all affected occurrences
together. Theme color edits must target a source theme linked to the selected
occurrence; they cannot use an unrelated occurrence as an entry point. Source
definitions stay immutable, while project theme values and occurrence overrides
remain separate. Materialization recomputes dependent text and geometry without
overwriting explicitly authored occurrence values. Field previews are derived
from slide/title/date context and never replace canonical field declarations.

The importer also emits immutable `unknown`-kind source definitions whose content
contains `slideMetadata`. These non-paint metadata definitions retain exact
authored background, header/footer, color-map and notes XML with native locators
and source-part hashes, plus explicit root flags and relationship dependencies.
They are data, never executable markup or a substitute for editable slide
objects. `slide.pptxSlideSource.definitionIds` links each slide to the relevant
source definitions. Notes retain their constituent source identities and exact
source XML; their body text populates the existing notes field only when the
incoming slide does not already declare notes. Existing slide metadata is not
overwritten. Notes definitions do not become slide-paint occurrences.

Ambiguous metadata owners, duplicate dependency kinds, unsupported notes
extensions and inheritance cycles reject admission before media staging or
presentation publication. A notes-to-slide backlink and a master's layout list
are not inheritance edges. Native edited-PPTX eligibility is unchanged; these
preservation records do not qualify native visual fidelity or export support.
