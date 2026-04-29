# Code Review Tổng Hợp — Full Codebase Scan
**Scope**: 299 files, net -23K lines (commit: "feat: complete Phase 1 command layer unification")
**Reviewers**: scout + 4 parallel code-reviewer agents
**Files examined**: ~187 source files across client/server/shared/electron

---

## Tổng Quan

Refactor Phase 1 thành công — SlideCanvas từ 3522 dòng xuống ~842 dòng, logic được tách clean. Nhưng có **nhiều correctness bug nghiêm trọng** từ refactor cần fix trước khi merge.

---

## CRITICAL ISSUES (14 total — phải fix trước merge)

### === CLIENT (Presentation Logic) ===

**C1. presentation-store.js: Dead state — `currentSlideIndex` không bao giờ được cập nhật**
- `setCurrentSlide` chỉ được gọi trong test files. Tất cả `updateSlide`, `updateElement`, `addElement`, `deleteElement` đọc `state.currentSlideIndex` từ store (luôn = 0). Element operations trên slide khác slide đầu tiên sẽ mutate sai slide.
- **Fix**: Wire store's `setCurrentSlide` với EditorPage's `setCurrentSlideIndex`, hoặc remove dead state khỏi store.

**C2. use-slide-operations.js:227-262 — `addSlide` bỏ qua `afterIndex`, luôn append vào cuối**
- `afterIndex` được accept nhưng không dùng. `presentation.slides.length` đọc từ closure (stale) thay vì `prev.slides.length`.
- **Fix**: Dùng splice-style insertion, đọc `prev.slides.length`.

**C3. use-slide-operations.js:276-286 — `duplicateSlide` thiếu `currentSlideIndexRef` trong deps**
- Callback không re-create khi `currentSlideIndexRef` thay đổi.
- **Fix**: Thêm `currentSlideIndexRef` vào dependency array.

**C4. use-live-presentation.js:17-76 — Socket.IO race condition (closure staleness + cleanup bug)**
- `setupSocket()` là async, nhưng `return` cleanup chạy đồng bộ. Trên fast re-renders, `activeSocket` có thể `null` tại cleanup time → orphan connections, double connections, memory leak.
- `presenterSecret` từ state closure không re-emit khi prop `presenterToken` thay đổi sau mount.
- **Fix**: Dùng `useRef` + cancellation flag + `socketRef.current?.disconnect()`.

**C5. use-live-presentation.js + LiveViewPage.jsx — Không có `connect_error` handler**
- Network failures, invalid URLs, CORS issues silently fail với zero user feedback.
- **Fix**: Thêm `activeSocket.on('connect_error', (err) => setJoinError(err.message))`.

**C6. SettingsPage.jsx:206-218 — Recursive API call trong `handleTestConnection`**
- `handleTestConnection` gọi `await handleSave()` bên trong, mỗi lần click "Test Connection" đều fire thêm 1 PUT request không cần thiết.
- **Fix**: Remove `await handleSave()` khỏi `handleTestConnection`.

### === CLIENT (Security) ===

**C7. TransitionPreview.jsx:43 — Unsanitized `presentation.theme` trong external CDN URL**
- `presentation.theme` là user-controlled. Attacker có thể set theme thành `https://evil.com/white.css` → iframe load external CSS từ domain tùy ý.
- **Fix**: Validate against known theme allowlist trước khi insert vào HTML string.

**C8. LivePresentationModal.jsx:85-96 — presenterToken không gửi đúng cách, onClose fire dù popup bị block**
- `presenterToken` chỉ được lưu vào `window.name` (đọc được bởi bất kỳ page cùng origin). `onClose()` fire bất kể popup được mở hay không.
- **Fix**: Gửi presenterToken qua HTTP-only cookie hoặc POST body. Move `onClose()` vào trong `if (presenterWindow)`.

**C9. InsertMenu.jsx:251-267 — Media upload không có try-catch**
- Upload fail → `r.json()` throws hoặc trả error object → không có feedback cho user.
- **Fix**: Wrap trong try-catch, hiển thị error message cho user.

### === SERVER (Security) ===

**C10. server/routes/upload.js:33 — SVG upload XSS vector**
- `.svg` được allow upload, được serve tĩnh tại `/uploads/`. SVG có thể embed `<script>` hoặc event handlers (`onload`). Khi presentation embed SVG, JS thực thi trong browser viewer.
- **Fix**: Block SVG uploads hoàn toàn, hoặc sanitize server-side strip `<script>` tags và event attributes trước khi lưu.

**C11. electron/main.js:2,8 — Electron sandbox disabled**
- `ELECTRON_DISABLE_SANDBOX=1` và `--no-sandbox` disable Chromium security sandbox. Dù `nodeIntegration: false` và `contextIsolation: true` đúng, sandbox còn mitigate renderer exploits khác.
- **Fix**: Remove cả 2 dòng disable sandbox.

**C12. server/index.js — No authentication trên bất kỳ route nào**
- Mọi endpoint đều unauthenticated. Bất kỳ client nào reach được server port đều có thể CRUD bất kỳ presentation/template/share token nào.
- **Fix**: Thêm "no auth" comment trong README + server code, hoặc implement API key middleware.

**C13. server/routes/settings.js:27 — Arbitrary field injection**
- `PUT /api/settings` dùng `{ ...existing, ...req.body }` không có schema validation. Client có thể inject bất kỳ key nào vào settings object.
- **Fix**: Thêm Zod schema validation, whitelist allowed fields.

**C14. server/routes/templates.js:29-46,61-77 — Templates POST/PUT không có schema validation**
- Raw `req.body` spread vào object. Malformed templates có thể corrupt storage file.
- **Fix**: Apply `validate(createPresentationSchema)` cho template POST/PUT handlers.

---

## HIGH-PRIORITY ISSUES (11 total)

**H1. EditorPage.jsx:818 — `handleUndo` không có trong useEffect dependency array** (scout)
- ESLint `react-hooks/exhaustive-deps` sẽ flag. Works vì `handleUndo` stable, nhưng cần explicit hoặc dùng ref.
- **Fix**: Thêm `handleUndo` vào deps array.

**H2. use-clipboard.js:144-178 — Stale `selectedElementIds` trong performCut/performDuplicate** (scout)
- Giữa `useCallback` dependency check và actual execution, selection có thể đã thay đổi.
- **Fix**: Dùng `selectedElementIdsRef` capture giá trị mới nhất bên trong callback body.

**H3. exportPptx.js:106-113 — Raster fetch failure để lại dirty cache** (scout)
- `clearPptxRasterAssetCaches()` chạy trong `finally` kể cả khi `fetchComplexElementRasters` throw. Warning array bị mất nếu `exportToPptxClient` throw.
- **Fix**: Catch raster error riêng, re-throw sau cleanup.

**H4. SlideCanvas.jsx:332 — `setTimeout(0)` click suppression unreliable** (client reviewer)
- Browser có thể fire click sau timeout. Nhiều global document mouse listeners không có early-exit guard.
- **Fix**: Dùng flag-based suppression với proper state machine.

**H5. server/routes/share.js:119-129 — Share token deletion không có authorization** (server reviewer)
- Bất kỳ client nào có thể delete bất kỳ share token nào bằng cách guess UUID.
- **Fix**: Check presentation ownership trước khi delete.

**H6. server/services/live-rooms.js:28-32 — Room codes 6-byte, enumerable** (server reviewer)
- 36^6 ~ 2.8B combinations có thể bị brute-force. Không có rate limiting trên Socket.IO connections.
- **Fix**: Tăng lên 10 bytes (36^10 ~ 3.6e15) hoặc thêm room passwords.

**H7. server/services/ai-endpoint-guard.js — IPv6 SSRF gap không đầy đủ** (server reviewer)
- `fe80::/10` link-local chỉ block `fe80-fe8b`, không block đầy đủ range. Allowlist check là string equality, không phải suffix match.
- **Fix**: Block toàn bộ `fe80::/10`. Dùng hostname comparison cho allowlist.

**H8. SlidePanel.jsx:180 — `onDrop` thiếu `e.stopPropagation()`** (client reviewer)
- Drag events có thể bubble lên canvas.
- **Fix**: Thêm `e.stopPropagation()` trong onDrop handler.

**H9. FindReplaceBar.jsx:67 — handleReplace/handleReplaceAll không trong useCallback** (client reviewer)
- Functions recreated mỗi render → child components re-render không cần thiết.
- **Fix**: Wrap trong useCallback.

**H10. common-element-controls.jsx:16 — updateFinite recreated mỗi render** (client reviewer)
- **Fix**: Dùng useCallback hoặc move ra ngoài component.

**H11. editor-store.js — Unmemoized Zustand selectors** (scout)
- `selectedElementIds` array reference changes → tất cả subscribed components re-render. Với `editingElementId` thay đổi mỗi keystroke → entire canvas re-renders.
- **Fix**: Dùng `shallow` equality từ Zustand cho array/object selectors.

---

## MEDIUM-PRIORITY ISSUES (12 total)

**M1. shared/src/index.js — CommonJS `require()` trong ESM context** (scout)
- Long-term compatibility risk nếu shared/ được publish như standalone package. Hiện tại works fine.
- **Fix**: Convert sang ES module imports.

**M2. InsertMenu.jsx:2 — Dead `PromptPopover` import** (scout)
- Import không sử dụng. Component được dùng qua path khác trong file.
- **Fix**: Remove dead import.

**M3. shared/src/htmlGenerator.js:154 — Comment garbled (`ΓÇö` → em-dash)** (scout)
- Mojibake artifact từ UTF-8/Windows-1252 encoding confusion.
- **Fix**: Replace `ΓÇö` bằng `—`.

**M4. canvas-element-wrapper.jsx:26-39 — contentRef created cho mọi element** (scout)
- Với 50 elements/slide, tạo 50 refs. Chỉ cần cho `latex` elements.
- **Fix**: Tạo ref có điều kiện hoặc dùng plain variable trong effect.

**M5. shared/src/element-renderers.js:425-427 — `getBackgroundAttrs: null` export misleading** (scout)
- Được overwrite bởi spread từ htmlGenerator, nhưng `null` export gây confuse.
- **Fix**: Remove khỏi exports object hoặc document rõ ràng.

**M6. export-pptx-basic-renderers.js — 8 element types không có PPTX handlers** (scout)
- `svg`, `drawing`, `qrcode`, `markdown`, `icon`, `audio`, `video`, `latex` fall through to `addFallbackElement` → silent data loss.
- **Fix**: Add handlers cho mỗi type hoặc đảm bảo fallback tạo visual representation có ý nghĩa.

**M7. server/index.js:150-155 — Incomplete HTML/CSS sanitization trong share view** (server reviewer)
- Chỉ block CSS `expression` và `javascript:` URLs. Data URLs, `@import`, và main HTML body không được sanitize. DOMPurify có trong deps nhưng không dùng.
- **Fix**: Dùng DOMPurify server-side trước khi serve share view.

**M8. server/routes/presentations.js — Error messages leak internal stack traces** (server reviewer)
- `err.message` trả thẳng cho client trong nhiều route, có thể chứa file paths, function names.
- **Fix**: Thay `err.message` trong 5xx responses bằng "Internal server error". Log chi tiết vào console.error.

**M9. Toolbar.jsx — 1186 lines, nên split** (client reviewer)
- Component quá lớn. Nên tách thành 3 sub-components: background menu, text bar, main toolbar.
- **Fix**: Extract sub-components.

**M10. DropdownMenu.jsx:32 — Missing `aria-expanded`/`aria-haspopup` trên trigger** (client reviewer)
- Accessibility violation.
- **Fix**: Thêm ARIA attributes.

**M11. SlidePanel.jsx:249 — `dangerouslySetInnerHTML` với SVG-onload risk** (client reviewer)
- Đã có mitigation nhưng không block hoàn toàn.
- **Fix**: Validate SVG content trước khi inject.

**M12. InsertMenu.jsx:327 — SVG upload read as text, passed unsanitized** (client reviewer)
- SVG uploaded, read as text, passed to handler mà không sanitize.
- **Fix**: Sanitize SVG content trước khi xử lý.

---

## LOW-PRIORITY / POSITIVE OBSERVATIONS

**Positive:**
- SlideCanvas refactor thành công: 3522 → 842 dòng, clean extraction
- Properties panel well-organized: small, focused files
- `sanitizeRichTextHtml` và `sanitizeSvgContent` solid defense-in-depth
- `commitCropRef` pattern trong SlideCanvas correct
- Immutability correctly enforced với spread operators trong stores
- Hook cleanup proper trong hầu hết cases
- Store separation (presentation/editor/UI) well-designed
- UUID param validation comprehensive trên server
- File locking prevents JSON corruption
- bcrypt cho password-protected shares, SHA-256 hashed presenter tokens
- Zod schema validation cho AI và presentation routes
- Electron: `nodeIntegration: false`, `contextIsolation: true`
- Không có `console.log` trong production React component files
- Không có `TODO`/`FIXME` comments
- Không có `.bind(` calls — dùng arrow functions và useCallback consistency

**Low:**
- L1: Không có CSP header trên server
- L2: Promise-chain file lock không phải true mutex (works in practice)
- L3: Marketplace search case-sensitive
- L4: PPTX import 60s timeout reasonable
- L5: InsertMenu `PromptPopover` import đã có note ở M2

---

## ISSUE COUNT SUMMARY

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Client — Logic | 5 | 5 | 4 | 2 |
| Client — Security | 3 | 1 | 4 | 0 |
| Server — Security | 4 | 3 | 3 | 2 |
| Server — Other | 0 | 2 | 1 | 2 |
| **Total** | **12** | **11** | **12** | **6** |

---

## RECOMMENDED FIX ORDER

**Phase 1 (blockers — fix trước merge):**
1. C1: Dead `currentSlideIndex` in presentation-store → **data corruption**
2. C2: `addSlide` ignores `afterIndex` → **UX bug**
3. C4/C5: Socket.IO race + missing error handler → **memory leak + silent failure**
4. C7: TransitionPreview XSS via theme URL → **security**
5. C10: SVG upload XSS → **security**
6. C11: Electron sandbox disabled → **security**
7. C12: No authentication → **security** (document or fix)
8. C13/C14: Settings/templates injection → **data integrity**

**Phase 2 (sau merge):**
9. H1-H11: Fix stale closures, memoization, SSR gaps, accessibility, Toolbar split
10. M1-M12: Cleanup, dead code removal, sanitization hardening

---

## UNRESOLVED QUESTIONS

1. App có intended cho multi-user/public hosting không? Auth là hard blocker nếu có.
2. SVG uploads là genuine feature requirement hay có thể block?
3. Electron sandbox disable là temporary (dev-only) hay permanent?
4. C1: Dead store state — đây là intentional design (hook owns it) hay regression từ refactor?
5. M6: 8 element types không có PPTX handlers — acceptable fallback hay cần implement?
6. C4: `presenterSecret` staleness — intentional (token không change sau mount) hay cần fix?
