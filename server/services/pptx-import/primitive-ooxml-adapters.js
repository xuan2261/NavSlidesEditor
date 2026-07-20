const crypto = require('node:crypto')
const JSZip = require('jszip')
const { assertPatchableSource } = require('./source-map')

const hash = (value) => crypto.createHash('sha256').update(value).digest('hex')
const tag = '(?:\\w+:)?'

function findNative(xml, nativeId) {
  const blocks = [...xml.matchAll(new RegExp(
    `<${tag}(?:sp|pic)\\b[\\s\\S]*?<\\/${tag}(?:sp|pic)>`, 'g'
  ))].filter((match) => new RegExp(
    `<${tag}cNvPr\\b[^>]*\\bid=(?:"${nativeId}"|'${nativeId}')`
  ).test(match[0]))
  if (blocks.length !== 1) {
    const error = new Error(blocks.length ? 'Ambiguous native source id' : 'Missing native source id')
    error.code = blocks.length ? 'SOURCE_AMBIGUOUS' : 'SOURCE_MISSING'
    throw error
  }
  return { index: blocks[0].index, xml: blocks[0][0] }
}

function replaceAttribute(xml, element, attribute, value) {
  const pattern = new RegExp(`(<${tag}${element}\\b[^>]*?)\\s${attribute}=(?:"[^"]*"|'[^']*')`)
  if (pattern.test(xml)) return xml.replace(pattern, `$1 ${attribute}="${value}"`)
  const opening = new RegExp(`(<${tag}${element}\\b)([^>]*>)`)
  if (!opening.test(xml)) throw new Error(`OOXML ${element} element is missing`)
  return xml.replace(opening, `$1 ${attribute}="${value}"$2`)
}

function geometryPatch(xml, property, value, ref) {
  const scale = ref.emuPerUnit || 9525
  if (property === 'rotation') return replaceAttribute(xml, 'xfrm', 'rot', Math.round(value * 60000))
  if (property === 'flipH' || property === 'flipV') {
    return replaceAttribute(xml, 'xfrm', property, value ? '1' : '0')
  }
  const map = {
    x: ['off', 'x'], y: ['off', 'y'], width: ['ext', 'cx'], height: ['ext', 'cy'],
  }
  const [element, attribute] = map[property]
  return replaceAttribute(xml, element, attribute, Math.round(value * scale))
}

function solidColorPatch(xml, property, value) {
  const color = String(value).replace(/^#/, '').toUpperCase()
  if (!/^[A-F0-9]{6}$/.test(color)) throw new TypeError('Solid color must be a six-digit hex value')
  const container = property === 'fill'
    ? /<(?:\w+:)?solidFill\b[\s\S]*?<\/(?:\w+:)?solidFill>/
    : /<(?:\w+:)?ln\b[\s\S]*?<\/(?:\w+:)?ln>/
  const match = xml.match(container)
  if (!match) throw new Error(`OOXML ${property} container is missing`)
  const patched = match[0].replace(
    /(<(?:\w+:)?srgbClr\b[^>]*\bval=)(?:"[^"]*"|'[^']*')/, `$1"${color}"`
  )
  if (patched === match[0]) throw new Error(`OOXML ${property} is not a solid RGB color`)
  return xml.replace(match[0], patched)
}

function cropPatch(xml, crop) {
  const values = ['l', 't', 'r', 'b'].reduce((result, key) => {
    const raw = Number(crop?.[key] ?? crop?.[{ l: 'left', t: 'top', r: 'right', b: 'bottom' }[key]] ?? 0)
    result[key] = Math.round(Math.max(0, Math.min(100, raw)) * 1000)
    return result
  }, {})
  const rect = `<a:srcRect l="${values.l}" t="${values.t}" r="${values.r}" b="${values.b}"/>`
  const existing = /<(?:\w+:)?srcRect\b[^>]*\/>/
  if (existing.test(xml)) return xml.replace(existing, rect)
  return xml.replace(/(<(?:\w+:)?blip\b[^>]*\/>)/, `$1${rect}`)
}

function patchShape(shape, operation) {
  const { property, after, sourceRef } = operation
  if (['x', 'y', 'width', 'height', 'rotation', 'flipH', 'flipV'].includes(property)) {
    return geometryPatch(shape, property, after, sourceRef)
  }
  if (property === 'fill' || property === 'stroke') return solidColorPatch(shape, property, after)
  if (property === 'crop') return cropPatch(shape, after)
  if (property === 'src') return shape
  throw new Error(`Unsupported primitive property: ${property}`)
}

function imageBytes(value) {
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return Buffer.from(value)
  if (typeof value === 'string') {
    const match = value.match(/^data:[^;,]+;base64,([A-Za-z0-9+/=\s]+)$/)
    if (match) return Buffer.from(match[1], 'base64')
  }
  throw new TypeError('Image replacement requires bytes or a base64 data URL')
}

function createPrimitiveAdapters() {
  return Object.freeze({
    async applyPatch(bytes, operation) {
      const ref = assertPatchableSource(operation.sourceRef)
      const zip = await JSZip.loadAsync(bytes, { checkCRC32: true })
      const part = zip.file(ref.partUri)
      if (!part) throw new Error('Authoritative source part is missing')
      const xml = await part.async('string')
      const native = findNative(xml, ref.nativeId)
      assertPatchableSource(ref, Buffer.from(native.xml))
      const patched = patchShape(native.xml, operation)
      const closure = [ref.partUri]
      if (operation.property === 'src') {
        if (!ref.mediaPartUri || !zip.file(ref.mediaPartUri)) {
          throw new Error('Authoritative image media part is missing')
        }
        zip.file(ref.mediaPartUri, imageBytes(operation.after))
        closure.push(ref.mediaPartUri)
      }
      if (patched !== native.xml) {
        zip.file(ref.partUri, xml.slice(0, native.index) + patched +
          xml.slice(native.index + native.xml.length))
      }
      return {
        bytes: await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }),
        sourceHash: hash(patched),
        impactClosure: closure,
      }
    },
  })
}

module.exports = { createPrimitiveAdapters }
