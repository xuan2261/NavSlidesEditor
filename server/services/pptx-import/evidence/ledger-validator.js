const { hashCanonical } = require('./canonical-hash')
const { verifySigned } = require('./signature-verifier')

function entryDigest(entry) {
  const { signature: _signature, ...payload } = entry || {}
  return hashCanonical(payload)
}

function validateLedger(manifest, policy, trustRoot, ledger, reasons, trustedConfig) {
  if (!policy) return
  const checkpoint = trustedConfig?.ledgerCheckpoint
  if (!checkpoint || checkpoint.identity !== ledger?.identity ||
      !Number.isSafeInteger(checkpoint.epoch) ||
      !/^[a-f0-9]{64}$/i.test(checkpoint.digest || '')) {
    reasons.push('invalid-ledger-checkpoint')
    return
  }
  const matching = (ledger?.entries || []).filter((entry) =>
    entry.releaseChannel === policy.releaseChannel &&
    entry.claimId === policy.claimId &&
    entry.policyDigest === policy.digest &&
    entry.ledgerIdentity === checkpoint.identity)
  if (!matching.length) return reasons.push('missing-ledger-authority')
  const ordered = [...matching].sort((a, b) => a.epoch - b.epoch)
  let predecessorEpoch = checkpoint.epoch
  let predecessorDigest = checkpoint.digest
  for (const entry of ordered) {
    if (!verifySigned(entry, trustRoot.publicKeys.ledger)) reasons.push('invalid-ledger-signature')
    if (entry.epoch !== predecessorEpoch + 1) reasons.push('non-contiguous-ledger-chain')
    if (entry.predecessor !== predecessorEpoch ||
        entry.predecessorDigest !== predecessorDigest) reasons.push('ledger-predecessor-mismatch')
    predecessorEpoch = entry.epoch
    predecessorDigest = entryDigest(entry)
  }
  const highest = Math.max(...ordered.map((entry) => entry.epoch))
  const highestEntries = matching.filter((entry) => entry.epoch === highest)
  if (highestEntries.length !== 1) reasons.push('duplicate-ledger-epoch')
  const entry = highestEntries[0]
  if (manifest.evidenceEpoch !== highest) reasons.push('evidence-epoch-replay')
  if (entry?.releaseCommit !== manifest.releaseCommit) reasons.push('release-commit-mismatch')
  if (entry?.transparencyDigest !== hashCanonical({
    epoch: entry?.epoch,
    releaseCommit: entry?.releaseCommit,
  })) reasons.push('invalid-ledger-transparency')
}

module.exports = { entryDigest, validateLedger }
