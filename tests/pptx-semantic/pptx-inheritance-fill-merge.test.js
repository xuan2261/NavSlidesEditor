import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { fixture, slide, layout, master } from './semantic-text-style-context-fixture.js'

const require = createRequire(import.meta.url)
const { projectSemanticImport } = require('../../server/services/pptx-import/semantic-projector')
const { applyPresentationProjectionOperation } = require('../../shared/src/pptx-projection-operation')
const { previewInheritanceEdit } = require('../../shared/src/pptx-inheritance-operations')
const {
  materializeGeometry,
  resolveGeometryStyle,
} = require('../../shared/src/pptx-geometry-style-resolution')
const { normalizeSemanticPresentation } = require('../../shared/src/pptx-semantic-presentation')
const { canonicalEditableSnapshot } = require('../../server/services/pptx-import/canonical-snapshot')
const {
  validateGeometryStyleOverride,
  validateGeometryStyleRecords,
} = require('../../shared/src/pptx-geometry-style-records')
const {
  mergeFill,
} = require('../../shared/src/pptx-inheritance-targets')

const clone = (value) => JSON.parse(JSON.stringify(value))
const operation = (instanceId, command, extra = {}) => ({
  type: 'inheritance.edit',
  instanceId,
  command,
  ...extra,
})

async function importedPresentation() {
  const zip = await fixture()
  for (const part of [slide, layout, master]) {
    zip.file(
      part,
      (await zip.file(part).async('string')).replaceAll(
        '<p:spPr/>',
        '<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="457200"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:schemeClr val="dk1"/></a:solidFill></p:spPr>'
      )
    )
  }
  zip.file(
    'ppt/presentation.xml',
    (await zip.file('ppt/presentation.xml').async('string')).replace(
      '</p:presentation>',
      '<p:sldSz cx="9144000" cy="5143500"/></p:presentation>'
    )
  )
  const result = await projectSemanticImport({
    zip,
    geometryInheritance: true,
    presentation: {
      id: 'inheritance-fill-deck',
      slides: [{ id: 'first', title: 'First', elements: [] }],
    },
  })
  const presentation = clone(result.presentation)
  const model = presentation.pptxSemantic
  const second = clone(presentation.slides[0])
  second.id = 'second'
  second.title = 'Second'
  for (const element of second.elements) {
    const original = model.instances[element.pptxInstanceId]
    const id = `copy:${original.id}`
    model.instances[id] = { ...clone(original), id, slideId: 'second' }
    element.id = id
    element.pptxInstanceId = id
  }
  presentation.slides.push(second)
  return { zip, presentation: normalizeSemanticPresentation(presentation) }
}

describe('mergeFill unit invariants', () => {
  it('merges sparse leaves when both fills are pattern variants', () => {
    const prev = Object.freeze({
      pattern: Object.freeze({
        preset: 'pct25',
        foreground: Object.freeze({ kind: 'srgb', value: '112233' }),
      }),
    })
    const next = Object.freeze({
      pattern: Object.freeze({
        preset: 'diagCross',
      }),
    })
    const merged = mergeFill(prev, next)
    expect(merged).toEqual({
      pattern: {
        preset: 'diagCross',
        foreground: { kind: 'srgb', value: '112233' },
      },
    })
    expect(() => validateGeometryStyleOverride({ fill: merged })).not.toThrow()
  })

  it('merges background into existing preset and foreground', () => {
    const prev = Object.freeze({
      pattern: Object.freeze({
        preset: 'diagCross',
        foreground: Object.freeze({ kind: 'srgb', value: '112233' }),
      }),
    })
    const next = Object.freeze({
      pattern: Object.freeze({
        background: Object.freeze({ kind: 'srgb', value: '445566' }),
      }),
    })
    const merged = mergeFill(prev, next)
    expect(merged).toEqual({
      pattern: {
        preset: 'diagCross',
        foreground: { kind: 'srgb', value: '112233' },
        background: { kind: 'srgb', value: '445566' },
      },
    })
    expect(() => validateGeometryStyleOverride({ fill: merged })).not.toThrow()
  })

  it('preserves explicit null to clear leaves without reviving previous value', () => {
    const prev = Object.freeze({
      pattern: Object.freeze({
        preset: 'diagCross',
        foreground: Object.freeze({ kind: 'srgb', value: '112233' }),
      }),
    })
    const next = Object.freeze({
      pattern: Object.freeze({
        foreground: null,
      }),
    })
    const merged = mergeFill(prev, next)
    expect(merged).toEqual({
      pattern: {
        preset: 'diagCross',
        foreground: null,
      },
    })
    expect(() => validateGeometryStyleOverride({ fill: merged })).not.toThrow()
  })

  it('preserves explicit false and 0 values and ignores undefined', () => {
    const prev = Object.freeze({
      pattern: Object.freeze({
        preset: 'pct25',
        scale: 100,
        active: true,
      }),
    })
    const next = Object.freeze({
      pattern: Object.freeze({
        scale: 0,
        active: false,
        preset: undefined,
      }),
    })
    const merged = mergeFill(prev, next)
    expect(merged.pattern.scale).toBe(0)
    expect(merged.pattern.active).toBe(false)
    expect(merged.pattern.preset).toBe('pct25')
  })

  it('cleanly replaces mutually exclusive variants when switching solid color to pattern', () => {
    const prev = Object.freeze({
      color: Object.freeze({ kind: 'srgb', value: '112233' }),
    })
    const next = Object.freeze({
      pattern: Object.freeze({ preset: 'diagCross' }),
    })
    const merged = mergeFill(prev, next)
    expect(merged).toEqual({
      pattern: { preset: 'diagCross' },
    })
    expect(merged.color).toBeUndefined()
    expect(() => validateGeometryStyleOverride({ fill: merged })).not.toThrow()
  })

  it('cleanly replaces mutually exclusive variants when switching pattern to solid color', () => {
    const prev = Object.freeze({
      pattern: Object.freeze({
        preset: 'diagCross',
        foreground: Object.freeze({ kind: 'srgb', value: '112233' }),
      }),
    })
    const next = Object.freeze({
      color: Object.freeze({ kind: 'srgb', value: '445566' }),
    })
    const merged = mergeFill(prev, next)
    expect(merged).toEqual({
      color: { kind: 'srgb', value: '445566' },
    })
    expect(merged.pattern).toBeUndefined()
    expect(() => validateGeometryStyleOverride({ fill: merged })).not.toThrow()
  })

  it('cleanly replaces mutually exclusive variants when switching gradient to pattern', () => {
    const prev = Object.freeze({
      gradient: Object.freeze({
        kind: 'linear',
        stops: [{ pos: 0, color: { kind: 'srgb', value: '000000' } }],
      }),
      gradientPatch: Object.freeze({ angle: 5400000 }),
    })
    const next = Object.freeze({
      pattern: Object.freeze({ preset: 'wave' }),
    })
    const merged = mergeFill(prev, next)
    expect(merged).toEqual({
      pattern: { preset: 'wave' },
    })
    expect(merged.gradient).toBeUndefined()
    expect(merged.gradientPatch).toBeUndefined()
    expect(() => validateGeometryStyleOverride({ fill: merged })).not.toThrow()
  })

  it('preserves unaffected fields across mutually exclusive variant replacement', () => {
    const prev = Object.freeze({
      color: Object.freeze({ kind: 'srgb', value: '112233' }),
      unaffectedMarker: 'marker-1',
    })
    const next = Object.freeze({
      pattern: Object.freeze({ preset: 'diagCross' }),
    })
    const merged = mergeFill(prev, next)
    expect(merged).toEqual({
      pattern: { preset: 'diagCross' },
      unaffectedMarker: 'marker-1',
    })
    expect(merged.color).toBeUndefined()
  })

  it('drops previous gradientPatch on full gradient replacement', () => {
    const prev = Object.freeze({
      gradient: Object.freeze({
        kind: 'linear',
        angle: 5400000,
        scaled: true,
        rotWithShape: true,
        stops: [{ pos: 0, color: { kind: 'srgb', value: '000000' } }],
      }),
      gradientPatch: Object.freeze({ angle: 5400000, scaled: true }),
    })
    const next = Object.freeze({
      gradient: Object.freeze({
        kind: 'linear',
        angle: 0,
        scaled: false,
        rotWithShape: true,
        stops: [
          { pos: 0, color: { kind: 'srgb', value: 'FFFFFF' } },
          { pos: 100000, color: { kind: 'srgb', value: '112233' } },
        ],
      }),
    })
    const merged = mergeFill(prev, next)
    expect(merged.gradient).toEqual(next.gradient)
    expect(merged.gradientPatch).toBeUndefined()
    expect(() => validateGeometryStyleOverride({ fill: merged })).not.toThrow()
  })

  it('retains only explicit newly supplied patch on full gradient replacement', () => {
    const prev = Object.freeze({
      gradient: Object.freeze({
        kind: 'linear',
        angle: 5400000,
        scaled: true,
        rotWithShape: true,
        stops: [{ pos: 0, color: { kind: 'srgb', value: '000000' } }],
      }),
      gradientPatch: Object.freeze({ angle: 5400000, scaled: true, rotWithShape: false }),
    })
    const next = Object.freeze({
      gradient: Object.freeze({
        kind: 'linear',
        angle: 0,
        scaled: false,
        rotWithShape: true,
        stops: [{ pos: 0, color: { kind: 'srgb', value: 'FFFFFF' } }, { pos: 100000, color: { kind: 'srgb', value: '000000' } }],
      }),
      gradientPatch: Object.freeze({ angle: 1800000 }),
    })
    const merged = mergeFill(prev, next)
    expect(merged.gradient).toEqual(next.gradient)
    expect(merged.gradientPatch).toEqual({ angle: 1800000 })
    expect(merged.gradientPatch.scaled).toBeUndefined()
    expect(merged.gradientPatch.rotWithShape).toBeUndefined()
    expect(() => validateGeometryStyleOverride({ fill: merged })).not.toThrow()
  })

  it('merges sparse gradientPatch when next fill does not supply complete gradient', () => {
    const prev = Object.freeze({
      gradient: Object.freeze({
        kind: 'linear',
        angle: 0,
        scaled: false,
        rotWithShape: true,
        stops: [{ pos: 0, color: { kind: 'srgb', value: '000000' } }, { pos: 100000, color: { kind: 'srgb', value: 'FFFFFF' } }],
      }),
      gradientPatch: Object.freeze({ angle: 5400000, scaled: true }),
    })
    const next = Object.freeze({
      gradientPatch: Object.freeze({ angle: 2700000 }),
    })
    const merged = mergeFill(prev, next)
    expect(merged.gradient).toEqual(prev.gradient)
    expect(merged.gradientPatch).toEqual({ angle: 2700000, scaled: true })
    expect(() => validateGeometryStyleOverride({ fill: merged })).not.toThrow()
  })
})

describe('sequential owner-override operations', () => {
  it('preserves pattern foreground across subsequent preset edits on owner-override', async () => {
    const { presentation } = await importedPresentation()
    const instanceId = Object.keys(presentation.pptxSemantic.instances)[0]
    const baseDefId = presentation.pptxSemantic.instances[instanceId].definitionId

    const firstIntent = operation(
      instanceId,
      {
        type: 'owner-override',
        baseDefinitionId: baseDefId,
        values: {
          geometryStyle: {
            fill: {
              pattern: {
                preset: 'pct25',
                foreground: { kind: 'srgb', value: 'FF2244' },
              },
            },
          },
        },
      },
      { scope: 'all' }
    )
    const preview1 = previewInheritanceEdit(presentation, firstIntent)
    const firstApplied = applyPresentationProjectionOperation(presentation, {
      ...firstIntent,
      preview: preview1,
    })

    const secondIntent = operation(
      instanceId,
      {
        type: 'owner-override',
        baseDefinitionId: baseDefId,
        values: {
          geometryStyle: {
            fill: {
              pattern: {
                preset: 'diagCross',
              },
            },
          },
        },
      },
      { scope: 'all' }
    )
    const preview2 = previewInheritanceEdit(firstApplied, secondIntent)
    const secondApplied = applyPresentationProjectionOperation(firstApplied, {
      ...secondIntent,
      preview: preview2,
    })

    const ownerStyle = Object.values(secondApplied.pptxSemantic.styles).find(
      (s) => s.kind === 'inheritance-override' && s.baseDefinitionId === baseDefId
    )
    expect(ownerStyle).toBeDefined()
    expect(ownerStyle.values.geometryStyle.fill).toEqual({
      pattern: {
        preset: 'diagCross',
        foreground: { kind: 'srgb', value: 'FF2244' },
      },
    })
    expect(() =>
      validateGeometryStyleOverride(ownerStyle.values.geometryStyle)
    ).not.toThrow()

    const geom = materializeGeometry(secondApplied.pptxSemantic, instanceId)
    expect(geom.style.fill.pattern.preset).toBe('diagCross')
    expect(geom.style.fill.pattern.foreground.value).toBe('FF2244')
  })

  it('cleanly cuts over from solid color to pattern without retaining conflicting color', async () => {
    const { presentation } = await importedPresentation()
    const instanceId = Object.keys(presentation.pptxSemantic.instances)[0]
    const baseDefId = presentation.pptxSemantic.instances[instanceId].definitionId

    const firstIntent = operation(
      instanceId,
      {
        type: 'owner-override',
        baseDefinitionId: baseDefId,
        values: {
          geometryStyle: {
            fill: {
              color: { kind: 'srgb', value: '112233' },
            },
          },
        },
      },
      { scope: 'all' }
    )
    const preview1 = previewInheritanceEdit(presentation, firstIntent)
    const firstApplied = applyPresentationProjectionOperation(presentation, {
      ...firstIntent,
      preview: preview1,
    })

    const secondIntent = operation(
      instanceId,
      {
        type: 'owner-override',
        baseDefinitionId: baseDefId,
        values: {
          geometryStyle: {
            fill: {
              pattern: {
                preset: 'wave',
                foreground: { kind: 'srgb', value: '556677' },
              },
            },
          },
        },
      },
      { scope: 'all' }
    )
    const preview2 = previewInheritanceEdit(firstApplied, secondIntent)
    const secondApplied = applyPresentationProjectionOperation(firstApplied, {
      ...secondIntent,
      preview: preview2,
    })

    const ownerStyle = Object.values(secondApplied.pptxSemantic.styles).find(
      (s) => s.kind === 'inheritance-override' && s.baseDefinitionId === baseDefId
    )
    expect(ownerStyle).toBeDefined()
    expect(ownerStyle.values.geometryStyle.fill.color).toBeUndefined()
    expect(ownerStyle.values.geometryStyle.fill.pattern).toEqual({
      preset: 'wave',
      foreground: { kind: 'srgb', value: '556677' },
    })
    expect(() =>
      validateGeometryStyleOverride(ownerStyle.values.geometryStyle)
    ).not.toThrow()

    const geom = materializeGeometry(secondApplied.pptxSemantic, instanceId)
    expect(geom.style.fill.pattern.preset).toBe('wave')
    expect(geom.style.fill.pattern.foreground.value).toBe('556677')
    expect(geom.style.fill.color).toBeUndefined()
  })

  it('cleanly cuts over from pattern to solid color without retaining conflicting pattern', async () => {
    const { presentation } = await importedPresentation()
    const instanceId = Object.keys(presentation.pptxSemantic.instances)[0]
    const baseDefId = presentation.pptxSemantic.instances[instanceId].definitionId

    const firstIntent = operation(
      instanceId,
      {
        type: 'owner-override',
        baseDefinitionId: baseDefId,
        values: {
          geometryStyle: {
            fill: {
              pattern: {
                preset: 'diagCross',
                foreground: { kind: 'srgb', value: 'AA2233' },
              },
            },
          },
        },
      },
      { scope: 'all' }
    )
    const preview1 = previewInheritanceEdit(presentation, firstIntent)
    const firstApplied = applyPresentationProjectionOperation(presentation, {
      ...firstIntent,
      preview: preview1,
    })

    const secondIntent = operation(
      instanceId,
      {
        type: 'owner-override',
        baseDefinitionId: baseDefId,
        values: {
          geometryStyle: {
            fill: {
              color: { kind: 'srgb', value: '8899AA' },
            },
          },
        },
      },
      { scope: 'all' }
    )
    const preview2 = previewInheritanceEdit(firstApplied, secondIntent)
    const secondApplied = applyPresentationProjectionOperation(firstApplied, {
      ...secondIntent,
      preview: preview2,
    })

    const ownerStyle = Object.values(secondApplied.pptxSemantic.styles).find(
      (s) => s.kind === 'inheritance-override' && s.baseDefinitionId === baseDefId
    )
    expect(ownerStyle).toBeDefined()
    expect(ownerStyle.values.geometryStyle.fill.pattern).toBeUndefined()
    expect(ownerStyle.values.geometryStyle.fill.color).toEqual({
      kind: 'srgb',
      value: '8899AA',
    })
    expect(() =>
      validateGeometryStyleOverride(ownerStyle.values.geometryStyle)
    ).not.toThrow()

    const geom = materializeGeometry(secondApplied.pptxSemantic, instanceId)
    expect(geom.style.fill.color.value).toBe('8899AA')
    expect(geom.style.fill.pattern).toBeUndefined()
  })

  it('preserves unaffected geometryStyle fields like stroke and textStyle during sequential fill operations', async () => {
    const { presentation } = await importedPresentation()
    const instanceId = Object.keys(presentation.pptxSemantic.instances)[0]
    const baseDefId = presentation.pptxSemantic.instances[instanceId].definitionId

    const firstIntent = operation(
      instanceId,
      {
        type: 'owner-override',
        baseDefinitionId: baseDefId,
        values: {
          textStyle: { color: { kind: 'srgb', value: '111111' }, italic: true },
          geometryStyle: {
            stroke: { width: 25400, color: { kind: 'srgb', value: '778899' } },
            fill: { color: { kind: 'srgb', value: '334455' } },
          },
        },
      },
      { scope: 'all' }
    )
    const preview1 = previewInheritanceEdit(presentation, firstIntent)
    const firstApplied = applyPresentationProjectionOperation(presentation, {
      ...firstIntent,
      preview: preview1,
    })

    const secondIntent = operation(
      instanceId,
      {
        type: 'owner-override',
        baseDefinitionId: baseDefId,
        values: {
          geometryStyle: {
            fill: {
              pattern: { preset: 'diagCross' },
            },
          },
        },
      },
      { scope: 'all' }
    )
    const preview2 = previewInheritanceEdit(firstApplied, secondIntent)
    const secondApplied = applyPresentationProjectionOperation(firstApplied, {
      ...secondIntent,
      preview: preview2,
    })

    const ownerStyle = Object.values(secondApplied.pptxSemantic.styles).find(
      (s) => s.kind === 'inheritance-override' && s.baseDefinitionId === baseDefId
    )
    expect(ownerStyle.values.textStyle).toEqual({
      color: { kind: 'srgb', value: '111111' },
      italic: true,
    })
    expect(ownerStyle.values.geometryStyle.stroke).toEqual({
      width: 25400,
      color: { kind: 'srgb', value: '778899' },
    })
    expect(ownerStyle.values.geometryStyle.fill).toEqual({
      pattern: { preset: 'diagCross' },
    })
  })

  it('maintains input presentation immutability across sequential operations', async () => {
    const { presentation } = await importedPresentation()
    const beforeClone = clone(presentation)
    const instanceId = Object.keys(presentation.pptxSemantic.instances)[0]
    const baseDefId = presentation.pptxSemantic.instances[instanceId].definitionId

    const firstIntent = operation(
      instanceId,
      {
        type: 'owner-override',
        baseDefinitionId: baseDefId,
        values: {
          geometryStyle: {
            fill: {
              pattern: {
                preset: 'pct25',
                foreground: { kind: 'srgb', value: 'FF0000' },
              },
            },
          },
        },
      },
      { scope: 'all' }
    )
    const preview1 = previewInheritanceEdit(presentation, firstIntent)
    const firstApplied = applyPresentationProjectionOperation(presentation, {
      ...firstIntent,
      preview: preview1,
    })

    expect(presentation).toEqual(beforeClone)
    const firstClone = clone(firstApplied)

    const secondIntent = operation(
      instanceId,
      {
        type: 'owner-override',
        baseDefinitionId: baseDefId,
        values: {
          geometryStyle: {
            fill: { pattern: { preset: 'diagCross' } },
          },
        },
      },
      { scope: 'all' }
    )
    const preview2 = previewInheritanceEdit(firstApplied, secondIntent)
    applyPresentationProjectionOperation(firstApplied, {
      ...secondIntent,
      preview: preview2,
    })

    expect(firstApplied).toEqual(firstClone)
  })

  it('clears previous gradientPatch angle and stop-provider topology on owner-override full gradient replacement', async () => {
    const { presentation } = await importedPresentation()
    const instanceId = Object.keys(presentation.pptxSemantic.instances)[0]
    const baseDefId = presentation.pptxSemantic.instances[instanceId].definitionId

    const initialGradient = {
      kind: 'linear',
      angle: 2700000,
      scaled: true,
      rotWithShape: true,
      stops: [
        { pos: 0, color: { kind: 'srgb', value: '112233' } },
        { pos: 50000, color: { kind: 'srgb', value: '445566' } },
        { pos: 100000, color: { kind: 'srgb', value: '778899' } },
      ],
    }

    // Step 1: Install initial gradient with angle patch
    const firstIntent = operation(
      instanceId,
      {
        type: 'owner-override',
        baseDefinitionId: baseDefId,
        values: {
          geometryStyle: {
            fill: {
              gradient: initialGradient,
              gradientPatch: { angle: 5400000 },
            },
          },
        },
      },
      { scope: 'all' }
    )
    const preview1 = previewInheritanceEdit(presentation, firstIntent)
    const firstApplied = applyPresentationProjectionOperation(presentation, {
      ...firstIntent,
      preview: preview1,
    })

    const geom1 = materializeGeometry(firstApplied.pptxSemantic, instanceId)
    expect(geom1.style.fill.gradient.angle).toBe(5400000)
    expect(geom1.style.fill.gradient.stops.length).toBe(3)

    // Step 2: Apply a real topology patch using provider derived from resolveGeometryStyle
    const resolvedState = resolveGeometryStyle(firstApplied.pptxSemantic, instanceId).gradientEdit
    expect(resolvedState).toBeDefined()
    expect(resolvedState.provider).toBeDefined()

    const topologyIntent = operation(
      instanceId,
      {
        type: 'owner-override',
        baseDefinitionId: baseDefId,
        values: {
          geometryStyle: {
            fill: {
              gradientPatch: {
                angle: 5400000,
                stops: {
                  provider: resolvedState.provider,
                  entries: [{ from: 0, pos: 10000 }, { from: 1 }, { from: 2 }],
                },
              },
            },
          },
        },
      },
      { scope: 'all' }
    )
    const preview2 = previewInheritanceEdit(firstApplied, topologyIntent)
    const patchedApplied = applyPresentationProjectionOperation(firstApplied, {
      ...topologyIntent,
      preview: preview2,
    })
    const geomPatched = materializeGeometry(patchedApplied.pptxSemantic, instanceId)
    expect(geomPatched.style.fill.gradient.stops[0].pos).toBe(10000)
    expect(geomPatched.style.fill.gradient.angle).toBe(5400000)
    const geomPatchedSibling = materializeGeometry(patchedApplied.pptxSemantic, `copy:${instanceId}`)
    expect(geomPatchedSibling.style.fill.gradient.stops[0].pos).toBe(10000)
    expect(geomPatchedSibling.style.fill.gradient.angle).toBe(5400000)
    // Step 3: Complete gradient replacement with different topology (2 stops, angle 0)
    const replacementGradient = {
      kind: 'linear',
      angle: 0,
      scaled: false,
      rotWithShape: true,
      stops: [
        { pos: 0, color: { kind: 'srgb', value: 'AABBCC' } },
        { pos: 100000, color: { kind: 'srgb', value: 'DDEEFF' } },
      ],
    }

    const replacementIntent = operation(
      instanceId,
      {
        type: 'owner-override',
        baseDefinitionId: baseDefId,
        values: {
          geometryStyle: {
            fill: {
              gradient: replacementGradient,
            },
          },
        },
      },
      { scope: 'all' }
    )
    const preview3 = previewInheritanceEdit(patchedApplied, replacementIntent)
    const replacementApplied = applyPresentationProjectionOperation(patchedApplied, {
      ...replacementIntent,
      preview: preview3,
    })
    const ownerStyle = Object.values(replacementApplied.pptxSemantic.styles).find(
      (s) => s.kind === 'inheritance-override' && s.baseDefinitionId === baseDefId
    )
    expect(ownerStyle).toBeDefined()
    expect(ownerStyle.values.geometryStyle.fill.gradient).toEqual(replacementGradient)
    expect(ownerStyle.values.geometryStyle.fill.gradientPatch).toBeUndefined()
    expect(() => validateGeometryStyleOverride(ownerStyle.values.geometryStyle)).not.toThrow()

    // Consumer assertion: angle is 0 (not retained 5400000), stops are 2 (no topology conflict)
    const geomReplacement = materializeGeometry(replacementApplied.pptxSemantic, instanceId)
    expect(geomReplacement.style.fill.gradient.angle).toBe(0)
    expect(geomReplacement.style.fill.gradient.stops.length).toBe(2)
    expect(geomReplacement.style.fill.gradient.stops[0].color.value).toBe('AABBCC')
    expect(geomReplacement.style.fill.gradient.stops[1].color.value).toBe('DDEEFF')
    const geomReplacementSibling = materializeGeometry(replacementApplied.pptxSemantic, `copy:${instanceId}`)
    expect(geomReplacementSibling.style.fill.gradient.angle).toBe(0)
    expect(geomReplacementSibling.style.fill.gradient.stops.length).toBe(2)
    // Step 4: Sparse follow-up patch on replacement gradient
    const sparsePatchIntent = operation(
      instanceId,
      {
        type: 'owner-override',
        baseDefinitionId: baseDefId,
        values: {
          geometryStyle: {
            fill: {
              gradientPatch: { angle: 1800000 },
            },
          },
        },
      },
      { scope: 'all' }
    )
    const preview4 = previewInheritanceEdit(replacementApplied, sparsePatchIntent)
    const sparseApplied = applyPresentationProjectionOperation(replacementApplied, {
      ...sparsePatchIntent,
      preview: preview4,
    })

    const geomSparse = materializeGeometry(sparseApplied.pptxSemantic, instanceId)
    expect(geomSparse.style.fill.gradient.angle).toBe(1800000)
    expect(geomSparse.style.fill.gradient.stops.length).toBe(2)
  })

  it('clears previous gradientPatch on instance-level geometry-style operation and respects immutability', async () => {
    const { presentation } = await importedPresentation()
    const instanceId = Object.keys(presentation.pptxSemantic.instances)[0]

    const initialGradient = {
      kind: 'linear',
      angle: 2700000,
      scaled: true,
      rotWithShape: true,
      stops: [
        { pos: 0, color: { kind: 'srgb', value: '112233' } },
        { pos: 100000, color: { kind: 'srgb', value: '445566' } },
      ],
    }

    const beforeClone = clone(presentation)

    // Step 1: Instance-level edit with gradient and gradientPatch
    const instanceOp1 = operation(instanceId, {
      type: 'geometry-style',
      style: {
        fill: {
          gradient: initialGradient,
          gradientPatch: { angle: 5400000 },
        },
      },
    })
    const preview1 = previewInheritanceEdit(presentation, instanceOp1)
    const firstApplied = applyPresentationProjectionOperation(presentation, {
      ...instanceOp1,
      preview: preview1,
    })

    expect(presentation).toEqual(beforeClone)
    const firstClone = clone(firstApplied)

    const inst1 = firstApplied.pptxSemantic.instances[instanceId]
    const geomComp1 = Object.values(inst1.overrides.components).find((c) => c.geometryStyle?.fill)
    expect(geomComp1.geometryStyle.fill.gradientPatch).toEqual({ angle: 5400000 })
    expect(materializeGeometry(firstApplied.pptxSemantic, instanceId).style.fill.gradient.angle).toBe(5400000)

    // Step 2: Instance-level complete gradient replacement
    const replacementGradient = {
      kind: 'linear',
      angle: 900000,
      scaled: false,
      rotWithShape: true,
      stops: [
        { pos: 0, color: { kind: 'srgb', value: 'AABB00' } },
        { pos: 100000, color: { kind: 'srgb', value: 'CCDDEE' } },
      ],
    }

    const instanceOp2 = operation(instanceId, {
      type: 'geometry-style',
      style: {
        fill: {
          gradient: replacementGradient,
        },
      },
    })
    const preview2 = previewInheritanceEdit(firstApplied, instanceOp2)
    const secondApplied = applyPresentationProjectionOperation(firstApplied, {
      ...instanceOp2,
      preview: preview2,
    })

    expect(firstApplied).toEqual(firstClone)

    const inst2 = secondApplied.pptxSemantic.instances[instanceId]
    const geomComp2 = Object.values(inst2.overrides.components).find((c) => c.geometryStyle?.fill)
    expect(geomComp2.geometryStyle.fill.gradient).toEqual(replacementGradient)
    expect(geomComp2.geometryStyle.fill.gradientPatch).toBeUndefined()

    const geom2 = materializeGeometry(secondApplied.pptxSemantic, instanceId)
    expect(geom2.style.fill.gradient.angle).toBe(900000)
    expect(geom2.style.fill.gradient.stops[0].color.value).toBe('AABB00')
  })
})

describe('ancestor cascade across master and layout definition hierarchy', () => {
  it('merges sparse pattern leaves across master and layout hierarchy', async () => {
    const { presentation } = await importedPresentation()
    const pres = clone(presentation)
    const instanceId = Object.keys(pres.pptxSemantic.instances)[0]
    const inst = pres.pptxSemantic.instances[instanceId]
    const layoutDef = Object.values(pres.pptxSemantic.definitions).find(
      (d) => d.source?.partUri === layout && d.kind === 'shape'
    )
    const masterDef = Object.values(pres.pptxSemantic.definitions).find(
      (d) => d.source?.partUri === master && d.kind === 'shape'
    )
    const slideDef = pres.pptxSemantic.definitions[inst.definitionId]
    slideDef.parentDefinitionId = layoutDef.id
    layoutDef.parentDefinitionId = masterDef.id

    // Master defines pattern preset and foreground
    pres.pptxSemantic.styles['project-inheritance:master'] = {
      kind: 'inheritance-override',
      origin: 'project',
      baseDefinitionId: masterDef.id,
      values: {
        geometryStyle: {
          fill: {
            pattern: {
              preset: 'pct25',
              foreground: { kind: 'srgb', value: 'AA1122' },
            },
          },
        },
      },
    }

    // Layout updates only pattern preset to diagCross (omitting foreground)
    pres.pptxSemantic.styles['project-inheritance:layout'] = {
      kind: 'inheritance-override',
      origin: 'project',
      baseDefinitionId: layoutDef.id,
      values: {
        geometryStyle: {
          fill: {
            pattern: {
              preset: 'diagCross',
            },
          },
        },
      },
    }

    const geom = materializeGeometry(pres.pptxSemantic, instanceId)
    expect(geom.style.fill.pattern.preset).toBe('diagCross')
    expect(geom.style.fill.pattern.foreground.value).toBe('AA1122')
  })

  it('cleanly replaces master solid color when layout defines pattern in cascade', async () => {
    const { presentation } = await importedPresentation()
    const pres = clone(presentation)
    const instanceId = Object.keys(pres.pptxSemantic.instances)[0]
    const inst = pres.pptxSemantic.instances[instanceId]
    const layoutDef = Object.values(pres.pptxSemantic.definitions).find(
      (d) => d.source?.partUri === layout && d.kind === 'shape'
    )
    const masterDef = Object.values(pres.pptxSemantic.definitions).find(
      (d) => d.source?.partUri === master && d.kind === 'shape'
    )
    const slideDef = pres.pptxSemantic.definitions[inst.definitionId]
    slideDef.parentDefinitionId = layoutDef.id
    layoutDef.parentDefinitionId = masterDef.id

    // Master defines solid color
    pres.pptxSemantic.styles['project-inheritance:master'] = {
      kind: 'inheritance-override',
      origin: 'project',
      baseDefinitionId: masterDef.id,
      values: {
        geometryStyle: {
          fill: { color: { kind: 'srgb', value: '001122' } },
        },
      },
    }

    // Layout defines pattern fill
    pres.pptxSemantic.styles['project-inheritance:layout'] = {
      kind: 'inheritance-override',
      origin: 'project',
      baseDefinitionId: layoutDef.id,
      values: {
        geometryStyle: {
          fill: {
            pattern: {
              preset: 'wave',
              foreground: { kind: 'srgb', value: '334455' },
            },
          },
        },
      },
    }

    const geom = materializeGeometry(pres.pptxSemantic, instanceId)
    expect(geom.style.fill.pattern.preset).toBe('wave')
    expect(geom.style.fill.pattern.foreground.value).toBe('334455')
    expect(geom.style.fill.color).toBeUndefined()
  })

  it('cleanly replaces master pattern when layout defines solid color in cascade', async () => {
    const { presentation } = await importedPresentation()
    const pres = clone(presentation)
    const instanceId = Object.keys(pres.pptxSemantic.instances)[0]
    const inst = pres.pptxSemantic.instances[instanceId]
    const layoutDef = Object.values(pres.pptxSemantic.definitions).find(
      (d) => d.source?.partUri === layout && d.kind === 'shape'
    )
    const masterDef = Object.values(pres.pptxSemantic.definitions).find(
      (d) => d.source?.partUri === master && d.kind === 'shape'
    )
    const slideDef = pres.pptxSemantic.definitions[inst.definitionId]
    slideDef.parentDefinitionId = layoutDef.id
    layoutDef.parentDefinitionId = masterDef.id

    // Master defines pattern
    pres.pptxSemantic.styles['project-inheritance:master'] = {
      kind: 'inheritance-override',
      origin: 'project',
      baseDefinitionId: masterDef.id,
      values: {
        geometryStyle: {
          fill: {
            pattern: {
              preset: 'pct25',
              foreground: { kind: 'srgb', value: 'AA1122' },
            },
          },
        },
      },
    }

    // Layout defines solid color
    pres.pptxSemantic.styles['project-inheritance:layout'] = {
      kind: 'inheritance-override',
      origin: 'project',
      baseDefinitionId: layoutDef.id,
      values: {
        geometryStyle: {
          fill: { color: { kind: 'srgb', value: '667788' } },
        },
      },
    }

    const geom = materializeGeometry(pres.pptxSemantic, instanceId)
    expect(geom.style.fill.color.value).toBe('667788')
    expect(geom.style.fill.pattern).toBeUndefined()
  })

  it('drops ancestor gradientPatch when descendant defines complete replacement gradient in cascade', async () => {
    const { presentation } = await importedPresentation()
    const pres = clone(presentation)
    const instanceId = Object.keys(pres.pptxSemantic.instances)[0]
    const inst = pres.pptxSemantic.instances[instanceId]
    const layoutDef = Object.values(pres.pptxSemantic.definitions).find(
      (d) => d.source?.partUri === layout && d.kind === 'shape'
    )
    const masterDef = Object.values(pres.pptxSemantic.definitions).find(
      (d) => d.source?.partUri === master && d.kind === 'shape'
    )
    const slideDef = pres.pptxSemantic.definitions[inst.definitionId]
    slideDef.parentDefinitionId = layoutDef.id
    layoutDef.parentDefinitionId = masterDef.id

    // Master defines gradient with angle patch
    pres.pptxSemantic.styles['project-inheritance:master'] = {
      kind: 'inheritance-override',
      origin: 'project',
      baseDefinitionId: masterDef.id,
      values: {
        geometryStyle: {
          fill: {
            gradient: {
              kind: 'linear',
              angle: 2700000,
              scaled: true,
              rotWithShape: true,
              stops: [
                { pos: 0, color: { kind: 'srgb', value: '112233' } },
                { pos: 50000, color: { kind: 'srgb', value: '445566' } },
                { pos: 100000, color: { kind: 'srgb', value: '778899' } },
              ],
            },
            gradientPatch: { angle: 5400000 },
          },
        },
      },
    }

    // Layout defines complete replacement gradient without patch
    pres.pptxSemantic.styles['project-inheritance:layout'] = {
      kind: 'inheritance-override',
      origin: 'project',
      baseDefinitionId: layoutDef.id,
      values: {
        geometryStyle: {
          fill: {
            gradient: {
              kind: 'linear',
              angle: 0,
              scaled: false,
              rotWithShape: true,
              stops: [
                { pos: 0, color: { kind: 'srgb', value: 'AABBCC' } },
                { pos: 100000, color: { kind: 'srgb', value: 'DDEEFF' } },
              ],
            },
          },
        },
      },
    }

    const geom = materializeGeometry(pres.pptxSemantic, instanceId)
    expect(geom.style.fill.gradient.angle).toBe(0)
    expect(geom.style.fill.gradient.stops.length).toBe(2)
    expect(geom.style.fill.gradient.stops[0].color.value).toBe('AABBCC')
    expect(geom.style.fill.gradient.stops[1].color.value).toBe('DDEEFF')
  })

  it('merges sparse gradientPatch across ancestor cascade without replacing gradient', async () => {
    const { presentation } = await importedPresentation()
    const pres = clone(presentation)
    const instanceId = Object.keys(pres.pptxSemantic.instances)[0]
    const inst = pres.pptxSemantic.instances[instanceId]
    const layoutDef = Object.values(pres.pptxSemantic.definitions).find(
      (d) => d.source?.partUri === layout && d.kind === 'shape'
    )
    const masterDef = Object.values(pres.pptxSemantic.definitions).find(
      (d) => d.source?.partUri === master && d.kind === 'shape'
    )
    const slideDef = pres.pptxSemantic.definitions[inst.definitionId]
    slideDef.parentDefinitionId = layoutDef.id
    layoutDef.parentDefinitionId = masterDef.id

    // Master defines base gradient
    pres.pptxSemantic.styles['project-inheritance:master'] = {
      kind: 'inheritance-override',
      origin: 'project',
      baseDefinitionId: masterDef.id,
      values: {
        geometryStyle: {
          fill: {
            gradient: {
              kind: 'linear',
              angle: 2700000,
              scaled: true,
              rotWithShape: true,
              stops: [
                { pos: 0, color: { kind: 'srgb', value: '112233' } },
                { pos: 50000, color: { kind: 'srgb', value: '445566' } },
                { pos: 100000, color: { kind: 'srgb', value: '778899' } },
              ],
            },
          },
        },
      },
    }

    // Layout defines sparse patch modifying only angle
    pres.pptxSemantic.styles['project-inheritance:layout'] = {
      kind: 'inheritance-override',
      origin: 'project',
      baseDefinitionId: layoutDef.id,
      values: {
        geometryStyle: {
          fill: {
            gradientPatch: { angle: 5400000 },
          },
        },
      },
    }

    const geom = materializeGeometry(pres.pptxSemantic, instanceId)
    expect(geom.style.fill.gradient.angle).toBe(5400000)
    expect(geom.style.fill.gradient.stops.length).toBe(3)
  })
})

describe('canonical snapshot publication and reopen', () => {
  it('survives canonical snapshot and reopen after solid-to-pattern and pattern leaf updates', async () => {
    const { presentation } = await importedPresentation()
    const instanceId = Object.keys(presentation.pptxSemantic.instances)[0]
    const baseDefId = presentation.pptxSemantic.instances[instanceId].definitionId

    // Step 1: Initial solid fill
    const solidIntent = operation(
      instanceId,
      {
        type: 'owner-override',
        baseDefinitionId: baseDefId,
        values: {
          geometryStyle: {
            fill: { color: { kind: 'srgb', value: '112233' } },
            stroke: { width: 12700, color: { kind: 'srgb', value: '445566' } },
          },
        },
      },
      { scope: 'all' }
    )
    const preview1 = previewInheritanceEdit(presentation, solidIntent)
    const step1 = applyPresentationProjectionOperation(presentation, {
      ...solidIntent,
      preview: preview1,
    })

    // Step 2: Switch to pattern with foreground
    const patternIntent = operation(
      instanceId,
      {
        type: 'owner-override',
        baseDefinitionId: baseDefId,
        values: {
          geometryStyle: {
            fill: {
              pattern: {
                preset: 'pct25',
                foreground: { kind: 'srgb', value: 'EE1133' },
              },
            },
          },
        },
      },
      { scope: 'all' }
    )
    const preview2 = previewInheritanceEdit(step1, patternIntent)
    const step2 = applyPresentationProjectionOperation(step1, {
      ...patternIntent,
      preview: preview2,
    })

    // Step 3: Update preset only (sparse leaf merge)
    const presetIntent = operation(
      instanceId,
      {
        type: 'owner-override',
        baseDefinitionId: baseDefId,
        values: {
          geometryStyle: {
            fill: {
              pattern: {
                preset: 'diagCross',
              },
            },
          },
        },
      },
      { scope: 'all' }
    )
    const preview3 = previewInheritanceEdit(step2, presetIntent)
    const step3 = applyPresentationProjectionOperation(step2, {
      ...presetIntent,
      preview: preview3,
    })

    // Publish canonical editable snapshot and reopen
    const snapshot = canonicalEditableSnapshot(step3)
    const reopened = normalizeSemanticPresentation(clone(snapshot))

    // Validations
    expect(() => validateGeometryStyleRecords(reopened.pptxSemantic)).not.toThrow()

    const geom = materializeGeometry(reopened.pptxSemantic, instanceId)
    expect(geom.style.fill.pattern.preset).toBe('diagCross')
    expect(geom.style.fill.pattern.foreground.value).toBe('EE1133')
    expect(geom.style.fill.color).toBeUndefined()
    expect(geom.style.stroke.color.value).toBe('445566')
    expect(geom.style.stroke.width).toBe(12700)
  })

  it('survives canonical snapshot publication and reopen after full gradient replacement with cleared patch', async () => {
    const { presentation } = await importedPresentation()
    const instanceId = Object.keys(presentation.pptxSemantic.instances)[0]
    const baseDefId = presentation.pptxSemantic.instances[instanceId].definitionId

    const initialGradient = {
      kind: 'linear',
      angle: 2700000,
      scaled: true,
      rotWithShape: true,
      stops: [
        { pos: 0, color: { kind: 'srgb', value: '112233' } },
        { pos: 50000, color: { kind: 'srgb', value: '445566' } },
        { pos: 100000, color: { kind: 'srgb', value: '778899' } },
      ],
    }

    // Step 1: Set initial gradient with angle patch
    const firstIntent = operation(
      instanceId,
      {
        type: 'owner-override',
        baseDefinitionId: baseDefId,
        values: {
          geometryStyle: {
            fill: {
              gradient: initialGradient,
              gradientPatch: { angle: 5400000 },
            },
          },
        },
      },
      { scope: 'all' }
    )
    const preview1 = previewInheritanceEdit(presentation, firstIntent)
    const step1 = applyPresentationProjectionOperation(presentation, {
      ...firstIntent,
      preview: preview1,
    })

    // Step 2: Replace with new gradient (2 stops, angle 0)
    const replacementGradient = {
      kind: 'linear',
      angle: 0,
      scaled: false,
      rotWithShape: true,
      stops: [
        { pos: 0, color: { kind: 'srgb', value: 'AABBCC' } },
        { pos: 100000, color: { kind: 'srgb', value: 'DDEEFF' } },
      ],
    }

    const replacementIntent = operation(
      instanceId,
      {
        type: 'owner-override',
        baseDefinitionId: baseDefId,
        values: {
          geometryStyle: {
            fill: {
              gradient: replacementGradient,
            },
          },
        },
      },
      { scope: 'all' }
    )
    const preview2 = previewInheritanceEdit(step1, replacementIntent)
    const step2 = applyPresentationProjectionOperation(step1, {
      ...replacementIntent,
      preview: preview2,
    })

    // Publish canonical editable snapshot and reopen
    const snapshot = canonicalEditableSnapshot(step2)
    const reopened = normalizeSemanticPresentation(clone(snapshot))

    // Validations
    expect(() => validateGeometryStyleRecords(reopened.pptxSemantic)).not.toThrow()

    const geom = materializeGeometry(reopened.pptxSemantic, instanceId)
    expect(geom.style.fill.gradient.angle).toBe(0)
    expect(geom.style.fill.gradient.stops.length).toBe(2)
    expect(geom.style.fill.gradient.stops[0].color.value).toBe('AABBCC')
    expect(geom.style.fill.gradient.stops[1].color.value).toBe('DDEEFF')
  })
})
