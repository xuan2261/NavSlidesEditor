// @vitest-environment jsdom
import { useState } from 'react'
import { act, cleanup, renderHook, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import JSZip from 'jszip'
import PptxGenJS from 'pptxgenjs'
import mapper from '../../../../server/services/pptx-import/mapper/map-presentation.js'
import { canonicalEditableSnapshot } from '../../../../server/services/pptx-import/canonical-snapshot.js'
import { useEditorElementController } from './use-editor-element-controller'
import AnimationTimeline from '../../components/AnimationTimeline'

afterEach(cleanup)

describe('source timing presence survives canonical save before the first deletion', () => {
  it.each(['<p:animEffect filter="fade"/>', '<p:animMotion path="M 0 0 L 1 1"/>', ''])(
    'discloses preserved native timing after parse/map and reopen (%s)', async (animation) => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), 'navslides-timing-reopen-'))
      try {
        const deck = new PptxGenJS()
        deck.addSlide().addText('Animated source', { x: 1, y: 1, w: 3, h: 1 })
        const zip = await JSZip.loadAsync(await deck.write({ outputType: 'nodebuffer' }))
        const sourcePath = 'ppt/slides/slide1.xml'
        const sourceXml = (await zip.file(sourcePath).async('string')).replace('</p:sld>', `<p:timing>${animation}</p:timing></p:sld>`)
        zip.file(sourcePath, sourceXml)
        const imported = await mapper.mapPptxOutput({
          zip, uploadsDir: root, originalName: 'Timing.pptx',
          output: { size: { width: 960, height: 540 }, slides: [{ elements: [
            { type: 'text', content: '<p>Animated source</p>', left: 96, top: 96, width: 288, height: 96 },
          ] }] },
        })
        const original = structuredClone(imported.presentation)
        const reopened = JSON.parse(JSON.stringify(canonicalEditableSnapshot(imported.presentation)))
        expect(reopened.slides[0]._pptxAnimations).toBeUndefined()
        const { result } = renderHook(() => {
          const [presentation, setPresentation] = useState(reopened)
          const controller = useEditorElementController({ presentation, setPresentation,
            activeSlide: presentation.slides[0], editingElementIdRef: { current: null },
            setSelectedElementIds: vi.fn(), setEditingElementId: vi.fn(),
            mapActive: (previous, update) => ({ ...previous, slides: [update(previous.slides[0])] }),
          })
          return { presentation, controller }
        })
        const target = reopened.slides[0].elements[0].id
        act(() => result.current.controller.deleteElement(target))
        const slide = result.current.presentation.slides[0]
        expect(slide.animationReferenceError).toMatch(/source animation timing.*deleted/i)
        expect(reopened.slides[0].hasSourceTiming).toBe(true)
        const saved = canonicalEditableSnapshot(result.current.presentation)
        expect(saved.slides[0].hasSourceTiming).toBe(true)
        expect(saved.slides[0].animationReferenceError).toBe(slide.animationReferenceError)
        render(<AnimationTimeline slide={slide} onClose={vi.fn()} onUpdateElement={vi.fn()} />)
        expect(screen.getByRole('alert').textContent).toBe(slide.animationReferenceError)
        expect(imported.presentation).toEqual(original)
        expect(await zip.file(sourcePath).async('string')).toBe(sourceXml)
      } finally {
        await fs.rm(root, { recursive: true, force: true })
      }
    }
  )
})
