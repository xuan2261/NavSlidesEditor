import { execFileSync } from 'node:child_process'
import { readFile, readdir } from 'node:fs/promises'
import { basename, isAbsolute, resolve } from 'node:path'
import { fileDigest, assertRun, assertArtifact } from './release-evidence-producer.mjs'
import { hashCanonical, sha256, windowsWorkflowIdentity } from './release-receipt-canonical.mjs'
import { verifyAuthenticodeEvidence } from './authenticode-policy.mjs'
import { createRequire } from 'node:module'
import { assertAuthoritativeReceipt } from '../officecli/physical-feasibility-receipt.mjs'

export function classifyWindowsArtifacts(names, version) {
  const expected = { 'nsis-exe': `NavSlides Editor Setup ${version}.exe`, 'portable-exe': `NavSlides Editor ${version}.exe` }
  if (!version || names.length !== 2 || new Set(names).size !== 2 ||
      Object.values(expected).some((name) => !names.includes(name))) throw new Error('Windows NSIS/portable artifact completeness/version mismatch')
  return expected
}
// Pinned primary schemas: gh v2.83.2 verify.go and sigstore-go v1.1.3
// fulcio/certificate/{summarize,extensions}.go. Predicate metadata is not identity authority.
export function normalizeGhAttestations(results, digests, expected) {
  if (!Array.isArray(results) || !results.length) throw new Error('verified attestation results are empty')
  if (typeof expected.workflowIdentity !== 'string') throw new Error('attestation workflow identity is invalid')
  const repository = expected.workflowIdentity.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\//)?.[1]
  if (!repository) throw new Error('attestation workflow identity is invalid')
  const verified = new Map()
  for (const item of results.flat()) {
    const result = item?.verificationResult
    const cert = result?.signature?.certificate
    const statement = result?.statement
    if (!item?.attestation?.bundle || typeof item.attestation.bundle !== 'object' ||
        !Object.keys(item.attestation.bundle).length || !cert || !result.verifiedTimestamps?.length ||
        statement?.predicateType !== 'https://slsa.dev/provenance/v1' ||
        cert.issuer !== 'https://token.actions.githubusercontent.com' ||
        cert.subjectAlternativeName !== expected.workflowIdentity || cert.buildSignerURI !== expected.workflowIdentity ||
        cert.sourceRepositoryURI !== `https://github.com/${repository}` || cert.sourceRepositoryDigest !== expected.subjectSha) {
      throw new Error('verified attestation certificate/source/workflow/issuer mismatch')
    }
    for (const subject of statement.subject ?? []) {
      const name = basename(subject.name ?? '')
      if (Object.hasOwn(digests, name) && subject.digest?.sha256 === digests[name]) verified.set(name, item)
    }
  }
  if (!Object.keys(digests).length || Object.keys(digests).some((name) => !verified.has(name))) {
    throw new Error('verified attestation artifact digest coverage is incomplete')
  }
  return [{ id: 'electron-windows', digest: hashCanonical(digests), subjectSha: expected.subjectSha,
    clientDigest: expected.clientDigest, workflowIdentity: expected.workflowIdentity,
    issuer: 'https://token.actions.githubusercontent.com', verified: true,
    bundleHash: hashCanonical([...verified.entries()]) }]
}
export async function normalizeWindowsAttestation(path, expected) {
  const names = (await readdir('post-download')).filter((name) => name.toLowerCase().endsWith('.exe')).sort()
  const version = JSON.parse(await readFile('package.json', 'utf8')).version
  classifyWindowsArtifacts(names, version)
  const digests = {}
  for (const name of names) digests[name] = await fileDigest(`post-download/${name}`)
  const bytes = await readFile(path)
  return { evidence: normalizeGhAttestations(JSON.parse(bytes), digests, expected), rawHash: sha256(bytes) }
}
export function captureGhAttestation(path, subjectSha, workflow) {
  if (!/^gh version 2\.83\.2(?:\s|$)/.test(execFileSync('gh', ['--version'], { encoding: 'utf8' }))) {
    throw new Error('pinned gh attestation verifier 2.83.2 is required')
  }
  try {
    return execFileSync('gh', ['attestation', 'verify', path, '--repo', process.env.GITHUB_REPOSITORY,
      '--source-digest', subjectSha, '--signer-workflow', `${process.env.GITHUB_REPOSITORY}/${workflow}`,
      '--format', 'json'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  } catch { throw new Error('actual gh attestation verification failed') }
}

// Windows trust verification is executed against the file, never against signer JSON.
// RFC3161 evidence is extracted from the embedded CMS attribute, not inferred from
// TimeStamperCertificate. SignedCms validates the token and its message imprint.
const CAPTURE = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security.Cryptography.Pkcs
Add-Type -AssemblyName System.Formats.Asn1
$s = Get-AuthenticodeSignature -LiteralPath $env:NS_VERIFY_EXE
if ($s.Status -ne 'Valid') { throw 'Windows Authenticode trust verification failed' }
$b = [IO.File]::ReadAllBytes($env:NS_VERIFY_EXE)
$pe = [BitConverter]::ToInt32($b, 60)
if ([BitConverter]::ToUInt32($b, $pe) -ne 17744) { throw 'Invalid PE header' }
$optional = $pe + 24
$magic = [BitConverter]::ToUInt16($b, $optional)
if ($magic -eq 523) { $directory = $optional + 112 } elseif ($magic -eq 267) { $directory = $optional + 96 } else { throw 'Invalid PE format' }
$offset = [BitConverter]::ToUInt32($b, $directory + 32)
$size = [BitConverter]::ToUInt32($b, $directory + 36)
if ($offset -lt 1 -or $size -lt 9 -or $offset + $size -gt $b.Length) { throw 'Embedded signature missing' }
$length = [BitConverter]::ToUInt32($b, $offset)
if ($length -lt 9 -or $length -gt $size -or [BitConverter]::ToUInt16($b, $offset + 6) -ne 2) { throw 'Invalid WIN_CERTIFICATE' }
$cmsBytes = [byte[]]::new($length - 8)
[Array]::Copy($b, $offset + 8, $cmsBytes, 0, $cmsBytes.Length)
$cms = [Security.Cryptography.Pkcs.SignedCms]::new()
$cms.Decode($cmsBytes)
$cms.CheckSignature($true)
if ($cms.SignerInfos.Count -ne 1) { throw 'Ambiguous embedded signer' }
$signer = $cms.SignerInfos[0]
if ($signer.Certificate.Thumbprint -ne $s.SignerCertificate.Thumbprint) { throw 'Windows/CMS signer mismatch' }
$attrs = @($signer.UnsignedAttributes | Where-Object { $_.Oid.Value -eq '1.3.6.1.4.1.311.3.3.1' })
if ($attrs.Count -ne 1 -or $attrs[0].Values.Count -ne 1) { throw 'RFC3161 token missing or ambiguous' }
$token = [Security.Cryptography.Pkcs.SignedCms]::new()
$token.Decode($attrs[0].Values[0].RawData)
$token.CheckSignature($true)
if ($token.ContentInfo.ContentType.Value -ne '1.2.840.113549.1.9.16.1.4' -or $token.SignerInfos.Count -ne 1) { throw 'RFC3161 TSTInfo required' }
$reader = [System.Formats.Asn1.AsnReader]::new([ReadOnlyMemory[byte]]::new($token.ContentInfo.Content), [System.Formats.Asn1.AsnEncodingRules]::DER)
$tst = $reader.ReadSequence()
$null = $tst.ReadInteger()
$null = $tst.ReadObjectIdentifier()
$imprint = $tst.ReadSequence()
$algorithm = $imprint.ReadSequence().ReadObjectIdentifier()
$expectedImprint = $imprint.ReadOctetString()
$null = $tst.ReadInteger()
$at = $tst.ReadGeneralizedTime().UtcDateTime
$hashName = switch ($algorithm) { '2.16.840.1.101.3.4.2.1' { 'SHA256' } '2.16.840.1.101.3.4.2.2' { 'SHA384' } '2.16.840.1.101.3.4.2.3' { 'SHA512' } default { throw 'Unsupported RFC3161 imprint algorithm' } }
$hash = [Security.Cryptography.HashAlgorithm]::Create($hashName)
try { $actualImprint = $hash.ComputeHash($signer.GetSignature()) } finally { $hash.Dispose() }
if ([Convert]::ToHexString($actualImprint) -ne [Convert]::ToHexString($expectedImprint)) { throw 'RFC3161 message imprint mismatch' }
foreach ($pair in @(@($signer.Certificate, '1.3.6.1.5.5.7.3.3'), @($token.SignerInfos[0].Certificate, '1.3.6.1.5.5.7.3.8'))) {
  $chain = [Security.Cryptography.X509Certificates.X509Chain]::new()
  $chain.ChainPolicy.VerificationTime = $at
  $chain.ChainPolicy.RevocationMode = 'Online'
  $chain.ChainPolicy.RevocationFlag = 'EntireChain'
  $null = $chain.ChainPolicy.ApplicationPolicy.Add([Security.Cryptography.Oid]::new($pair[1]))
  $chain.ChainPolicy.ExtraStore.AddRange($token.Certificates)
  $chain.ChainPolicy.ExtraStore.AddRange($cms.Certificates)
  try { if (-not $chain.Build($pair[0])) { throw 'Signature/timestamp chain trust failed' } } finally { $chain.Dispose() }
}
@{ status='Valid'; signerSubject=$s.SignerCertificate.Subject; signerThumbprint=$s.SignerCertificate.Thumbprint;
  certificate=@{notBefore=$s.SignerCertificate.NotBefore.ToUniversalTime().ToString('o');notAfter=$s.SignerCertificate.NotAfter.ToUniversalTime().ToString('o')};
  chainTrusted=$true; timestamp=@{type='RFC3161';trusted=$true;value=$at.ToString('o')};
  sha256=(Get-FileHash -LiteralPath $env:NS_VERIFY_EXE -Algorithm SHA256).Hash.ToLowerInvariant()
} | ConvertTo-Json -Depth 10 -Compress
`
export const WINDOWS_CAPTURE_HASH = sha256(CAPTURE)
export async function captureAuthenticode(exePath) {
  const env = process.env
  if (process.platform !== 'win32' || !isAbsolute(env.WINDOWS_VERIFIER_PATH ?? '') ||
      !isAbsolute(env.WINDOWS_SIGNTOOL_PATH ?? '') || !env.WINDOWS_VERIFIER_VERSION ||
      await fileDigest(env.WINDOWS_VERIFIER_PATH) !== env.WINDOWS_VERIFIER_SHA256 ||
      await fileDigest(env.WINDOWS_SIGNTOOL_PATH) !== env.WINDOWS_SIGNTOOL_SHA256) {
    throw new Error('authenticode_verifier_unavailable: pinned independent Windows verifier required')
  }
  try {
    const version = execFileSync(env.WINDOWS_VERIFIER_PATH, ['-NoProfile', '-NonInteractive', '-Command', '$PSVersionTable.PSVersion.ToString()'], { encoding: 'utf8' }).trim()
    if (version !== env.WINDOWS_VERIFIER_VERSION) throw new Error('verifier version mismatch')
    const signtool = execFileSync(env.WINDOWS_SIGNTOOL_PATH, ['verify', '/pa', '/all', '/v', '/tw', resolve(exePath)], { encoding: 'utf8' })
    const raw = execFileSync(env.WINDOWS_VERIFIER_PATH, ['-NoProfile', '-NonInteractive', '-Command', CAPTURE], {
      encoding: 'utf8', env: { ...env, NS_VERIFY_EXE: resolve(exePath) },
    })
    const signature = JSON.parse(raw)
    if (signature.chainTrusted !== true || signature.sha256 !== await fileDigest(exePath)) throw new Error('independent signature capture mismatch')
    return { signature, verifier: { version, scriptHash: sha256(CAPTURE), executableHash: env.WINDOWS_VERIFIER_SHA256,
      signtoolHash: env.WINDOWS_SIGNTOOL_SHA256, signtoolOutputHash: sha256(signtool), captureHash: sha256(raw) } }
  } catch { throw new Error('independent Authenticode/RFC3161/chain verification failed') }
}
export function validateWindowsSignature(evidence) {
  return verifyAuthenticodeEvidence({ evidence, expected: { publisherSubject: process.env.WINDOWS_SIGNING_SUBJECT,
    publisherThumbprint: process.env.WINDOWS_SIGNING_THUMBPRINT } })
}
export function assertWindowsLeafEvidence(receipt, policy) {
  const workflowIdentity = windowsWorkflowIdentity(policy)
  const leaf = receipt.evidence
  if (!leaf?.signatures || !leaf.office || !leaf.fidelity || !Array.isArray(leaf.attestation)) throw new Error('Windows actual leaf evidence is required')
  for (const kind of ['office', 'fidelity']) {
    const item = leaf[kind]
    if (item.status !== 'passed' || item.subjectSha !== receipt.subjectSha || item.clientDigest !== receipt.clientDigest ||
        !/^[a-f0-9]{64}$/.test(item.rawHash) || !item.limitations?.length) throw new Error('physical release leaf identity/scope mismatch')
    const run = item.producer?.run
    assertRun(run, { runId: run?.id, subjectSha: receipt.subjectSha, repository: run?.repository?.full_name,
      workflow: run?.path, event: run?.event, ref: run?.head_branch })
    assertArtifact(item.producer?.artifact, run, item.producer?.artifact?.name)
  }
  const manifest = createRequire(import.meta.url)('../../server/services/pptx-import/officecli/qualification-manifest.json')
  assertAuthoritativeReceipt(leaf.office.raw, manifest, receipt.subjectSha)
  if (leaf.office.kind !== 'officecli' || leaf.office.claimScope !== leaf.office.raw.claimScope ||
      leaf.office.rawCanonicalHash !== hashCanonical(leaf.office.raw) || leaf.fidelity.kind !== 'fidelity' ||
      leaf.fidelity.claimScope !== 'environment-bounded-powerpoint-visual-oracle' ||
      leaf.fidelity.evaluation?.gate?.integrity?.verdict !== 'passed' ||
      leaf.fidelity.evaluation?.gate?.qualification?.verdict !== 'passed' ||
      leaf.fidelity.evidenceHash !== hashCanonical(leaf.fidelity.evaluation)) throw new Error('physical raw/evaluation leaf binding mismatch')
  const artifacts = Object.values(receipt.artifacts)
  if (artifacts.length !== 2 || Object.keys(leaf.signatures).length !== 2) throw new Error('Windows signature artifact completeness mismatch')
  for (const artifact of artifacts) {
    const signature = leaf.signatures[artifact.path]
    if (!signature?.preVerifier || !signature?.postVerifier || signature.postDownload?.chainTrusted !== true ||
        signature.preUpload?.chainTrusted !== true || signature.sha256 !== artifact.sha256 ||
        [signature.preVerifier, signature.postVerifier].some((verifier) => !verifier?.version || verifier.scriptHash !== WINDOWS_CAPTURE_HASH ||
          ['executableHash', 'signtoolHash', 'signtoolOutputHash', 'captureHash'].some((key) => !/^[a-f0-9]{64}$/.test(verifier[key]))) ||
        hashCanonical(signature) !== artifact.evidenceHash) throw new Error('independent Windows signature leaf mismatch')
    verifyAuthenticodeEvidence({ evidence: signature, expected: { publisherSubject: signature.preUpload.signerSubject,
      publisherThumbprint: signature.preUpload.signerThumbprint } })
  }
  const normalized = normalizeGhAttestations(leaf.attestationRaw,
    Object.fromEntries(artifacts.map((artifact) => [artifact.path, artifact.sha256])),
    { subjectSha: receipt.subjectSha, clientDigest: receipt.clientDigest, workflowIdentity })
  if (hashCanonical(normalized) !== hashCanonical(leaf.attestation)) throw new Error('Windows attestation raw/leaf mismatch')
  const gates = { 'electron-runtime-closure': leaf.runtimeHash, 'officecli-physical': hashCanonical(leaf.office),
    'fidelity-powerpoint': hashCanonical(leaf.fidelity), authenticode: hashCanonical(leaf.signatures),
    'post-download-authenticode': hashCanonical({ signatures: leaf.signatures, stage: 'post-download' }), attestation: hashCanonical(leaf.attestation) }
  for (const [gate, digest] of Object.entries(gates)) if (receipt.gates[gate] !== digest) throw new Error(`Windows gate leaf hash mismatch: ${gate}`)
}
