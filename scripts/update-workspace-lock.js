const path = require('node:path')
const { resolveWorkspaceLock, syncWorkspaceLock } = require('./workspace-lock')

const root = path.join(__dirname, '..')

if (process.argv.includes('--resolve')) {
  resolveWorkspaceLock(root)
  console.log('Workspace lock dependency graph regenerated from complete temporary workspace')
} else {
  const result = syncWorkspaceLock(root)
  console.log(
    result.changedFields.length > 0
      ? `Workspace lock version metadata updated: ${result.changedFields.join(', ')}`
      : 'Workspace lock version metadata already current'
  )
}
