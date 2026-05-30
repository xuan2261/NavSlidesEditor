import { describe, it, expect } from 'vitest'
import {
  FX_MODULES,
  getFxModule,
  listFx,
  buildFxRuntimeScript,
} from '../src/fx/index.js'
import { generateRevealHTML } from '../src/htmlGenerator.js'

describe('fx registry', () => {
  it('registers at least 8 FX modules', () => {
    expect(listFx().length).toBeGreaterThanOrEqual(8)
  })

  it('every module has name, label, defaultParams, initState, draw', () => {
    for (const m of listFx()) {
      expect(m.name, 'name').toBeTypeOf('string')
      expect(m.label, `${m.name} label`).toBeTruthy()
      expect(m.defaultParams, `${m.name} defaultParams`).toBeTypeOf('object')
      expect(m.initState, `${m.name} initState`).toBeTypeOf('function')
      expect(m.draw, `${m.name} draw`).toBeTypeOf('function')
    }
  })

  it('module names are unique', () => {
    const names = listFx().map((m) => m.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('getFxModule looks up by name, returns null for unknown (no throw)', () => {
    expect(getFxModule('gradient-blob')).toBe(FX_MODULES['gradient-blob'])
    expect(getFxModule('does-not-exist')).toBe(null)
    expect(getFxModule(undefined)).toBe(null)
  })

  it('buildFxRuntimeScript embeds the registry + reduced-motion guard', () => {
    const rt = buildFxRuntimeScript()
    expect(rt).toContain('prefers-reduced-motion')
    expect(rt).toContain('data-fx-name')
    // serialized module sources present
    expect(rt).toContain('gradient-blob')
    expect(rt).toContain('starfield')
  })
})

describe('htmlGenerator FX emission', () => {
  const fxDeck = {
    title: 'FX Deck',
    slides: [
      { id: 's1', background: { type: 'fx', fx: { name: 'starfield', params: { speed: 2 } } }, elements: [] },
      { id: 's2', background: { type: 'color', color: '#101010' }, elements: [] },
    ],
  }
  const html = generateRevealHTML(fxDeck)

  it('emits a <canvas data-fx-name> for the fx slide', () => {
    expect(html).toContain('data-fx-name="starfield"')
    expect(html).toContain('<canvas')
  })

  it('embeds fx params as a data attribute', () => {
    expect(html).toMatch(/data-fx-params=/)
  })

  it('injects the FX runtime script exactly once', () => {
    const occurrences = html.split('__navslidesFxRuntime').length - 1
    expect(occurrences).toBeGreaterThanOrEqual(1)
    // the IIFE marker should appear once
    const starts = html.split('/* navslides-fx-runtime */').length - 1
    expect(starts).toBe(1)
  })

  it('wires BOTH ready and slidechanged (guards slide-1-dead-FX bug)', () => {
    expect(html).toContain("Reveal.on('slidechanged'")
    // FX must also start on ready (the runtime hooks both)
    expect(html).toMatch(/__navslidesFxStart|fxSyncActive/)
  })

  it('does NOT inject the FX runtime when no slide uses fx', () => {
    const plain = generateRevealHTML({
      title: 'No FX',
      slides: [{ id: 'x', background: { type: 'color', color: '#000' }, elements: [] }],
    })
    expect(plain).not.toContain('/* navslides-fx-runtime */')
    expect(plain).not.toContain('data-fx-name')
  })
})
