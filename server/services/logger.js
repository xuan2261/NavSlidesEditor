// Level-gated wrapper over console. LOG_LEVEL env selects the minimum level
// (error|warn|info|debug, default info); sinks stay on console so existing
// output streams and test spies keep working.
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 }
const configured = LEVELS[String(process.env.LOG_LEVEL || 'info').toLowerCase()]
const threshold = configured === undefined ? LEVELS.info : configured

const enabled = (level) => LEVELS[level] <= threshold

module.exports = {
  error: (...args) => { if (enabled('error')) console.error(...args) },
  warn: (...args) => { if (enabled('warn')) console.warn(...args) },
  info: (...args) => { if (enabled('info')) console.log(...args) },
  log: (...args) => { if (enabled('info')) console.log(...args) },
  debug: (...args) => { if (enabled('debug')) console.debug(...args) },
}
