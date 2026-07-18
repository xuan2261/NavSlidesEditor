const REQUIRED_ENV = Object.freeze({
  OFFICECLI_NO_AUTO_RESIDENT: '1',
  OFFICECLI_SKIP_UPDATE: '1',
})

const ALLOWED_ENV = new Set([
  'SystemRoot',
  'WINDIR',
  'TEMP',
  'TMP',
  'LOCALAPPDATA',
  'LANG',
  'LC_ALL',
])

function buildOfficeCliEnv(baseEnv = process.env) {
  const env = {}
  for (const [key, value] of Object.entries(baseEnv)) {
    if (ALLOWED_ENV.has(key) && typeof value === 'string') env[key] = value
  }
  return { ...env, ...REQUIRED_ENV }
}

function buildSpawnOptions({ env = process.env, cwd } = {}) {
  return {
    cwd,
    env: buildOfficeCliEnv(env),
    shell: false,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  }
}

module.exports = { ALLOWED_ENV, REQUIRED_ENV, buildOfficeCliEnv, buildSpawnOptions }
