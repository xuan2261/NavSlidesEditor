import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ROOT, policyIdentity } from './education-release-policy.mjs'
import {
  createSubject,
  assertFrozenSubject,
  stageQualification,
} from './education-qualification-stage.mjs'
import { identifyLane } from './education-artifact-identities.mjs'
import { verifyPackagedSources, verifyPackageStage } from './education-package-sources.mjs'

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const value = (args, key) => {
  const at = args.indexOf(key)
  return at < 0 ? undefined : args[at + 1]
}
export async function prepareQualification(args, root = ROOT) {
  const output = resolve(
    value(args, '--output') ||
      value(args, '--context') ||
      process.env.NAVSLIDES_EDUCATION_CONTEXT ||
      resolve(root, '.tmp/education-qualification-context.json')
  )
  if (args.includes('--freeze')) {
    if (existsSync(output)) throw new Error(`Frozen context collision: ${output}`)
    const runId = value(args, '--run-id')
    if (!runId || !/^[\w.-]{1,120}$/.test(runId))
      throw new Error('Supply a unique --run-id (letters, digits, dots, hyphens).')
    const { policyHash } = await policyIdentity(root)
    const context = {
      schemaVersion: 1,
      runId,
      ...createSubject(root),
      policyHash,
      frozenAt: new Date().toISOString(),
      lanes: {},
    }
    mkdirSync(dirname(output), { recursive: true })
    writeFileSync(output, JSON.stringify(context, null, 2) + '\n', { flag: 'wx' })
    return { contextPath: output, runId, subjectHash: context.subjectHash, policyHash }
  }
  const context = readJson(output)
  assertFrozenSubject(root, context)
  if (context.policyHash !== (await policyIdentity(root)).policyHash)
    throw new Error('Frozen required-cell policy changed.')
  const stagePath = value(args, '--stage')
  if (stagePath) {
    const result = stageQualification(root, resolve(stagePath), context)
    writeFileSync(
      resolve(result.stage, 'education-qualification-context.json'),
      JSON.stringify(context, null, 2) + '\n',
      { flag: 'wx' }
    )
    return result
  }
  const lane = value(args, '--artifacts')
  if (!lane) throw new Error('Use --freeze, --stage <new path>, or --artifacts <lane>.')
  const options = {
    context,
    installer: value(args, '--installer'),
    exe: value(args, '--exe'),
    resources: value(args, '--resources'),
    browserVersion: value(args, '--browser-version'),
    projects: value(args, '--projects')?.split(','),
    origins: value(args, '--origins')?.split(','),
  }
  if (lane === 'windows-packaged') {
    await verifyPackageStage(context, options)
    verifyPackagedSources(root, context, options.resources)
  }
  context.lanes[lane] = identifyLane(root, lane, options)
  writeFileSync(output, JSON.stringify(context, null, 2) + '\n')
  return { contextPath: output, lane, artifactHashes: context.lanes[lane].artifactHashes }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(await prepareQualification(process.argv.slice(2)), null, 2))
  } catch (error) {
    console.error(`[education-qualification] ${error.message}`)
    process.exitCode = 1
  }
}
