import { expect } from '@playwright/test'
import { selectGeneratedSlide } from './release-surfaces.js'

export const desktopPolicyElement = {
  id: 'desktop-policy-probe',
  type: 'html',
  x: 80,
  y: 40,
  width: 780,
  height: 440,
  zIndex: 1,
  htmlDependencies: { network: false, offlineCapable: true, resources: [], dynamicResources: [] },
  content: `<style>#inline{color:#2563eb;font-size:28px}button{font-size:24px}output{display:block}</style>
  <p id="inline">Inline desktop content</p><button id="probe">Probe runtime policy</button><output id="observed"></output>
  <script>
  const observed={inline:true,evalBlocked:false,functionBlocked:false,fetchBlocked:false,socketBlocked:false,violations:[]};
  const update=()=>document.querySelector('#observed').textContent=JSON.stringify(observed);update();
  document.addEventListener('securitypolicyviolation',event=>{observed.violations.push({directive:event.effectiveDirective,uri:event.blockedURI});update()});
  document.querySelector('#probe').onclick=()=>{
    try{eval('1+1')}catch(error){observed.evalBlocked=true}
    try{new Function('return 2')()}catch(error){observed.functionBlocked=true}
    fetch('https://education.invalid/undeclared').then(()=>update(),()=>{observed.fetchBlocked=true;update()});
    try{const socket=new WebSocket('wss://education.invalid/undeclared');socket.onerror=()=>{observed.socketBlocked=true;update()}}catch(error){observed.socketBlocked=true}
    update();
  };
  </script>`,
}
export async function probeDesktopPolicy(page, application) {
  const traffic = await application.evaluateHandle(({ session }) => {
    const reached = []
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ['https://education.invalid/*', 'wss://education.invalid/*'] },
      (details, callback) => {
        reached.push({ url: details.url, resourceType: details.resourceType })
        callback({ cancel: true })
      }
    )
    return reached
  })
  let frame, identity
  try {
    await selectGeneratedSlide(page, 1)
    await expect(page.locator('[data-ns-effective-slide-id="desktop-policy"]')).toHaveClass(
      /\bpresent\b/
    )
    // Native frame discovery does not depend on CDP exposing opaque descendants.
    await expect
      .poll(async () => {
        identity = await application.evaluate(async ({ BrowserWindow }, url) => {
          const window = BrowserWindow.getAllWindows().find(
            (window) => window.webContents.getURL().split('#')[0] === url
          )
          if (!window) throw new Error(`Native presenter window not found: ${url}`)
          for (const child of window.webContents.mainFrame.framesInSubtree) {
            if (child.isDestroyed()) continue
            if (
              await child.executeJavaScript(
                "Boolean(document.getElementById('probe') && document.getElementById('observed')?.textContent)"
              )
            ) {
              return {
                processId: child.processId,
                routingId: child.routingId,
                frameTreeNodeId: child.frameTreeNodeId,
                url: child.url,
              }
            }
          }
          return null
        }, page.url().split('#')[0])
        return Boolean(identity)
      })
      .toBe(true)
    frame = await application.evaluateHandle(({ webFrameMain }, identity) => {
      const frame = webFrameMain.fromId(identity.processId, identity.routingId)
      if (!frame || frame.isDestroyed())
        throw new Error('Native policy frame was destroyed before interaction')
      return frame
    }, identity)
    const geometry = await frame.evaluate((frame) =>
      frame.executeJavaScript(`(() => {
      const rect = document.getElementById('probe').getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
        viewportWidth: innerWidth, viewportHeight: innerHeight,
        color: getComputedStyle(document.getElementById('inline')).color };
    })()`)
    )
    expect(geometry.color).toBe('rgb(37, 99, 235)')
    const outer = await page
      .locator('[data-ns-element-id="desktop-policy-probe"] iframe')
      .boundingBox()
    if (!outer || geometry.width <= 0 || geometry.height <= 0)
      throw new Error('Native policy button has no visible bounds')
    // Click through Chromium's input path; native inspection never sets probe results.
    await page.mouse.click(
      outer.x + ((geometry.x + geometry.width / 2) * outer.width) / geometry.viewportWidth,
      outer.y + ((geometry.y + geometry.height / 2) * outer.height) / geometry.viewportHeight
    )
    const readObserved = () =>
      frame.evaluate((frame) =>
        frame.executeJavaScript("JSON.parse(document.getElementById('observed').textContent)")
      )
    await expect
      .poll(async () => {
        const observed = await readObserved()
        return {
          evalBlocked: observed.evalBlocked,
          functionBlocked: observed.functionBlocked,
          fetchBlocked: observed.fetchBlocked,
          socketBlocked: observed.socketBlocked,
          connectSrcDenials:
            observed.violations.filter((item) => item.directive === 'connect-src').length >= 2,
          scriptSrcDenial: observed.violations.some((item) =>
            item.directive.startsWith('script-src')
          ),
        }
      })
      .toEqual({
        evalBlocked: true,
        functionBlocked: true,
        fetchBlocked: true,
        socketBlocked: true,
        connectSrcDenials: true,
        scriptSrcDenial: true,
      })
    const reached = await traffic.jsonValue()
    expect(
      reached,
      'Actual native networking must reject undeclared traffic before the safety abort hook'
    ).toEqual([])
    return {
      ...(await readObserved()),
      inlineCss: geometry.color,
      nativeFrame: identity,
      observedRequestAttempts: reached
        .filter((request) => request.url.startsWith('https:'))
        .map((request) => request.url),
      observedSocketAttempts: reached
        .filter((request) => request.url.startsWith('wss:'))
        .map((request) => request.url),
      reachedNetwork: reached.map((request) => request.url),
    }
  } finally {
    try {
      await application.evaluate(({ session }) =>
        session.defaultSession.webRequest.onBeforeRequest(null)
      )
    } finally {
      await frame?.dispose()
      await traffic.dispose()
    }
  }
}
