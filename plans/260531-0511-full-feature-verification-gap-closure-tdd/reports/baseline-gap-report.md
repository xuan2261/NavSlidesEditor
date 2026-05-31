# Baseline Gap Report

Generated: local run
Editor-core baseline total: 100
Verified PASS: 90/100
Gap count: 10

| Capability | Status | Risk | Target | Reason | Debt until |
|---|---|---|---|---|---|
| canvas.lock | ALLOWED | P2 | unit | lock toggle is inline component state; no pure seam — needs extraction | 2026-06-30 |
| canvas.move | ALLOWED | P2 | unit | drag-delta applied in pointer-interaction hook; no testable export | 2026-06-30 |
| command.insertLink | ALLOWED | P2 | unit | action is an inline DOM-query closure in EditorPage commands array | 2026-06-30 |
| command.insertSlide | ALLOWED | P2 | unit | action opens a modal via inline closure; needs handler extraction | 2026-06-30 |
| command.startSlideshow | ALLOWED | P2 | unit | action is a console.log stub at EditorPage.jsx:946 — real wiring gap, tracked | 2026-06-30 |
| control.file.menu | ALLOWED | P2 | component | file dropdown lacks an isolated render seam; deep component tree | 2026-06-30 |
| shortcut.eraseAnnotations | ALLOWED | P2 | unit | annotation present-mode wiring not unit-covered | 2026-06-30 |
| shortcut.highlighterTool | ALLOWED | P2 | unit | annotation present-mode wiring not unit-covered | 2026-06-30 |
| shortcut.laserPointer | ALLOWED | P2 | unit | annotation present-mode wiring not unit-covered | 2026-06-30 |
| shortcut.penTool | ALLOWED | P2 | unit | annotation present-mode wiring not unit-covered | 2026-06-30 |
