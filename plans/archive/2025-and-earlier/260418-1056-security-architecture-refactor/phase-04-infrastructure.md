# Phase 04 — Infrastructure & Long-term

> **Priority:** 🟡 Medium  
> **Effort:** 5-10 days  
> **Dependencies:** Phase 03 complete  
> **Goal:** Request validation, CSS Modules, type safety foundation

---

## Context

Sau Phase 1-3, security đã fix, component structure sạch. Phase 4 tập trung vào infrastructure improvements để tăng maintainability dài hạn. Mỗi task trong phase này là **độc lập** — có thể chọn lọc implement.

---

## Implementation Steps

### Task 4.1: Request Body Validation (Zod)

**Files:** `server/routes/*.js`, NEW `server/schemas/*.js`  
**Effort:** 2 days

**Vấn đề:** `PUT /api/presentations/:id` chấp nhận `req.body` trực tiếp, không validate structure.

**Approach:** Thêm Zod schemas cho tất cả mutation endpoints.

```javascript
// server/schemas/presentation-schema.js
const { z } = require('zod')

const elementSchema = z
  .object({
    id: z.string().uuid(),
    type: z.enum([
      'text',
      'image',
      'shape',
      'code',
      'latex',
      'html',
      'markdown',
      'chart',
      'video',
      'audio',
      'table',
      'icon',
      'callout',
      'qr',
      'divider',
    ]),
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive(),
    rotation: z.number().default(0),
    locked: z.boolean().default(false),
    zIndex: z.number().int().default(1),
  })
  .passthrough() // Allow type-specific fields

const slideSchema = z
  .object({
    id: z.string().uuid(),
    background: z
      .object({
        type: z.enum(['color', 'gradient', 'image']),
        value: z.string(),
      })
      .optional(),
    elements: z.array(elementSchema).default([]),
    notes: z.string().default(''),
    hidden: z.boolean().default(false),
  })
  .passthrough()

const presentationSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().max(500),
    theme: z.string().default('black'),
    transition: z.string().default('none'),
    slides: z.array(slideSchema),
  })
  .passthrough()

module.exports = { presentationSchema, slideSchema, elementSchema }
```

**Validation middleware:**

```javascript
// server/middleware/validate.js
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      })
    }
    req.body = result.data
    next()
  }
}
module.exports = { validateBody }
```

**Apply to routes:**

```javascript
// server/routes/presentations.js
const { validateBody } = require('../middleware/validate')
const { presentationSchema } = require('../schemas/presentation-schema')

router.put('/:id', validateBody(presentationSchema), async (req, res) => {
  // req.body is now validated and typed
})
```

**Endpoints to validate:**

| Method | Path                           | Schema                          |
| ------ | ------------------------------ | ------------------------------- |
| PUT    | `/api/presentations/:id`       | `presentationSchema`            |
| POST   | `/api/presentations`           | `presentationSchema.partial()`  |
| POST   | `/api/upload`                  | `uploadSchema` (filename, size) |
| POST   | `/api/rclone/config`           | `rcloneConfigSchema`            |
| POST   | `/api/github/config`           | `githubConfigSchema`            |
| POST   | `/api/presentations/:id/share` | `shareSchema`                   |

**Checklist:**

- `[x]` Install `zod`
- `[x]` Create `server/schemas/presentation-schema.js`
- `[x]` Create `server/schemas/config-schemas.js` (rclone, github)
- `[x]` Create `server/middleware/validate.js`
- `[x]` Apply to PUT presentations
- `[x]` Apply to POST presentations
- `[x]` Apply to POST config endpoints
- `[x]` Apply to POST share
- `[x]` Run full E2E suite (ensure existing data still valid)
- `[x]` Test: send malformed body → verify 400 response with details

---

### Task 4.2: CSS Modules Migration

**Files:** `client/src/index.css` (57KB) → nhiều module files  
**Effort:** 3 days

**Strategy:** Tách `index.css` thành CSS Modules per component. Giữ global styles (theme variables, resets) trong `index.css`.

**Migration plan:**

| Component       | New CSS Module                              | Approx Lines |
| --------------- | ------------------------------------------- | ------------ |
| EditorPage      | `pages/EditorPage.module.css`               | ~200         |
| SlideCanvas     | `components/SlideCanvas.module.css`         | ~300         |
| PropertiesPanel | `components/PropertiesPanel.module.css`     | ~250         |
| Toolbar         | `components/Toolbar.module.css`             | ~200         |
| SlidePanel      | `components/SlidePanel.module.css`          | ~150         |
| Modals (shared) | `components/modals/Modal.module.css`        | ~100         |
| HomePage        | `pages/HomePage.module.css`                 | ~300         |
| Dashboard       | `components/dashboard/Dashboard.module.css` | ~200         |

**Remaining in `index.css`:**

```css
/* Global styles only (~200 lines) */
:root {
  /* theme variables */
}
[data-theme='dark'] {
  /* dark theme overrides */
}
[data-theme='light'] {
  /* light theme overrides */
}
*,
*::before,
*::after {
  box-sizing: border-box;
}
body {
  /* global body styles */
}
/* Global utility classes */
```

**Usage in components:**

```jsx
// BEFORE:
<div className="slide-canvas-container">

// AFTER:
import styles from './SlideCanvas.module.css'
<div className={styles.container}>
```

**Checklist:**

- `[x]` Audit `index.css` — classify selectors by component
- `[x]` Extract EditorPage styles → module
- `[x]` Extract SlideCanvas styles → module
- `[x]` Extract PropertiesPanel styles → module
- `[x]` Extract Toolbar styles → module
- `[x]` Extract remaining component styles
- `[x]` Keep global styles in trimmed `index.css`
- `[x]` Update all component imports
- `[x]` Run visual regression tests
- `[x]` Verify dark/light theme switching

---

### Task 4.3: TypeScript Foundation (Data Models Only)

**Files:** NEW `shared/src/types/`, selected files  
**Effort:** 2 days

**Scope:** Define TypeScript types cho data models ONLY. Không migrate toàn bộ codebase.

**Step 1: Create JSDoc type definitions**

Dùng JSDoc thay vì full TypeScript migration (KISS — không cần build tool changes).

```javascript
// shared/src/types/presentation.d.ts (hoặc .js với JSDoc)

/**
 * @typedef {'text'|'image'|'shape'|'code'|'latex'|'html'|'markdown'|'chart'|'video'|'audio'|'table'|'icon'|'callout'|'qr'|'divider'} ElementType
 */

/**
 * @typedef {Object} BaseElement
 * @property {string} id
 * @property {ElementType} type
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 * @property {number} rotation
 * @property {boolean} locked
 * @property {number} zIndex
 */

/**
 * @typedef {BaseElement & { content: string }} TextElement
 * @typedef {BaseElement & { src: string, objectFit: string }} ImageElement
 * ...
 */

/**
 * @typedef {Object} Slide
 * @property {string} id
 * @property {{ type: 'color'|'gradient'|'image', value: string }} [background]
 * @property {BaseElement[]} elements
 * @property {string} notes
 * @property {boolean} hidden
 */

/**
 * @typedef {Object} Presentation
 * @property {string} id
 * @property {string} title
 * @property {string} theme
 * @property {string} transition
 * @property {Slide[]} slides
 */
```

**Step 2: Configure Vite for .d.ts awareness**

Vite hỗ trợ TypeScript type checking qua `tsc --noEmit`. Thêm `jsconfig.json`:

```json
{
  "compilerOptions": {
    "checkJs": true,
    "moduleResolution": "bundler",
    "target": "ES2020",
    "paths": {
      "revealjs-shared": ["../shared/src"]
    }
  },
  "include": ["src/**/*.js", "src/**/*.jsx"],
  "exclude": ["node_modules"]
}
```

**Checklist:**

- `[x]` Create `shared/src/types/` directory
- `[x]` Define Presentation, Slide, Element types
- `[x]` Add JSDoc annotations to element-factory.js
- `[x]` Add JSDoc annotations to presentation-store.js
- `[x]` Add `jsconfig.json` to client
- `[x]` Run `npx tsc --noEmit` → fix type errors
- `[x]` Add type check to `package.json` scripts

---

### Task 4.4: Electron Keychain Integration

**File:** `electron/main.js`, `server/routes/github.js`  
**Effort:** 1 day

**Current:** GitHub token lưu plaintext trong `github-config.json`.
**Target:** Dùng OS keychain qua `keytar` (or `electron safeStorage`).

```javascript
// electron/main.js
const { safeStorage } = require('electron')

// When saving GitHub token from server API:
ipcMain.handle('save-credential', (event, key, value) => {
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(value)
    // Store encrypted buffer in config
    return true
  }
  return false
})

ipcMain.handle('get-credential', (event, key) => {
  if (safeStorage.isEncryptionAvailable()) {
    // Read encrypted buffer from config
    return safeStorage.decryptString(encryptedBuffer)
  }
  return null
})
```

**Lưu ý:** Chỉ áp dụng cho Electron. Docker/Node.js giữ plaintext file (chấp nhận được cho self-hosted).

**Checklist:**

- `[x]` Import `safeStorage` từ Electron
- `[x]` Add IPC handlers cho credential save/load
- `[x]` Update github.js: detect Electron → use safeStorage
- `[x]` Fallback: non-Electron → keep file-based storage
- `[x]` Test trên Electron app
- `[x]` Verify Docker deployment không bị ảnh hưởng

---

### Task 4.5: Error Boundaries

**File:** NEW `client/src/components/ErrorBoundary.jsx`  
**Effort:** 2 hours

```jsx
// client/src/components/ErrorBoundary.jsx
import { Component } from 'react'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center', color: '#e0e0e0' }}>
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false })}>Try Again</button>
          <button onClick={() => window.location.reload()}>Reload</button>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
```

**Wrap in App.jsx:**

```jsx
<ErrorBoundary>
  {page === 'editor' ? <EditorPage ... /> : <HomePage ... />}
</ErrorBoundary>
```

**Checklist:**

- `[x]` Create ErrorBoundary component
- `[x]` Wrap App.jsx children
- `[x]` Optionally: separate boundary per major section (Editor, Home)
- `[x]` Test: throw error in component → verify fallback UI

---

## Verification Plan

### Automated Tests

```bash
npx playwright test                         # Full suite
npm run build --workspace=client            # Build check
npm run build --workspace=server            # Server build
npx tsc --noEmit --workspace=client         # Type check (if jsconfig)
```

### Manual Verification

1. CSS: dark/light theme → verify all components styled correctly
2. Electron: save GitHub token → close/reopen → verify token persisted securely
3. API: send malformed JSON to PUT → verify 400 error with details
4. Error boundary: break a component → verify graceful error UI

### Metrics

- All API mutation endpoints have Zod validation
- CSS split: `index.css` ≤200 lines (global only)
- Type definitions cover 100% of data models
- Error boundary prevents white screen of death

---

## Todo

- `[x]` Task 4.1: Zod request validation
- `[x]` Task 4.2: CSS Modules migration
- `[x]` Task 4.3: TypeScript foundation (JSDoc types)
- `[x]` Task 4.4: Electron keychain integration
- `[x]` Task 4.5: Error boundaries
- `[x]` Run full test suite
- `[x]` Final build verification
