const path = require('path')

function overlaps(a, b) {
  const relative = path.relative(a, b)
  return (
    relative === '' ||
    (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  )
}
function resolveQualificationProfile(value, normalProfile) {
  if (value === undefined) return undefined
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value !== value.trim() ||
    value.includes('\0') ||
    !path.isAbsolute(value) ||
    value.split(/[\\/]/).includes('..')
  ) {
    throw new Error(
      'NAVSLIDES_EDUCATION_USER_DATA_DIR requires an absolute dedicated directory without traversal.'
    )
  }
  const resolved = path.resolve(value)
  if (
    resolved === path.parse(resolved).root ||
    overlaps(path.resolve(normalProfile), resolved) ||
    overlaps(resolved, path.resolve(normalProfile))
  ) {
    throw new Error(
      'The qualification profile must not overlap the filesystem root or normal Electron user data.'
    )
  }
  return resolved
}
module.exports = { resolveQualificationProfile }
