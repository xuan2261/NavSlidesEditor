import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = path.resolve(__dirname, '..')
const backup = fs.readFileSync(path.join(root, 'scripts', 'backup-docker-volumes.ps1'), 'utf8')
const restore = fs.readFileSync(path.join(root, 'scripts', 'restore-docker-volumes.ps1'), 'utf8')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))

describe('Docker volume backup and restore contract', () => {
  it('backs up both persistent roots from one stopped consistency point', () => {
    expect(backup).toContain('/app/server/data')
    expect(backup).toContain('/app/server/uploads')
    expect(backup).toMatch(/compose.+ps.+running/is)
    expect(backup).toContain('Invoke-Compose @("stop", $Service)')
    expect(backup).toContain('[string]$Service = "revealjs-editor"')
    expect(backup).toContain('Get-FileHash')
    expect(backup).toContain('manifest.json')
    expect(backup).not.toMatch(/down\s+-v/i)
  })

  it('restarts from captured pre-state in finally and preserves both errors', () => {
    expect(backup).toMatch(/\$wasRunning/)
    expect(backup).toMatch(/finally\s*\{/)
    expect(backup).toMatch(/\$backupError/)
    expect(backup).toMatch(/\$restartError/)
    expect(backup).toContain('Invoke-Compose @("start", $Service)')
  })

  it('verifies hashes before empty-volume extraction and proves restored content', () => {
    expect(restore.indexOf('Get-FileHash')).toBeLessThan(restore.indexOf('tar -xzf'))
    expect(restore).toMatch(/target.+empty/is)
    expect(restore).toContain('presentations.json')
    expect(restore).toContain('pptx-originals')
    expect(restore).toContain('history')
    expect(restore).toContain('settings.json')
    expect(restore).toContain('/uploads/')
    expect(restore).not.toMatch(/down\s+-v/i)
  })

  it('exposes non-interactive package scripts', () => {
    expect(pkg.scripts['backup:docker']).toContain('backup-docker-volumes.ps1')
    expect(pkg.scripts['restore:docker']).toContain('restore-docker-volumes.ps1')
    expect(pkg.scripts['backup:docker']).toContain('-NonInteractive')
    expect(pkg.scripts['restore:docker']).toContain('-NonInteractive')
  })
})
