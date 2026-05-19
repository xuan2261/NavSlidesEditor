# Journal — Three.js modal port from parallax-presentations

Date: 2026-05-19
Plan: `plans/260519-2114-port-three-modal-from-parallax/`
Commit: `72343090`

## What was non-obvious

**Aliased templates were UI lies.** The pre-existing modal listed 8 template names but `galaxy / terrain / instanced-spheres` re-used `particle-cloud / wave-plane / wireframe-sphere` HTML. The original test (`getByText('Galaxy')`) only checked the label rendered — passed for the wrong reason. New regression guards assert specific source-only identifiers (`5000`, `lerp`, `computeVertexNormals`, `flatShading`, `InstancedMesh`) so any future re-aliasing fails loudly.

**Importmap survives data-URL wrapping.** `shared/src/element-renderers.js renderHtml` wraps every `el.type === 'html'` in `<!doctype><html><head>…</head><body>${content}</body></html>` and serves via `data:` URL. I assumed this might mangle `<script type="importmap">`. It doesn't — the importmap lives inside `${content}` (which goes into `<body>`), and `<script type="importmap">` works in any document position when parsed before the first `import`. Verified by reading `element-renderers.js:155-165` rather than testing.

**`previewKey` ≠ render trigger.** Tempted to bump `previewKey` on every `params` change to "force" iframe refresh — that would drop the WebGL context every keystroke. Correct design: `useMemo` re-derives `srcDoc` on params change (React handles attribute diff, iframe re-loads); `key` only bumps on Refresh / Edit-as-code where we explicitly want a remount. Captured as red-team R3.

**Renderer literal must be format-pinned.** Test asserts `{antialias:true,alpha:true|false}` exactly. If a future refactor reorders to `{alpha:…,antialias:…}` or adds spaces, the assertion fails. Intentional canary — the alias regression succeeded *because* test assertions were structural, not behavioral.

## Process notes

- `--deep --tdd` planning paid off: 13-row red-team caught 6 deltas before any code was written. The "Edit-as-code keeps params" check (R5) was almost an after-thought; it would have been a real bug if user-edited color was discarded on round-trip.
- Code-reviewer subagent returned empty on first invocation — had to resume via `SendMessage`. Resume worked; subagent context survived. Background subagent output lands at `%TEMP%\…\tasks\<agent-id>.output` even when the chat-channel return is empty.
- Source's `ThreeModal.jsx` AGPL header lives at file level. Our split puts copied template strings in a separate data module → SPDX header on the data file is sufficient; modal file (locally rewritten) needs no header. Locked in red-team R4.

## Open thread

`docs/code-standards.md` should document the importmap pattern (Three.js, addons via CDN) so future Anime / Kinetic-text ports follow it. Phase Next Steps #1 — deferred.
