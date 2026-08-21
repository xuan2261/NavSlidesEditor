/**
 * Isolated adversarial PPTX import suite.
 * Expected reject/warn/map outcomes — never folded into metrics averages.
 */
const fs = require('node:fs/promises')
const http = require('node:http')
const https = require('node:https')
const os = require('node:os')
const path = require('node:path')
const { buildOpcInventory } = require('./package-store/opc-inventory')
const {
  FIXTURE_BUILDERS,
  materializeFixtures,
} = require('./pptx-import-adversarial-fixtures')
const { IMPORT_CRC_POLICY, validatePptxPackage } = require('./pptx-guards')

const DEFAULT_FIXTURE_DIR = path.join('server', 'data', 'test-corpus', 'adversarial')

/**
 * Expected outcomes for the adversarial lane (C1–C6 + breadth stubs).
 * Metrics corpus must not include these intentional failures.
 */
const ADVERSARIAL_CASES = Object.freeze([
  { id: 'C1', fixture: 'bad-crc.pptx', gate: 'package', expect: 'reject', code: IMPORT_CRC_POLICY.errorCode },
  { id: 'C2', fixture: 'good-package.pptx', gate: 'package', expect: 'map' },
  { id: 'C3', fixture: 'nested-package.pptx', gate: 'inventory', expect: 'reject', code: 'zip-recursion-depth-exceeded' },
  { id: 'C4', fixture: 'malformed-xml.pptx', gate: 'package', expect: 'reject', code: 'xml-dtd-prohibited' },
  { id: 'C5', fixture: 'external-rel.pptx', gate: 'inventory', expect: 'map', assertNoNetwork: true },
  { id: 'C6', fixture: 'emf-stub.pptx', gate: 'package', expect: 'map' },
  { id: 'A1', fixture: 'smartart-stub.pptx', gate: 'package', expect: 'map' },
  { id: 'A2', fixture: 'macro-ole-stub.pptx', gate: 'package', expect: 'map' },
  { id: 'A3', fixture: 'rtl-cjk-smoke.pptx', gate: 'package', expect: 'map' },
  { id: 'A4', fixture: 'notes-comments.pptx', gate: 'package', expect: 'map' },
])

function withNetworkProbe(run) {
  let hits = 0
  const wrap = (original) => function patched(...args) {
    hits += 1
    return original.apply(this, args)
  }
  const originals = {
    httpReq: http.request,
    httpsReq: https.request,
    httpGet: http.get,
    httpsGet: https.get,
    fetch: globalThis.fetch,
  }
  http.request = wrap(originals.httpReq)
  https.request = wrap(originals.httpsReq)
  http.get = wrap(originals.httpGet)
  https.get = wrap(originals.httpsGet)
  if (typeof originals.fetch === 'function') globalThis.fetch = wrap(originals.fetch)
  return Promise.resolve()
    .then(run)
    .finally(() => {
      http.request = originals.httpReq
      https.request = originals.httpsReq
      http.get = originals.httpGet
      https.get = originals.httpsGet
      if (typeof originals.fetch === 'function') globalThis.fetch = originals.fetch
    })
    .then((value) => ({ value, networkHits: hits }))
}

async function writeTempFixture(name, bytes) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-adv-'))
  const filePath = path.join(dir, name)
  await fs.writeFile(filePath, bytes)
  return { dir, filePath }
}

async function executeGate(caseDef, filePath, bytes) {
  if (caseDef.gate === 'inventory') {
    return buildOpcInventory(bytes, { maxNestedDepth: 2 })
  }
  return validatePptxPackage(filePath, caseDef.fixture)
}

function outcomeFromError(caseDef, error) {
  const code = error?.code || error?.reason || null
  if (caseDef.expect !== 'reject') {
    return {
      id: caseDef.id, fixture: caseDef.fixture, ok: false,
      expected: caseDef.expect, actual: 'reject', code, message: error?.message,
    }
  }
  const codeOk = !caseDef.code || code === caseDef.code
  return {
    id: caseDef.id, fixture: caseDef.fixture, ok: codeOk,
    expected: caseDef.expect, actual: 'reject', code, message: error?.message,
  }
}

async function runCase(caseDef, bytes) {
  const { dir, filePath } = await writeTempFixture(caseDef.fixture, bytes)
  try {
    const run = () => executeGate(caseDef, filePath, bytes)
    try {
      const result = caseDef.assertNoNetwork ? await withNetworkProbe(run) : { value: await run(), networkHits: 0 }
      if (caseDef.expect === 'reject') {
        return {
          id: caseDef.id, fixture: caseDef.fixture, ok: false,
          expected: 'reject', actual: 'map', detail: 'expected reject but gate accepted',
        }
      }
      if (caseDef.assertNoNetwork && result.networkHits > 0) {
        return {
          id: caseDef.id, fixture: caseDef.fixture, ok: false,
          expected: 'map-no-network', actual: `networkHits=${result.networkHits}`,
        }
      }
      return {
        id: caseDef.id, fixture: caseDef.fixture, ok: true,
        expected: caseDef.expect, actual: 'map', networkHits: result.networkHits,
      }
    } catch (error) {
      return outcomeFromError(caseDef, error)
    }
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
}

async function runAdversarialSuite({ fixtureDir = DEFAULT_FIXTURE_DIR, materialize = false } = {}) {
  if (materialize) await materializeFixtures(fixtureDir)
  const results = []
  for (const caseDef of ADVERSARIAL_CASES) {
    const builder = FIXTURE_BUILDERS[caseDef.fixture]
    const bytes = builder
      ? await builder()
      : await fs.readFile(path.join(fixtureDir, caseDef.fixture))
    results.push(await runCase(caseDef, bytes))
  }
  const failed = results.filter((row) => !row.ok)
  return {
    lane: 'adversarial',
    policy: IMPORT_CRC_POLICY,
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    results,
    ok: failed.length === 0,
  }
}

async function main(argv = process.argv.slice(2)) {
  const materialize = argv.includes('--materialize')
  const flag = argv.find((arg) => arg.startsWith('--fixture-dir='))
  const fixtureDir = flag ? flag.slice('--fixture-dir='.length) : DEFAULT_FIXTURE_DIR
  const summary = await runAdversarialSuite({ fixtureDir, materialize })
  console.log(JSON.stringify(summary, null, 2))
  process.exitCode = summary.ok ? 0 : 1
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}

module.exports = {
  ADVERSARIAL_CASES,
  DEFAULT_FIXTURE_DIR,
  runAdversarialSuite,
  main,
}
