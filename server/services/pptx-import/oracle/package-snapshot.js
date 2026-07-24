const { coded, requestBytes, requestJson, withSignal } = require('./http-boundary')

const isSha256 = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value)
const isPositiveInt = (value) => Number.isSafeInteger(value) && value > 0

function endpoint(baseUrl, pathname) {
  return new URL(pathname, `${baseUrl}/`).href
}

function extractPackageIdentity(snapshot) {
  const authority = snapshot?.packageAuthority
  const original = snapshot?.original
  if (snapshot?.schemaVersion !== 1 || typeof snapshot?.presentationId !== 'string' || !snapshot.presentationId ||
    typeof authority?.revisionId !== 'string' || !authority.revisionId || !isSha256(authority.headHash) ||
    !isPositiveInt(snapshot.aggregateGeneration) || !isSha256(original?.sha256) || !isPositiveInt(original.byteLength)) {
    throw coded('invalid-package-snapshot')
  }
  return {
    presentationId: snapshot.presentationId,
    packageRevisionId: authority.revisionId,
    packageHeadHash: authority.headHash,
    aggregateGeneration: snapshot.aggregateGeneration,
    originalSha256: original.sha256,
    originalByteLength: original.byteLength,
  }
}

function samePackageIdentity(left, right) {
  return left.presentationId === right.presentationId && left.packageRevisionId === right.packageRevisionId &&
    left.packageHeadHash === right.packageHeadHash && left.aggregateGeneration === right.aggregateGeneration &&
    left.originalSha256 === right.originalSha256 && left.originalByteLength === right.originalByteLength
}

async function readPackageSnapshot(fetchImpl, baseUrl, presentationId, signal) {
  const snapshot = await requestJson(
    fetchImpl,
    endpoint(baseUrl, `/api/presentations/${encodeURIComponent(presentationId)}/pptx-package-snapshot`),
    withSignal(null, signal)
  )
  const identity = extractPackageIdentity(snapshot)
  if (identity.presentationId !== presentationId) throw coded('invalid-package-snapshot')
  return identity
}

function originalHeaders(identity) {
  return {
    'If-Pptx-Generation': String(identity.aggregateGeneration),
    'If-Pptx-Package-Revision': identity.packageRevisionId,
    'If-Pptx-Package-Head-Hash': identity.packageHeadHash,
  }
}

async function readFencedOriginal(fetchImpl, baseUrl, identity, signal) {
  return requestBytes(
    fetchImpl,
    endpoint(baseUrl, `/api/presentations/${encodeURIComponent(identity.presentationId)}/pptx-original`),
    withSignal({ headers: originalHeaders(identity) }, signal)
  )
}

module.exports = { extractPackageIdentity, readFencedOriginal, readPackageSnapshot, samePackageIdentity }
