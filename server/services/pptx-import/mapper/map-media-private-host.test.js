const { gateExternalMediaUrl } = require('./map-media')

const ORIGINS = 'PPTX_IMPORT_MEDIA_ORIGINS'
let previous

beforeEach(() => {
  previous = process.env[ORIGINS]
})

afterEach(() => {
  if (previous === undefined) delete process.env[ORIGINS]
  else process.env[ORIGINS] = previous
})

function gate(url) {
  const context = { warnings: [] }
  return { result: gateExternalMediaUrl(url, context), context }
}

/**
 * The origin allowlist is empty by default, so it blocks everything on its own.
 * Allowlisting the origin under test isolates the private-host check, which is
 * the layer that has to hold when an administrator opts an origin in.
 */
function gateWithOriginAllowed(url) {
  process.env[ORIGINS] = new URL(url).origin
  return gate(url)
}

describe('private-host gate for allowlisted origins', () => {
  // URL parsing rewrites ::ffff:127.0.0.1 to ::ffff:7f00:1, so an allowlist
  // entry never looks like loopback by the time it is compared.
  it.each([
    ['IPv4-mapped loopback', 'http://[::ffff:127.0.0.1]/a.png'],
    ['IPv4-mapped private range', 'http://[0:0:0:0:0:ffff:10.0.0.5]/a.png'],
    ['IPv4-mapped link-local metadata', 'http://[::ffff:169.254.169.254]/latest/meta-data'],
    ['NAT64 translation prefix', 'http://[64:ff9b::127.0.0.1]/a.png'],
    ['unspecified address', 'http://[::]/a.png'],
    ['IPv6 loopback', 'http://[::1]/a.png'],
    ['unique local address', 'http://[fd00::1]/a.png'],
  ])('blocks %s even when its origin is allowlisted', (_label, url) => {
    const { result, context } = gateWithOriginAllowed(url)

    expect(result).toBeNull()
    expect(context.warnings[0]).toMatchObject({ code: 'media-external-url-blocked' })
  })

  it('still allows a public origin the administrator opted in to', () => {
    const { result } = gateWithOriginAllowed('http://[2606:4700::1111]/a.png')

    expect(result).toBe('http://[2606:4700::1111]/a.png')
  })

  it('blocks a public origin that was never allowlisted', () => {
    delete process.env[ORIGINS]

    expect(gate('https://cdn.example.com/a.png').result).toBeNull()
  })
})
