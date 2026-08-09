import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import exportModule from './server-export.js'
import storageModule from '../services/storage.js'

const { exportToFile } = exportModule
const { UPLOADS_DIR } = storageModule
const createdUploads = []
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+Xw0YAAAAAElFTkSuQmCC',
  'base64'
)
const MP4 = Buffer.from([
  0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
  0, 0, 0, 0, 0x69, 0x73, 0x6f, 0x6d,
])
const WAV = Buffer.from('RIFF0000WAVEfmt ')

async function upload(extension, bytes) {
  await fs.mkdir(UPLOADS_DIR, { recursive: true })
  const filename = `pptx-media-${randomUUID()}.${extension}`
  const filePath = path.join(UPLOADS_DIR, filename)
  await fs.writeFile(filePath, bytes)
  createdUploads.push(filePath)
  return `/uploads/${filename}`
}

function presentation(elements) {
  return {
    title: 'Media export',
    resolution: { width: 960, height: 540 },
    slides: [{ id: 's1', background: { type: 'color', color: '#fff' }, elements }],
  }
}

function mediaElement(id, type, src, extra = {}) {
  return {
    id,
    type,
    src,
    x: 20,
    y: type === 'video' ? 20 : 260,
    width: 320,
    height: 180,
    ...extra,
  }
}

async function exportPackage(source) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'navslides-media-export-'))
  const output = path.join(tempDir, 'media.pptx')
  const result = await exportToFile(source, output, { strictRaster: true })
  const zip = await JSZip.loadAsync(await fs.readFile(output))
  await fs.rm(tempDir, { recursive: true, force: true })
  return { result, zip }
}

async function packageText(zip) {
  const xmlNames = Object.keys(zip.files).filter((name) => name.endsWith('.xml') || name.endsWith('.rels'))
  return (await Promise.all(xmlNames.map((name) => zip.file(name).async('string')))).join('\n')
}

afterEach(async () => {
  await Promise.all(createdUploads.splice(0).map((file) => fs.unlink(file).catch(() => {})))
})

describe('server PPTX embedded media', () => {
  it('writes validated local audio/video parts, relationships, and a PNG poster', async () => {
    const video = await upload('mp4', MP4)
    const audio = await upload('wav', WAV)
    const poster = await upload('png', PNG)
    const { result, zip } = await exportPackage(
      presentation([
        mediaElement('video-1', 'video', video, {
          poster,
          startTime: 2,
          endTime: 5,
          playbackRate: 1.5,
          autoplay: true,
          loop: true,
          muted: true,
        }),
        mediaElement('audio-1', 'audio', audio),
      ])
    )

    const names = Object.keys(zip.files)
    const mp4Part = names.find((name) => /^ppt\/media\/media-.*\.mp4$/u.test(name))
    const wavPart = names.find((name) => /^ppt\/media\/media-.*\.wav$/u.test(name))
    const posterPart = names.find((name) => /^ppt\/media\/image-.*\.png$/u.test(name))
    expect(mp4Part).toBeTruthy()
    expect(wavPart).toBeTruthy()
    expect(posterPart).toBeTruthy()
    expect(Buffer.from(await zip.file(mp4Part).async('uint8array'))).toEqual(MP4)
    expect(Buffer.from(await zip.file(wavPart).async('uint8array'))).toEqual(WAV)
    expect(Buffer.from(await zip.file(posterPart).async('uint8array'))).toEqual(PNG)
    const xml = await packageText(zip)
    expect(xml).toContain('/relationships/video')
    expect(xml).toContain('/relationships/audio')
    expect(xml).toContain('video/mp4')
    expect(xml).toContain('audio/wav')
    expect(result.warnings).toContain(
      'Slide 1: browser-only trim, playback speed, autoplay, loop, muted settings are not preserved for video in PPTX'
    )
  })

  it('never embeds external, traversal, unsupported, or MIME-changing sources', async () => {
    const poster = await upload('png', PNG)
    const mismatch = await upload('mp4', WAV)
    const { result, zip } = await exportPackage(
      presentation([
        mediaElement('external', 'video', 'https://example.test/movie.mp4', { poster }),
        mediaElement('traversal', 'audio', '/uploads/%2e%2e/private.wav'),
        mediaElement('unsupported', 'video', '/uploads/movie.webm'),
        mediaElement('mismatch', 'video', mismatch),
      ])
    )

    const names = Object.keys(zip.files)
    expect(names.some((name) => /^ppt\/media\/media-/u.test(name))).toBe(false)
    const xml = await packageText(zip)
    expect(xml).not.toContain('example.test')
    expect(xml).not.toContain('private.wav')
    expect(result.warnings).toContain('Slide 1: used video poster fallback')
    expect(result.warnings).toContain(
      'Slide 1: validated local video could not be embedded; used a static fallback'
    )
  })
})
