const { spawn } = require('child_process')
const path = require('path')

const nodeDir = 'C:\\nvm4w\\nodejs'
process.env.PATH = `${nodeDir};${process.env.PATH || ''}`
process.env.PLAYWRIGHT_JSON_OUTPUT_FILE = path.resolve(__dirname, '../plans/261009-0901-navslides-full-reliability-deep-tdd/reports/p10-e2e-portable-20261106-run1.json')

const playwrightCli = path.resolve(__dirname, '../node_modules/@playwright/test/cli.js')
const args = [
  playwrightCli,
  'test',
  'tests/e2e/export/portable-package-real-browser.spec.js',
  'tests/e2e/export/portable-package-export-refusals.spec.js',
  '--project=chromium',
  '--workers=1',
  '--retries=0',
  '--reporter=json',
  '--output=plans/261009-0901-navslides-full-reliability-deep-tdd/reports/browser-p10-e2e-run1'
]

console.log(`[run-p10-e2e] Spawning Playwright with Node: ${process.execPath}`)
console.log(`[run-p10-e2e] Receipt target: ${process.env.PLAYWRIGHT_JSON_OUTPUT_FILE}`)

const child = spawn(process.execPath, args, {
  stdio: 'inherit',
  env: process.env,
  cwd: path.resolve(__dirname, '..')
})

child.on('exit', (code, signal) => {
  console.log(`[run-p10-e2e] Playwright child exited with code ${code}, signal ${signal}`)
  process.exit(code ?? 0)
})
