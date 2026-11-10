// Task23 security controls: ZIP preflight, external media URL gating, and converter isolation.
import JSZip from 'jszip'
import request from 'supertest'
import { createRequire } from 'node:module'
import { expect } from 'vitest'
import { editor } from '../../server/routes/portable-package-project-fixture.js'

const require = createRequire(import.meta.url)

export async function assertZipSecuritySafeguards() {
  const { securityPreflight } = require('../../server/services/pptx-import/export-security-preflight')
  const xmlBomb = new JSZip()
  xmlBomb.file('ppt/unsafe.xml', '<!DOCTYPE x [<!ENTITY e "unsafe">]><x/>')
  expect(await securityPreflight(await xmlBomb.generateAsync({ type: 'nodebuffer' })))
    .toMatchObject({ ok: false, blockReason: 'unsafe-or-oversized-package' })

  const macroZip = new JSZip()
  macroZip.file('ppt/vbaProject.bin', Buffer.from('vba-macro-payload'))
  macroZip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')
  expect(await securityPreflight(await macroZip.generateAsync({ type: 'nodebuffer' })))
    .toMatchObject({ ok: false, blockReason: 'protected-or-active-content' })

  const oleZip = new JSZip()
  oleZip.file('ppt/embeddings/oleObject1.bin', Buffer.from('ole-payload'))
  oleZip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')
  expect(await securityPreflight(await oleZip.generateAsync({ type: 'nodebuffer' })))
    .toMatchObject({ ok: false, blockReason: 'protected-or-active-content' })
}

export function assertExternalMediaSafeguards() {
  const { gateExternalMediaUrl, gateBackgroundImageSrc } = require('../../server/services/pptx-import/mapper/map-media')
  const loopbackContext = { warnings: [] }
  expect(gateExternalMediaUrl('http://127.0.0.1/private.png', loopbackContext)).toBeNull()
  expect(loopbackContext.warnings).toEqual(expect.arrayContaining([
    expect.objectContaining({ code: 'media-external-url-blocked' }),
  ]))

  const cloudMetadataContext = { warnings: [] }
  expect(gateExternalMediaUrl('http://169.254.169.254/latest/meta-data', cloudMetadataContext)).toBeNull()
  expect(cloudMetadataContext.warnings).toEqual(expect.arrayContaining([
    expect.objectContaining({ code: 'media-external-url-blocked' }),
  ]))

  const protocolRelativeContext = { warnings: [] }
  expect(gateBackgroundImageSrc('//attacker.com/evil.png', protocolRelativeContext)).toBeNull()
  expect(protocolRelativeContext.warnings).toEqual(expect.arrayContaining([
    expect.objectContaining({ code: 'media-external-url-blocked', host: 'protocol-relative' }),
  ]))
}

export function assertConverterSafeguards() {
  const { resolveConverterBinary, convertVectorImage } = require('../../server/services/pptx-import/emf-wmf-sandbox')
  expect(resolveConverterBinary({ binary: 'magick' }))
    .toEqual({ ok: false, error: 'emf-binary-must-be-absolute', code: 'POLICY' })

  expect(resolveConverterBinary({ binary: 'C:\\Windows\\System32\\cmd.exe' }))
    .toEqual({ ok: false, error: 'binary-not-allowlisted', code: 'POLICY' })

  expect(resolveConverterBinary({ binary: 'C:\\Program Files\\ImageMagick\\magick.exe', trustedRoot: 'C:\\Program Files\\ImageMagick' }))
    .toEqual({ ok: false, error: 'emf-binary-hash-required', code: 'POLICY' })

  // Vector conversion defaults to disabled unless PPTX_EMF_CONVERT=1 is explicit.
  const priorEnv = process.env.PPTX_EMF_CONVERT
  delete process.env.PPTX_EMF_CONVERT
  return convertVectorImage('input.emf', 'output.png').then((result) => {
    expect(result).toEqual({ ok: false, error: 'emf-convert-disabled', code: 'DISABLED' })
    if (priorEnv !== undefined) process.env.PPTX_EMF_CONVERT = priorEnv
  })
}

export async function assertNativeExportGenerationFence({ current, initialId, read, save }) {
  const deck = await read(initialId)
  const stagedNoOp = await save(deck, 'task23-export-stale-preparation')
  expect(stagedNoOp.status, JSON.stringify(stagedNoOp.body)).toBe(200)
  const generation = stagedNoOp.body.aggregateGeneration
  expect(generation).toBeGreaterThanOrEqual(1)

  const staleGeneration = await request(current.app).get(`/api/presentations/${initialId}/pptx-original`)
    .set('If-Pptx-Generation', String(generation + 99))
  expect(staleGeneration.status, JSON.stringify(staleGeneration.body)).toBe(409)
  expect(staleGeneration.body.code).toBe('STALE_GENERATION')
}

export async function assertNativeExportFailsClosed({ current, initialId, editedGeneration, originalFor }) {
  const fidelity = await request(current.app).get(`/api/presentations/${initialId}/pptx-fidelity`)
  expect(fidelity.status).toBe(200)
  expect(fidelity.body.exports.original).toMatchObject({ available: true, label: 'Download Original' })
  expect(fidelity.body.exports.validatedEdited.available).toBe(false)

  // Missing required idempotency / generation headers returns 400.
  const missingHeaders = await editor(request(current.app).post(`/api/presentations/${initialId}/pptx-edited`)).send({})
  expect(missingHeaders.status).toBe(400)
  expect(missingHeaders.body.code).toBe('INVALID_EXPORT_REQUEST')

  // Out-of-bounds non-integer generation header returns 400.
  const invalidGeneration = await editor(request(current.app).post(`/api/presentations/${initialId}/pptx-edited`))
    .set('Idempotency-Key', 'invalid-generation-native-export')
    .set('If-Pptx-Generation', 'not-a-number')
    .send({})
  expect(invalidGeneration.status).toBe(400)
  expect(invalidGeneration.body.code).toBe('INVALID_EXPORT_REQUEST')

  // Semantic picture edit cannot be exported as native-edited: rejected with 422.
  const denied = await editor(request(current.app).post(`/api/presentations/${initialId}/pptx-edited`))
    .set('Idempotency-Key', 'deny-native-picture')
    .set('If-Pptx-Generation', String(editedGeneration))
    .send({})
  expect(denied.status).toBe(422)
  expect(denied.body.code).toBe('CANONICAL_TEXT_JOURNAL_INVALID')
  expect(denied.headers['x-pptx-export-mode']).toBeUndefined()
  expect(typeof denied.body).toBe('object')

  // Original remains available and byte-identical via the immutable original route.
  await originalFor(initialId)
}
