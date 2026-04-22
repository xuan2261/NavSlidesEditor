# Phase 01: Vendor Assets Setup

## Context

- Plan: [plan.md](./plan.md)
- Brainstorm: [brainstorm report](../reports/brainstorm-260410-2216-offline-html-export-lan.md)

## Overview

- **Priority:** Critical
- **Status:** Completed
- **Blocks:** Phase 03, Phase 04, Phase 05

Install npm packages vào `server/`, copy `/dist` folders vào `server/vendor/`, tạo script tự động.

## Requirements

### Packages cần install (trong `server/`)

```
reveal.js@5.1.0
katex@0.16.11
chart.js@4
highlight.js@11
d3@7
marked
```

### Vendor directory structure

```
server/vendor/
  reveal.js/
    dist/
      reset.css
      reveal.css
      reveal.js
      theme/           ← all theme CSS files
    plugin/
      notes/notes.js
      highlight/highlight.js
      math/math.js     ← nếu dùng reveal math plugin
  katex/
    dist/
      katex.min.css
      katex.min.js
      fonts/           ← 28 woff2 files (CRITICAL)
  chart.js/
    dist/
      chart.umd.js     ← UMD build cho srcdoc usage
  highlight.js/
    styles/            ← all CSS themes (monokai, etc.)
    lib/
      highlight.min.js
  d3/
    dist/
      d3.min.js
  marked/
    marked.min.js      ← copy từ node_modules/marked/marked.min.js
```

## Implementation Steps

### Step 1: Install packages vào server/

```bash
cd server
npm install reveal.js@5.1.0 katex@0.16.11 chart.js@4 highlight.js@11 d3@7 marked
```

> Note: Các package này chỉ dùng để copy dist assets, không import vào Express code.

### Step 2: Tạo script copy-vendor.js

**File:** `scripts/copy-vendor.js` (tại root của monorepo)

Script làm:

1. Xóa `server/vendor/` nếu tồn tại
2. Copy từng package's dist vào đúng subdirectory
3. Log kết quả với file sizes

```javascript
// scripts/copy-vendor.js
const fs = require('fs')
const path = require('path')

const serverDir = path.join(__dirname, '..', 'server')
const vendorDir = path.join(serverDir, 'vendor')
const nodeModules = path.join(serverDir, 'node_modules')

// ... copy logic (xem Implementation Detail bên dưới)
```

**Implementation Detail của copy script:**

```javascript
const { execSync } = require('child_process')

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

const copies = [
  // reveal.js: copy dist/ + plugin/
  { src: path.join(nodeModules, 'reveal.js/dist'), dest: path.join(vendorDir, 'reveal.js/dist') },
  {
    src: path.join(nodeModules, 'reveal.js/plugin'),
    dest: path.join(vendorDir, 'reveal.js/plugin'),
  },
  // katex: copy entire dist/ (includes fonts/ subdirectory)
  { src: path.join(nodeModules, 'katex/dist'), dest: path.join(vendorDir, 'katex/dist') },
  // chart.js: only UMD build
  { src: path.join(nodeModules, 'chart.js/dist'), dest: path.join(vendorDir, 'chart.js/dist') },
  // highlight.js: styles + lib
  {
    src: path.join(nodeModules, 'highlight.js/styles'),
    dest: path.join(vendorDir, 'highlight.js/styles'),
  },
  {
    src: path.join(nodeModules, 'highlight.js/lib'),
    dest: path.join(vendorDir, 'highlight.js/lib'),
  },
  // d3: dist only
  { src: path.join(nodeModules, 'd3/dist'), dest: path.join(vendorDir, 'd3/dist') },
  // marked: single file copy
]

// Remove existing vendor dir
if (fs.existsSync(vendorDir)) {
  fs.rmSync(vendorDir, { recursive: true })
  console.log('Cleaned existing vendor/')
}

for (const { src, dest } of copies) {
  if (!fs.existsSync(src)) {
    console.warn(`WARN: Source not found: ${src}`)
    continue
  }
  copyDir(src, dest)
  console.log(`✓ Copied: ${path.relative(process.cwd(), dest)}`)
}

// marked: copy single file (no dist/ subfolder)
const markedSrc = path.join(nodeModules, 'marked/marked.min.js')
const markedDest = path.join(vendorDir, 'marked/marked.min.js')
fs.mkdirSync(path.dirname(markedDest), { recursive: true })
if (fs.existsSync(markedSrc)) {
  fs.copyFileSync(markedSrc, markedDest)
  console.log(`✓ Copied: vendor/marked/marked.min.js`)
} else {
  // fallback: use src/marked.min.js or bundle entrypoint
  console.warn('WARN: marked.min.js not found, check package structure')
}

console.log('\n✅ Vendor assets ready.')
```

### Step 3: Thêm npm script

**File:** `package.json` (root monorepo)

```json
{
  "scripts": {
    "vendor": "node scripts/copy-vendor.js",
    "postinstall": "npm run vendor"
  }
}
```

> `postinstall` tự động chạy vendor copy sau `npm install` — quan trọng cho CI/CD và first-time setup.

## Files to Create

- `scripts/copy-vendor.js` (new)

## Files to Modify

- `package.json` (root) — add `vendor` and `postinstall` scripts
- `server/package.json` — add npm packages as `devDependencies` (chỉ dùng để copy)

## Todo

- [x] `cd server && npm install reveal.js@5.1.0 katex@0.16.11 chart.js@4 highlight.js@11 d3@7 marked`
- [x] Create `scripts/copy-vendor.js`
- [x] Run `node scripts/copy-vendor.js` và verify output
- [x] Verify `server/vendor/katex/dist/fonts/` có đủ 28 woff2 files
- [x] Verify `server/vendor/chart.js/dist/chart.umd.js` tồn tại
- [x] Add scripts to root `package.json`

## Verification

```bash
# Count KaTeX fonts
ls server/vendor/katex/dist/fonts/*.woff2 | wc -l  # expect ~28

# Check chart.js UMD build
ls server/vendor/chart.js/dist/chart.umd.js

# Check total vendor size
du -sh server/vendor/
```

## Risk

- `marked` package: file location thay đổi giữa versions. Check với `node -e "require.resolve('marked/marked.min.js')"`
- `chart.js` UMD: package mới có thể dùng `chart.umd.js` hoặc `chart.min.js` — verify path sau install
