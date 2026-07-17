const JSZip = require('jszip')
const { parseRawEntries, relationshipSource, resolveTarget } = require('./package-store/raw-zip')
const { PackageSafetyError, createXmlSafetyBudget, isXmlPart, readLimit } = require('./xml-safety')

const DEFAULT_NESTED_LIMITS = Object.freeze({
  maxEntries: 1000,
  maxBytes: 20 * 1024 * 1024,
  maxEntryBytes: 20 * 1024 * 1024,
  maxNestedDepth: 3,
  maxNestedAggregateBytes: 40 * 1024 * 1024,
  maxCompressionRatio: 100,
  maxRelationships: 10000,
})

function resolveNestedLimits(options = {}) {
  return Object.freeze({
    maxEntries: readLimit(options, 'maxEntries', DEFAULT_NESTED_LIMITS.maxEntries),
    maxBytes: readLimit(options, 'maxBytes', DEFAULT_NESTED_LIMITS.maxBytes),
    maxEntryBytes: readLimit(options, 'maxEntryBytes', DEFAULT_NESTED_LIMITS.maxEntryBytes),
    maxNestedDepth: readLimit(options, 'maxNestedDepth', DEFAULT_NESTED_LIMITS.maxNestedDepth, 0),
    maxNestedAggregateBytes: readLimit(options, 'maxNestedAggregateBytes', DEFAULT_NESTED_LIMITS.maxNestedAggregateBytes),
    maxCompressionRatio: readLimit(options, 'maxCompressionRatio', DEFAULT_NESTED_LIMITS.maxCompressionRatio),
    maxRelationships: readLimit(options, 'maxRelationships', DEFAULT_NESTED_LIMITS.maxRelationships),
  })
}

function attrs(tag) {
  return Object.fromEntries(
    [...tag.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map((match) => [
      match[1].replace(/^.*:/, ''), match[2] ?? match[3],
    ])
  )
}

function assertRelationshipTarget(source, target) {
  const value = String(target || '').trim()
  const localTarget = value.split(/[?#]/, 1)[0]
  if (!localTarget || localTarget.startsWith('//') || localTarget.includes('\\') ||
      localTarget.includes('//') || /^[a-z][a-z\d+.-]*:/i.test(localTarget) || /%2f|%5c/i.test(localTarget)) {
    throw new PackageSafetyError('relationship-target-invalid', 'Relationship target is invalid')
  }
  try {
    return resolveTarget(source, localTarget)
  } catch {
    throw new PackageSafetyError('relationship-target-invalid', 'Relationship target escapes its package')
  }
}

function assertRelationshipsSafe(bytes, name, state, limits) {
  const source = relationshipSource(name)
  if (source === null) return
  const xml = bytes.toString('utf8')
  for (const match of xml.matchAll(/<(?:\w+:)?Relationship\b[^>]*\/?\s*>/gi)) {
    state.relationships += 1
    if (state.relationships > limits.maxRelationships) {
      throw new PackageSafetyError('relationship-limit-exceeded', 'Relationship budget exceeded', 413)
    }
    const value = attrs(match[0])
    if (String(value.TargetMode || '').toLowerCase() !== 'external') {
      assertRelationshipTarget(source, value.Target)
    } else if (!String(value.Target || '').trim()) {
      throw new PackageSafetyError('relationship-target-invalid', 'External relationship target is missing')
    }
  }
}

function isZipPayload(name, bytes) {
  const extension = /\.(?:docx|opc|pptx|xlsx|xlsm|zip)$/i.test(name || '')
  const signature = bytes.subarray(0, 4).toString('binary')
  return extension || signature === 'PK\x03\x04' || signature === 'PK\x05\x06' || signature === 'PK\x07\x08'
}

function assertDeclaredEntryLimits(entry, limits) {
  if (entry.uncompressedSize > limits.maxEntryBytes) {
    throw new PackageSafetyError('zip-entry-byte-limit-exceeded', 'Nested ZIP entry exceeds byte budget', 413)
  }
  const ratio = entry.uncompressedSize === 0 ? 1 : entry.uncompressedSize / Math.max(entry.compressedSize, 1)
  if (ratio > limits.maxCompressionRatio) {
    throw new PackageSafetyError('zip-compression-ratio-exceeded', 'Nested ZIP compression ratio exceeds budget', 413)
  }
}

function readBoundedEntry(entry, declared, container, state, limits) {
  assertDeclaredEntryLimits(declared, limits)
  return new Promise((resolve, reject) => {
    let entryBytes = 0
    let settled = false
    const chunks = []
    const finish = (error, value) => {
      if (settled) return
      settled = true
      if (error) reject(error)
      else resolve(value)
    }
    let stream
    try {
      stream = entry.nodeStream('nodebuffer')
    } catch {
      finish(new PackageSafetyError('nested-zip-invalid', 'Nested ZIP entry cannot be decompressed'))
      return
    }
    stream.on('data', (chunk) => {
      entryBytes += chunk.length
      container.bytes += chunk.length
      state.usedBytes += chunk.length
      if (entryBytes > limits.maxEntryBytes) {
        stream.destroy()
        finish(new PackageSafetyError('zip-entry-byte-limit-exceeded', 'Nested ZIP entry exceeds byte budget', 413))
      } else if (container.bytes > limits.maxBytes) {
        stream.destroy()
        finish(new PackageSafetyError('zip-container-byte-limit-exceeded', 'Nested ZIP container exceeds byte budget', 413))
      } else if (state.usedBytes > limits.maxNestedAggregateBytes) {
        stream.destroy()
        finish(new PackageSafetyError('nested-aggregate-byte-limit-exceeded', 'Nested ZIP aggregate budget exceeded', 413))
      } else {
        chunks.push(Buffer.from(chunk))
      }
    })
    stream.on('end', () => finish(null, Buffer.concat(chunks, entryBytes)))
    stream.on('error', () => finish(new PackageSafetyError('nested-zip-invalid', 'Nested ZIP entry cannot be decompressed')))
  })
}

async function inspectContainer(input, depth, state, limits) {
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input)
  if (depth > limits.maxNestedDepth) {
    throw new PackageSafetyError('zip-recursion-depth-exceeded', 'Nested ZIP recursion depth exceeded', 413)
  }
  if (bytes.length > limits.maxBytes) {
    throw new PackageSafetyError('zip-container-byte-limit-exceeded', 'Nested ZIP container exceeds byte budget', 413)
  }
  let entries
  try {
    entries = parseRawEntries(bytes)
  } catch (error) {
    if (error instanceof PackageSafetyError) throw error
    throw new PackageSafetyError('nested-zip-invalid', 'Nested package is not a valid ZIP')
  }
  if (entries.length > limits.maxEntries) {
    throw new PackageSafetyError('zip-entry-limit-exceeded', 'Nested ZIP has too many entries', 413)
  }
  let zip
  try {
    zip = await JSZip.loadAsync(bytes, { checkCRC32: false })
  } catch {
    throw new PackageSafetyError('nested-zip-invalid', 'Nested package is not a readable ZIP')
  }
  const container = { bytes: 0 }
  for (const declared of entries) {
    const entry = zip.file(declared.name)
    if (!entry || entry.dir) continue
    const data = await readBoundedEntry(entry, declared, container, state, limits)
    if (isXmlPart(declared.name)) state.xmlBudget.inspect(data, declared.name)
    if (/\.rels$/i.test(declared.name)) assertRelationshipsSafe(data, declared.name, state, limits)
    if (isZipPayload(declared.name, data)) await inspectContainer(data, depth + 1, state, limits)
  }
}

function createNestedPackageGuard(options = {}) {
  const limits = resolveNestedLimits(options)
  const state = { usedBytes: 0, relationships: 0, xmlBudget: createXmlSafetyBudget(options) }
  return Object.freeze({
    limits,
    get usedBytes() { return state.usedBytes },
    async inspect(bytes) {
      await inspectContainer(bytes, 0, state, limits)
      return Object.freeze({ safe: true, nestedBytes: state.usedBytes, xmlBytes: state.xmlBudget.usedBytes })
    },
  })
}

async function guardNestedPackage(bytes, options = {}) {
  return createNestedPackageGuard(options).inspect(bytes)
}

module.exports = {
  DEFAULT_NESTED_LIMITS,
  assertRelationshipsSafe,
  createNestedPackageGuard,
  guardNestedPackage,
  isZipPayload,
  resolveNestedLimits,
}
