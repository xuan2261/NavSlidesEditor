# Phase 03 — Presenter and product reliability

Status: **Complete** — popup bridge, supported game/timer action routing, Reveal lifecycle, defaults, marketplace và route-state contracts verified.

## Goal

Sửa verified UI/runtime regressions và khôi phục test coverage phản ánh contract thật.

## Findings covered

- High H3: game presenter shortcut callback bị mất wiring.
- Medium M8: Reveal iframe timeout cũ clear polling frame mới.
- Medium M9: Default Preferences không áp dụng cho New Presentation.
- Medium M11: Marketplace rejection hiển thị loading vô hạn.
- Medium M12: live presenter route-state fixture stale; verification gap, không phải runtime defect.

## Likely files

- `client/src/hooks/editor-controller/use-editor-live-session-controller.js`
- `client/src/hooks/editor-controller/use-editor-keyboard-controller.js`
- `client/src/pages/EditorPage.jsx`, presenter wiring/bridge tests
- `client/src/hooks/use-reveal-preview-frame.js` và hook tests
- `client/src/pages/HomePage.jsx`, `SettingsPage.jsx` và flow tests
- `editor-live-presenter-route-state.test.jsx`

## Steps

1. Return `emitGameShortcutAction` từ live-session controller; giữ producer/consumer contract trực tiếp; route game namespace actions qua game host socket và timer actions qua primary live socket; không expose shortcut thiếu runtime consumer.
2. Sở hữu interval + timeout + `onload` theo từng Reveal effect generation; cleanup đúng generation và unmount.
3. Load persisted defaults trước khi mở New Presentation; giữ fallback khi settings unavailable và không overwrite form đã được user sửa.
4. Tách marketplace `loading/error/data`; có accessible Retry và distinct successful-empty state.
5. Cập nhật route-state fixture với `remoteToken`/`speakerToken`; không đổi production behavior nếu test chỉ stale, thêm malformed-response test nếu contract cần cover.

## Validation

- `editor-page-present-wiring.test.jsx` và generated-runtime tests: supported Enter/Space/P/action không throw, queued popup messages drain đúng socket; unsupported direct team/reveal shortcuts không còn trong registry/config/docs.
- Fake timers A→B: timeout/onload A không dừng polling B; B eventually assigns deck; unmount không leak timer.
- Settings save `white/fade` → Home form và create payload dùng `white/fade`; late/failing settings không overwrite user input và giữ fallback.
- Marketplace reject → alert + Retry; retry success → cards; successful empty payload → empty state, không phải loading.
- Route-state focused test pass và assert intended cleanup/navigation; malformed token response vẫn fail closed.

## Risks / rollback

- Default settings load có thể tạo render race; form đã touched không được overwrite bởi late response.
- Reveal lifecycle fix dễ leak nếu cleanup thiếu; assert timer count và stale `onload` generation.
- Rollback từng behavior độc lập; không revert tests encode accepted contract.

