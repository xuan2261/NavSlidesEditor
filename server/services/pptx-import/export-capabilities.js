function exportSurfaceCapabilities({ hasValidatedRevision = false, editedExportBlocked = null } = {}) {
  return Object.freeze({
    original: Object.freeze({
      capability: 'original',
      available: true,
      roundtrip: true,
      label: 'Download original',
    }),
    edited: Object.freeze({
      capability: 'validated-edited',
      available: hasValidatedRevision && !editedExportBlocked,
      roundtrip: true,
      label: 'Export validated edited revision',
      blockReason: editedExportBlocked,
    }),
    reconstructed: Object.freeze({
      capability: 'reconstructed',
      available: true,
      roundtrip: false,
      label: 'Generate new PPTX (non-roundtrip)',
    }),
  })
}

function providerEvidencePlaceholder(subjectHash) {
  return Object.freeze({
    status: 'unavailable',
    provider: null,
    subjectHash,
    claimLevel: null,
    reason: 'protected-provider-not-configured',
  })
}

module.exports = { exportSurfaceCapabilities, providerEvidencePlaceholder }
