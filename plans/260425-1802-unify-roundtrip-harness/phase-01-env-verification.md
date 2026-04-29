---
phase: 1
title: "Environment Verification + pptxgenjs Setup"
status: completed
priority: P1
effort: 1h
dependencies: ["0"]
---

# Phase 1: Environment Verification + pptxgenjs Setup

## Overview

Verify environment compatibility và add `pptxgenjs` vào server workspace trước khi port bất kỳ code nào. Đây là **P0 blocker** — không có pptxgenjs ở server, không thể export.

## Requirements

- Functional: Server có thể `require('pptxgenjs')` thành công
- Non-functional: `npm install` thành công, không breaking changes

## Architecture

```
Client: pptxgenjs@4.0.1 (ESM, "type": "module")
         ↓
Server: cần pptxgenjs@4.0.1 (CommonJS, hoạt động server-side)

Kiểm tra: pptxgenjs@4.x hỗ trợ Node.js (không cần browser polyfill)
```

## Related Code Files

- Modify: `server/package.json` — thêm pptxgenjs dependency
- Read: `client/package.json` — verify pptxgenjs version
- Read: `server/package.json` — verify current dependencies

## Implementation Steps

### Step 1: Verify pptxgenjs Node.js compatibility

```bash
# Check pptxgenjs version in client
npm ls pptxgenjs --workspace=client

# Check if it's CJS or ESM
head -5 node_modules/pptxgenjs/package.json
```

pptxgenjs@4.x exports both CJS và ESM:
```json
{
  "main": "dist/pptxgen.cjs.js",
  "module": "dist/pptxgen.es.js",
  "exports": {
    "import": "./dist/pptxgen.es.js",
    "require": "./dist/pptxgen.cjs.js"
  }
}
```

### Step 2: Add pptxgenjs to server package.json

```bash
# Add exact version to server/package.json (workspace-scoped install)
npm install pptxgenjs@4.0.1 --save --workspace=server

# Verify: require from server context works
node -e "const p = require('pptxgenjs'); console.log('ok', typeof p)"
```

**Installation strategy:** pptxgenjs@4.0.1 goes into `server/package.json` dependencies. npm workspace hoisting ensures only one copy in `node_modules/`. Server uses CommonJS `require()` which resolves to `dist/pptxgen.cjs.js`.

### Step 3: Verify server starts with pptxgenjs

```bash
cd server && node -e "
const pptxgen = require('pptxgenjs')
const pptx = new pptxgen()
pptx.addSlide()
pptx.addText('test')
pptx.writeFile({ fileName: '/tmp/test.pptx' }).then(() => {
  console.log('pptxgenjs works server-side')
}).catch(e => console.error(e))
"
```

### Step 4: Verify revealjs-shared compatibility

Server đã có `revealjs-shared` trong dependencies. Verify nó hoạt động:
```bash
node -e "const r = require('revealjs-shared'); console.log('ok', typeof r)"
```

## Success Criteria

- [x] `pptxgenjs@4.0.1` in `server/package.json` dependencies
- [x] `npm install --workspace=server` thành công
- [x] `require('pptxgenjs')` works in Node.js server context
- [x] pptxgenjs can create and write a simple PPTX file server-side
- [x] No breaking changes to existing server functionality

## Risk Assessment

- **Risk:** Version mismatch — **Mitigation:** Match exact version from client (4.0.1)
- **Risk:** Bundle size increase — **Mitigation:** Acceptable; pptxgenjs là production dependency cần thiết
- **Risk:** Dependency conflict với workspace hoisting — **Mitigation:** Dùng `npm install --workspace=server` để install vào server/node_modules, không phải root
