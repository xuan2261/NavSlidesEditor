const { sameIdentity, sameIntent } = require('./server/services/project-import-media-session-identity.js')
const left = {
  sessionId: '1', payloadDigest: '2', archiveDigest: '3', intendedPresentationId: '4', leaseId: '5', scope: '6', capabilitySalt: '7', packageBundleDigest: '8'
}
const right = { ...left, state: 'committed', capabilityHash: undefined, replayHash: 'hash' }
console.log('sameIdentity:', sameIdentity(left, right))
