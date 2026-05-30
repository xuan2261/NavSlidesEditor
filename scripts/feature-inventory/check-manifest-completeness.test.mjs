import { describe, it, expect } from 'vitest'
import {
  checkManifestCompleteness,
  parseCommandIds,
} from './check-manifest-completeness.mjs'

describe('manifest completeness check', () => {
  it('passes when every discovered control/command maps to the manifest', () => {
    const r = checkManifestCompleteness({
      discovered: ['command.insertSlide', 'control.format.bold'],
      manifestIds: ['command.insertSlide', 'control.format.bold', 'canvas.move'],
    })
    expect(r.ok).toBe(true)
    expect(r.missing).toEqual([])
  })

  it('fails when a discovered control is absent from the manifest', () => {
    const r = checkManifestCompleteness({
      discovered: ['control.format.newButton'],
      manifestIds: ['control.format.bold'],
    })
    expect(r.ok).toBe(false)
    expect(r.missing).toContain('control.format.newButton')
  })

  it('fails when a discovered command is absent from the manifest', () => {
    const r = checkManifestCompleteness({
      discovered: ['command.exportPdf'],
      manifestIds: ['command.insertSlide'],
    })
    expect(r.ok).toBe(false)
    expect(r.missing).toContain('command.exportPdf')
  })

  it('parses command ids from the inline EditorPage commands array', () => {
    const src = `
      const commands = [
        { id: 'insertSlide', label: 'Insert Slide', action: () => {} },
        { id: 'group', label: 'Group', action: () => {} },
        { id: 'commandPalette', label: 'Palette', action: () => {} },
      ]
    `
    const ids = parseCommandIds(src)
    expect(ids).toEqual(['command.insertSlide', 'command.group', 'command.commandPalette'])
  })

  it('parseCommandIds returns empty when no commands array present', () => {
    expect(parseCommandIds('const x = 1')).toEqual([])
  })
})
