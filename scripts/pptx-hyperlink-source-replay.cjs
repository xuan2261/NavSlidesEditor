'use strict'
// Explicit diagnostic: capture JSON is supplied by the caller, never a CI dependency.
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const assert = require('node:assert/strict')
const { createHash } = require('node:crypto')
const JSZip = require('jszip')
const root = '../server/services/pptx-import/'
const { buildSemanticInventory } = require(`${root}semantic-inventory`)
const { parseXml, descendants, attr, decodeXml } = require(`${root}ooxml-text-run-xml`)
const { relationshipPart } = require(`${root}slide-order`)
const { sourceNamespace } = require(`${root}semantic-source-slides`)
const { readSemanticTextAdmission } = require(`${root}ooxml-semantic-text-admission`)
const { canonicalRunAction } = require('../shared/src/pptx-text-hyperlinks')
async function main() {
  const [capturePath, expectedHash, expectedLength] = process.argv.slice(2)
  if (!capturePath || !/^[a-f0-9]{64}$/.test(expectedHash || '') || !/^\d+$/.test(expectedLength || ''))
    throw new TypeError('Usage: node scripts/pptx-hyperlink-source-replay.cjs <capture.json> <sha256> <byteLength>')
  const saved = JSON.parse(await fs.readFile(capturePath, 'utf8'))
  assert.equal(typeof saved.bytesBase64, 'string')
  const bytes = Buffer.from(saved.bytesBase64, 'base64')
  const digest = createHash('sha256').update(bytes).digest('hex')
  assert.equal(digest, expectedHash)
  assert.equal(bytes.length, Number(expectedLength))
  const zip = await JSZip.loadAsync(bytes), inventory = await buildSemanticInventory(zip)
  const link = inventory.definitions.find((d) => d.kind === 'hyperlink')
  assert.ok(link, 'Source has no inventoried hyperlink')
  const byId = new Map(inventory.definitions.map((d) => [d.id, d]))
  let source = link
  while (source.nativeId === null) source = byId.get(source.parentDefinitionId)
  const xml = await zip.file(source.partUri).async('string'), roots = parseXml(xml), nodes = new Map()
  const all = inventory.definitions.filter((d) => d.partUri === source.partUri)
  for (const definition of all) {
    let node = { children: roots }
    for (const index of definition.componentLocators[0].path) node = node.children[index]
    nodes.set(definition.id, node)
  }
  const components = all.filter((d) => {
    let owner = byId.get(d.parentDefinitionId)
    while (owner && owner.nativeId === null) owner = byId.get(owner.parentDefinitionId)
    return owner?.id === source.id
  })
  const relXml = await zip.file(relationshipPart(source.partUri)).async('string')
  const relationships = descendants({ children: parseXml(relXml) }, (n) => n.local === 'Relationship')
  const admitted = readSemanticTextAdmission({ source, xml, node: nodes.get(source.id), nodes, components,
    relationships: () => relationships, sourceId: sourceNamespace(inventory),
    slideParts: new Set(inventory.slides.map((s) => s.partUri)) }, (_, detail) => { throw new Error(detail) })
  assert.ok(admitted.mappedDefinitionIds.includes(link.id), 'Hyperlink was not admitted')
  const actual = admitted.textDocument.paragraphs.flatMap((p) => p.runs)
    .flatMap((run) => Object.values(run.hyperlinks || {})).find((entry) => entry.componentId === link.id)
  assert.ok(actual, 'Admitted canonical text omitted its source hyperlink')
  const identity = nodes.get(link.id).attrs.find((entry) => entry.name.endsWith(':id'))
  assert.equal(actual.relationshipId, decodeXml(identity.value))
  if (actual.targetPartUri) {
    assert.equal(actual.sourceId, sourceNamespace(inventory))
    assert.equal(Object.hasOwn(actual, 'action'), false)
  } else {
    const relationship = relationships.find((entry) => decodeXml(attr(entry, 'Id')) === actual.relationshipId)
    assert.ok(canonicalRunAction(actual.action))
    assert.equal(actual.action.url, decodeXml(attr(relationship, 'Target')))
  }
  assert.equal(await zip.file(source.partUri).async('string'), xml)
  console.log(JSON.stringify({ stage: 'source-hyperlink-admission', status: 'passed',
    sha256: digest, byteLength: bytes.length, componentId: link.id, partUri: source.partUri }))
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'navslides-hyperlink-replay-'))
  let transaction
  try {
    const file = path.join(directory, 'source.pptx'), uploadsDir = path.join(directory, 'uploads')
    process.env.SLIDES_DATA_DIR = path.join(directory, 'data')
    process.env.SLIDES_UPLOADS_DIR = uploadsDir
    const { importPptxFile } = require(`${root}importer`)
    const { createMediaTransaction } = require(`${root}media-dedup`)
    transaction = createMediaTransaction({ hashScope: {} })
    await fs.mkdir(uploadsDir)
    await fs.writeFile(file, bytes)
    const result = await importPptxFile(file, { originalName: 'source.pptx', uploadsDir,
      semanticImport: true, geometryInheritance: true, mediaTransaction: transaction })
    console.log(JSON.stringify({ stage: 'full-parser', status: 'passed', slideCount: result.presentation?.slides?.length }))
  } catch (error) {
    console.error(JSON.stringify({ stage: 'full-parser', status: 'failed', name: error.name,
      code: error.code, message: error.message, sourceLocation: error.sourceLocation }))
    process.exitCode = 1
  } finally {
    try { if (transaction) await transaction.rollback() }
    finally { await fs.rm(directory, { recursive: true, force: true }) }
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
