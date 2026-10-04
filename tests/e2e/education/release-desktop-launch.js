import fs from 'node:fs/promises'
import path from 'node:path'
import { _electron, expect, request as apiRequest } from '@playwright/test'
import electronExecutable from 'electron'
import { identifyLane } from '../../../scripts/feature-inventory/education-artifact-identities.mjs'
import {
  verifyPackageStage,
  verifyPackagedSources,
} from '../../../scripts/feature-inventory/education-package-sources.mjs'

const root = path.resolve(__dirname, '../../..')
export async function launchDesktop(lane, testInfo) {
  const packaged = lane === 'windows-packaged'
  if (packaged && process.platform !== 'win32')
    throw new Error(
      'Actual Windows runtime is required; packaged qualification cannot be skipped or emulated.'
    )
  const executablePath = packaged ? process.env.NAVSLIDES_PACKAGED_EXE : electronExecutable
  if (!executablePath)
    throw new Error('NAVSLIDES_PACKAGED_EXE must name the newly emitted staged Windows executable.')
  const userData = testInfo.outputPath('qualification-electron-user-data')
  await fs.mkdir(userData, { recursive: true })
  const env = { ...process.env, NAVSLIDES_EDUCATION_USER_DATA_DIR: userData }
  delete env.ELECTRON_RUN_AS_NODE
  let application
  try {
    application = await _electron.launch({
      executablePath,
      cwd: root,
      args: packaged ? [] : [path.join(root, 'electron/main.js')],
      env,
      timeout: 60000,
    })
    const page = await application.firstWindow({ timeout: 60000 })
    await page.waitForURL('http://127.0.0.1:3002/**')
    const runtime = await application.evaluate(({ app }) => ({
      isPackaged: app.isPackaged,
      executablePath: process.execPath,
      resources: process.resourcesPath,
      chromiumVersion: process.versions.chrome,
      electronVersion: process.versions.electron,
      userData: app.getPath('userData'),
      data: process.env.SLIDES_DATA_DIR,
      uploads: process.env.SLIDES_UPLOADS_DIR,
    }))
    expect(path.resolve(runtime.userData)).toBe(path.resolve(userData))
    expect(path.resolve(runtime.data)).toBe(path.join(path.resolve(userData), 'data'))
    expect(path.resolve(runtime.uploads)).toBe(path.join(path.resolve(userData), 'uploads'))
    expect(runtime.isPackaged).toBe(packaged)
    expect(path.resolve(runtime.executablePath)).toBe(path.resolve(executablePath))
    const context = process.env.NAVSLIDES_EDUCATION_CONTEXT
      ? JSON.parse(await fs.readFile(process.env.NAVSLIDES_EDUCATION_CONTEXT, 'utf8'))
      : null
    if (packaged && !context)
      throw new Error(
        'Packaged runtime requires the updated main frozen context, not a fabricated or stale package receipt.'
      )
    if (packaged && !process.env.NAVSLIDES_EDUCATION_PACKAGE_RECEIPT)
      throw new Error(
        'NAVSLIDES_EDUCATION_PACKAGE_RECEIPT is required for actual packaged runtime observations.'
      )
    const identity = identifyLane(root, lane, {
      exe: runtime.executablePath,
      installer: process.env.NAVSLIDES_PACKAGED_INSTALLER,
      resources: runtime.resources,
      browserVersion: runtime.chromiumVersion,
      context,
    })
    let embeddedSources = null
    if (context) {
      expect(identity.artifactHashes).toEqual(context.lanes[lane].artifactHashes)
      expect(runtime.chromiumVersion).toBe(context.lanes[lane].browserVersion)
    }
    if (packaged) {
      expect(path.resolve(process.env.NAVSLIDES_PACKAGED_INSTALLER)).toBe(
        context.lanes[lane].artifactPaths.installer
      )
      await verifyPackageStage(context, {
        resources: runtime.resources,
        installer: process.env.NAVSLIDES_PACKAGED_INSTALLER,
        exe: runtime.executablePath,
      })
      embeddedSources = verifyPackagedSources(root, context, runtime.resources)
    }
    const request = await apiRequest.newContext({ baseURL: new URL(page.url()).origin })
    return { application, page, request, runtime, identity, embeddedSources, userData }
  } catch (error) {
    if (application) await application.close()
    throw error
  }
}
export async function closeDesktop(desktop) {
  try {
    await desktop.request.dispose()
  } finally {
    await desktop.application.close()
  }
}
