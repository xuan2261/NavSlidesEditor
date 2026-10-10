// Owned native concurrency fixtures with exact byte, authority and cleanup checks.
const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const http = require('node:http')
const assert = require('node:assert/strict')
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
const digest = value => sha(JSON.stringify(value))
const LIMIT = 5000
function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
function bounded(promise, label) {
  let timer
  return Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error(`${label} exceeded ${LIMIT}ms`),
      { code: 'P08_BOUND_EXCEEDED', boundary: label })), LIMIT)
  })]).finally(() => clearTimeout(timer))
}
function api(base, route, { method = 'GET', body, key, status = 200, binary = false } = {}) {
  return bounded(new Promise((resolve, reject) => {
    const bytes = body === undefined ? null : Buffer.from(JSON.stringify(body))
    const request = http.request(new URL(route, base), { method, headers: {
      Origin: base, 'Sec-Fetch-Site': 'same-origin', Connection: 'close',
      ...(bytes ? { 'Content-Type': 'application/json', 'Content-Length': bytes.length } : {}),
      ...(key ? { 'Idempotency-Key': key } : {}),
    } }, response => {
      const chunks = []
      response.on('data', chunk => chunks.push(chunk))
      response.on('error', reject)
      response.on('aborted', () => reject(Object.assign(new Error('HTTP body aborted'), { code: 'ECONNRESET' })))
      response.on('end', () => {
        try {
          const result = Buffer.concat(chunks)
          const parsed = binary ? result : JSON.parse(result.toString())
          try { assert.equal(response.statusCode, status, `HTTP ${method} ${route}: ${JSON.stringify(parsed)}`) }
          catch (error) {
            error.httpStatus = response.statusCode
            error.applicationCode = parsed?.code || parsed?.reasonCode
            throw error
          }
          resolve({ body: parsed, headers: response.headers, status: response.statusCode })
        } catch (error) { reject(error) }
      })
    })
    request.on('error', reject)
    request.setTimeout(LIMIT, () => request.destroy(Object.assign(new Error('HTTP deadline'), { code: 'P08_HTTP_DEADLINE' })))
    request.end(bytes)
  }), `HTTP ${method} ${route}`)
}
async function fixture(ctx, label, { presentationId, media, preparedOnly = false } = {}) {
  const JSZip = require('jszip')
  const { buildImportSourceMap } = require('./services/pptx-import/source-map')
  const mediaBytes = media?.bytes || Buffer.concat([Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ8sAAAAASUVORK5CYII=', 'base64'), Buffer.from(label)])
  const jobId = `fixture-${label}`
  const placed = await ctx.ownership.placeMedia({ ownerId: jobId, scope: 'pptx-import', bytes: mediaBytes,
    originalName: `${label}.png`, mimeType: 'image/png', sourceKey: label })
  const url = `/uploads/${placed.filename}`
  const slides = [{ id: 's1', elements: [{ id: 'e1', type: 'text', content: '<p>Before</p>' },
    { id: 'image', type: 'image', src: url }] }]
  const created = presentationId ? { id: presentationId, title: label, slides } :
    (await api(ctx.base, '/api/presentations', { method: 'POST', body: { title: label, slides }, status: 201 })).body
  const shape = '<p:sp><p:nvSpPr><p:cNvPr id="4" name="Title"/></p:nvSpPr><p:spPr/><p:txBody><a:p><a:r><a:t>Before</a:t></a:r></a:p></p:txBody></p:sp>'
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<Types/>')
  zip.file('ppt/presentation.xml', `<p:presentation name="${label}"/>`)
  zip.file('_rels/.rels', '<Relationships><Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>')
  zip.file('ppt/_rels/presentation.xml.rels', '<Relationships><Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>')
  zip.file('ppt/slides/slide1.xml', `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree>${shape}</p:spTree></p:cSld></p:sld>`)
  zip.file('ppt/media/image1.png', mediaBytes)
  const bytes = await zip.generateAsync({ type: 'nodebuffer' })
  const map = await buildImportSourceMap({ ...created, slides: [{ ...slides[0], elements: [
    { ...slides[0].elements[0], _pptxSource: { nodeId: '4', matchedBy: 'sourceId' } }, slides[0].elements[1],
  ] }] }, { slides: [{ index: 0, path: 'ppt/slides/slide1.xml', nodes: [{ id: '4', kind: 'shape', sourceXml: shape }] }] },
  zip, { packageGeneration: 1, revisionId: 'pending' })
  const projection = { id: created.id, title: created.title, slides: created.slides,
    ...(created.theme ? { theme: created.theme, transition: created.transition, designTokens: created.designTokens } : {}) }
  const prepared = await ctx.store.prepareImport(bytes, { jobId, presentationId: created.id,
    projection, sourceMap: map, compatibilityPresentation: created })
  const result = { id: created.id, jobId, prepared, bytes, media: { bytes: mediaBytes, url }, projection }
  if (!preparedOnly) {
    await ctx.runtime.withPackageStore(store => store.publishImport(prepared))
    await ctx.ownership.commitOwner(jobId, created.id, { scope: 'pptx-import' })
    await ctx.runtime.drainPackageCompatibilityOutbox()
  }
  return result
}
async function consumers(ctx, input, id = input.id) {
  const deck = (await api(ctx.base, `/api/presentations/${id}`)).body
  assert.equal(deck.id, id)
  const url = deck.slides[0].elements.find(element => element.id === 'image').src
  assert.equal(url, input.media.url)
  const [media, original] = await Promise.all([
    api(ctx.base, url, { binary: true }), api(ctx.base, `/api/presentations/${id}/pptx-original`, { binary: true }),
  ])
  assert.equal(sha(media.body), sha(input.media.bytes))
  assert.equal(sha(original.body), sha(input.bytes))
  assert.equal(original.headers['x-pptx-export-mode'], 'immutable-package-original')
  const reopened = await require('jszip').loadAsync(original.body)
  assert.equal(sha(await reopened.file('ppt/media/image1.png').async('nodebuffer')), sha(input.media.bytes))
  return { id, generation: deck.aggregateGeneration, deckSha256: digest(deck), mediaUrl: url,
    mediaSha256: sha(media.body), originalSha256: sha(original.body), originalZipOpened: true }
}
async function snapshot(ctx, ids) {
  const state = ctx.store.getState()
  const rows = (await ctx.storage.readPresentations()).filter(row => ids.includes(row.id))
  return { stateSha256: digest(state), rootSha256: sha(await fs.readFile(path.join(ctx.storage.DATA_DIR, 'state-root.json'))),
    uploadHashesSha256: sha(await fs.readFile(ctx.storage.UPLOAD_HASHES_FILE)),
    heads: state.heads.filter(head => ids.includes(head.presentationId)).map(head => ({ ...head, sha256: digest(head) })),
    owners: state.owners.filter(owner => ids.includes(owner.ownerId)),
    jobs: state.jobs.filter(job => ids.includes(job.presentationId)),
    results: state.mutationResults.filter(result => ids.includes(result.presentationId)).map(result => ({
      presentationId: result.presentationId, idempotencyKey: result.idempotencyKey, operation: result.operation,
      generation: result.generation, packageRevisionId: result.packageRevisionId, state: result.state, sha256: digest(result),
    })), rows: rows.map(row => ({ id: row.id, sha256: digest(row) })) }
}
module.exports = { api, bounded, consumers, deferred, digest, fixture, sha, snapshot }
