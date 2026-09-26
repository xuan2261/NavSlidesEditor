import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const COUNT_KEYS = [
  'numTotalTestSuites',
  'numPassedTestSuites',
  'numFailedTestSuites',
  'numPendingTestSuites',
  'numTotalTests',
  'numPassedTests',
  'numFailedTests',
  'numPendingTests',
  'numTodoTests',
]

function canonicalTestFile(file) {
  const normalized = file.replaceAll('\\', '/')
  return /^[a-zA-Z]:\//.test(normalized)
    ? `${normalized[0].toLowerCase()}${normalized.slice(1)}`
    : path.resolve(file).replaceAll('\\', '/')
}

export function mergeVitestResults(projectReports, expectedProjects = []) {
  const projectNames = new Set()
  const testFiles = new Set()
  const testResults = []
  const totals = Object.fromEntries(COUNT_KEYS.map((key) => [key, 0]))
  let success = true

  for (const { projectName, result } of projectReports) {
    if (!projectName || projectNames.has(projectName)) {
      throw new Error(`duplicate or missing result project: ${projectName || '<missing>'}`)
    }
    if (!result || !Array.isArray(result.testResults)) {
      throw new Error(`project ${projectName} has no testResults array`)
    }
    projectNames.add(projectName)
    success = success && result.success === true
    for (const key of COUNT_KEYS) totals[key] += Number(result[key] || 0)
    for (const testResult of result.testResults) {
      const file = canonicalTestFile(testResult.name || '')
      if (testFiles.has(file)) throw new Error(`duplicate test file execution: ${file}`)
      testFiles.add(file)
      testResults.push(testResult)
    }
  }

  const missing = expectedProjects.filter((name) => !projectNames.has(name))
  if (missing.length) throw new Error(`missing result project(s): ${missing.join(', ')}`)
  return {
    ...totals,
    success: success && totals.numFailedTests === 0 && totals.numFailedTestSuites === 0,
    testResults,
    projects: [...projectNames],
  }
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  const { values } = parseArgs({
    options: {
      input: { type: 'string', multiple: true },
      out: { type: 'string' },
      requireProject: { type: 'string', multiple: true },
    },
  })
  if (!values.input?.length || !values.out) {
    throw new Error('Usage: run-results --input project=file --out file')
  }
  const reports = values.input.map((item) => {
    const separator = item.indexOf('=')
    if (separator < 1) throw new Error(`invalid --input value: ${item}`)
    return {
      projectName: item.slice(0, separator),
      result: JSON.parse(readFileSync(item.slice(separator + 1), 'utf8')),
    }
  })
  const merged = mergeVitestResults(reports, values.requireProject || [])
  writeFileSync(values.out, `${JSON.stringify(merged)}\n`)
}
