import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { collectScenarioRecords } from './release-evidence-adapter.js'
import { fileHash } from '../../../scripts/feature-inventory/education-evidence-files.mjs'
import { ROOT } from '../../../scripts/feature-inventory/education-release-policy.mjs'
import { acquireEvidenceOwnership } from '../../../scripts/feature-inventory/education-evidence-ownership.mjs'
export default class EducationEvidenceReporter {
  onBegin() {
    const path = process.env.NAVSLIDES_EDUCATION_CONTEXT
    if (!path) return
    if (process.env.PLAYWRIGHT_USE_DEV_SERVERS !== '0')
      throw new Error(
        'Frozen qualification requires PLAYWRIGHT_USE_DEV_SERVERS=0; Vite development receipts cannot qualify production artifacts.'
      )
    this.context = JSON.parse(readFileSync(path, 'utf8'))
    this.path = resolve(
      process.env.NAVSLIDES_EDUCATION_EVIDENCE ||
        resolve(ROOT, 'scripts/feature-inventory/reports/education-release-evidence.json')
    )
    this.pending = []
    this.failures = []
    this.error = null
  }
  onTestEnd(test, result) {
    if (!this.context) return
    try {
      const scenarios = collectScenarioRecords(result.attachments, result.status)
      const project = test.parent.project()?.name || ''
      const testTitle = test.titlePath().join(' › ')
      for (const scenario of scenarios) {
        const lane = this.context.lanes?.[scenario.lane]
        if (!lane) throw new Error(`Missing frozen artifact identity: ${scenario.lane}`)
        const execution = scenario.execution || {}
        if (
          scenario.lane !== 'production-browser' &&
          (!execution.executablePath ||
            fileHash(execution.executablePath) !== lane.artifactHashes.exe)
        )
          throw new Error('Desktop observation did not launch the exact frozen executable.')
        this.pending.push({
          ...scenario,
          schemaVersion: this.context.schemaVersion,
          runId: this.context.runId,
          subjectHash: this.context.subjectHash,
          policyHash: this.context.policyHash,
          artifactHashes: lane.artifactHashes,
          runtimeVersion: lane.runtimeVersion,
          environment: process.platform,
          browser: execution.browser || '',
          browserVersion: execution.browserVersion || '',
          project,
          viewport: execution.viewport,
          protocol: execution.protocol,
          origin: execution.origin,
          testTitle,
          executablePath: execution.executablePath || null,
          timestamp: scenario.timestamp || new Date().toISOString(),
          artifactFileHashes:
            scenario.artifactFileHashes ||
            Object.fromEntries(scenario.artifactPaths.map((path) => [path, fileHash(path)])),
          testFile: test.location.file,
          retry: result.retry,
          annotations: test.annotations,
        })
      }
      const scoped =
        /[\\/]tests[\\/]e2e[\\/](?:education[\\/].*\.spec\.js|live[\\/]education-.*\.spec\.js|block-library\.spec\.js)$/.test(
          test.location.file
        )
      if (result.status !== 'passed' && (scenarios.length || scoped))
        this.failures.push({
          testTitle,
          project,
          result: result.status,
          errors: result.errors.map((error) => error.message || String(error)),
          timestamp: new Date().toISOString(),
        })
    } catch (error) {
      this.error = error
      this.failures.push({
        testTitle: test.title,
        result: 'failed',
        errors: [error.message],
        timestamp: new Date().toISOString(),
      })
    }
  }
  onError(error) {
    if (!this.context) return
    this.failures.push({
      result: 'failed',
      source: 'runner-error',
      errors: [error.message || String(error)],
      timestamp: new Date().toISOString(),
    })
  }
  onEnd(result) {
    if (!this.context) return
    const status = result?.status || 'failed'
    if (status !== 'passed')
      this.failures.push({
        result: status,
        source: 'runner-end',
        errors: [`Playwright run ended with ${status}.`],
        timestamp: new Date().toISOString(),
      })
    const packagePath = process.env.NAVSLIDES_EDUCATION_PACKAGE_RECEIPT
    const packagedRecords = this.pending.filter((record) => record.lane === 'windows-packaged')
    if (packagedRecords.length && !packagePath) {
      this.error = new Error(
        'Packaged observations require NAVSLIDES_EDUCATION_PACKAGE_RECEIPT before validated import.'
      )
      this.failures.push({
        result: 'failed',
        source: 'package-receipt',
        errors: [this.error.message],
        timestamp: new Date().toISOString(),
      })
    }
    const persistPackage = packagePath && (packagedRecords.length || this.failures.length)
    let ownership, outcome
    try {
      ownership = acquireEvidenceOwnership([this.path, persistPackage && packagePath])
      const manifest = ownership.read(this.path, this.context)
      manifest.records.push(...this.pending.filter((record) => record.lane !== 'windows-packaged'))
      manifest.executionFailures = [...(manifest.executionFailures || []), ...this.failures]
      manifest.updatedAt = new Date().toISOString()
      ownership.write(this.path, manifest)
      let receipt
      if (persistPackage) {
        receipt = ownership.read(packagePath, this.context)
        receipt.records.push(...packagedRecords)
        receipt.executionFailures = [...(receipt.executionFailures || []), ...this.failures]
        const lane = this.context.lanes?.['windows-packaged']
        if (lane) receipt.artifactHashes = lane.artifactHashes
        receipt.updatedAt = manifest.updatedAt
      }
      if (receipt) ownership.write(packagePath, receipt)
      if (this.error || this.failures.length)
        outcome = { status: status === 'passed' ? 'failed' : status }
    } catch (error) {
      console.error(`[education-evidence] ${error.message}`)
      outcome = { status: status === 'passed' ? 'failed' : status }
    } finally {
      try {
        ownership?.release()
      } catch (error) {
        console.error(`[education-evidence] ${error.message}`)
        outcome = { status: status === 'passed' ? 'failed' : status }
      }
    }
    return outcome
  }
}
