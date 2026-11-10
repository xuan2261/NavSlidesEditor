// @vitest-environment jsdom
import React, { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { pictureFixture } from './semantic-picture-fixture'
import ImageProperties from '../../client/src/components/properties/image-properties'
import CanvasElement from '../../client/src/components/canvas/canvas-element-wrapper'
import operations from '../../shared/src/pptx-projection-operation'
import pictureSvgModule from '../../shared/src/pptx-picture-svg'
import renderTree from '../../shared/src/pptx-semantic-render-tree'
import { applySemanticGeometry } from '../../client/src/utils/pptx-semantic-geometry-bridge'
import CommonElementControls from '../../client/src/components/properties/common-element-controls'
import CanvasContextMenu from '../../client/src/components/canvas/canvas-right-click-context-menu-for-slide-elements'
let uploadsDir
beforeEach(async () => { uploadsDir = await mkdtemp(join(tmpdir(), 'picture-ui-')) })
afterEach(async () => { cleanup(); await rm(uploadsDir, { recursive: true, force: true }) })
describe('canonical picture inspector and canvas', () => {
  it('edits exact crop and each ordered alpha stage through the real operation reducer', async () => {
    const { presentation } = await pictureFixture({ uploadsDir })
    let current = presentation
    const receipts = []
    function Harness() {
      const [value, setValue] = useState(presentation)
      return <ImageProperties element={value.slides[0].elements[0]} pptxSemantic={value.pptxSemantic}
        onUpdate={(update) => {
          receipts.push(update)
          current = operations.applyPresentationProjectionOperation(value, update.pptxProjectionOperation)
          setValue(current)
        }} />
    }
    render(<Harness />)
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Picture crop left (%)' }), { target: { value: '0.75' } })
    expect(current.slides[0].elements[0].pptxPicture.srcRect.l).toBe(750)
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Picture alpha stage 1 (%)' }), { target: { value: '150' } })
    expect(current.slides[0].elements[0].pptxPicture.alpha.map((stage) => stage.amt)).toEqual([150000, 35000])
    fireEvent.click(screen.getByRole('button', { name: 'Move alpha stage 2 up' }))
    expect(current.slides[0].elements[0].pptxPicture.alpha.map((stage) => stage.amt)).toEqual([35000, 150000])
    expect(receipts.every((r) => Object.keys(r).join() === 'pptxProjectionOperation')).toBe(true)
    expect(current.pptxSemantic.definitions).toEqual(presentation.pptxSemantic.definitions)
    expect(current.slides[0].elements[1]).toEqual(presentation.slides[0].elements[1])
    fireEvent.click(screen.getByRole('button', { name: 'Reset picture crop and alpha' }))
    expect(current).toEqual(presentation)
  })
  it('displays asynchronous crop and alpha rejection without changing source or sibling', async () => {
    const { presentation } = await pictureFixture({ uploadsDir })
    const before = structuredClone(presentation)
    const onUpdate = vi.fn().mockRejectedValue(new TypeError('Picture edit could not be saved'))
    render(<ImageProperties element={presentation.slides[0].elements[0]}
      pptxSemantic={presentation.pptxSemantic} onUpdate={onUpdate} />)
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Picture crop left (%)' }),
      { target: { value: '0.75' } })
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Picture edit could not be saved'))
    expect(onUpdate).toHaveBeenLastCalledWith({ pptxProjectionOperation: {
      type: 'picture.edit', instanceId: presentation.slides[0].elements[0].pptxInstanceId,
      componentId: presentation.slides[0].elements[0].pptxPicture.componentId,
      command: { type: 'crop', edge: 'l', value: 750 },
    } })
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Picture alpha stage 1 (%)' }),
      { target: { value: '150' } })
    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('alert').textContent).toContain('Picture edit could not be saved')
    expect(presentation).toEqual(before)
  })
  it('reads source state rather than forged aliases and respects slide/ancestor locks', async () => {
    const { presentation } = await pictureFixture({ uploadsDir })
    const element = { ...presentation.slides[0].elements[0], pptxPicture: { forged: true }, opacity: 0.9 }
    const onUpdate = vi.fn()
    const { rerender } = render(<ImageProperties element={element} pptxSemantic={presentation.pptxSemantic}
      slideLocked onUpdate={onUpdate} />)
    const input = screen.getByRole('spinbutton', { name: 'Picture crop left (%)' })
    expect(input.value).toBe('0.5')
    expect(input.closest('fieldset').disabled).toBe(true)
    const locked = structuredClone(presentation.pptxSemantic)
    locked.instances[element.pptxInstanceId].overrides.locked = true
    rerender(<ImageProperties element={element} pptxSemantic={locked} onUpdate={onUpdate} />)
    expect(screen.getByRole('spinbutton', { name: 'Picture alpha stage 1 (%)' }).closest('fieldset').disabled).toBe(true)
    expect(onUpdate).not.toHaveBeenCalled()
  })
  it('canvas uses the same SVG image-only alpha and native mask as generated output', async () => {
    const { presentation } = await pictureFixture({ uploadsDir })
    const node = renderTree.semanticRenderTree(presentation.pptxSemantic, presentation.slides[0])[0]
    const element = renderTree.semanticLocalElement(node.element)
    const { container } = render(<CanvasElement element={element} iconPaths={{}}
      onPointerDown={vi.fn()} onClick={vi.fn()} onDoubleClick={vi.fn()} onContextMenu={vi.fn()} />)
    const svg = container.querySelector('svg[data-pptx-picture]')
    expect(svg).not.toBeNull()
    const expected = document.createElement('div')
    expected.innerHTML = pictureSvgModule.pictureSvg(element)
    expect(svg.outerHTML).toBe(expected.firstChild.outerHTML)
    expect(container.querySelector('img')).toBeNull()
  })
  it('rejects fake legacy crop/alpha updates in the editor bridge', async () => {
    const { presentation } = await pictureFixture({ uploadsDir })
    const slide = presentation.slides[0], element = slide.elements[0]
    for (const update of [{ opacity: 0.2 }, { imageW: 300 }, { cropData: { left: 0.2 } }, { src: '/uploads/other.png' }]) {
      expect(() => applySemanticGeometry(presentation.pptxSemantic, slide, [{ id: element.id, ...update }])).toThrow()
    }
  })
  it('does not expose generic whole-object opacity for canonical pictures', async () => {
    const { presentation } = await pictureFixture({ uploadsDir })
    render(<CommonElementControls element={presentation.slides[0].elements[0]}
      pptxSemantic={presentation.pptxSemantic} onUpdate={vi.fn()} />)
    expect(screen.queryByRole('slider', { name: 'Opacity' })).toBeNull()
  })
  it('context Crop opens canonical controls and Reset crop dispatches a crop-only operation', async () => {
    const { presentation } = await pictureFixture({ uploadsDir })
    const element = presentation.slides[0].elements[0], start = vi.fn(), update = vi.fn()
    render(<CanvasContextMenu
      contextMenu={{ elementId: element.id, elementType: 'image', x: 0, y: 0 }}
      slide={presentation.slides[0]} pptxSemantic={presentation.pptxSemantic}
      onStartCrop={start} onUpdateElement={update} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Crop' }))
    expect(start).not.toHaveBeenCalled()
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Picture crop left (%)' }),
      { target: { value: '0.75' } })
    expect(update).toHaveBeenCalledWith(element.id, { pptxProjectionOperation: {
      type: 'picture.edit', instanceId: element.pptxInstanceId, componentId: element.pptxPicture.componentId,
      command: { type: 'crop', edge: 'l', value: 750 },
    } })
    fireEvent.click(screen.getByRole('button', { name: 'Reset crop' }))
    expect(update).toHaveBeenLastCalledWith(element.id, { pptxProjectionOperation: {
      type: 'picture.edit', instanceId: element.pptxInstanceId, componentId: element.pptxPicture.componentId,
      command: { type: 'reset-crop' },
    } })
  })
})
