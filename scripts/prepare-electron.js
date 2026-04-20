/**
 * Prepare server dependencies for Electron packaging.
 *
 * Problem: npm workspaces hoist all deps to root node_modules/, so running
 * `npm install` inside server/ only installs packages that differ from root.
 * This leaves express/cors/etc. missing from server/node_modules/.
 *
 * Solution: Create a temporary standalone directory, copy server/package.json
 * (without workspace dep), run npm install there, then move node_modules back.
 * This bypasses workspace hoisting entirely.
 *
 * NOTE: This script only uses Node.js built-in modules (fs, path, child_process)
 * to avoid circular dependency on packages that may not be installed yet.
 */
const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const ROOT = path.join(__dirname, '..')
const serverDir = path.join(ROOT, 'server')
const sharedDir = path.join(ROOT, 'shared')
const serverPkg = JSON.parse(fs.readFileSync(path.join(serverDir, 'package.json'), 'utf8'))

// ── Helpers (no fs-extra dependency) ────────────────────────────────────────
function rmSync(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true })
}

function mkdirpSync(p) {
  fs.mkdirSync(p, { recursive: true })
}

function copyDirSync(src, dest, filter) {
  mkdirpSync(dest)
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (filter && !filter(srcPath)) continue
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath, filter)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

// ── Step 1: Create isolated temp directory (outside workspace) ──────────────
const tmpDir = path.join(ROOT, '.electron-tmp')
rmSync(tmpDir)
mkdirpSync(tmpDir)

// Build package.json WITHOUT the workspace reference
const deps = { ...serverPkg.dependencies }
delete deps['revealjs-shared']

const isolatedPkg = {
  name: 'electron-server-deps',
  version: '1.0.0',
  private: true,
  dependencies: deps,
}

fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(isolatedPkg, null, 2))

// ── Step 2: Install deps in isolated directory ──────────────────────────────
console.log('Installing server production dependencies (isolated)...')
try {
  execSync('npm install --omit=dev --ignore-scripts', {
    cwd: tmpDir,
    stdio: 'inherit',
  })
} catch (err) {
  console.error('Failed to install server dependencies:', err.message)
  rmSync(tmpDir)
  process.exit(1)
}

// ── Step 3: Move node_modules to server/ ────────────────────────────────────
const serverNM = path.join(serverDir, 'node_modules')
rmSync(serverNM)
fs.renameSync(path.join(tmpDir, 'node_modules'), serverNM)

// ── Step 4: Copy shared/ workspace package ──────────────────────────────────
const targetShared = path.join(serverNM, 'revealjs-shared')
rmSync(targetShared)
copyDirSync(sharedDir, targetShared, (src) => {
  return !src.includes('node_modules') && !src.includes('.git')
})

// ── Step 5: Cleanup ─────────────────────────────────────────────────────────
rmSync(tmpDir)

// ── Step 6: Verify critical modules ─────────────────────────────────────────
const critical = ['express', 'cors', 'fs-extra', 'multer', 'uuid', 'revealjs-shared']
const missing = critical.filter((m) => !fs.existsSync(path.join(serverNM, m)))
if (missing.length > 0) {
  console.error(`✗ Missing critical modules: ${missing.join(', ')}`)
  process.exit(1)
}

console.log(`✓ All ${critical.length} critical modules verified`)
console.log('✓ Server dependencies ready for Electron packaging')
