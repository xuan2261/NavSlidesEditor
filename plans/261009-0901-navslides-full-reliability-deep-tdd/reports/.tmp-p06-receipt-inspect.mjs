import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const report = JSON.parse(await readFile(path.join(root, 'p06-browser-acceptance-final02.json'), 'utf8'))
const rows = []
async function visit(suite) {
  for (const spec of suite.specs || []) {
    for (const test of spec.tests || []) {
      for (const result of test.results || []) {
        const attachment = result.attachments.find((item) => item.name === 'p06-browser-receipt')
        assert.ok(attachment?.body, `Missing real receipt: ${spec.title}`)
        const receipt = JSON.parse(Buffer.from(attachment.body, 'base64').toString('utf8'))
        const gate = receipt.executionIdentity
        assert.equal(result.status, 'passed')
        assert.equal(receipt.status, 'passed')
        assert.equal(gate.status, 'matched')
        assert.equal(gate.before.sha256, gate.after.sha256)
        assert.deepEqual(receipt.pageErrors, [])
        const image = result.attachments.find((item) => item.name === 'p06-native-ui')
        assert.ok(image?.body, `Missing native screenshot: ${spec.title}`)
        const screenshot = `p06-native-final02-${rows.length + 1}.png`
        await writeFile(path.join(root, screenshot), Buffer.from(image.body, 'base64'), { flag: 'wx' })
        rows.push({ title: spec.title, status: result.status, scenarioIds: receipt.scenarioIds,
          executionIdentity: { status: gate.status, before: gate.before.sha256, after: gate.after.sha256,
            sourceBefore: gate.before.sourceSha256, sourceAfter: gate.after.sourceSha256,
            nodeExecutableSha256: gate.before.runtime.nodeExecutableSha256,
            browserExecutableSha256: gate.before.runtime.browserExecutableSha256,
            browserVersion: gate.before.runtime.browserVersion, files: gate.before.files.length },
          runs: receipt.runs, pageErrors: receipt.pageErrors, screenshot })
      }
    }
  }
  for (const child of suite.suites || []) await visit(child)
}
for (const suite of report.suites) await visit(suite)
assert.equal(rows.length, 5)
assert.equal(report.stats.expected, 5)
assert.equal(report.stats.unexpected, 0)
assert.equal(report.stats.skipped, 0)
assert.equal(report.stats.flaky, 0)
const summary = { status: 'passed', command: 'Playwright P06 native authoring/save/restore; chromium; workers=1; retries=0',
  stats: report.stats, runs: rows,
  limits: 'Current dirty working-tree production browser/HTTP evidence, not hosted CI, Office, clean SHA or release qualification.' }
await writeFile(path.join(root, 'p06-native-summary-final02.json'), JSON.stringify(summary, null, 2), { flag: 'wx' })
console.log(JSON.stringify({ status: summary.status, stats: summary.stats, rows: rows.map((row) => ({ title: row.title,
  status: row.status, scenarioIds: row.scenarioIds, identityMatched: row.executionIdentity.before === row.executionIdentity.after,
  sourceSha256: row.executionIdentity.sourceBefore, screenshot: row.screenshot })) }, null, 2))
