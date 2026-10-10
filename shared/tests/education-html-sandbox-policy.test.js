import { describe, expect, it } from 'vitest'
import { JSDOM } from 'jsdom'
import {
  buildSandboxCsp,
  buildSandboxDocument,
  buildSandboxFrameDocument,
  validateHtmlDependencies,
} from '../src/education/html-sandbox-policy.js'

const local = { network: false, offlineCapable: true, resources: [], dynamicResources: [] }
describe('authored HTML dependency capabilities', () => {
  it('does not certify undeclared script capability', () => {
    expect(validateHtmlDependencies(undefined)).toBeUndefined()
    const policy = buildSandboxCsp()
    expect(policy).toContain("connect-src 'none'")
    expect(policy).toContain("script-src 'unsafe-inline'")
    expect(policy).not.toContain('unsafe-eval')
  })
  it('preserves authored local script and DOM behavior', () => {
    const content =
      '<button>Count</button><script>window.counter=7;document.querySelector("button").textContent="Count "+window.counter</script>'
    const dom = new JSDOM(buildSandboxDocument(content, local), { runScripts: 'dangerously' })
    expect(dom.window.counter).toBe(7)
    expect(dom.window.document.querySelector('button').textContent).toBe('Count 7')
    expect(dom.window.document.querySelector('meta[http-equiv]').getAttribute('content')).toContain(
      "connect-src 'none'"
    )
    dom.window.close()
  })
  it('keeps authored markup out of the trusted container and preserves child capability metadata', () => {
    const content =
      '</iframe><meta http-equiv="Content-Security-Policy" content="default-src *"><button>Count</button><script>window.marker="child";document.querySelector("button").textContent="Local ✓"</script>'
    const outer = new JSDOM(buildSandboxFrameDocument(content, local), {
      runScripts: 'dangerously',
    })
    expect(outer.window.marker).toBeUndefined()
    expect(outer.window.document.querySelector('button, script')).toBeNull()
    const frame = outer.window.document.querySelector('iframe')
    expect(frame.getAttribute('sandbox').split(/\s+/)).toEqual(['allow-scripts'])
    expect(JSON.parse(frame.getAttribute('data-html-dependencies'))).toEqual(local)
    const child = new JSDOM(frame.getAttribute('srcdoc'), { runScripts: 'dangerously' })
    const policies = [
      ...child.window.document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]'),
    ]
    expect(policies[0].content.split(';').map((directive) => directive.trim())).toContain(
      "connect-src 'none'"
    )
    expect(policies[1].content).toBe('default-src *')
    expect(child.window.marker).toBe('child')
    expect(child.window.document.querySelector('button').textContent).toBe('Local ✓')
    child.window.close()
    outer.window.close()
  })
  it('grants each declared origin only its actual capability', () => {
    const policy = buildSandboxCsp(
      {
        network: true,
        offlineCapable: false,
        resources: [
          { url: 'https://images.example/a.png', kind: 'image' },
          { url: '/vendor/a.js', kind: 'script' },
        ],
        dynamicResources: [{ url: 'https://api.example/data', kind: 'connect' }],
      },
      { baseUrl: 'https://slides.example/deck' }
    )
    expect(policy).toContain('img-src data: blob: https://images.example')
    expect(policy).toContain("script-src 'unsafe-inline' https://slides.example")
    expect(policy).toContain('connect-src https://api.example')
    expect(policy).toContain("worker-src 'none'")
    expect(policy).not.toContain('https://images.example https://api.example')
  })
  it.each([
    { ...local, surprise: true },
    { ...local, network: 'false' },
    { ...local, resources: [{ url: 'javascript:alert(1)', kind: 'script' }] },
    { ...local, resources: [{ url: 'https://x.example', kind: 'anything' }] },
    { ...local, resources: [{ url: 'https://u:p@x.example', kind: 'image' }] },
    { ...local, resources: Array(1) },
    { ...local, resources: Object.assign([], { authority: true }) },
    {
      ...local,
      dynamicResources: Array.from({ length: 257 }, () => ({ url: '/x', kind: 'image' })),
    },
    JSON.parse(
      '{"network":false,"offlineCapable":true,"resources":[],"dynamicResources":[],"__proto__":{}}'
    ),
  ])('rejects invalid dependency declarations at the boundary', (metadata) => {
    expect(() => validateHtmlDependencies(metadata)).toThrow()
  })
  it('requires a resolvable base for hosted relative capabilities', () => {
    expect(() =>
      buildSandboxCsp({ ...local, network: true, resources: [{ url: '/x', kind: 'script' }] })
    ).toThrow(/base/i)
  })
})
