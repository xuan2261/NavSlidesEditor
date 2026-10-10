function originError() {
  return Object.assign(new Error('Project import requires the same-origin private editor'), {
    code: 'PROJECT_IMPORT_ORIGIN_REJECTED',
    status: 403,
  })
}

function assertPrivateEditorOrigin(req, { allowReadNavigation = false } = {}) {
  const host = req.get('host')
  let origin = req.get('origin')
  if (!origin && allowReadNavigation && req.method === 'GET' && req.get('sec-fetch-site') === 'same-origin') {
    try { origin = new URL(req.get('referer')).origin } catch { throw originError() }
  }
  if (!host || !origin) throw originError()
  let parsed
  try {
    parsed = new URL(origin)
  } catch {
    throw originError()
  }
  if (parsed.host.toLowerCase() !== host.toLowerCase() ||
      !['http:', 'https:'].includes(parsed.protocol)) {
    throw originError()
  }
  const fetchSite = req.get('sec-fetch-site')
  if (fetchSite && fetchSite !== 'same-origin') throw originError()
  const referer = req.get('referer')
  if (referer) {
    let refererUrl
    try {
      refererUrl = new URL(referer)
    } catch {
      throw originError()
    }
    if (refererUrl.origin !== parsed.origin ||
        /^\/(?:share|live|remote|speaker|player|game)(?:\/|$)/u.test(refererUrl.pathname)) {
      throw originError()
    }
  }
}

// The default preserves function.length === 3, required for normal Express middleware.
function privateEditorOnly(req, res, next, options = undefined) {
  try {
    assertPrivateEditorOrigin(req, options)
    next()
  } catch (error) {
    res.status(error.status).json({ error: error.message, code: error.code })
  }
}

module.exports = { assertPrivateEditorOrigin, privateEditorOnly }
