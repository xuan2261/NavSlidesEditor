const {
  getPackageStore,
  getReadablePackageStore,
} = require('./pptx-import/package-store-runtime')
const { createMutationTransactionService } = require('./pptx-import/mutation-transaction')
const { createNativeTextAdapter } = require('./pptx-import/text-ooxml-adapter')
const { createPrimitiveAdapters } = require('./pptx-import/primitive-ooxml-adapters')
const os = require('node:os')
const path = require('node:path')
const { verifyNativePlainRunPostcondition } = require('./pptx-import/native-plain-run-postcondition')
const { createOfficeCliGateway } = require('./pptx-import/officecli/gateway')
const { createNativeLauncherClient } = require('./pptx-import/officecli/launcher-client')
const { qualifyOfficeCli } = require('./pptx-import/officecli/qualification')
const { createStagedOfficeCliValidator } = require('./pptx-import/officecli/staged-validator')
const { canonicalMatrixSubject } = require('./pptx-import/evidence/matrix-subject')

function currentAuthority(state, presentationId) {
  const head = state.heads.find((item) => item.presentationId === presentationId)
  const result = [...state.mutationResults].reverse().find((item) =>
    item.presentationId === presentationId &&
    item.packageRevisionId === head?.packageRevisionId &&
    item.sourceMap && item.projection)
  return { head, result }
}

function configuredLauncherClient({ env = process.env, createClient = createNativeLauncherClient } = {}) {
  const launcherPath = env.OFFICECLI_LAUNCHER_PATH
  const launcherHash = env.OFFICECLI_LAUNCHER_SHA256
  const launcherVersion = env.OFFICECLI_LAUNCHER_VERSION
  const policyDigest = env.OFFICECLI_CONTAINMENT_POLICY_DIGEST
  if (typeof launcherPath !== 'string' || typeof launcherHash !== 'string' ||
      typeof launcherVersion !== 'string' || typeof policyDigest !== 'string') return null
  try {
    return createClient({
      launcherPath,
      launcherIdentity: { sha256: launcherHash.toUpperCase(), version: launcherVersion },
      policyDigest,
    })
  } catch {
    return null
  }
}

function productionComposition({ env = process.env, createLauncherClient = createNativeLauncherClient } = {}) {
  const workspaceRoot = path.join(os.tmpdir(), 'navslides-officecli')
  void createLauncherClient
  return Object.freeze({
    nativeReimport: verifyNativePlainRunPostcondition,
    officeCliGatewayFactory: ({ readRevision }) => createOfficeCliGateway({
      workspaceRoot,
      qualification: () => qualifyOfficeCli({ env, matrixSubject: canonicalMatrixSubject() }),
      readRevision,
    }),
  })
}

function createQualifiedValidators({ nativeReimport, officeCliGatewayFactory } = {}) {
  if (typeof nativeReimport !== 'function') return Object.freeze({})
  const validators = { nativeReimport }
  if (typeof officeCliGatewayFactory === 'function') {
    validators.officeCli = createStagedOfficeCliValidator({ createGateway: officeCliGatewayFactory })
  }
  return Object.freeze(validators)
}

async function editedExportAvailability(presentation, options = productionComposition()) {
  const store = options.store || await getReadablePackageStore()
  const { head, result } = currentAuthority(store.getState(), presentation.id)
  if (!head) return { available: false, reasonCode: 'PACKAGE_HEAD_UNAVAILABLE' }
  if (!result) return { available: false, reasonCode: 'CURRENT_SOURCE_AUTHORITY_UNAVAILABLE' }
  const validators = createQualifiedValidators(options)
  if (typeof validators.nativeReimport !== 'function') return { available: false, reasonCode: 'QUALIFIED_VALIDATORS_UNAVAILABLE' }
  if (typeof validators.officeCli !== 'function') return { available: false, reasonCode: 'OFFICECLI_VALIDATOR_UNAVAILABLE' }
  const gateway = options.officeCliGatewayFactory({ readRevision: async () => null })
  const capability = await gateway.probeCapability()
  if (!capability.available || !capability.validation) return { available: false, reasonCode: 'OFFICECLI_VALIDATOR_UNAVAILABLE' }
  return { available: true, reasonCode: 'QUALIFIED_VALIDATORS_AVAILABLE' }
}

async function executeValidatedEditedExport(request, options = productionComposition()) {
  const store = options.store || getPackageStore()
  const validators = createQualifiedValidators(options)
  const service = createMutationTransactionService({
    store,
    nativeTextAdapter: options.nativeTextAdapter || createNativeTextAdapter(),
    nativePrimitiveAdapter: options.nativePrimitiveAdapter || createPrimitiveAdapters(),
    loadSourceMap: async ({ presentationId }) => currentAuthority(store.getState(), presentationId).result?.sourceMap,
    loadCanonicalProjection: async ({ presentationId }) => currentAuthority(store.getState(), presentationId).result?.projection,
    validators,
  })
  return service.execute({ ...request, requireOfficeCli: true })
}

module.exports = { configuredLauncherClient, createQualifiedValidators, editedExportAvailability, executeValidatedEditedExport, productionComposition }
