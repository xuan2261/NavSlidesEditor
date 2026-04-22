# Phase 02: TikZJax Self-Host

## Context

- Plan: [plan.md](./plan.md)
- Blocks: Phase 03

## Overview

- **Priority:** High
- **Status:** Pending

TikZJax không có trên npm. Cần download pre-built artifacts từ GitHub và tự host.
TikZJax dùng WebAssembly nên cần MIME type `application/wasm` được set đúng.

## Current Usage (htmlGenerator.js:152-153)

```javascript
const tikzScript = hasTikz
  ? `<link rel="stylesheet" type="text/css" href="https://tikzjax.com/v1/fonts.css"><script src="https://tikzjax.com/v1/tikzjax.js"><\/script>`
  : ''
```

## TikZJax Artifacts Needed

From `https://tikzjax.com/v1/`:

- `tikzjax.js` — main JS loader (~50 KB)
- `tikzjax.wasm` — WebAssembly binary (~1.4 MB)
- `fonts.css` — TeX font declarations
- `fonts/` — TeX font files (woff2)

**Alternative source:** GitHub release artifacts từ `https://github.com/drgrice1/tikzjax`

## Implementation Steps

### Step 1: Download TikZJax artifacts

```bash
mkdir -p server/vendor/tikzjax

# Download JS + WASM từ official CDN (run once, commit to repo hoặc script)
curl -L https://tikzjax.com/v1/tikzjax.js -o server/vendor/tikzjax/tikzjax.js
curl -L https://tikzjax.com/v1/tikzjax.wasm -o server/vendor/tikzjax/tikzjax.wasm
curl -L https://tikzjax.com/v1/fonts.css -o server/vendor/tikzjax/fonts.css
```

> **Thực tế:** TikZJax CDN (`tikzjax.com`) serve từ GitHub Pages. Artifacts có thể lấy từ:
> `https://raw.githubusercontent.com/drgrice1/tikzjax/page/v1/tikzjax.js`

### Step 2: Update fonts.css paths

Sau khi download `fonts.css`, rewrite font URLs để dùng relative paths:

```bash
# fonts.css sẽ có dạng:
# @font-face { src: url('https://tikzjax.com/v1/fonts/...') }
# Cần rewrite thành relative:
# @font-face { src: url('./fonts/...') }
sed -i 's|https://tikzjax.com/v1/fonts/|./fonts/|g' server/vendor/tikzjax/fonts.css
```

### Step 3: Download font files

```bash
mkdir -p server/vendor/tikzjax/fonts
# Parse fonts.css để tìm font URLs và download
# Hoặc download toàn bộ fonts directory từ GitHub
```

Font files thường gồm: `cmr10.woff2`, `cmmi10.woff2`, `cmbx10.woff2`, etc.

### Step 4: Thêm vào copy-vendor.js script

```javascript
// Trong scripts/copy-vendor.js — thêm warning nếu tikzjax chưa download
const tikzjaxDir = path.join(vendorDir, 'tikzjax')
if (!fs.existsSync(path.join(tikzjaxDir, 'tikzjax.js'))) {
  console.warn('\nWARN: TikZJax artifacts not found at server/vendor/tikzjax/')
  console.warn('Run: npm run vendor:tikzjax to download them\n')
}
```

Thêm script `vendor:tikzjax` vào `package.json`:

```json
{
  "scripts": {
    "vendor:tikzjax": "node scripts/download-tikzjax.js"
  }
}
```

### Step 5: Tạo download-tikzjax.js script

**File:** `scripts/download-tikzjax.js`

```javascript
// scripts/download-tikzjax.js
// Download TikZJax WASM artifacts for offline self-hosting
const https = require('https')
const fs = require('fs')
const path = require('path')

const BASE_URL = 'https://tikzjax.com/v1'
const DEST_DIR = path.join(__dirname, '..', 'server', 'vendor', 'tikzjax')

const FILES = ['tikzjax.js', 'tikzjax.wasm', 'fonts.css']

async function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    https
      .get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close()
          fs.unlinkSync(dest)
          return download(res.headers.location, dest).then(resolve).catch(reject)
        }
        res.pipe(file)
        file.on('finish', () => {
          file.close()
          resolve()
        })
      })
      .on('error', (err) => {
        fs.unlinkSync(dest)
        reject(err)
      })
  })
}

async function main() {
  fs.mkdirSync(DEST_DIR, { recursive: true })
  for (const file of FILES) {
    const url = `${BASE_URL}/${file}`
    const dest = path.join(DEST_DIR, file)
    console.log(`Downloading ${file}...`)
    await download(url, dest)
    console.log(`✓ ${file}`)
  }

  // Rewrite fonts.css to use relative paths
  const fontsCss = fs.readFileSync(path.join(DEST_DIR, 'fonts.css'), 'utf8')
  const rewritten = fontsCss.replace(/https:\/\/tikzjax\.com\/v1\/fonts\//g, './fonts/')
  fs.writeFileSync(path.join(DEST_DIR, 'fonts.css'), rewritten)
  console.log('✓ Rewritten fonts.css paths to relative')

  console.log('\n✅ TikZJax artifacts ready at server/vendor/tikzjax/')
}

main().catch(console.error)
```

## Files to Create

- `scripts/download-tikzjax.js` (new)
- `server/vendor/tikzjax/` (populated by script)

## Files to Modify

- `package.json` (root) — add `vendor:tikzjax` script

## Todo

- [ ] Create `scripts/download-tikzjax.js`
- [ ] Run `node scripts/download-tikzjax.js` khi có internet
- [ ] Verify `server/vendor/tikzjax/tikzjax.wasm` tồn tại (~1.4 MB)
- [ ] Verify `server/vendor/tikzjax/fonts.css` dùng relative paths
- [ ] Add script to `package.json`

## Risk Assessment

| Risk                                       | Mitigation                                             |
| ------------------------------------------ | ------------------------------------------------------ |
| WASM MIME type blocked bởi browser         | Phase 03 set explicit `Content-Type: application/wasm` |
| TikZJax CDN URL thay đổi                   | Commit artifacts vào git repo hoặc git-lfs             |
| font download không đầy đủ                 | Parse fonts.css, download từng font explicitly         |
| WASM binary version mismatch với JS loader | Download cùng lúc, từ cùng version URL                 |

## Note: Git LFS

Nếu `tikzjax.wasm` (~1.4 MB) quá lớn cho git, dùng git-lfs:

```bash
git lfs track "server/vendor/tikzjax/*.wasm"
git add .gitattributes
```
