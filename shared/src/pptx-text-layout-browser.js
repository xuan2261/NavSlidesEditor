const { cloneTextData, evaluateFontProfile } = require('./pptx-text-document.js')
const { readFontCoverage } = require('./pptx-text-layout-font.js')
const { measureBrowserLine } = require('./pptx-text-layout-browser-line.js')

const descriptor = (face) => JSON.stringify(['family', 'style', 'weight', 'stretch', 'unicodeRange',
  'featureSettings', 'variationSettings', 'ascentOverride', 'descentOverride', 'lineGapOverride']
  .map((key) => face[key] ?? null))
const environment = (win) => ({
  userAgent: win.navigator.userAgent, platform: win.navigator.platform,
  language: win.navigator.language, devicePixelRatio: win.devicePixelRatio,
})
/**
 * Private, same-origin iframe; no global font registration, network fetch or
 * guessed installed-face lookup. assets are {faceId, bytes:ArrayBuffer} records.
 * SFNT-only v1 deliberately rejects WOFF/WOFF2/TTC/variable font coverage.
 * Caller owns dispose(). Native comparison is separate; this never qualifies.
 */
async function createBrowserTextMeasurer({ document: outer, fontProfile, assets }) {
  const win = outer?.defaultView
  if (!outer?.body || !win?.FontFace || !win.crypto?.subtle || !Array.isArray(assets))
    throw new TypeError('Text measurement requires a secure browser document and font bytes')
  const profileFonts = cloneTextData(fontProfile)
  evaluateFontProfile({ profile: profileFonts, requests: [] })
  const bytesById = new Map()
  for (const asset of assets) {
    if (!asset || typeof asset.faceId !== 'string' || bytesById.has(asset.faceId) ||
        !(asset.bytes instanceof win.ArrayBuffer) || asset.bytes.byteLength > 33554432 ||
        !profileFonts.faces.some((face) => face.id === asset.faceId))
      throw new TypeError('Invalid text measurement font asset')
    bytesById.set(asset.faceId, asset.bytes.slice(0))
  }
  const frame = outer.createElement('iframe')
  frame.setAttribute('data-pptx-text-measurement', '')
  frame.setAttribute('aria-hidden', 'true')
  frame.tabIndex = -1
  frame.style.cssText = 'position:fixed;left:-100000px;top:0;width:1px;height:1px;' +
    'visibility:hidden;pointer-events:none;border:0;'
  const loaded = new Promise((resolve, reject) => {
    const timeout = win.setTimeout(() => { frame.remove(); reject(new Error('Text measurement iframe load timeout')) }, 10000)
    frame.addEventListener('load', () => { win.clearTimeout(timeout); resolve() }, { once: true })
  })
  frame.srcdoc = '<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0"></body></html>'
  outer.body.append(frame)
  await loaded
  const doc = frame.contentDocument, fonts = new Map(), fontErrors = new Map(), identities = []
  let disposed = false
  try {
    for (const face of profileFonts.faces) {
      const bytes = bytesById.get(face.id)
      const eligible = evaluateFontProfile({ profile: { schemaVersion: 1, faces: [face] }, requests: [{
        typeface: face.typeface, bold: face.bold ?? false, italic: face.italic ?? false,
        source: { part: 'fontProfile', path: `faces.${face.id}` },
      }] }).results[0]
      if (!eligible.metricsQualified) { fontErrors.set(face.id, eligible.unsupportedReason); continue }
      if (!bytes || !face.assetHash) { fontErrors.set(face.id, 'font-asset-required'); continue }
      const digest = await win.crypto.subtle.digest('SHA-256', bytes)
      const actualHash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
      if (actualHash !== face.assetHash.toLowerCase()) { fontErrors.set(face.id, 'font-asset-hash-mismatch'); continue }
      let covers
      try { covers = readFontCoverage(bytes) }
      catch { fontErrors.set(face.id, 'font-coverage-unsupported'); continue }
      // Generated ASCII alias avoids CSS escaping and installed family collisions.
      const alias = `pptx_measured_${fonts.size}`
      const loadedFace = new doc.defaultView.FontFace(alias, bytes, {
        style: face.italic ? 'italic' : 'normal', weight: face.bold ? '700' : '400',
      })
      try { await loadedFace.load() }
      catch { fontErrors.set(face.id, 'font-load-failed'); continue }
      doc.fonts.add(loadedFace)
      fonts.set(face.id, { alias, face: loadedFace, covers, descriptor: descriptor(loadedFace) })
      identities.push(Object.freeze({ faceId: face.id, assetHash: actualHash }))
    }
    const profile = Object.freeze({ id: 'pptx-explicit-lines-v1', sessionId: win.crypto.randomUUID(),
      ...environment(win), fontIdentities: Object.freeze(identities) })
    const profileKey = JSON.stringify(profile), fontKey = JSON.stringify(profileFonts)
    const measurement = {
      profile,
      validate(requestedFonts, requestedProfile) {
        if (disposed || !frame.isConnected || doc.fonts.size !== fonts.size ||
            JSON.stringify(environment(win)) !== JSON.stringify(environment(frame.contentWindow)) ||
            Object.entries(environment(win)).some(([key, value]) => value !== profile[key]) ||
            [...fonts.values()].some((entry) => !doc.fonts.has(entry.face) ||
              entry.face.status !== 'loaded' || descriptor(entry.face) !== entry.descriptor))
          return 'stale-browser-profile'
        if (JSON.stringify(requestedFonts) !== fontKey || JSON.stringify(requestedProfile) !== profileKey)
          return 'measurement-profile-mismatch'
        return null
      },
      measureLine(input, outputFontFamilies) {
        return measureBrowserLine(doc, fonts, fontErrors, input, (item, fontScale) =>
          require('./pptx-text-layout-equation').measureInlineEquation({
            document: doc, fontRuntime: equationFonts, fontProfile: profileFonts,
            fontErrors, item, fontScale, outputFontFamilies,
          }))
      },
      dispose() { disposed = true; frame.remove(); fonts.clear() },
    }
    const equationFonts = {
      fontProfile: { schemaVersion: 1, faces: profileFonts.faces.filter((face) => fonts.has(face.id)) },
      rendererProfile: profile,
      fontFamilies: Object.fromEntries([...fonts].map(([id, entry]) => [id, entry.alias])),
      measurement: { validate: () => measurement.validate(profileFonts, profile) },
      getFontAsset(faceId) {
        const bytes = bytesById.get(faceId)
        if (!fonts.has(faceId) || !bytes) throw new TypeError('Verified equation font asset unavailable')
        return { bytes }
      },
    }
    return measurement
  } catch (error) { frame.remove(); throw error }
}
module.exports = { createBrowserTextMeasurer }
