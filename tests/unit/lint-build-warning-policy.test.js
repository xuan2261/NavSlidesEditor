import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '..', '..')
const read = (...parts) => readFileSync(resolve(root, ...parts), 'utf8')

describe('lint and build warning policy', () => {
  it('keeps local agent artifacts and tool environments out of generic lint scope', () => {
    const eslintConfig = read('eslint.config.mjs')

    expect(eslintConfig).toContain("'.claude/**'")
    expect(eslintConfig).toContain("'vitest-setup-*.js'")
    expect(eslintConfig).toContain("'website/.vitepress/config.mjs'")
  })

  it('keeps Vitest free of React plugin deprecation warnings', () => {
    const vitestConfig = read('vitest.config.mjs')

    expect(vitestConfig).not.toContain('@vitejs/plugin-react')
    expect(vitestConfig).not.toContain('plugins: [react()]')
  })

  it('does not define manual chunks for packages absent from the client import graph', () => {
    const viteConfig = read('client', 'vite.config.js')

    expect(viteConfig).not.toContain("'vendor-reveal'")
    expect(viteConfig).toContain('chunkSizeWarningLimit: 2500')
  })

  it('keeps heavyweight PPTX export code out of the initial editor bundle', () => {
    const editorPage = read('client', 'src', 'pages', 'EditorPage.jsx')

    expect(editorPage).not.toMatch(/import\s+\{\s*exportToPptx\s*\}\s+from ['"]\.\.\/utils\/exportPptx['"]/)
    expect(editorPage).toContain("import('../utils/exportPptx')")
  })

  it('lazy-loads route pages from the app shell', () => {
    const app = read('client', 'src', 'App.jsx')

    expect(app).toContain("const EditorPage = lazy(() => import('./pages/EditorPage'))")
    expect(app).not.toMatch(/import\s+EditorPage\s+from ['"]\.\/pages\/EditorPage['"]/)
  })
})
