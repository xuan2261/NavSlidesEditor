import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const clientRoot = path.resolve(import.meta.dirname, '../..')
const editorPagePath = path.join(clientRoot, 'pages/EditorPage.jsx')
const productionModules = [
  path.join(clientRoot, 'components/editor/editor-workspace.jsx'),
  path.join(clientRoot, 'components/editor/editor-navigator.jsx'),
  path.join(clientRoot, 'components/editor/editor-inspector.jsx'),
  path.join(clientRoot, 'hooks/editor-controller/use-editor-element-controller.js'),
  path.join(clientRoot, 'hooks/editor-controller/use-editor-keyboard-controller.js'),
]

describe('EditorPage composition root', () => {
  it('keeps the page composition-focused and extracted modules cohesive', () => {
    const editorPage = fs.readFileSync(editorPagePath, 'utf8')
    expect(editorPage.split(/\r?\n/).length).toBeLessThanOrEqual(650)

    for (const modulePath of productionModules) {
      const source = fs.readFileSync(modulePath, 'utf8')
      expect(source.split(/\r?\n/).length, path.basename(modulePath)).toBeLessThanOrEqual(200)
      expect(source).not.toMatch(/from ['"].*EditorPage/)
    }
  })
})
