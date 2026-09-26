const PROCESS_COUNT_ENV_NAMES = Object.freeze([
  'NAVSLIDES_WORKERS',
  'WEB_CONCURRENCY',
  'PM2_INSTANCES',
  'INSTANCE_COUNT',
  'CLUSTER_WORKERS',
])

function unsupportedTopologyError() {
  return Object.assign(new Error('UNSUPPORTED_MULTI_PROCESS_TOPOLOGY'), {
    code: 'UNSUPPORTED_MULTI_PROCESS_TOPOLOGY',
  })
}

function isSingleProcessCount(value) {
  if (value === undefined || value === null || String(value).trim() === '') return true
  return String(value).trim() === '1'
}

function assertSingleProcessTopology(env = process.env, processLike = process) {
  if (processLike.NODE_UNIQUE_ID || env.NODE_UNIQUE_ID) throw unsupportedTopologyError()
  for (const name of PROCESS_COUNT_ENV_NAMES) {
    if (!isSingleProcessCount(env[name])) throw unsupportedTopologyError()
  }
}

module.exports = {
  PROCESS_COUNT_ENV_NAMES,
  assertSingleProcessTopology,
}
