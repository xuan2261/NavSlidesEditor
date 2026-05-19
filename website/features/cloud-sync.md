# Cloud Sync

NavSlides Editor can mirror your `server/data/` and `server/uploads/` directories to any cloud provider [rclone](https://rclone.org/) supports — Drive, S3, Dropbox, B2, SFTP, WebDAV, and dozens of others.

## Why rclone

- **No lock-in**: configure once, switch providers without touching NavSlides
- **Offline-first**: all data lives locally; the cloud is a backup mirror
- **Selective**: sync presentations only, or include uploads, or include history snapshots

## Wiring it up

1. Install `rclone` on the host running NavSlides
2. Run `rclone config` to set up your remote
3. Configure the sync target in **Settings → Cloud Sync**
4. Trigger sync manually or schedule it via your OS scheduler

The endpoint that drives sync is `POST /api/sync` (see `server/routes/sync.js`). It shells out to `rclone` with the configured remote — so anything you can do at the rclone CLI is available here.

## What gets synced

- `server/data/*.json` — presentation, template, and share metadata
- `server/data/history/` — version snapshots
- `server/uploads/` — media assets

Secrets and per-instance config (`server/data/settings.json`) are sync-excluded by default.
