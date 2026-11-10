const { withPackageStore } = require('./pptx-import/package-store-runtime')

async function withStore(action) {
  return withPackageStore(action)
}

function duplicatePackageOwner(sourceId, destinationId, options) {
  return withStore((store) =>
    store.duplicatePresentationOwner(sourceId, destinationId, options)
  )
}

function instantiateRetainedPackageHead(retainedOwner, destinationId, options) {
  return withStore((store) =>
    store.instantiateRetainedHead(retainedOwner, destinationId, options)
  )
}

function quarantinePackageOwner(presentationId, options) {
  return withStore((store) => store.quarantinePresentation(presentationId, options))
}

function restoreQuarantinedPackageHead(retainedOwner, presentationId, options) {
  return withStore((store) =>
    store.restoreQuarantinedHead(retainedOwner, presentationId, options)
  )
}

async function restoreQuarantinedPackageHeadWithRetry(retainedOwner, presentationId, options) {
  let lastError
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await restoreQuarantinedPackageHead(retainedOwner, presentationId, options)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

async function quarantinePackageOwnerWithRetry(presentationId, options) {
  let lastError
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await quarantinePackageOwner(presentationId, options)
    } catch (error) {
      if (error.code === 'STALE_GENERATION') throw error
      lastError = error
    }
  }
  throw lastError
}

function retainPackageHead(owner, presentationId, options) {
  return withStore((store) => store.retainHead(owner, presentationId, options))
}

function releasePackageOwner(owner) {
  return withStore((store) => store.releaseOwner(owner))
}

async function releasePackageOwnerWithRetry(owner) {
  let lastError
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await releasePackageOwner(owner)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

function getPackageOwnerRecords(owner) {
  return withStore((store) => store.getOwnerRecords(owner))
}

function getPackageHistoryOwners(presentationId) {
  return withStore((store) => store.getHistoryOwnerRecords(presentationId))
}

function packageOwnerExists(owner) {
  return withStore((store) => store.hasOwner(owner))
}

function packagePresentationExists(presentationId) {
  return withStore((store) => store.hasPresentationHead(presentationId))
}

function getPackageHead(presentationId) {
  return withStore((store) => store.getPresentationHead(presentationId))
}

function packageCompatibilityPending(presentationId) {
  return withStore((store) => store.hasCompatibilityPending(presentationId))
}

function getRestorablePackageHead(presentationId, owner) {
  return withStore((store) => store.getRestorableHead(presentationId, owner))
}

function restorePackageForward(presentationId, owner, options) {
  return withStore((store) => store.restoreForward(presentationId, owner, options))
}

module.exports = {
  duplicatePackageOwner,
  getPackageHead,
  getPackageHistoryOwners,
  getPackageOwnerRecords,
  getRestorablePackageHead,
  instantiateRetainedPackageHead,
  packageOwnerExists,
  packagePresentationExists,
  packageCompatibilityPending,
  quarantinePackageOwner,
  quarantinePackageOwnerWithRetry,
  releasePackageOwner,
  releasePackageOwnerWithRetry,
  restorePackageForward,
  restoreQuarantinedPackageHead,
  restoreQuarantinedPackageHeadWithRetry,
  retainPackageHead,
}
