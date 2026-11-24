import { expect } from '../fixtures/test-fixtures.js'
import { findFrame } from './release-surfaces.js'

export const finalFrameHtml = `<style>body{margin:0;color:#16324f;font:24px sans-serif}#frame{width:140px;height:80px;background:#2563eb;transform:translateX(40px)}</style><h1>Qualified HTML lesson</h1><output id="final">Frame 0</output><div id="frame"></div><script>let frame=0;function advance(){document.querySelector('#final').textContent='Frame '+(++frame);if(frame<3)requestAnimationFrame(advance)}requestAnimationFrame(advance)</script>`
export const isolationHtml = `<style>body{font:18px sans-serif;color:#16324f}button{font:18px sans-serif}output{display:block}</style><button id="probe">Probe sandbox</button><output id="parent-result"></output><output id="network-result"></output><output id="violations"></output><script>
const violations=[];document.addEventListener('securitypolicyviolation',e=>{violations.push({directive:e.effectiveDirective,blocked:e.blockedURI});document.querySelector('#violations').textContent=JSON.stringify(violations)});
document.querySelector('#probe').onclick=async()=>{
const parentResults=[];for(const action of [()=>parent.document.body.dataset.contentAttack='escaped',()=>parent.localStorage.setItem('content-attack','escaped'),()=>top.document.body.dataset.contentAttack='escaped']){try{action();parentResults.push('escaped')}catch(e){parentResults.push(e.name)}}document.querySelector('#parent-result').textContent=JSON.stringify(parentResults);
const url='https://example.invalid/education-sandbox-probe';const results=await Promise.all([
fetch(url).then(()=>['fetch','escaped'],()=>['fetch','blocked']),
new Promise(resolve=>{const xhr=new XMLHttpRequest();xhr.open('GET',url);xhr.onload=()=>resolve(['xhr','escaped']);xhr.onerror=()=>resolve(['xhr','blocked']);try{xhr.send()}catch(e){resolve(['xhr','blocked'])}}),
new Promise(resolve=>{try{const socket=new WebSocket('wss://example.invalid/education-sandbox-probe');socket.onopen=()=>{socket.close();resolve(['socket','escaped'])};socket.onerror=()=>resolve(['socket','blocked'])}catch(e){resolve(['socket','blocked'])}}),
new Promise(resolve=>{try{const worker=new Worker(url);worker.onmessage=()=>{worker.terminate();resolve(['worker','escaped'])};worker.onerror=()=>{worker.terminate();resolve(['worker','blocked'])}}catch(e){resolve(['worker','blocked'])}}),
new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(['image','escaped']);image.onerror=()=>resolve(['image','blocked']);image.src=url})]);document.querySelector('#network-result').textContent=JSON.stringify(results);
}</script>`

export async function inspectFinalFrame(page) {
  const frame = await findFrame(page, '#final')
  await expect(
    frame.getByRole('heading', { name: 'Qualified HTML lesson', exact: true })
  ).toBeVisible()
  await expect(frame.locator('#final')).toHaveText('Frame 3')
  const geometry = await frame.locator('#frame').evaluate((node) => {
    const r = node.getBoundingClientRect(),
      style = getComputedStyle(node)
    return {
      x: r.x,
      width: r.width,
      height: r.height,
      color: style.backgroundColor,
      transform: style.transform,
    }
  })
  expect(geometry).toEqual({
    x: 40,
    width: 140,
    height: 80,
    color: 'rgb(37, 99, 235)',
    transform: 'matrix(1, 0, 0, 1, 40, 0)',
  })
  return {
    heading: await frame.locator('h1').textContent(),
    finalFrame: await frame.locator('#final').textContent(),
    geometry,
  }
}
export async function inspectIsolation(page) {
  const frame = await findFrame(page, '#probe')
  await frame.getByRole('button', { name: 'Probe sandbox', exact: true }).click()
  await expect(frame.locator('#parent-result')).toHaveText(
    '["SecurityError","SecurityError","SecurityError"]'
  )
  await expect(frame.locator('#network-result')).toHaveText(
    '[["fetch","blocked"],["xhr","blocked"],["socket","blocked"],["worker","blocked"],["image","blocked"]]'
  )
  const violations = await frame.locator('#violations').textContent().then(JSON.parse)
  expect(violations.map((item) => item.directive)).toEqual(
    expect.arrayContaining(['connect-src', 'img-src'])
  )
  expect(violations.some((item) => item.blocked.includes('education-sandbox-probe'))).toBe(true)
  expect(
    await page.evaluate(() => ({
      dom: document.body.dataset.contentAttack || null,
      storage: localStorage.getItem('content-attack'),
    }))
  ).toEqual({ dom: null, storage: null })
  return {
    parent: JSON.parse(await frame.locator('#parent-result').textContent()),
    network: JSON.parse(await frame.locator('#network-result').textContent()),
    violations,
  }
}
export async function openPrint(page) {
  await page.getByRole('button', { name: 'File menu', exact: true }).click()
  const pending = page.waitForEvent('popup')
  await page.getByRole('menuitem', { name: 'Export PDF', exact: true }).click()
  const print = await pending
  try {
    await print.waitForFunction(() => window.__navslidesExportReady === true)
    return print
  } catch (error) {
    await print.close()
    throw error
  }
}
