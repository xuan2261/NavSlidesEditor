import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)
const headed = args.includes('--headed')
const strict = args.includes('--strict')
const scopeArg = args.find((arg) => arg.startsWith('--scope='))
const decksArg = args.find((arg) => arg.startsWith('--decks='))

const env = { ...process.env }
if (strict) env.PPTX_IMPORT_AUDIT_STRICT = '1'
if (scopeArg) env.PPTX_IMPORT_AUDIT_SCOPE = scopeArg.slice('--scope='.length)
if (decksArg) env.PPTX_IMPORT_AUDIT_DECKS = decksArg.slice('--decks='.length)

const playwrightArgs = [
  'playwright',
  'test',
  'tests/e2e/pptx-import-real-browser-audit.spec.js',
  '--project=chromium',
  '--workers=1',
  '--retries=0',
  '--reporter=line',
]
if (headed) playwrightArgs.push('--headed')

const result = spawnSync('npx', playwrightArgs, {
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

process.exit(result.status ?? 1)
