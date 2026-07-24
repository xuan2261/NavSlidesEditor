const {
  getPackageStore,
  getReadablePackageStore,
} = require('./pptx-import/package-store-runtime')
const { createMutationTransactionService } = require('./pptx-import/mutation-transaction')
const { createNativeTextAdapter } = require('./pptx-import/text-ooxml-adapter')
const { createPrimitiveAdapters } = require('./pptx-import/primitive-ooxml-adapters')
const os = require('node:os')
const path = require('node:path')
const { createNativeReimportValidator } = require('./pptx-import/native-reimport-validator')
const { createOfficeCliGateway } = require('./pptx-import/officecli/gateway')
const { createNativeLauncherClient } = require('./pptx-import/officecli/launcher-client')
const { qualifyOfficeCli } = require('./pptx-import/officecli/qualification')
const { createStagedOfficeCliValidator } = require('./pptx-import/officecli/staged-validator')
const { canonicalMatrixSubject } = require('./pptx-import/evidence/matrix-subject')
const { deriveCanonicalPlainTextJournal } = require('./pptx-import/canonical-plain-text-journal')
const { replayRequest, resolveEditedExportContext } = require('./pptx-import/validated-edited-export-context')
const { canonicalReasonCodes, reasonCodeSubject } = require('./pptx-import/reason-code-contract')

function unavailable(reasonCode) {
  const reasonCodes = canonicalReasonCodes([reasonCode])
  return {
    available: false,
    officeCliAvailable: false,
    reasonCode: reasonCodes[0],
    reasonCodes,
    reasonCodeSubject: reasonCodeSubject(),
  }
}

function blocked(reasonCode) {
  const reasonCodes = canonicalReasonCodes([reasonCode])
  return Object.freeze({
    ok: false,
    status: 422,
    blockReason: reasonCodes[0],
    reasonCode: reasonCodes[0],
    reasonCodes,
    reasonCodeSubject: reasonCodeSubject(),
  })
}

function serverRequest(request, context) {
  return Object.freeze({
    presentationId: request.presentationId,
    expectedGeneration: request.expectedGeneration,
    idempotencyKey: request.idempotencyKey,
    cancelled: request.cancelled === true,
    requireOfficeCli: true,
    baseRevisionId: context.head.packageRevisionId,
    after: context.after,
    textTransports: context.textTransports,
    pendingEdit: context.pendingEdit,
    pendingJournalHash: context.pendingJournalHash,
    compatibilityPresentation: context.after,
  })
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

function productionComposition({
  env = process.env,
  createLauncherClient = createNativeLauncherClient,
  importer,
} = {}) {
  const workspaceRoot = path.join(os.tmpdir(), 'navslides-officecli')
  void createLauncherClient
  return Object.freeze({
    nativeReimport: createNativeReimportValidator({
      importer,
      workspaceRoot: path.join(workspaceRoot, 'native-reimport'),
    }),
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

function hasCanonicalTextJournal(context, matrixAuthorityEpoch) {
  try {
    deriveCanonicalPlainTextJournal(context.before, context.after, {
      baseRevisionId: context.head.packageRevisionId,
      sourceMap: context.sourceMap,
      textTransports: context.textTransports,
      matrixAuthorityEpoch,
    })
    return true
  } catch {
    return false
  }
}

async function editedExportAvailability(presentation, options = productionComposition()) {
  try {
    const store = options.store || await getReadablePackageStore()
    const state = store.getState()
    const context = resolveEditedExportContext(state, presentation.id)
    if (!context.ok) return unavailable(context.reasonCode)
    if (context.pendingJournalHash && context.pendingEdit === false) {
      return {
        available: true,
        noOp: true,
        requiresValidators: false,
        officeCliAvailable: false,
        reasonCode: 'no-op-reconciliation-available',
      }
    }
    if (!hasCanonicalTextJournal(context, state.matrixAuthorityEpoch)) {
      return unavailable('CANONICAL_TEXT_JOURNAL_INVALID')
    }
    const validators = createQualifiedValidators(options)
    if (typeof validators.nativeReimport !== 'function') return unavailable('QUALIFIED_VALIDATORS_UNAVAILABLE')
    if (typeof validators.officeCli !== 'function') return unavailable('OFFICECLI_VALIDATOR_UNAVAILABLE')
    const gateway = options.officeCliGatewayFactory({ readRevision: async () => null })
    const capability = await gateway.probeCapability()
    if (!capability.available || !capability.validation) {
      return unavailable('OFFICECLI_VALIDATOR_UNAVAILABLE')
    }
    return { available: true, officeCliAvailable: true, reasonCode: 'QUALIFIED_VALIDATORS_AVAILABLE' }
  } catch {
    return unavailable('validated-edited-export-unavailable')
  }
}

async function hasValidatedEditedReplay(request, options = {}) {
  const store = options.store || getPackageStore()
  return Boolean(replayRequest(store.getState(), request))
}

async function executeValidatedEditedExport(request, options = productionComposition()) {
  const store = options.store || getPackageStore()
  const state = store.getState()
  const replay = replayRequest(state, request)
  const context = replay ? null : resolveEditedExportContext(state, request.presentationId)
  if (!replay && !context.ok) return blocked(context.reasonCode)
  const validators = createQualifiedValidators(options)
  const service = createMutationTransactionService({
    store,
    nativeTextAdapter: options.nativeTextAdapter || createNativeTextAdapter(),
    nativePrimitiveAdapter: options.nativePrimitiveAdapter || createPrimitiveAdapters(),
    loadSourceMap: async () => context?.sourceMap,
    loadCanonicalProjection: async () => context?.before,
    validators,
  })
  return service.execute(replay || serverRequest(request, context))
}

module.exports = {
  configuredLauncherClient,
  createQualifiedValidators,
  editedExportAvailability,
  executeValidatedEditedExport,
  hasValidatedEditedReplay,
  productionComposition,
}
