const { buildOpcInventory } = require('./package-store/opc-inventory')
const { securityPreflight } = require('./export-security-preflight')

function assertClosure(before, after, touched) {
  const oldParts = new Map(before.parts.map((part) => [part.path, part.sha256]))
  const newParts = new Map(after.parts.map((part) => [part.path, part.sha256]))
  if (oldParts.size !== newParts.size ||
      [...oldParts].some(([part]) => !newParts.has(part))) {
    throw new Error('OPC inventory changed outside the declared transaction')
  }
  for (const [part, sourceHash] of oldParts) {
    if (!touched.has(part) && newParts.get(part) !== sourceHash) {
      throw new Error(`Untouched OPC part changed: ${part}`)
    }
  }
}

async function runLayeredValidators(context, validators = {}) {
  const results = []
  const beforeInventory = await buildOpcInventory(context.beforeBytes)
  const afterInventory = await buildOpcInventory(context.afterBytes)
  results.push({ layer: 'zip-opc', ok: true, manifestHash: afterInventory.manifestHash })
  assertClosure(beforeInventory, afterInventory, new Set(context.touchedParts))
  results.push({ layer: 'impact', ok: true })
  const security = await securityPreflight(context.afterBytes)
  if (!security.ok) throw Object.assign(new Error(security.blockReason), { code: 'SECURITY_BLOCK' })
  results.push({ layer: 'security', ok: true })
  if (context.requireOfficeCli) {
    if (typeof validators.officeCli !== 'function') {
      throw Object.assign(new Error('Qualified OfficeCLI containment lane is unavailable'), {
        code: 'OFFICECLI_UNAVAILABLE',
      })
    }
    if ((await validators.officeCli(context)) !== true) throw new Error('OfficeCLI validation failed')
    results.push({ layer: 'officecli', ok: true })
  }
  if (typeof validators.nativeReimport !== 'function') {
    throw new TypeError('Native re-import validator is required for edited export')
  }
  if ((await validators.nativeReimport(context)) !== true) throw new Error('Native semantic validation failed')
  results.push({ layer: 'native-reimport', ok: true })
  return Object.freeze(results.map(Object.freeze))
}

module.exports = { runLayeredValidators }
