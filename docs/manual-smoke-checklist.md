# Manual Smoke Checklist

Target runtime: 35-45 minutes. Run this only after automated PR fast lane passes.

## Always Run

| Step | Mapping | Time | Check |
|---|---|---:|---|
| Create deck, add text + shape, format, align, save/reload | `export.html`, `flow.autosave`, `canvas.align` | 8m | automated-backed: Saved JSON and exported HTML preserve marker text and shape color. |
| Share link with password, open viewer, revoke link | `share.password`, `share.revoke` | 6m | automated-backed: Password is required before revoke; revoked link no longer opens. |
| Import PPTX sample, edit imported text, export PPTX | `import.pptx`, `export.pptx` | 10m | automated-backed: Imported text remains editable; exported package opens and contains edited marker. |
| Start live room, reconnect presenter/viewer, end room | `live.reconnect`, `live.presenter-authz` | 7m | automated-backed: Viewer resyncs after reconnect; invalid presenter reuse fails. |
| Run release artifact scan before sharing reports | manual-risk: secret/artifact leak | 4m | manual-only: `rg --no-ignore --hidden` scan from CI gate report returns no secrets. |

## Rotating Domain Sample

Run one row per release unless that domain changed, then run the changed row.

| Step | Mapping | Time | Check |
|---|---|---:|---|
| AI generate/rewrite/translate with local/mock provider | `ai.generate`, `ai.rewrite`, `ai.translate`, `ai.failure` | 8m | automated-backed: Provider errors are generic; malformed JSON does not corrupt deck. |
| Markdown import and project export/import archive | `import.markdown`, manual-risk: archive media integrity | 8m | automated-backed: Slides split correctly; archive re-import keeps local media references. |
| Game scoring and leaderboard | `element.game`, `game.score` | 8m | automated-backed: Player score updates and leaderboard ordering are visible to presenter. |
| History snapshot save/restore/delete | `history.snapshot` | 6m | automated-backed: Restore changes deck state; deleted snapshot disappears. |
| rclone status/config view without credentials | `sync.rclone-status` | 5m | automated-backed: UI shows configured/unconfigured state without exposing secrets. |

## Automation Boundary

- Do not duplicate full Playwright, PPTX corpus, or k6 load locally unless release strict lane calls for it.
- External AI/sync/GitHub/rclone checks are contract/local only unless a hermetic adapter or dedicated test credentials exist.
- Any skipped manual row must be recorded in the release summary as risk, not silently omitted.

Unresolved questions:

- None.
