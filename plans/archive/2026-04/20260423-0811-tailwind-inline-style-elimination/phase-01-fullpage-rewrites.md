---
phase: 1
title: "Full-Page Rewrites (SpeakerViewPage + LiveViewPage)"
status: pending
priority: P1
effort: "3h"
dependencies: []
---

# Phase 01: Full-Page Rewrites

## Overview

Chuyển đổi 2 trang sử dụng 100% inline-style (gần như zero Tailwind adoption) sang utility classes. Đây là ưu tiên cao nhất vì cả 2 trang **hoàn toàn bị vỡ giao diện ở Light Mode** do hardcode Dark hex colors.

## Requirements

- **Functional:** Giữ nguyên mọi tính năng (WebSocket, timer, slide navigation, cursor/laser overlay, iframe viewer)
- **Non-functional:** Theme Light/Dark phải hoạt động chính xác trên cả 2 trang

## Related Code Files

- Modify: `client/src/pages/SpeakerViewPage.jsx` (267 lines, 24 inline styles)
- Modify: `client/src/pages/LiveViewPage.jsx` (365 lines, 22 inline styles)

## Hex-to-Token Mapping

Dưới đây là bảng mapping chính xác từ các hex hardcode hiện tại sang design token tương ứng:

| Hex hiện tại | Tailwind Class | CSS Variable |
|---|---|---|
| `#0a0a0f` | `bg-surface-0` | `var(--surface-0)` |
| `#0f172a` | `bg-surface-1` | `var(--surface-1)` |
| `#1e293b` | `bg-surface-2` / `bg-card` | `var(--surface-2)` |
| `#334155` | `border-border-strong` | `var(--border-strong)` |
| `#e2e8f0` | `text-text-primary` | `var(--text-primary)` |
| `#94a3b8` | `text-text-secondary` | `var(--text-secondary)` |
| `#64748b` | `text-text-muted` | `var(--text-muted)` |
| `#475569` | `text-text-muted` | `var(--text-muted)` |
| `#6366f1` | `text-primary` / `bg-primary` | `var(--color-primary)` |
| `#22c55e` | `bg-success` | `var(--success)` |
| `#ef4444` | `bg-danger` | `var(--danger)` |

## Implementation Steps

### SpeakerViewPage.jsx

1. **Root container** (L64-75): Chuyển `style={{ width:'100vw', height:'100vh', background:'#0a0a0f', color:'#e2e8f0', display:'grid', gridTemplateRows:'auto 1fr auto' }}` → `className="w-screen h-screen bg-surface-0 text-text-primary grid grid-rows-[auto_1fr_auto] font-sans overflow-hidden"`

2. **Top bar** (L78-86): `style={{ padding:'8px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #1e293b', background:'#0f172a' }}` → `className="px-4 py-2 flex justify-between items-center border-b border-border-strong bg-surface-1"`

3. **Inner flex containers** (L88, L102): `style={{ display:'flex', alignItems:'center', gap:16 }}` → `className="flex items-center gap-4"`

4. **Text spans with hex colors** (L95, L103, L106, L107): Thay `style={{ color:'#94a3b8' }}` → `className="text-text-secondary"`, `style={{ color:'#64748b' }}` → `className="text-text-muted"`

5. **Status indicator dot** (L110-117): `style={{ width:8, height:8, borderRadius:'50%', background: isConnected ? '#22c55e' : '#ef4444' }}` → `className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success' : 'bg-danger'}`}`

6. **Main grid** (L122): `style={{ display:'grid', gridTemplateColumns:'2fr 1fr' }}` → `className="grid grid-cols-[2fr_1fr] gap-px overflow-hidden"`

7. **Section headers** (L132-139, L165-172, L204-211): `style={{ fontSize:12, color:'#64748b', textTransform:'uppercase', letterSpacing:1 }}` → `className="label-caps"` (đã có sẵn class)

8. **Slide preview panels** (L143-155, L176-187): `style={{ background:'#1e293b', border:'1px solid #334155', borderRadius:8 }}` → `className="bg-card border border-border-strong rounded-lg flex items-center justify-center"`

9. **Bottom thumbnails bar** (L231-239): `style={{ background:'#0f172a', borderTop:'1px solid #1e293b' }}` → `className="px-4 py-2 border-t border-border-strong bg-surface-1 flex gap-1 overflow-x-auto"`

10. **Thumbnail buttons** (L248-259): Chuyển conditional style logic sang conditional className:
    ```jsx
    className={`w-10 h-7 rounded shrink-0 text-[11px] cursor-pointer ${
      i === slideIndex 
        ? 'border-2 border-primary bg-primary-light text-primary font-bold'
        : 'border border-border-strong bg-card text-text-muted'
    }`}
    ```

### LiveViewPage.jsx

11. **Room not found view** (L160-183): `style={{ background:'#000', color:'#fff' }}` → `className="w-screen h-screen flex items-center justify-center bg-surface-0 text-text-primary font-sans"`

12. **Main container** (L186-194): `style={{ background:'#000' }}` → `className="w-screen h-screen relative bg-black overflow-hidden"` (giữ `bg-black` vì đây là presentation viewer, luôn dark)

13. **Connection status badge** (L198-210): Chuyển sang utility classes nhưng giữ `style` cho `top/left` positioning

14. **Waiting overlay** (L218-227): `style={{ background:'#000' }}` → `className="absolute inset-0 z-[2000] flex items-center justify-center bg-black"`

15. **Spinner** (L230-239): `style={{ width:48, height:48, borderRadius:'50%', border:'3px solid rgba(...)' }}` → `className="w-12 h-12 rounded-full border-[3px] border-primary-light border-t-primary animate-spin mx-auto mb-4"`, xóa luôn inline `<style>` keyframe

16. **Dynamic overlays (KEEP inline style):** cursor dot (L292-308), laser pointer (L312-328), annotation SVG (L332-352) — phụ thuộc vào giá trị runtime (`cursorPos.x`, `laserPos.y`), PHẢI giữ inline style

17. **Iframe** (L356-358): `style={{ width:'100%', height:'100%', border:'none' }}` → `className="w-full h-full border-none block"`

## Success Criteria

- [ ] `SpeakerViewPage.jsx` inline styles giảm từ 24 → ≤2 (chỉ giữ dynamic)
- [ ] `LiveViewPage.jsx` inline styles giảm từ 22 → ≤6 (cursor, laser, annotation, connection badge positioning)
- [ ] Theme Light/Dark hoạt động chính xác trên cả 2 trang
- [ ] `npm run build` pass zero errors
- [ ] Kiểm tra visual: SpeakerView hiển thị đúng layout grid, timer, thumbnails
- [ ] Kiểm tra visual: LiveView hiển thị đúng spinner, viewer count badge, iframe
- [ ] `npm run test:e2e` pass (nếu có test cho 2 trang này)

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Tailwind `important: '#root'` override inline style | Test cẩn thận — Tailwind classes đã có specificity cao hơn bình thường |
| LiveViewPage cursor/laser overlay bị ảnh hưởng | Giữ nguyên inline style cho dynamic overlays |
| SpeakerViewPage conditional thumbnail styling bị lỗi | Test kỹ active/inactive state cho slide thumbnail buttons |
