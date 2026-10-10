import {
  test,
  expect,
  apiUpdatePresentation,
  apiCreateShareLink,
} from '../fixtures/test-fixtures.js'
import { deckWith } from './release-game-fixtures.js'
import { isolationHtml, inspectIsolation } from './release-content-fields-html.js'
import { findFrame } from './release-surfaces.js'
import { recordCommon } from './common-runtime-evidence.js'

const policyHtml =
  isolationHtml +
  `<button id="local">Advance local lesson</button><output id="local-result">Step 0</output>
<button id="code-probe">Probe executable policies</button><output id="code-result"></output><script>
let step=0;document.querySelector('#local').onclick=()=>document.querySelector('#local-result').textContent='Step '+(++step);
document.querySelector('#code-probe').onclick=async()=>{
const result={};for(const [name,run] of [['eval',()=>eval('window.evalEscape=1')],['function',()=>new Function('window.functionEscape=1')()]]){
try{run();result[name]='escaped'}catch(error){result[name]=error.name}}
result.dataScript=await new Promise(resolve=>{const script=document.createElement('script');
script.src='data:text/javascript,window.dataScriptEscape%3D1';script.onload=()=>resolve('escaped');script.onerror=()=>resolve('blocked');document.body.append(script)});
document.querySelector('#code-result').textContent=JSON.stringify(result);
}</script>`

function captureShareProbes(context) {
  const requests = new Map(),
    sockets = []
  function entry(request) {
    if (!request.url().includes('education-sandbox-probe')) return null
    if (!requests.has(request))
      requests.set(request, {
        url: request.url(),
        type: request.resourceType(),
        page: request.frame().page().url(),
        failed: null,
        response: null,
        finished: false,
      })
    return requests.get(request)
  }
  const requested = (request) => {
    entry(request)
  }
  const failed = (request) => {
    const item = entry(request)
    if (item) item.failed = request.failure()?.errorText || 'unknown'
  }
  const responded = (response) => {
    const item = entry(response.request())
    if (item) item.response = response.status()
  }
  const finished = (request) => {
    const item = entry(request)
    if (item) item.finished = true
  }
  context.on('request', requested)
  context.on('requestfailed', failed)
  context.on('response', responded)
  context.on('requestfinished', finished)
  return {
    requests,
    sockets,
    socket: (socket) => sockets.push(socket.url()),
    dispose() {
      context.off('request', requested)
      context.off('requestfailed', failed)
      context.off('response', responded)
      context.off('requestfinished', finished)
    },
  }
}

test('common sandbox-isolation: hosted Share allows authored local scripts but denies parent storage DOM network data-script and eval escapes', async ({
  page,
  request,
  testPresentation,
}, testInfo) => {
  await apiUpdatePresentation(
    request,
    testPresentation.id,
    deckWith([
      {
        id: 'authored-sandbox',
        type: 'html',
        x: 20,
        y: 20,
        width: 920,
        height: 500,
        content: policyHtml,
        htmlDependencies: {
          network: false,
          offlineCapable: true,
          resources: [],
          dynamicResources: [],
        },
      },
    ])
  )
  const share = await apiCreateShareLink(request, testPresentation.id)
  const shared = await page.context().newPage()
  const transport = captureShareProbes(page.context())
  shared.on('websocket', transport.socket)
  try {
    await shared.goto(`/share/${share.token}`)
    await shared.waitForFunction(() => window.Reveal?.isReady())
    const frame = await findFrame(shared, '#local')
    await frame.getByRole('button', { name: 'Advance local lesson', exact: true }).click()
    await expect(frame.locator('#local-result')).toHaveText('Step 1')
    const isolation = await inspectIsolation(shared)
    await frame.getByRole('button', { name: 'Probe executable policies', exact: true }).click()
    await expect(frame.locator('#code-result')).toHaveText(
      '{"eval":"EvalError","function":"EvalError","dataScript":"blocked"}'
    )
    await expect
      .poll(async () =>
        JSON.parse(await frame.locator('#violations').textContent()).some(
          (item) => item.directive === 'script-src-elem' && item.blocked === 'data'
        )
      )
      .toBe(true)
    const violations = JSON.parse(await frame.locator('#violations').textContent())
    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ directive: 'script-src', blocked: 'eval' }),
        expect.objectContaining({ directive: 'script-src-elem', blocked: 'data' }),
        expect.objectContaining({
          directive: 'connect-src',
          blocked: 'https://example.invalid/education-sandbox-probe',
        }),
        expect.objectContaining({
          directive: 'img-src',
          blocked: 'https://example.invalid/education-sandbox-probe',
        }),
      ])
    )
    expect(
      await frame.evaluate(() => ({
        eval: window.evalEscape || null,
        function: window.functionEscape || null,
        dataScript: window.dataScriptEscape || null,
      }))
    ).toEqual({ eval: null, function: null, dataScript: null })
    await expect
      .poll(() => [...transport.requests.values()].some((item) => item.type === 'image'))
      .toBe(true)
    await expect
      .poll(() => [...transport.requests.values()].every((item) => item.failed !== null))
      .toBe(true)
    const attempts = [...transport.requests.values()]
    for (const item of attempts) {
      expect(item.page).toBe(shared.url())
      expect(item.response).toBeNull()
      expect(item.finished).toBe(false)
      expect(violations.some((violation) => violation.blocked === item.url)).toBe(true)
    }
    expect(transport.sockets).toEqual([])
    await frame.getByRole('button', { name: 'Advance local lesson', exact: true }).click()
    await expect(frame.locator('#local-result')).toHaveText('Step 2')
    await recordCommon(
      testInfo,
      shared,
      'sandbox-isolation',
      'share',
      {
        localResult: 'Step 2',
        parentErrors: ['SecurityError', 'SecurityError', 'SecurityError'],
        executablePolicy: { eval: 'EvalError', function: 'EvalError', dataScript: 'blocked' },
        networkResults: [
          ['fetch', 'blocked'],
          ['xhr', 'blocked'],
          ['socket', 'blocked'],
          ['worker', 'blocked'],
          ['image', 'blocked'],
        ],
        socketConnections: [],
        successfulProbeResponses: [],
      },
      {
        localResult: await frame.locator('#local-result').textContent(),
        isolation,
        executablePolicy: JSON.parse(await frame.locator('#code-result').textContent()),
        violations,
        attempts,
        socketConnections: transport.sockets,
      }
    )
  } finally {
    transport.dispose()
    shared.off('websocket', transport.socket)
    await shared.close()
  }
})
