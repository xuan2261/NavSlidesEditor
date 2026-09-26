import { createWriteStream, existsSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { normalizeVitestPath } from '../../config/vitest/vitest-lanes.mjs'
import { repoRoot, schemaKeys } from './baseline-support.mjs'

const COUNT_KEYS = {
  testFiles: 'testResults',
  totalSuites: 'numTotalTestSuites',
  passedSuites: 'numPassedTestSuites',
  failedSuites: 'numFailedTestSuites',
  pendingSuites: 'numPendingTestSuites',
  totalTests: 'numTotalTests',
  passedTests: 'numPassedTests',
  failedTests: 'numFailedTests',
  pendingTests: 'numPendingTests',
  todoTests: 'numTodoTests',
}

function summarizeResult(file, laneByPath) {
  if (!existsSync(file)) return { readable: false }
  try {
    const result = JSON.parse(readFileSync(file, 'utf8'))
    const testResult = result.testResults?.[0]
    const assertion = testResult?.assertionResults?.[0]
    const laneDurationsSeconds = {}
    const executedFiles = []
    for (const item of result.testResults || []) {
      const normalized = normalizeVitestPath(item.name)
      executedFiles.push(normalized)
      const lane = laneByPath.get(normalized) || 'unclassified'
      const duration = Math.max(0, Number(item.endTime || 0) - Number(item.startTime || 0)) / 1000
      laneDurationsSeconds[lane] = (laneDurationsSeconds[lane] || 0) + duration
    }
    const counts = {}
    for (const [label, key] of Object.entries(COUNT_KEYS)) {
      counts[label] =
        key === 'testResults' ? (result.testResults?.length ?? null) : (result[key] ?? null)
    }
    return {
      readable: true,
      success: result.success,
      counts,
      executedFiles: executedFiles.sort(),
      laneDurationsSeconds,
      schema: {
        topLevelKeys: schemaKeys(result),
        testResultKeys: schemaKeys(testResult),
        assertionResultKeys: schemaKeys(assertion),
      },
    }
  } catch (error) {
    return { readable: false, error: error.message }
  }
}

export function runVitestSample({ label, rawRoot, extraArgs, laneByPath }) {
  return new Promise((resolve) => {
    const jsonPath = path.join(rawRoot, `${label}.json`)
    const stdoutPath = path.join(rawRoot, `${label}.stdout.txt`)
    const stderrPath = path.join(rawRoot, `${label}.stderr.txt`)
    rmSync(jsonPath, { force: true })
    rmSync(stdoutPath, { force: true })
    rmSync(stderrPath, { force: true })
    const args = [
      path.join(repoRoot, 'node_modules', 'vitest', 'vitest.mjs'),
      'run',
      '--reporter=json',
      `--outputFile=${jsonPath}`,
      ...extraArgs,
    ]
    const startedAt = new Date()
    const start = process.hrtime.bigint()
    const child = spawn(process.execPath, args, {
      cwd: repoRoot,
      env: process.env,
      windowsHide: true,
    })
    child.stdout.pipe(createWriteStream(stdoutPath))
    child.stderr.pipe(createWriteStream(stderrPath))
    child.once('error', (error) => resolve({ label, error: error.message }))
    child.once('close', (exitCode, signal) => {
      resolve({
        label,
        command: `vitest ${args.slice(1).join(' ')}`,
        startedAt: startedAt.toISOString(),
        endedAt: new Date().toISOString(),
        durationSeconds: Number(process.hrtime.bigint() - start) / 1e9,
        exitCode,
        signal,
        peakMemoryBytes: null,
        memoryMeasurement: 'unavailable for fork tree on this host',
        raw: {
          json: path.relative(repoRoot, jsonPath).replaceAll('\\', '/'),
          stdout: path.relative(repoRoot, stdoutPath).replaceAll('\\', '/'),
          stderr: path.relative(repoRoot, stderrPath).replaceAll('\\', '/'),
        },
        result: summarizeResult(jsonPath, laneByPath),
      })
    })
  })
}
