---
phase: 6
title: "Cleanup & Bundle Optimization"
status: pending
priority: P3
effort: "45 min"
dependencies: [3, 4, 5]
---

# Phase 6: Cleanup & Bundle Optimization

## Overview

Remove leftover migration artifacts from repo root and configure Vite manual chunking to break the 4.3MB main bundle into manageable pieces.

## Requirements

- **Functional**: All lazy-loaded routes continue to work
- **Non-functional**: Main bundle < 1MB (currently 4.3MB)
- **Non-functional**: Repo root clean of migration artifacts

## Related Code Files

### Delete:
- `repo/comprehensive_code_audit_n22th4.md`
- `repo/implementation_plan_n22th4.md`
- `repo/implementation_plan_theme.md`
- `repo/implementation_plan_theme_new.md`
- `repo/fix-btn-icon.js`
- `repo/test_err.txt`
- `repo/test_output.txt`
- `repo/test_output2.txt`

### Modify:
- `client/vite.config.js` — Add `manualChunks` configuration

## Implementation Steps

### Step 1: Remove migration artifacts

```bash
cd d:/NCKH_2025/Para_WorkSpace/NavSlidesEditor/Projects/NavSlidesEditor/repo
rm -f comprehensive_code_audit_n22th4.md implementation_plan_n22th4.md implementation_plan_theme.md implementation_plan_theme_new.md fix-btn-icon.js test_err.txt test_output.txt test_output2.txt
```

### Step 2: Configure manual chunks in Vite

Add to `vite.config.js`:

```js
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        // Vendor chunks
        'vendor-react': ['react', 'react-dom', 'react-router-dom'],
        'vendor-editor': ['@tiptap/core', '@tiptap/react', '@tiptap/starter-kit'],
        'vendor-reveal': ['reveal.js'],
        'vendor-charts': ['chart.js', 'react-chartjs-2'],
        'vendor-ui': ['lucide-react'],
        // Feature chunks
        'feature-ai': [
          './src/components/AIGeneratorModal.jsx',
          './src/components/AICopywriterModal.jsx',
          './src/components/AITranslateModal.jsx',
        ],
        'feature-export': ['./src/utils/offlineExport.js'],
      },
    },
  },
},
```

### Step 3: Verify chunk distribution

```bash
cd client && npx vite build
```

Expected output: Main bundle should drop from 4.3MB to ~2-2.5MB.

### Step 4: Verify all pages load correctly

Test that lazy-loaded routes still work:
- `/` (Dashboard)
- `/editor/:id` (Editor)
- `/settings` (Settings)
- `/explore` (Explore)
- `/present/:id` (Presentation)

## Success Criteria

- [ ] Repo root has no `.md` or `.txt` migration artifacts
- [ ] `fix-btn-icon.js` removed
- [ ] `vite build` passes
- [ ] Main JS chunk < 2.5MB (down from 4.3MB)
- [ ] All routes load without errors
- [ ] No 404s for chunk files

## Test Plan

```bash
# Verify cleanup
ls repo/*.md repo/*.txt repo/fix-*.js 2>/dev/null  # Should show nothing

# Build and check sizes
cd client && npx vite build 2>&1 | grep -E "\.js.*kB"
```

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| manualChunks references non-existent module | Medium | Verify import paths exist before building |
| Over-splitting causes too many HTTP requests | Low | Only split vendor + 2 feature chunks |
| Removing files that are still referenced | Low | All listed files are standalone artifacts, not imports |
