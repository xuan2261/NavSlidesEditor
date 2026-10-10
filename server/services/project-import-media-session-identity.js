function sameIdentity(left, right) {
  return Boolean(left && right && left.sessionId === right.sessionId && left.payloadDigest === right.payloadDigest &&
    left.archiveDigest === right.archiveDigest && left.intendedPresentationId === right.intendedPresentationId &&
    left.leaseId === right.leaseId && left.scope === right.scope && left.capabilitySalt === right.capabilitySalt)
}
function sameIntent(left, right) {
  return sameIdentity(left, right) && left.packageBundleDigest === right.packageBundleDigest
}
module.exports = { sameIdentity, sameIntent }
