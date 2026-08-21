const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const root = path.join(__dirname, '..')
const temporaryDir = path.join(root, '.workspace-lock-tmp')
const workspaces = ['client', 'server', 'shared', 'website']
const npmInvocation = (args) =>
  process.platform === 'win32'
    ? { command: process.env.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c', 'npm', ...args] }
    : { command: 'npm', args }

fs.rmSync(temporaryDir, { force: true, recursive: true })
fs.mkdirSync(temporaryDir, { recursive: true })

try {
  fs.copyFileSync(path.join(root, 'package.json'), path.join(temporaryDir, 'package.json'))
  for (const workspace of workspaces) {
    const destination = path.join(temporaryDir, workspace)
    fs.mkdirSync(destination, { recursive: true })
    fs.copyFileSync(
      path.join(root, workspace, 'package.json'),
      path.join(destination, 'package.json')
    )
  }

  const npm = npmInvocation(['install', '--package-lock-only', '--ignore-scripts'])
  execFileSync(npm.command, npm.args, { cwd: temporaryDir, stdio: 'inherit' })
  const generatedLock = path.join(temporaryDir, 'package-lock.json')
  const lock = JSON.parse(fs.readFileSync(generatedLock, 'utf8'))
  if (lock.lockfileVersion !== 3 || !lock.packages?.client) {
    throw new Error('Generated workspace lock is incomplete')
  }
  fs.copyFileSync(generatedLock, path.join(root, 'package-lock.json'))
  console.log('Workspace package-lock.json regenerated from manifests')
} finally {
  fs.rmSync(temporaryDir, { force: true, recursive: true })
}
