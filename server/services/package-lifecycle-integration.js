const { withPackageStore } = require('./pptx-import/package-store-runtime')

async function withStore(action) {
  return withPackageStore(action)
}

function duplicatePackageOwner(sourceId, destinationId, options) {
  return withStore((store) =>
    store.duplicatePresentationOwner(sourceId, destinationId, options)
  )
}

function quarantinePackageOwner(presentationId, options) {
  return withStore((store) => store.quarantinePresentation(presentationId, options))
}

function retainPackageHead(owner, presentationId, options) {
  return withStore((store) => store.retainHead(owner, presentationId, options))
}

function releasePackageOwner(owner) {
  return withStore((store) => store.releaseOwner(owner))
}

function getRestorablePackageHead(presentationId, owner) {
  return withStore((store) => store.getRestorableHead(presentationId, owner))
}

function restorePackageForward(presentationId, owner, options) {
  return withStore((store) => store.restoreForward(presentationId, owner, options))
}

module.exports = {
  duplicatePackageOwner,
  getRestorablePackageHead,
  quarantinePackageOwner,
  releasePackageOwner,
  restorePackageForward,
  retainPackageHead,
}
