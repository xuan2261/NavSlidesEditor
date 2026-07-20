const { PptxImportError } = require('./diagnostics')

const DEFAULT_XML_LIMITS = Object.freeze({
  maxXmlBytes: 8 * 1024 * 1024,
  maxAggregateXmlBytes: 64 * 1024 * 1024,
  maxXmlDepth: 128,
  maxXmlAttributes: 256,
  maxXmlTextBytes: 8 * 1024 * 1024,
})

class PackageSafetyError extends PptxImportError {
  constructor(reason, message, status = reason.includes('budget') || reason.includes('limit') ? 413 : 400) {
    super(message, { status, type: 'package-safety' })
    this.name = 'PackageSafetyError'
    this.reason = reason
    this.code = reason
  }
}

function assertOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new PackageSafetyError('invalid-safety-limit', 'PPTX safety limits must be an object')
  }
}

function readLimit(options, name, defaultValue, minimum = 1) {
  assertOptions(options)
  if (!Object.hasOwn(options, name)) return defaultValue
  const value = options[name]
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new PackageSafetyError('invalid-safety-limit', `PPTX safety limit ${name} is invalid`)
  }
  return value
}

function resolveXmlLimits(options = {}) {
  return Object.freeze({
    maxXmlBytes: readLimit(options, 'maxXmlBytes', DEFAULT_XML_LIMITS.maxXmlBytes),
    maxAggregateXmlBytes: readLimit(options, 'maxAggregateXmlBytes', DEFAULT_XML_LIMITS.maxAggregateXmlBytes),
    maxXmlDepth: readLimit(options, 'maxXmlDepth', DEFAULT_XML_LIMITS.maxXmlDepth),
    maxXmlAttributes: readLimit(options, 'maxXmlAttributes', DEFAULT_XML_LIMITS.maxXmlAttributes),
    maxXmlTextBytes: readLimit(options, 'maxXmlTextBytes', DEFAULT_XML_LIMITS.maxXmlTextBytes),
  })
}

function isXmlPart(name) {
  return /\.xml$|\.rels$/i.test(name || '')
}

function findTagEnd(xml, start) {
  let quote = null
  for (let index = start; index < xml.length; index += 1) {
    const character = xml[index]
    if (quote) {
      if (character === quote) quote = null
    } else if (character === '"' || character === "'") {
      quote = character
    } else if (character === '>') {
      return index
    }
  }
  return -1
}

function addTextBytes(value, textBytes, limits, name) {
  const next = textBytes + Buffer.byteLength(value)
  if (next > limits.maxXmlTextBytes) {
    throw new PackageSafetyError('xml-text-budget-exceeded', `XML text budget exceeded in ${name}`, 413)
  }
  return next
}

function scanXml(xml, limits, name) {
  if (/<!DOCTYPE\b/i.test(xml)) {
    throw new PackageSafetyError('xml-dtd-prohibited', `DTD is prohibited in ${name}`)
  }
  if (/<!ENTITY\b/i.test(xml)) {
    throw new PackageSafetyError('xml-entity-prohibited', `Entity declaration is prohibited in ${name}`)
  }
  let depth = 0
  let textBytes = 0
  let index = 0
  while (index < xml.length) {
    const nextTag = xml.indexOf('<', index)
    if (nextTag < 0) {
      addTextBytes(xml.slice(index), textBytes, limits, name)
      break
    }
    textBytes = addTextBytes(xml.slice(index, nextTag), textBytes, limits, name)
    if (xml.startsWith('<!--', nextTag)) {
      const end = xml.indexOf('-->', nextTag + 4)
      index = end < 0 ? xml.length : end + 3
      continue
    }
    if (xml.startsWith('<![CDATA[', nextTag)) {
      const end = xml.indexOf(']]>', nextTag + 9)
      const textEnd = end < 0 ? xml.length : end
      textBytes = addTextBytes(xml.slice(nextTag + 9, textEnd), textBytes, limits, name)
      index = end < 0 ? xml.length : end + 3
      continue
    }
    if (xml.startsWith('<?', nextTag)) {
      const end = xml.indexOf('?>', nextTag + 2)
      index = end < 0 ? xml.length : end + 2
      continue
    }
    const end = findTagEnd(xml, nextTag + 1)
    if (end < 0) break
    const tag = xml.slice(nextTag, end + 1)
    const closing = /^<\s*\//.test(tag)
    const match = tag.match(/^<\s*([A-Za-z_][\w:.-]*)/)
    if (match && match[1].split(':').pop().toLowerCase() === 'include') {
      throw new PackageSafetyError('xml-xinclude-prohibited', `XInclude is prohibited in ${name}`)
    }
    if (closing) {
      depth = Math.max(0, depth - 1)
    } else if (match) {
      const attributes = tag.slice(match[0].length, -1).match(/\s+[\w:.-]+\s*=/g) || []
      if (attributes.length > limits.maxXmlAttributes) {
        throw new PackageSafetyError('xml-attribute-limit-exceeded', `XML attribute limit exceeded in ${name}`, 413)
      }
      const nextDepth = depth + 1
      if (nextDepth > limits.maxXmlDepth) {
        throw new PackageSafetyError('xml-depth-exceeded', `XML depth limit exceeded in ${name}`, 413)
      }
      if (!/\/\s*>$/.test(tag)) depth = nextDepth
    }
    index = end + 1
  }
}

function createXmlSafetyBudget(options = {}) {
  const limits = resolveXmlLimits(options)
  let usedBytes = 0
  return Object.freeze({
    limits,
    get usedBytes() { return usedBytes },
    inspect(bytes, name) {
      const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)
      if (buffer.length > limits.maxXmlBytes) {
        throw new PackageSafetyError('xml-byte-budget-exceeded', `XML byte budget exceeded in ${name}`, 413)
      }
      if (usedBytes + buffer.length > limits.maxAggregateXmlBytes) {
        throw new PackageSafetyError('xml-aggregate-budget-exceeded', 'Aggregate XML budget exceeded', 413)
      }
      usedBytes += buffer.length
      scanXml(buffer.toString('utf8'), limits, name)
      return buffer
    },
  })
}

function assertXmlSafe(bytes, name, options = {}) {
  return createXmlSafetyBudget(options).inspect(bytes, name)
}

module.exports = {
  DEFAULT_XML_LIMITS,
  PackageSafetyError,
  assertXmlSafe,
  createXmlSafetyBudget,
  isXmlPart,
  readLimit,
  resolveXmlLimits,
}
