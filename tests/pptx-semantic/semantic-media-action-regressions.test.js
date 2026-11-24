import { describe, it, expect } from 'vitest'
import { computeMixedSource } from '../../client/src/utils/selection-mixed-values.js'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { normalizeElementAction } = require('../../shared/src/element-actions.js')

describe('Media and Safe Action Regression Suite (Tasks 14 & 20)', () => {
  it('disallows unsafe URL protocols in element action authoring', () => {
    const dangerousProtocols = [
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)'
    ]
    for (const url of dangerousProtocols) {
      const { action, error } = normalizeElementAction({ kind: 'url', url })
      expect(action).toBeNull()
      expect(error).toContain('Enter a safe')
    }
  })

  it('normalizes safe HTTPS and mailto URLs without escaping errors', () => {
    const safeUrls = [
      { input: 'https://example.com/asset.mp4', kind: 'url' },
      { input: 'mailto:developer@navslides.test', kind: 'email' }
    ]
    for (const { input, kind } of safeUrls) {
      const { action, error } = normalizeElementAction({ kind, url: input })
      expect(error).toBe('')
      expect(action).toMatchObject({ kind, url: input })
    }
  })

  it('computes mixed media source status across disparate media selections', () => {
    const singleAudio = [{ id: 'a1', type: 'audio', src: 'media/track1.mp3' }]
    expect(computeMixedSource(singleAudio, ['a1']).isMixed).toBe(false)

    const mixed = [
      { id: 'a1', type: 'audio', src: 'media/track1.mp3' },
      { id: 'a2', type: 'audio', src: 'media/track2.mp3' }
    ]
    expect(computeMixedSource(mixed, ['a1', 'a2']).isMixed).toBe(true)
  })
})
