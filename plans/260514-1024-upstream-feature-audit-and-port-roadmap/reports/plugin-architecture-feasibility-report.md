# Plugin Architecture Feasibility Report

Date: 2026-05-14

## Summary

Decision: `defer to separate P1/P2 architecture epic`.

Upstream plugin/Manim work is not a small port. It changes storage, server routes, toolbar/editor integration, iframe sandboxing, asset serving, export hooks, and runtime trust boundaries.

Do not implement plugin architecture in the current sync branch.

## Upstream Series

| Commit | Finding |
| --- | --- |
| `e37311be` | Adds plugin API foundation, storage layer, migrations, server routes. |
| `82be9d02` | Adds plugin context, sandbox, rendering hooks, export path. |
| `278739b4` | Adds loader, sample plugin, toolbar integration, plugin assets. |
| `f9b64b61` | Fixes asset serving order before auth middleware. |
| `4400b516` | Moves plugin tools into toolbar dropdown. |
| `071205a1` | Moves plugin dropdown and layout tools. |
| `fca7cc2a` | Fixes sandbox bridge injection and asset paths. |
| `4798a3b9` | Makes listing public and fixes loader fetch. |
| `b6fda989` | Moves Manim into plugin with manifest/sandbox/editor integration. |

## Threat Model

Trust boundary:

- Current app already supports trusted author HTML.
- Plugin architecture adds reusable executable packages and host/plugin messaging.
- Marketplace or user-installed plugins would introduce untrusted code risk.

Risks:

- plugin asset path traversal
- malicious sandbox HTML/JS exfiltrating data through network
- unsafe `postMessage('*')` bridge patterns
- plugin code mutating presentation data beyond its element
- export mismatch between live plugin and static HTML
- server route exposure for plugin listing/assets/install
- Docker/Electron packaging drift

Required controls before implementation:

- local-only bundled plugins first
- no remote marketplace by default
- path normalization with tests for plugin assets
- iframe `sandbox="allow-scripts"` only; avoid same-origin unless proven needed
- origin/source validation for host/plugin messages
- explicit capability manifest
- export fallback contract
- security tests for route traversal and message validation

## MVP Scope If Accepted Later

Recommended MVP: local-only bundled plugins.

- `plugins/{slug}/parallax-plugin.json`
- static asset serving from bundled plugin directories
- `plugin:*` element renderer in editor canvas
- shared export fallback or static render hook
- no install/uninstall API
- no remote plugin fetch
- no write access to storage
- no Manim until generic sandbox/export contract is stable

## Estimate

- Architecture/design/threat model: 4-6h.
- Local-only MVP: 20-30h.
- Tests/security review/docs: 10-16h.
- Manim plugin after MVP: 8-14h.

## Recommendation

Defer. Create separate epic if plugin/Manim is product direction. Do not mix with upstream bugfix/UX ports.

## Verification

Planning gate only:

```powershell
git diff --stat
```

## Unresolved Questions

- User go/no-go: should plugin/Manim become core product direction or stay experimental backlog.
