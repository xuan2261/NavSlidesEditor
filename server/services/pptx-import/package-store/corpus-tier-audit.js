const fs = require('node:fs/promises')
const path = require('node:path')
const { featureMatrixHash } = require('../canonical-feature-matrix')
const { COMPLEX_OBJECT_TIERS } = require('../complex-object-policy')
const { buildOpcInventory } = require('./opc-inventory')

const MATRIX_HASH = featureMatrixHash()

function relsPath(part) {
  const dir = path.posix.dirname(part)
  return path.posix.join(dir, '_rels', `${path.posix.basename(part)}.rels`)
}

function relationshipClosure(inventory, roots) {
  const parts = new Set(roots.filter(Boolean))
  const relationships = []
  const queue = [...parts]
  while (queue.length) {
    const source = queue.shift()
    const outgoing = inventory.relationships.filter((item) => item.source === source)
    if (outgoing.length) parts.add(relsPath(source))
    for (const relationship of outgoing) {
      relationships.push(relationship)
      if (!relationship.external && !relationship.dangling &&
          !parts.has(relationship.normalizedTarget)) {
        parts.add(relationship.normalizedTarget)
        queue.push(relationship.normalizedTarget)
      }
    }
  }
  return {
    parts: [...parts].sort(),
    relationships: relationships.map((item) => ({
      source: item.source,
      id: item.id,
      target: item.target,
      external: item.external,
    })),
  }
}

function auditInventory(deck, inventory) {
  const objects = inventory.complexObjects.objects.map((object, index) => {
    const tier = COMPLEX_OBJECT_TIERS[object.kind]
    if (!tier) throw new Error(`Unclassified complex object: ${deck}#${index}:${object.kind}`)
    const relationshipRoot = object.source.relationshipSource
    return {
      id: `${deck}#${index}`,
      kind: object.kind,
      rowId: tier.rowId,
      featureTier: tier.tier,
      matrixHash: MATRIX_HASH,
      source: object.source,
      tier,
      preservation: {
        result: tier.editedExport,
        closure: relationshipClosure(inventory, [
          object.source.partPath,
          relationshipRoot,
          relationshipRoot && relsPath(relationshipRoot),
        ]),
      },
    }
  })
  const describedParts = new Set(objects.map((item) => item.source.partPath).filter(Boolean))
  for (const unknown of inventory.unknownParts) {
    if (!describedParts.has(unknown)) {
      throw new Error(`Unclassified unknown part: ${deck}:${unknown}`)
    }
  }
  return {
    deck,
    packageSha256: inventory.packageSha256,
    matrixHash: MATRIX_HASH,
    objects,
    classified: true,
  }
}

async function auditCorpus(corpusDir) {
  const decks = (await fs.readdir(corpusDir)).filter((name) => /\.pptx$/i.test(name)).sort()
  const results = []
  for (const deck of decks) {
    results.push(auditInventory(deck, await buildOpcInventory(path.join(corpusDir, deck))))
  }
  return { schemaVersion: 1, matrixHash: MATRIX_HASH, classified: true, decks: results }
}

module.exports = { auditCorpus, auditInventory, relationshipClosure }
