import { describe, it, expect } from 'vitest'
import { extractTagsFromSource, deriveLayer } from './extract-tags.mjs'

describe('tag extractor', () => {
  it('extracts a single [cap:*] tag with smoke tier by default', () => {
    const src = `it('[cap:element.chart] renders bar chart', () => {})`
    const out = extractTagsFromSource(src, 'client/src/foo.test.js')
    expect(out['element.chart']).toBeTruthy()
    expect(out['element.chart'][0]).toMatchObject({
      title: '[cap:element.chart] renders bar chart',
      tier: 'smoke',
      layer: 'unit',
      skipped: false,
    })
  })

  it('detects inline tier:deep marker', () => {
    const src = `it('[cap:canvas.group tier:deep] groups children', () => {})`
    const out = extractTagsFromSource(src, 'x.test.js')
    expect(out['canvas.group'][0].tier).toBe('deep')
  })

  it('detects a standalone [tier:deep] token applying to all caps in title', () => {
    const src = `it('[cap:canvas.zorder] reorders [tier:deep]', () => {})`
    const out = extractTagsFromSource(src, 'x.test.js')
    expect(out['canvas.zorder'][0].tier).toBe('deep')
  })

  it('captures multiple caps in one title', () => {
    const src = `it('[cap:canvas.group][cap:canvas.zorder] both', () => {})`
    const out = extractTagsFromSource(src, 'x.test.js')
    expect(Object.keys(out).sort()).toEqual(['canvas.group', 'canvas.zorder'])
  })

  it('marks it.skip as skipped', () => {
    const src = `it.skip('[cap:element.audio] mounts', () => {})`
    const out = extractTagsFromSource(src, 'x.test.js')
    expect(out['element.audio'][0].skipped).toBe(true)
  })

  it('marks .fixme as skipped', () => {
    const src = `test.fixme('[cap:flow.autosave] persists', () => {})`
    const out = extractTagsFromSource(src, 'x.test.js')
    expect(out['flow.autosave'][0].skipped).toBe(true)
  })

  it('captures tags in describe titles too', () => {
    const src = `describe('[cap:flow.clipboard] clipboard suite', () => {})`
    const out = extractTagsFromSource(src, 'x.test.js')
    expect(out['flow.clipboard']).toBeTruthy()
  })

  it('derives e2e layer from tests/e2e path', () => {
    expect(deriveLayer('tests/e2e/elements/chart.spec.js')).toBe('e2e')
    expect(deriveLayer('tests\\e2e\\elements\\chart.spec.js')).toBe('e2e')
  })

  it('derives integration layer from path', () => {
    expect(deriveLayer('client/src/integration/foo.test.js')).toBe('integration')
  })

  it('derives unit layer by default', () => {
    expect(deriveLayer('client/src/stores/editor-store.test.js')).toBe('unit')
  })

  it('ignores text with no cap tags', () => {
    const out = extractTagsFromSource(`it('plain test', () => {})`, 'x.test.js')
    expect(Object.keys(out)).toHaveLength(0)
  })

  it('records file path on each occurrence', () => {
    const out = extractTagsFromSource(
      `it('[cap:element.shape] x', ()=>{})`,
      'tests/e2e/elements/shape.spec.js'
    )
    expect(out['element.shape'][0].file).toBe('tests/e2e/elements/shape.spec.js')
    expect(out['element.shape'][0].layer).toBe('e2e')
  })
})
