const { cloneTextData } = require('./pptx-text-document')
const { createBrowserTextMeasurer } = require('./pptx-text-layout-browser')

const descriptor = (face) => JSON.stringify([
  face.family, face.style, face.weight, face.stretch, face.unicodeRange,
  face.featureSettings, face.variationSettings, face.ascentOverride,
  face.descentOverride, face.lineGapOverride,
])
const familyIdentity = (family) => family.trim().replace(/^(['"])(.*)\1$/u, '$2').toLowerCase()

// The caller delivers source-matching SFNT bytes. No installed font lookup,
// network fetch, font substitution or qualification is performed here.
async function createTableFontRuntime({ document, fontProfile, assets }) {
  const profile = cloneTextData(fontProfile)
  const copies = assets.map(({ faceId, bytes }) => ({ faceId, bytes: bytes.slice(0) }))
  const measurement = await createBrowserTextMeasurer({
    document, fontProfile: profile, assets: copies,
  })
  const faces = [], fontFamilies = {}
  const ownedFamilies = new Set()
  let disposed = false
  const dispose = () => {
    disposed = true
    for (const { face } of faces) document.fonts.delete(face)
    measurement.dispose()
  }
  try {
    const identities = measurement.profile.fontIdentities
    if (profile.faces.some((face) => !identities.some((identity) => identity.faceId === face.id))) {
      const error = new TypeError('Source-matching table font bytes could not be measured')
      error.code = 'PPTX_TABLE_FONT_UNAVAILABLE'
      throw error
    }
    const session = document.defaultView.crypto.randomUUID().replaceAll('-', '_')
    for (const [index, face] of profile.faces.entries()) {
      const alias = `pptx_table_${session}_${index}`
      const asset = copies.find(({ faceId }) => faceId === face.id)
      const output = new document.defaultView.FontFace(alias, asset.bytes, {
        style: face.italic ? 'italic' : 'normal', weight: face.bold ? '700' : '400',
      })
      await output.load()
      document.fonts.add(output)
      faces.push({ face: output, descriptor: descriptor(output) })
      fontFamilies[face.id] = alias
      ownedFamilies.add(familyIdentity(output.family))
    }
    const measured = {
      measureLine: (input) => measurement.measureLine(input, fontFamilies),
      validate(fonts, renderer) {
        if (disposed || [...document.fonts].some((face) => ownedFamilies.has(familyIdentity(face.family)) &&
            !faces.some((entry) => entry.face === face)) ||
            faces.some((entry) => !document.fonts.has(entry.face) ||
          entry.face.status !== 'loaded' || descriptor(entry.face) !== entry.descriptor))
          return 'stale-table-output-fonts'
        return measurement.validate(fonts, renderer)
      },
    }
    return Object.freeze({
      fontProfile: profile,
      rendererProfile: measurement.profile,
      measurement: measured,
      fontFamilies: Object.freeze(fontFamilies),
      get assets() { return copies.map(({ faceId, bytes }) => ({ faceId, bytes: bytes.slice(0) })) },
      getFontAsset(faceId) {
        const asset = copies.find((asset) => asset.faceId === faceId)
        if (!asset) throw new TypeError('Unknown table font face')
        return { face: cloneTextData(profile.faces.find((face) => face.id === faceId)),
          bytes: asset.bytes.slice(0) }
      },
      dispose,
    })
  } catch (error) { dispose(); throw error }
}
module.exports = { createTableFontRuntime }
