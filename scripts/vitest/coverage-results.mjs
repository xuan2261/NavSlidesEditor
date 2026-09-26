import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

export const COVERAGE_FLOORS = Object.freeze({
  lines: 74,
  branches: 60,
  functions: 68,
  statements: 71,
})

function canonicalFile(file) {
  const normalized = file.replaceAll('\\', '/')
  if (/^[a-zA-Z]:\//.test(normalized)) {
    return `${normalized[0].toLowerCase()}${normalized.slice(1)}`
  }
  return path.resolve(file).replaceAll('\\', '/')
}

function sameShape(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function addCounters(target, source, label) {
  for (const [key, value] of Object.entries(source)) {
    if (!(key in target)) throw new Error(`incompatible ${label} counter ${key}`)
    if (Array.isArray(value)) {
      if (!Array.isArray(target[key]) || target[key].length !== value.length) {
        throw new Error(`incompatible ${label} counter ${key}`)
      }
      target[key] = target[key].map((count, index) => count + value[index])
    } else {
      target[key] += value
    }
  }
}

function mergeFileCoverage(target, source, file) {
  for (const mapName of ['statementMap', 'fnMap', 'branchMap']) {
    if (!sameShape(target[mapName], source[mapName])) {
      throw new Error(`incompatible coverage map for ${file}: ${mapName}`)
    }
  }
  addCounters(target.s, source.s, 'statement')
  addCounters(target.f, source.f, 'function')
  addCounters(target.b, source.b, 'branch')
}

export function mergeProjectCoverage(projects, expectedProjects = []) {
  const names = new Set()
  const merged = {}
  for (const { projectName, coverageMap } of projects) {
    if (!projectName || names.has(projectName)) {
      throw new Error(`duplicate or missing coverage project: ${projectName || '<missing>'}`)
    }
    names.add(projectName)
    for (const [reportedFile, record] of Object.entries(coverageMap || {})) {
      const file = canonicalFile(record.path || reportedFile)
      const next = structuredClone({ ...record, path: file })
      if (merged[file]) mergeFileCoverage(merged[file], next, file)
      else merged[file] = next
    }
  }
  const missing = expectedProjects.filter((name) => !names.has(name))
  if (missing.length) throw new Error(`missing coverage project(s): ${missing.join(', ')}`)
  return merged
}

function metric(total, covered) {
  const pct = total === 0 ? 100 : Math.floor((covered / total) * 10_000) / 100
  return { total, covered, skipped: 0, pct }
}

export function summarizeCoverage(coverageMap) {
  let statements = 0
  let coveredStatements = 0
  let functions = 0
  let coveredFunctions = 0
  let branches = 0
  let coveredBranches = 0
  const lines = new Map()
  for (const record of Object.values(coverageMap)) {
    for (const [key, hits] of Object.entries(record.s)) {
      statements += 1
      if (hits > 0) coveredStatements += 1
      const line = record.statementMap[key]?.start?.line
      const lineKey = `${record.path}:${line}`
      if (line != null) lines.set(lineKey, Math.max(lines.get(lineKey) || 0, hits))
    }
    for (const hits of Object.values(record.f)) {
      functions += 1
      if (hits > 0) coveredFunctions += 1
    }
    for (const hits of Object.values(record.b)) {
      branches += hits.length
      coveredBranches += hits.filter((count) => count > 0).length
    }
  }
  return {
    lines: metric(lines.size, [...lines.values()].filter((hits) => hits > 0).length),
    statements: metric(statements, coveredStatements),
    functions: metric(functions, coveredFunctions),
    branches: metric(branches, coveredBranches),
  }
}

export function buildCoverageSummary(coverageMap) {
  const report = { total: summarizeCoverage(coverageMap) }
  for (const [file, record] of Object.entries(coverageMap)) {
    report[file] = summarizeCoverage({ [file]: record })
  }
  return report
}

export function assertCoverageSummary(summary, floors = COVERAGE_FLOORS) {
  for (const [name, floor] of Object.entries(floors)) {
    const actual = summary?.[name]?.pct
    if (!Number.isFinite(actual) || actual < floor) {
      throw new Error(`${name} coverage ${actual ?? 'missing'} is below ${floor}`)
    }
  }
  return summary
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  const { values } = parseArgs({
    options: {
      project: { type: 'string', multiple: true },
      out: { type: 'string' },
      summary: { type: 'string' },
      requireProject: { type: 'string', multiple: true },
    },
  })
  if (!values.project?.length || !values.out || !values.summary) {
    throw new Error('Usage: coverage-results --project name=file --out file --summary file')
  }
  const projects = values.project.map((item) => {
    const separator = item.indexOf('=')
    if (separator < 1) throw new Error(`invalid --project value: ${item}`)
    return {
      projectName: item.slice(0, separator),
      coverageMap: JSON.parse(readFileSync(item.slice(separator + 1), 'utf8')),
    }
  })
  const merged = mergeProjectCoverage(projects, values.requireProject || [])
  const summary = buildCoverageSummary(merged)
  assertCoverageSummary(summary.total)
  writeFileSync(values.out, `${JSON.stringify(merged)}\n`)
  writeFileSync(values.summary, `${JSON.stringify(summary, null, 2)}\n`)
}
