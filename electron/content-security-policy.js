// Desktop renderer policy: Reveal and editable HTML intentionally use inline JS/CSS.
// Dynamic evaluation remains disabled; local assets and embedded media are allowed.
const DESKTOP_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' blob: https:",
  "style-src 'self' 'unsafe-inline' https:",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https:",
  "media-src 'self' data: blob: https:",
  "connect-src 'self' ws://127.0.0.1:3002 https: wss:",
  "frame-src 'self' data: blob: https:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ')

function withDesktopCsp(responseHeaders = {}) {
  if (Object.keys(responseHeaders).some((name) => name.toLowerCase() === 'content-security-policy')) {
    return responseHeaders
  }
  return { ...responseHeaders, 'Content-Security-Policy': [DESKTOP_CSP] }
}

module.exports = { DESKTOP_CSP, withDesktopCsp }
