// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import NativeSourceTimingControls from './native-source-timing-controls'
import reader from '../../../server/services/pptx-import/ooxml-semantic-timing'
import xmlReader from '../../../server/services/pptx-import/ooxml-text-run-xml'

afterEach(cleanup)
const hash = 'a'.repeat(64)
function fixture(filter = 'fade') {
  const partUri = 'ppt/slides/slide1.xml'
  const xml = `<p:timing xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:tnLst><p:par><p:cTn id="1" nodeType="clickEffect"><p:childTnLst><p:animEffect filter="${filter}" transition="in"><p:cBhvr><p:cTn id="2" dur="300"/><p:tgtEl><p:spTgt spid="7"/></p:tgtEl></p:cBhvr></p:animEffect></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>`
  const source = { id: 'timing', partUri, preconditionHash: hash, componentLocators: [{ path: [0, 1], preconditionHash: hash }] }
  const timingDocument = reader.readSemanticTiming({ source, node: xmlReader.parseXml(xml)[0], xml })
  const document = { definitions: {
    timing: { id: 'timing', kind: 'opaque', source: { partUri, preconditionHash: hash, componentLocator: source.componentLocators[0] }, content: { timingDocument } },
    target: { id: 'target', kind: 'shape', source: { partUri, nativeId: '7' }, content: {} },
  }, instances: { target: { id: 'target', slideId: 'slide', definitionId: 'target', parentInstanceId: null, overrides: {} } },
  sourceSlides: [{ slideId: 'slide', partUri }] }
  return { document, slide: { id: 'slide', elements: [{ id: 'target', type: 'shape', pptxInstanceId: 'target' }] } }
}

describe('native source timing controls', () => {
  it('emits a canonical source-bound trigger command rather than a fragment patch', async () => {
    const props = fixture(), onOperation = vi.fn()
    render(<NativeSourceTimingControls {...props} onOperation={onOperation} />)
    fireEvent.change(screen.getByLabelText('Source timing 1 trigger'), { target: { value: 'afterPrevious' } })
    await waitFor(() => expect(onOperation).toHaveBeenCalledTimes(1))
    expect(onOperation).toHaveBeenCalledWith(expect.objectContaining({ type: 'timing.edit', slideId: 'slide', definitionId: 'timing',
      nodeLocator: expect.objectContaining({ preconditionHash: hash }), command: { type: 'set-trigger', trigger: 'afterPrevious' } }))
  })
  it('shows unsupported timing without editable controls or fake playback', () => {
    render(<NativeSourceTimingControls {...fixture('wipe(right)')} onOperation={vi.fn()} />)
    expect(screen.getByRole('status').textContent).toMatch(/unsupported-effect/)
    expect(screen.queryByLabelText('Source timing 1 trigger')).toBeNull()
  })
  it('displays rejected async edits and does not silently swallow the failure', async () => {
    render(<NativeSourceTimingControls {...fixture()} onOperation={vi.fn().mockRejectedValue(new Error('Locked source timing'))} />)
    fireEvent.change(screen.getByLabelText('Source timing 1 trigger'), { target: { value: 'withPrevious' } })
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Locked source timing')
  })
  it('emits duration and delay commands with non-negative integer values', async () => {
    const props = fixture(), onOperation = vi.fn()
    render(<NativeSourceTimingControls {...props} onOperation={onOperation} />)
    fireEvent.change(screen.getByLabelText('Source timing 1 duration'), { target: { value: '650' } })
    await waitFor(() => expect(onOperation).toHaveBeenCalledWith(expect.objectContaining({
      command: { type: 'set-duration', durationMs: 650 },
    })))
    fireEvent.change(screen.getByLabelText('Source timing 1 delay'), { target: { value: '150' } })
    await waitFor(() => expect(onOperation).toHaveBeenCalledWith(expect.objectContaining({
      command: { type: 'set-delay', delayMs: 150 },
    })))
  })
})
