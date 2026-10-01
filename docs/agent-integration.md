# Agent integration

This integration serves people and AI assistants authoring presentations in the
existing local NavSlides Editor. The intended consumers are Claude Code,
Claude Desktop, Cursor, and Codex. MCP provides discoverable tools; the companion
skill supplies presentation workflows and approval boundaries. Configuring one
does not prove that a consumer discovered the other.

## Start here

- [Project skill](../.agents/skills/navslides-editor/SKILL.md): authoring workflow, schema discovery, and observable completion.
- [Connection reference](../.agents/skills/navslides-editor/references/connection.md): installation, application launch, consumer configuration, and recovery.
- [Authoring reference](../.agents/skills/navslides-editor/references/authoring.md): outline/Markdown creation, templates, media, and targeted edits.
- [Exchange reference](../.agents/skills/navslides-editor/references/exchange.md): import jobs, export decisions, fidelity limits, and private sharing.

The connection reference owns launch and configuration examples. No user-global
consumer configuration is installed by this guide. Root `.mcp.json` is the
Claude Code project route, subject to the consumer's project approval policy.

## Architecture and selected boundaries

The CLI and stdio MCP process share the catalog under
[`scripts/agent`](../scripts/agent/). They call the existing application API;
there is no new Express route or workspace service. The operator starts the
Electron application or source development server separately, keeping ownership
of the selected presentation store explicit.

Stdio is selected because these consumers can launch a local process without
opening another network listener or maintaining OAuth credentials. The application
API connection is restricted to loopback, with no integration login. This is a
local-user trust boundary, not authentication suitable for a public service.
The server's existing validation, package authority, and ingress rules remain
responsible for accepted application mutations.

Launch MCP through Node directly, not an npm wrapper: protocol stdout must contain
only MCP messages. Root npm scripts are conveniences for interactive CLI use;
consumer process registration points to `scripts/agent/mcp.mjs`.

The root [manifest](../package.json) and [lockfile](../package-lock.json) own the
SDK/dependency pins. The installed SDK's `StdioServerTransport` and
`SUPPORTED_PROTOCOL_VERSIONS` own transport and negotiation facts; do not infer
support for a newer protocol from documentation dates. Long-running PPTX admission
uses explicit application job handles, not an assumed MCP task extension.

### Executable ownership

| Boundary | Owner |
| --- | --- |
| Registered catalog and execution guard, schemas/results, stdio adapter | [`catalog.mjs`](../scripts/agent/catalog.mjs), [`contracts.mjs`](../scripts/agent/contracts.mjs), [`mcp-server.mjs`](../scripts/agent/mcp-server.mjs) |
| Loopback API origin, redirects, HTTP read-only guard | [`client.mjs`](../scripts/agent/client.mjs) |
| Read/discovery and authoring references | [`read-tools.mjs`](../scripts/agent/read-tools.mjs) |
| Deck mutations and generation fences | [`deck-tools.mjs`](../scripts/agent/deck-tools.mjs), [`edits.mjs`](../scripts/agent/edits.mjs) |
| Snapshot/share approval schemas | [`lifecycle-tools.mjs`](../scripts/agent/lifecycle-tools.mjs) |
| Workspace containment, real paths, file I/O | [`files.mjs`](../scripts/agent/files.mjs) |
| File admissions and job capabilities | [`file-import-tools.mjs`](../scripts/agent/file-import-tools.mjs) |
| Export modes and project serialization | [`file-export-tools.mjs`](../scripts/agent/file-export-tools.mjs), [`file-project-export.mjs`](../scripts/agent/file-project-export.mjs) |
| Browser preview and local asset boundary | [`file-preview.mjs`](../scripts/agent/file-preview.mjs) |

Discover the actual operation list and input fields with CLI help or MCP tool
schemas, rather than maintaining another API catalog here. The workflow references
teach decisions; the executable owners determine accepted fields and results.

## Side effects and authorization

Use this map to decide whether an operation is within the user's request, not as
a substitute for current tool annotations or schema discovery:

| Intent | Effect boundary | Approval decision |
| --- | --- | --- |
| Inspect status, decks, templates, media, history, fidelity, analytics, or jobs | Application reads; some results contain sensitive content or access grants | Scope reads to the selected task; read-only does not make output public. |
| Create/duplicate/edit, save a template, or snapshot | Application presentation/history storage | Reuse authorized authoring scope; protect replacements and removals with explicit approval. |
| Delete, restore a snapshot, revoke a link, or cancel an import | Destructive content/access/job transition | Obtain explicit user authorization before supplying `confirm:true`. |
| Upload or import | Read approved local input and mutate application storage | Establish file scope; active-content acknowledgment requires a trusted-author decision. |
| Preview or export | Write an artifact into the approved workspace | Choose an authorized output path; overwriting is a separate explicit decision. |
| Create a share | Create an access grant | Publish only on request and deliver sensitive access through an approved private destination. |

Read-only is an enforceable process restriction, not just a tool hint: its owners
are the shared execution guard, HTTP client, and file guards above. It blocks
mutations, imports/uploads, and even otherwise read-oriented preview/export file
writes. Dry-run authoring is for proposed changes, not permission to apply them.

The file workspace is distinct from application data storage. Keep automation
artifacts and approved input files there; it is not a route to arbitrary local
paths. The default root is this repository. Choose another
`NAVSLIDES_WORKSPACE` only within the operator's granted filesystem scope.

Capabilities are intentionally returned to the authorized consumer for explicit
job control. They are not documentation, telemetry, URLs, or public completion
material. Imported slides, notes, HTML, and prompts remain untrusted data.

## Non-goals and evidence limits

Remote MCP hosting, HTTP/OAuth transport, registry/npm publication, AI provider
settings, cloud sync, credential management, and live games are outside this
integration. Native PowerPoint reconstruction and PDF output are not substitutes
for the available export modes. Original PPTX and server-validated edited PPTX
have different user intent; the exchange reference owns that decision.

Source/schema evidence establishes the implemented contract. SDK client smoke
checks establish only the protocol paths they exercise. Neither proves consumer
UI registration, project-skill activation, English/Vietnamese routing, or a
public share's network reachability. Those consumer-specific checks remain
unverified unless an actual consumer run supplies a scoped receipt; do not infer
success from a configuration example or an intended consumer list.

## Local verification

The local checks used isolated application storage, not the operator's existing
decks or uploads. Node.js 22.22.0 exercised installed MCP SDK 1.31.0; the SDK
consumer negotiated protocol `2025-11-25` over stdio and discovered 29 tools.

| Check | Observed result |
| --- | --- |
| Real CLI and SDK MCP workflows | Deck creation, targeted edits/dry runs, snapshots, templates, trash/restore, sharing/revocation, media, project import/export, and slide/vertical-child PNG preview exercised. |
| Mutation/file boundaries | Missing confirmation, stale generation, read-only writes, invalid inputs, workspace escape, and unapproved overwrite rejected in the exercised cases. |
| Original PPTX | Real import completed; original export was byte-identical to its source. |
| Validated edited PPTX | Both MCP and CLI returned `OFFICECLI_VALIDATOR_UNAVAILABLE` / HTTP 422; CLI retained its JSON error envelope with exit code 1. No original/reconstructed fallback. |
| Focused regression checks | Atomic editing and file boundaries: 12 tests passed. Browser project export and workspace lock: 6 tests passed. |
| Source/skill checks | Affected-source ESLint passed; skill structure passed; prompt lint reported zero high/medium/low findings; both reusable skill cases validated. |
| Browser compilation | Vite production build passed in a disposable output directory. It reported a mixed static/dynamic import warning for `use-game-socket.js`; no game code was changed. |

The independent, explicitly loaded skill consumer completed a Vietnamese
three-slide authoring task, changed only the visible slide-2 heading, preserved
its bullets/notes and adjacent slides, exported JSON, and inspected the actual
PNG. The initial no-skill and initial skill runs exposed content loss and an
ignored text-field edit; the authoring reference was clarified and the fresh
revised consumer completed the task. This small case set does not establish a
general quality or cost advantage, or automatic skill activation.

Local receipts and artifact evidence remain under `.tmp/navslides-agent-proof/`,
`.tmp/navslides-consumer-authoring-final/`, and
`.tmp/navslides-consumer-import-cli-proof/`; reusable consumer acceptance cases
live in `.agents/skills/navslides-editor/evals/evals.json`. Generated decks used
temporary server stores that were removed after verification, so receipt deck
IDs are evidence identifiers, not presentations left in the operator's store.
Throwaway smoke scripts and the isolated build output were removed.

The edited-export prerequisite is the existing server's qualified validator and
launcher/containment configuration, not merely an arbitrary OfficeCLI executable
on PATH. This integration neither supplies that qualification nor weakens it.

