function invalid(raise, code, message) {
  raise(code, message)
}

function identifier(value, label, raise) {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    invalid(raise, 'INVALID_IDENTIFIER', `${label} must be a non-empty trimmed string`)
  }
  return value
}

function positiveInteger(value, label, raise) {
  if (!Number.isInteger(value) || value < 1) invalid(raise, 'INVALID_VERSION', `${label} must be a positive integer`)
  return value
}

function exactRecord(value, fields, label, raise, unknownCode) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    invalid(raise, 'INVALID_OBJECT', `${label} must be a plain object`)
  }
  if (fields.some((field) => !Object.hasOwn(value, field))) {
    invalid(raise, 'MISSING_REQUIRED_FIELD', `${label} is incomplete`)
  }
  if (Object.keys(value).some((field) => !fields.includes(field))) {
    invalid(raise, unknownCode, `${label} contains an unknown field`)
  }
}

function catalog(entries, fields, label, raise, normalize) {
  if (!Array.isArray(entries) || entries.length === 0) invalid(raise, 'MISSING_CATALOG', `${label} is required`)
  const values = entries.map((entry, index) => {
    exactRecord(entry, fields, `${label}[${index}]`, raise, 'UNKNOWN_CATALOG_FIELD')
    return normalize(entry, `${label}[${index}]`, raise)
  }).sort((left, right) => left.id.localeCompare(right.id))
  if (new Set(values.map((entry) => entry.id)).size !== values.length) {
    invalid(raise, `DUPLICATE_${label.replace(/s$/, '').toUpperCase()}_BINDING`, `${label} contains duplicate IDs`)
  }
  return Object.freeze(values)
}

function parseMatrixCatalogs(input, raise) {
  const impactPolicies = catalog(input.impactPolicies, ['id'], 'impact-policies', raise,
    (entry, label) => Object.freeze({ id: identifier(entry.id, `${label}.id`, raise) }))
  const transports = catalog(input.transports, ['id', 'schemaVersion'], 'transports', raise,
    (entry, label) => Object.freeze({
      id: identifier(entry.id, `${label}.id`, raise),
      schemaVersion: positiveInteger(entry.schemaVersion, `${label}.schemaVersion`, raise),
    }))
  const eligibilityPolicies = catalog(input.eligibilityPolicies, ['id', 'version'], 'eligibility-policies', raise,
    (entry, label) => Object.freeze({
      id: identifier(entry.id, `${label}.id`, raise),
      version: positiveInteger(entry.version, `${label}.version`, raise),
    }))
  const normalizationContracts = catalog(input.normalizationContracts, ['id', 'version'], 'normalization-contracts', raise,
    (entry, label) => Object.freeze({
      id: identifier(entry.id, `${label}.id`, raise),
      version: positiveInteger(entry.version, `${label}.version`, raise),
    }))
  const adapters = catalog(input.adapters, ['id', 'qualified'], 'adapters', raise,
    (entry, label) => Object.freeze({
      id: identifier(entry.id, `${label}.id`, raise),
      qualified: typeof entry.qualified === 'boolean'
        ? entry.qualified
        : invalid(raise, 'INVALID_STATE', `${label}.qualified must be boolean`),
    }))
  return Object.freeze({ impactPolicies, transports, eligibilityPolicies, normalizationContracts, adapters })
}

function includes(catalog, id, version) {
  return catalog.some((entry) => entry.id === id && (version === undefined || entry.version === version || entry.schemaVersion === version))
}

function validateRowBindings(rows, catalogs, raise) {
  for (const row of rows) {
    if (!includes(catalogs.impactPolicies, row.impactPolicyId)) {
      invalid(raise, 'UNKNOWN_IMPACT_POLICY_BINDING', `${row.id} has no impact policy binding`)
    }
    if (!includes(catalogs.transports, row.transportId, row.transportSchemaVersion)) {
      invalid(raise, 'UNKNOWN_TRANSPORT_BINDING', `${row.id} has no transport binding`)
    }
    if (!includes(catalogs.eligibilityPolicies, row.eligibilityPolicyId, row.eligibilityPolicyVersion)) {
      invalid(raise, 'UNKNOWN_ELIGIBILITY_POLICY_BINDING', `${row.id} has no eligibility binding`)
    }
    if (!includes(catalogs.normalizationContracts, row.normalizationContractId, row.normalizationContractVersion)) {
      invalid(raise, 'UNKNOWN_NORMALIZATION_CONTRACT_BINDING', `${row.id} has no normalization binding`)
    }
    const adapter = row.adapterId === null ? null : catalogs.adapters.find((entry) => entry.id === row.adapterId)
    if (row.adapterId !== null && !adapter) invalid(raise, 'UNKNOWN_ADAPTER_BINDING', `${row.id} has no adapter binding`)
    if (['preserved-opaque', 'unsupported-blocking'].includes(row.tier) &&
      (row.adapterId !== null || row.adapterQualified || row.transactionEligible || row.level4Promoted)) {
      invalid(raise, 'NONEXECUTABLE_ROW_HAS_ADAPTER', `${row.id} cannot bind an adapter`)
    }
    if ((row.adapterQualified || row.transactionEligible || row.level4Promoted) && adapter?.qualified !== true) {
      invalid(raise, 'MISSING_QUALIFIED_ADAPTER', `${row.id} requires a qualified adapter`)
    }
  }
}

module.exports = { parseMatrixCatalogs, validateRowBindings }
