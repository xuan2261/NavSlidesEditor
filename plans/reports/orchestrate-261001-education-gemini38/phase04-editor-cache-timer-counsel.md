## TL;DR
**GO for the isolated forced Vite restart. GO for the timer tuple cutover. NO-GO for Phase04 acceptance until actual surfaces pass.** Read-only counsel; no commands, tests, or edits executed.

## Reframed problem
Restore the editor’s optimized shared-package export, then make timers address effective game instances rather than raw element IDs.

The cache discrepancy is verified: `shared/src/index.js:146` exports the helper; cached `client/node_modules/.vite/deps/revealjs-shared.js:9620-9642` omits it from the root barrel, although its implementation exists internally. `EditorPage.jsx:39,585` imports/calls that root export. This supports the supplied runtime failure without rerunning it.

## What to do
1. Stop only the owned isolated Vite service. Restart with the specified proxy, host, port, `--strictPort --force`; disable browser cache and reload. Preserve API/data. [Vite’s documented linked-dependency procedure](https://vite.dev/guide/dep-pre-bundling#monorepos-and-linked-dependencies) matches this repair.
2. Extract the timer service; centralize `JSON.stringify([effectiveSlideId, elementId])` and migrate descriptors, host bindings, and allocator to that helper.
3. Require both unchanged, nonempty identity strings. Replace the timer-only colon-rejecting validator (`server/services/socket-handler.js:12-14`); do not weaken unrelated validation.
4. Carry both fields through commands, sync, ended callbacks, replay, and client readers. Host commands already carry them (`shared/src/education/browser/live-host-commands.js:19-22`).

## What to avoid / contract risks
- No barrel repair, shim, raw-ID fallback, or mixed-version compatibility path. This is a breaking socket/client callback contract; cut over all consumers together.
- A tuple identifies state; it does **not** authorize control. Preserve server-derived room membership and `canControlTimer` (`server/services/live-rooms.js:288-291`), including speaker admission and existing legacy-role policy.
- Preserve duration/delta limits and disconnect/reconnect lifecycle. Treat `<200 LOC` as a maintainability target, not permission to omit behavior.
- Do not re-pin the two obsolete event-copy assertions; remove those assertions while retaining meaningful behavior coverage.

## Work checklist / success metrics
Exercise editor load, Try gameplay, and offline download. Then prove inherited-copy isolation, pause/resume/adjust/stop, expiry/reconnect, and revoked-role rejection.

**Next risk:** stale timeout ownership. `socket-handler.js:68-71` compares mutable timer deadlines and unconditionally deletes the timeout slot. Capture immutable timer/deadline/timeout ownership; an obsolete callback must neither expire replacement state nor delete its timeout.

## Assumptions
**High confidence:** supplied failure is authoritative. **Medium confidence:** all timer consumers can migrate together; otherwise the clean-cutover acceptance gate fails. Model-family independence remains false.