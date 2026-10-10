const path = require('node:path')
const lanes = ['electron-dev', 'windows-packaged']
const desktopSpec = /tests[\\/]e2e[\\/]education[\\/]desktop-runtime-release\.spec\.js$/

function desktopProjects() {
  return lanes.map((lane) => ({
    name: lane,
    testMatch: desktopSpec,
    workers: 1,
    metadata: { educationDesktopLane: lane },
    use: { browserName: 'chromium' },
  }))
}
function desktopLane(project) {
  const lane = project.metadata?.educationDesktopLane
  if (!lanes.includes(lane) || project.name !== lane) {
    throw new Error(
      'The real desktop specification requires the explicit electron-dev or windows-packaged project and matching lane metadata; desktop qualification cannot be skipped.'
    )
  }
  return lane
}
function qualificationReporters(reporters, env = process.env, args = process.argv) {
  if (!env.NAVSLIDES_EDUCATION_CONTEXT) return reporters
  if (args.some((arg) => arg === '--reporter' || arg.startsWith('--reporter='))) {
    throw new Error(
      'Frozen education qualification rejects CLI reporter overrides; use the configured evidence reporter.'
    )
  }
  return [...reporters, [path.join(__dirname, 'release-evidence-reporter.js')]]
}
module.exports = { desktopProjects, desktopLane, qualificationReporters }
