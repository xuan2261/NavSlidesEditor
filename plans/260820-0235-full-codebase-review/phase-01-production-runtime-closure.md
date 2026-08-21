# Phase 01 — Production runtime closure

Status: **Complete** — exact dependency/runtime closure, Windows start, staged vendor publication, Electron rebuild and receipt verified.

## Goal

Loại bỏ dependency graph invalid và bảo đảm Docker/Electron/Windows runtime chỉ dùng dependencies, versions và artifacts đã khai báo, lock, kiểm thử.

## Locked baseline

- Electron `42.9.3` exact là source-of-truth duy nhất cho dev, test, builder và packaged runtime; electron-builder khóa `26.15.3` để loại bỏ AppImage search-path advisory.
- Node `22.22.0` exact là build/CI/Docker runtime; public `engines.node` floor là `>=22.13.0` để đáp ứng production PDF.js security baseline.
- Toàn bộ direct `@tiptap/*` khóa exact `2.27.2`; remediation không đổi persisted rich-text schema sang v3.
- `server/package.json` sở hữu production dependencies. Electron preparation dùng checked-in isolated production lock và `npm ci`, không `npm install` floating.

## Findings covered

- High H2: TipTap v2/v3 peer graph `invalid`.
- Medium M4: custom AI endpoint thiếu declared `undici`.
- Medium M3: Electron dev/test 42 nhưng release 33.
- Medium M7: Electron production install không reproducible.
- Medium M6: `npm start` hỏng trên Windows.
- Rejected finding retained as qualification: Socket.IO client đã được build-time vendor; cần artifact smoke, không cần server runtime dependency.

## Likely files

- `client/package.json`, `package.json`, `package-lock.json`, Node version owner
- `server/package.json`, `server/index.js`, `server/vendor-assets.test.js`
- `Dockerfile`, `electron-builder.yml`, `scripts/copy-vendor.js`
- `scripts/prepare-electron.js`, checked-in Electron server lock, release workflow/tests
- Rich-text compatibility fixtures và focused dependency/runtime tests

## Steps

1. Pin mọi direct `@tiptap/*` về exact `2.27.2`, regenerate root lock bằng clean install; fixture existing rich-text HTML phải giữ highlight, color, table, links, math/custom marks qua `setContent` → `getHTML` round-trip.
2. Khai báo exact `undici` release tương thích Node `22.22.0` tại `server/package.json`; production-deps-only resolver không dựa vào root/dev hoisting.
3. Pin Electron exact `42.9.3` và electron-builder exact `26.15.3` ở source-of-truth duy nhất; cùng giá trị drive developer binary, root lock và packaged runtime.
4. Thêm một version owner cho Node exact `22.22.0`; root engines giữ floor `>=22.13.0`, còn Docker builder/runtime, CI và release jobs consume exact version hoặc immutable base digest đã chứng minh chứa đúng version.
5. Giữ `server/package.json` là manifest owner; synthesize isolated Electron server manifest deterministically, pair với checked-in isolated lock, chạy `npm ci --omit=dev --ignore-scripts`. Hai clean runs trên cùng Windows image/arch phải có canonical package name/version/integrity tree hash giống nhau.
6. Thay POSIX-only `NODE_ENV=production` bằng cross-platform start mechanism tối thiểu; native Windows CI chạy đúng command public.
7. Rework `copy-vendor` thành staging publication: required source thiếu là fatal, validate manifest + hashes, rồi atomic replace live vendor tree; failure giữ nguyên tree cũ và cleanup staging.
8. Docker và release workflow pin base/action/tool versions bằng immutable digest/SHA nơi platform hỗ trợ; mỗi stage emit receipt gồm Node/npm/OS, lock hash, production tree hash, vendor manifest hash và output SHA-256.

## Validation

- Clean `npm ci` dưới Node `22.22.0` đáp ứng public floor; `npm ls @tiptap/core @tiptap/react @tiptap/starter-kit @tiptap/extension-highlight --all` exit 0 và chỉ có major 2.
- Existing rich-text fixture round-trip giữ semantic HTML/marks cho highlight, color, table, link và custom math/font extensions; editor command smoke pass.
- Production-deps-only server resolves declared `undici` từ server tree.
- Vendor copy failure injection giữ previous manifest/tree byte-identical; success manifest đủ required assets. Docker/unpacked Electron request `/vendor/socket.io/socket.io.min.js` HTTP 200 và Live Presenter join/navigation hoạt động.
- Packaged runtime reports Electron `42.9.3` và Node `22.22.0`; dev, builder, lock và artifact version owners bằng nhau.
- Windows CI chạy documented `npm start`, polls health, rồi clean process-tree shutdown.
- Hai isolated Electron installs trên cùng Windows image/arch có identical canonical dependency-tree hash; receipt schema reject missing field/hash mismatch.
- Docker base digest, Electron artifact SHA-256 và lock/vendor receipts được lưu cùng release evidence.

## Risks / rollback

- TipTap v2 alignment vẫn có thể đổi HTML do patch delta; fixture lấy từ persisted production-compatible documents, compare semantic output và rollback toàn bộ manifest + lock nếu drift.
- Electron major alignment có thể ảnh hưởng native ABI; rollback version change độc lập nếu packaged smoke fail, nhưng không ship mismatch.
- Node/image pin cần coordinated update khi security patch; thay exact value + digest + receipts trong một change, không quay lại floating tags.
- Isolated lock và staged vendor publication phải fail closed; rollback bằng previous checked-in lock/manifest, không reconcile `node_modules` thủ công.

