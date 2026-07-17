const { hashCanonical } = require('./canonical-hash')
const { verifySigned } = require('./signature-verifier')
const { validateAuthorityKeys, validateTrustedRoot } = require('./trust-root-validator')

function same(actual, expected, reason, reasons) {
  if (actual !== expected) reasons.push(reason)
}

function manifestClaimDigest(manifest) {
  const {
    ciAttestation: _ci,
    providerAttestation: _provider,
    artifacts: _artifacts,
    ...claim
  } = manifest
  return hashCanonical(claim)
}

function validatePolicy(trustRoot, reasons) {
  if (!trustRoot?.policy || !trustRoot?.publicKeys) {
    reasons.push('missing-trust-root')
    return null
  }
  validateAuthorityKeys(trustRoot.publicKeys, reasons)
  const policy = trustRoot.policy
  if (policy.identity !== trustRoot.approvedPolicyIdentity) {
    reasons.push('unapproved-policy-identity')
  }
  const { digest: _digest, ...policyBody } = policy
  if (policy.digest !== hashCanonical(policyBody)) reasons.push('invalid-policy-digest')
  return policy
}

function validateCi(manifest, policy, trustRoot, artifacts, reasons) {
  const ci = manifest.ciAttestation
  if (!ci) return reasons.push('missing-ci-attestation')
  if (!verifySigned(ci, trustRoot.publicKeys.ci)) reasons.push('invalid-ci-signature')
  same(ci.issuer, policy.ci?.issuer, 'untrusted-ci-issuer', reasons)
  same(ci.repository, policy.ci?.repository, 'untrusted-ci-repository', reasons)
  same(ci.workflow, policy.ci?.workflow, 'untrusted-ci-workflow', reasons)
  same(ci.ref, policy.ci?.ref, 'untrusted-ci-ref', reasons)
  same(ci.environment, policy.ci?.environment, 'untrusted-ci-environment', reasons)
  same(ci.policyDigest, policy.digest, 'ci-attestation-policy-mismatch', reasons)
  same(ci.releaseCommit, manifest.releaseCommit, 'release-commit-mismatch', reasons)
  same(ci.artifactDigest, hashCanonical(artifacts), 'ci-attestation-artifact-mismatch', reasons)
  same(ci.claimDigest, manifestClaimDigest(manifest), 'ci-attestation-claim-mismatch', reasons)
}

function validateProvider(manifest, policy, trustRoot, artifacts, reasons) {
  for (const field of ['renderer', 'provider', 'providerRole', 'os', 'officeBuild',
    'fonts', 'officeCli']) {
    if (manifest[field] == null ||
        (Array.isArray(manifest[field]) && manifest[field].length === 0)) {
      reasons.push(`missing-${field.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`)
    }
  }
  if (manifest.providerRole !== 'claim-authoritative') reasons.push('provider-not-claim-authoritative')
  const provider = manifest.providerAttestation
  if (!provider) return reasons.push('missing-provider-attestation')
  if (!verifySigned(provider, trustRoot.publicKeys.provider)) reasons.push('invalid-provider-signature')
  same(provider.runner, policy.provider?.runner, 'untrusted-provider-runner', reasons)
  same(provider.policyDigest, policy.digest, 'provider-attestation-policy-mismatch', reasons)
  same(provider.releaseCommit, manifest.releaseCommit, 'provider-release-commit-mismatch', reasons)
  same(provider.claimDigest, manifestClaimDigest(manifest),
    'provider-attestation-claim-mismatch', reasons)
  same(provider.artifactDigest,
    hashCanonical(artifacts.filter((item) => item.kind === 'visual')),
    'provider-attestation-artifact-mismatch', reasons)
}

function validateTrust(manifest, trustRoot, level, artifacts, reasons, trustedConfig) {
  validateTrustedRoot(trustRoot, trustedConfig, reasons)
  if (level === 4 && !manifest.providerAttestation) reasons.push('missing-provider-attestation')
  const policy = validatePolicy(trustRoot, reasons)
  if (!policy) return null
  same(manifest.policyDigest, policy.digest, 'policy-digest-mismatch', reasons)
  if (hashCanonical(manifest.thresholds) !== hashCanonical(policy.thresholds)) {
    reasons.push('threshold-policy-mismatch')
  }
  validateCi(manifest, policy, trustRoot, artifacts, reasons)
  if (level === 4) validateProvider(manifest, policy, trustRoot, artifacts, reasons)
  return policy
}

module.exports = { manifestClaimDigest, validateTrust }
