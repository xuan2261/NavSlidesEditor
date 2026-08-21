function parseUrl(value) {
  try {
    return new URL(String(value))
  } catch {
    return null
  }
}

function isTrustedAppUrl(rawUrl, appOrigin) {
  const target = parseUrl(rawUrl)
  const trusted = parseUrl(appOrigin)
  if (!target || !trusted) return false

  if (target.protocol === 'http:' || target.protocol === 'https:' || target.protocol === 'blob:') {
    return target.origin === trusted.origin
  }
  return false
}

function isExternalHttpUrl(rawUrl, appOrigin) {
  const target = parseUrl(rawUrl)
  if (!target || (target.protocol !== 'http:' && target.protocol !== 'https:')) return false
  return !isTrustedAppUrl(rawUrl, appOrigin)
}

module.exports = { isTrustedAppUrl, isExternalHttpUrl }
