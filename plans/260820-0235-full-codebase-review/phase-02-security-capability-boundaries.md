# Phase 02 — Security and capability boundaries

Status: **Complete** — analytics/operator boundary, Electron confinement, mapped/special/NAT64 endpoint defense verified.

## Goal

Khóa đúng analytics capability, Electron renderer boundary và AI endpoint network defense-in-depth theo supported trust model.

## Findings covered

- High H1: analytics cross-token/referrer disclosure.
- Medium M1: Electron prefix-origin bypass trong unsandboxed renderer.
- Low L1: SSRF guard bỏ lọt hex IPv4-mapped IPv6; nâng severity nếu untrusted tenant được cấu hình endpoint.

## Locked decision

- Raw analytics là editor/operator-only surface; share token không cấp analytics capability và không xây viewer aggregate endpoint trong remediation scope.
- Local loopback/Electron user là operator. Remote deployment phải đặt editor và operator API sau authenticated reverse proxy; public share routes được tách riêng.
- Không thêm built-in account/session system. Existing external-auth architecture là credential boundary và phải có documented route topology + deploy smoke.

## Likely files

- `server/routes/analytics.js`, analytics API/unit/E2E tests
- Analytics client/editor navigation flow; share route negative tests
- `electron/main.js`, `electron/preload.js`, Electron integration/security tests
- `server/services/ai-endpoint-guard.js` và tests
- `README.md`, deployment/security docs và reverse-proxy contract fixture

## Steps

1. Tách analytics authorization khỏi viewer share-token check; owner/editor API trả raw analytics theo operator boundary đã khóa. Server route không xem share capability là credential.
2. Loại bỏ share-token query khỏi analytics client/API contract; editor mở Analytics qua existing owner navigation flow. Đặt `Cache-Control: no-store`; URL, referrer, error và logs không chứa share/admin credential.
3. Cập nhật deployment contract: loopback/Electron được coi là local operator; remote reverse proxy authenticate editor + operator API, trong khi public share route không transitively expose analytics. Không thêm ad-hoc app token.
4. Parse URL và compare exact `origin` cho window-open/main-frame navigation; external URL luôn mở system browser. Test blob owner/origin và `will-frame-navigate` hoặc document rõ subframe policy.
5. Bật Chromium sandbox. Repo không có consumer của `window.electronAPI`, nên mặc định xóa preload credential bridge + IPC handlers; chỉ giữ nếu có contract thật, khi đó validate sender/main frame/origin và allowlist keys.
6. Normalize IPv4-mapped, IPv4-compatible, well-known NAT64 embedded IPv4 và IANA special-use IPv6 bằng canonical bytes trước policy check và dispatcher pinning; không blanket-block public IPv6/NAT64.
7. Ghi security decision trong owning docs; xóa stale safeStorage/share-viewer analytics claims.

## Validation

- Owner Analytics UI flow qua operator boundary nhận đúng raw detail và `Cache-Control: no-store`; share token A/B, unauthenticated public-share context và forged query không authorize endpoint.
- Reverse-proxy integration fixture chứng minh public `/share` vẫn reachable nhưng editor/operator analytics route yêu cầu external credential; logs/redirect URLs không lộ credential.
- Regression matrix cho userinfo, encoded URL, mixed case, default port, subdomain/prefix confusion, blob owner, child window và subframe policy.
- Nếu IPC bị xóa: preload surface absent. Nếu giữ: app main frame hợp lệ pass; non-app/subframe/key ngoài allowlist reject.
- Packaged test harness probes effective renderer sandbox (`process.sandboxed` hoặc test-only equivalent), `getLastWebPreferences()`, absence of `--no-sandbox`, popup/main-frame denial và external-browser handoff; static source assertions không đủ release gate.
- Direct literal + mock DNS trả `::ffff:7f00:1`, `::ffff:0a00:1`, `64:ff9b::7f00:1`, `64:ff9b::0a00:1` và table-driven private/special ranges; tất cả fail closed trong khi public IPv6/NAT64 vẫn pass.

## Risks / rollback

- Analytics boundary phụ thuộc deployment topology; docs/sample proxy và deploy smoke là part of security contract. Không thêm raw viewer-token fallback hoặc ad-hoc app auth.
- Sandbox enable có thể lộ preload assumptions; sửa/remove bridge, không disable sandbox để rollback.
- Network normalization phải giữ public IPv6 endpoint hợp lệ; canonical table-driven tests tránh overblocking.

