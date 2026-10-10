import { createRequire } from 'node:module'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import JSZip from 'jszip'
import { expect } from '@playwright/test'
import { slide, text } from './p06-history-acceptance.js'

const nodeRequire = createRequire(path.resolve('package.json'))
const { openPackageStore } = nodeRequire('./server/services/pptx-import/package-store')
const { buildImportSourceMap } = nodeRequire('./server/services/pptx-import/source-map')
const PptxGenJS = nodeRequire('pptxgenjs')
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

// Genuine package-store closure imported through actual HTTP; no native-parser qualification.
export async function createHistoryPackage(request, ids, title = 'Package original') {
  const root = await mkdtemp(path.join(tmpdir(), 'navslides-p06-package-'))
  const store = await openPackageStore({ rootDir: root })
  const pptx = new PptxGenJS()
  pptx.addSlide().addText('Package Alpha', { x: 1, y: 1, w: 4, h: 1 })
  const original = Buffer.from(await pptx.write({ outputType: 'nodebuffer' }))
  const projection = { id: 'p06-source', title, theme: 'black', slides: [slide([text('package-text', '<p>Package Alpha</p>')])] }
  let archive
  await store.acquireWriter()
  try {
    await store.commitImport(original, { jobId: 'p06-fixture', presentationId: projection.id,
      projection, compatibilityPresentation: projection,
      sourceMap: await buildImportSourceMap(projection, null, null) })
    const bundle = await store.exportPresentationPackage(projection.id)
    const zip = new JSZip()
    zip.file('manifest.json', JSON.stringify({ version: '2.0', externalLinks: [], media: [] }), { createFolders: false })
    zip.file('presentation.json', JSON.stringify(projection), { createFolders: false })
    zip.file('package/manifest.json', JSON.stringify(bundle.manifest), { createFolders: false })
    for (const blob of bundle.blobs) zip.file(`package/blobs/${blob.sha256}`, blob.bytes, { createFolders: false })
    archive = await zip.generateAsync({ type: 'nodebuffer' })
  } finally { await store.releaseWriter(); await rm(root, { recursive: true, force: true }) }
  const base = process.env.PLAYWRIGHT_API_BASE_URL
  const headers = { Origin: new URL(base).origin }
  const admitted = await request.post(`${base}/project-imports/preflight`, {
    headers, multipart: { file: { name: 'p06-package.navslides', mimeType: 'application/zip', buffer: archive } },
  })
  expect(admitted.ok(), await admitted.text()).toBeTruthy()
  const admission = await admitted.json()
  headers['X-NavSlides-Import-Capability'] = admission.capability
  const media = await request.post(`${base}/project-imports/${admission.sessionId}/media`, { headers })
  expect(media.ok(), await media.text()).toBeTruthy()
  const published = await request.post(`${base}/project-imports/${admission.sessionId}/publish`, { headers, data: {} })
  expect(published.ok(), await published.text()).toBeTruthy()
  const result = await published.json()
  ids.push(result.presentationId)
  return { id: result.presentationId, originalSha256: sha256(original) }
}
