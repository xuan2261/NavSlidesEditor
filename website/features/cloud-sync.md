# Cloud Sync

NavSlides Editor publishes presentation bundles to a configured [rclone](https://rclone.org/) remote. This is presentation delivery, not a mirror or full backup of the server's data and uploads directories.

## Why rclone

- **No lock-in**: configure once, switch providers without touching NavSlides
- **Local authoring**: presentation data stays local; cloud sync requires a network connection and a configured rclone remote.
- **Whole-library or single-deck delivery**: sync healthy presentations together or publish one presentation with its referenced media.

## Wiring it up

1. Install `rclone` on the host running NavSlides
2. Run `rclone config` to set up your remote
3. Configure the sync target in **Settings → Cloud Sync**
4. Trigger sync manually or schedule it via your OS scheduler

The application exposes fixed sync operations through `POST /api/rclone/sync` and `POST /api/rclone/sync-single`; it does not expose arbitrary rclone CLI operations.

## What gets synced

The bundle producer in [`server/routes/sync.js`](https://github.com/xuan2261/NavSlidesEditor/blob/main/server/routes/sync.js) owns the payload: presentation HTML and JSON, available package-backed content, and referenced uploads. Settings, template/share records and the instance's history directory are not a full-instance backup payload. Keep operator backups separate from cloud presentation delivery.
