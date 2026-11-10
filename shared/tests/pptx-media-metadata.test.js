import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createSemanticMediaFixture } from '../../tests/pptx-semantic/semantic-media-fixture'
import { projectSemanticImport } from '../../server/services/pptx-import/semantic-projector'
import { editMediaPlaybackOccurrence } from '../src/pptx-media-operations'
import { mediaCompatibilityElement, validateMediaOverride } from '../src/pptx-media-document'
import { normalizePptxSemanticDocument } from '../src/pptx-semantic-document'
import { renderSlideElements } from '../src/element-renderers'

let uploadsDir, document, element, instance, source
beforeAll(async () => {
  uploadsDir = await mkdtemp(path.join(tmpdir(), 'media-metadata-'))
  const { presentation } = await projectSemanticImport({
    zip: await createSemanticMediaFixture({ mediaType: 'video', trimEnd: '2500.25' }),
    uploadsDir, presentation: { id: 'media', slides: [{ id: 'slide', elements: [] }] },
  })
  document = normalizePptxSemanticDocument(JSON.parse(JSON.stringify(presentation.pptxSemantic)))
  element = presentation.slides[0].elements[0]
  instance = document.instances[element.pptxInstanceId]
  source = document.definitions[instance.definitionId].content.mediaDocument
})
afterAll(async () => { if (uploadsDir) await rm(uploadsDir, { recursive: true, force: true }) })
const track = { src: '/uploads/en.vtt', srcLang: 'en', label: 'English', kind: 'captions', default: true }
const edit = (patch, input = document) =>
  editMediaPlaybackOccurrence(input, instance.id, source.embeddedComponentId, patch)

describe('canonical occurrence media metadata consumers', () => {
  it('renders persisted metadata without changing the source or a sibling occurrence', () => {
    const original = structuredClone(document)
    const sibling = { ...structuredClone(instance), id: `${instance.id}-sibling`, paintIndex: 2 }
    const input = { ...document, instances: { ...document.instances, [sibling.id]: sibling } }
    const metadata = { poster: '/uploads/alternate.png', tracks: [track], transcript: 'Spoken <words>',
      audioDescription: 'A diagram appears.', volume: 0.35 }
    const edited = edit(metadata, input)
    const reopened = normalizePptxSemanticDocument(JSON.parse(JSON.stringify(edited)))
    const projected = mediaCompatibilityElement(reopened, element)
    expect(projected).toMatchObject(metadata)
    const html = renderSlideElements({ id: 'slide', elements: [projected] })
    expect(html).toContain('poster="/uploads/alternate.png"')
    expect(html).toContain('<track src="/uploads/en.vtt" kind="captions" srclang="en" label="English" default>')
    expect(html).toContain('Spoken &lt;words&gt;')
    expect(html).toContain('A diagram appears.')
    expect(html).toContain('&quot;volume&quot;:0.35')
    expect(projected.src).toBe(source.asset.src)
    expect(reopened.definitions).toEqual(document.definitions)
    expect(reopened.instances[sibling.id]).toEqual(sibling)
    expect(document).toEqual(original)
  })

  it('derives all metadata from canonical state rather than a stale compatibility cache', () => {
    const projected = mediaCompatibilityElement(document, { ...element, src: '/uploads/forged.mp4',
      poster: '/uploads/forged.png', tracks: [track], transcript: 'Forged', audioDescription: 'Forged', volume: 0 })
    expect(projected).toMatchObject({ src: source.asset.src, poster: source.poster.src,
      tracks: [], transcript: '', audioDescription: '', volume: 1 })
  })

  it('preserves empty caption drafts but never mounts their empty sources', () => {
    const draft = { ...track, src: '', label: '', srcLang: '' }
    const projected = mediaCompatibilityElement(edit({ tracks: [draft] }), element)
    expect(projected.tracks).toEqual([draft])
    expect(renderSlideElements({ id: 'slide', elements: [projected] })).not.toContain('<track ')
  })

  it('clears metadata back to source defaults without retaining dead override records', () => {
    const edited = edit({ poster: '', tracks: [track], transcript: 'Words', audioDescription: 'Scene', volume: 0 })
    const reset = edit({ poster: source.poster.src, tracks: [], transcript: '', audioDescription: '', volume: 1 }, edited)
    expect(reset.instances[instance.id].overrides.components?.[source.embeddedComponentId]).toBeUndefined()
    expect(mediaCompatibilityElement(reset, element).poster).toBe(source.poster.src)
  })

  it.each([
    { volume: -0.1 }, { volume: 1.1 }, { volume: '0.5' }, { volume: NaN },
    { poster: 'https://outside.invalid/poster.png' }, { poster: '/uploads/../poster.png' },
    { poster: '/uploads/a.png?x=1' }, { poster: 'javascript:alert(1)' },
    { tracks: [{ ...track, src: 'javascript:alert(1)' }] },
    { tracks: [{ ...track, src: ' data:text/vtt;base64,V0VCVlRU' }] },
    { tracks: [{ ...track, src: '//outside.invalid/captions.vtt' }] },
    { tracks: [{ ...track, src: '/uploads/%2e%2e/secrets.vtt' }] },
    { tracks: [{ ...track, kind: 'invalid' }] }, { tracks: [{ ...track, default: 1 }] },
    { tracks: [{ ...track, label: 'x'.repeat(161) }] }, { tracks: [track, track] },
    { tracks: Array.from({ length: 33 }, () => ({ ...track, default: false })) },
    { transcript: 'x'.repeat(12001) }, { audioDescription: 4 }, { src: '/uploads/replacement.mp4' },
  ])('rejects invalid metadata atomically instead of sanitizing it: %j', (patch) => {
    const original = structuredClone(document)
    expect(() => edit(patch)).toThrow(/media|playback/i)
    expect(() => validateMediaOverride(document.definitions[instance.definitionId], source.embeddedComponentId,
      { mediaPlayback: patch })).toThrow(/media|playback/i)
    expect(document).toEqual(original)
  })
})
