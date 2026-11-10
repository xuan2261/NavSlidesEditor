const { test, expect } = require('@playwright/test')
const {
  buildSandboxFrameDocument,
} = require('../../../shared/src/education/html-sandbox-policy.js')
const local = { network: false, offlineCapable: true, resources: [], dynamicResources: [] }
const attacks = {
  'location assignment': "location.href='https://proof-invalid.example/location'",
  'location assign': "location.assign('https://proof-invalid.example/assign')",
  'self-target anchor':
    "const a=document.createElement('a');a.href='https://proof-invalid.example/anchor';a.target='_self';document.body.append(a);a.click()",
  'meta refresh':
    "const m=document.createElement('meta');m.httpEquiv='refresh';m.content='0;url=https://proof-invalid.example/refresh';document.head.append(m)",
  'nested frame':
    "const f=document.createElement('iframe');f.src='https://proof-invalid.example/nested';document.body.append(f)",
}


for (const [name, attack] of Object.entries(attacks)) {
  test(`local opaque wrapper blocks ${name} before a network request`, async ({ page }) => {
    const requests = []
    await page.route('https://proof-invalid.example/**', (route) => {
      requests.push(route.request().url())
      return route.abort()
    })
    const source = `<button id="count">Count 0</button><button id="attack">Attempt navigation</button><script>
      let count=0;document.getElementById('count').onclick=()=>{
        try { parent.document.body.setAttribute('data-compromised','yes') } catch {}
        document.getElementById('count').textContent='Count '+(++count);
      };
      document.getElementById('attack').onclick=()=>{${attack}};
    </script>`
    const document = buildSandboxFrameDocument(source, local)
    await page.setContent('<main id="sentinel">Unchanged</main>')
    await page.evaluate((content) => {
      const frame = document.createElement('iframe')
      frame.setAttribute('sandbox', 'allow-scripts')
      frame.srcdoc = content
      document.body.append(frame)
    }, document)
    const counter = page
      .frameLocator('iframe')
      .frameLocator('iframe')
      .getByRole('button', { name: 'Count 0' })
    await counter.click()
    await expect(
      page.frameLocator('iframe').frameLocator('iframe').getByRole('button', { name: 'Count 1' })
    ).toBeVisible()
    const outer = page.frameLocator('iframe')
    const inner = outer.frameLocator('iframe')
    for (const frame of [outer, inner]) {
      await frame.locator('body').evaluate(() => {
        window.navigationViolations = []
        document.addEventListener('securitypolicyviolation', (event) => {
          window.navigationViolations.push({
            directive: event.effectiveDirective,
            blocked: event.blockedURI,
          })
        })
      })
    }
    await page
      .frameLocator('iframe')
      .frameLocator('iframe')
      .getByRole('button', { name: 'Attempt navigation' })
      .click()
    // Observe the browser's denial, not merely an unchanged request list.
    await expect
      .poll(async () => {
        const violations = await Promise.all(
          [outer, inner].map((frame) =>
            frame.locator('body').evaluate(() => window.navigationViolations)
          )
        )
        return violations
          .flat()
          .some(
            (event) =>
              event.directive === 'frame-src' &&
              event.blocked.startsWith('https://proof-invalid.example')
          )
      })
      .toBe(true)
    expect(requests).toEqual([])
    await expect(page.locator('body')).not.toHaveAttribute('data-compromised')
    await expect(page.getByText('Unchanged')).toBeVisible()
  })
}

