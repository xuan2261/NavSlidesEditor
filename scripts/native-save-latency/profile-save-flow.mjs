import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { chromium } from '@playwright/test'
import { exposedTarget } from './helpers.mjs'
const reports=path.resolve('plans/261009-0901-navslides-full-reliability-deep-tdd/reports')
const original=path.join(reports,'native-save-20261116-2be2763d-61fa-4dca-ab14-31272ec3536b')
const isolation=JSON.parse(await fs.readFile(path.join(original,'isolation.json')))
const prior=JSON.parse(await fs.readFile(path.join(original,'result.json')))
const output=path.join(reports,`preput-diagnostic-${Date.now()}`)
await fs.mkdir(output)
const root=await fs.mkdtemp(path.join(os.tmpdir(),'nav-preput-copy-'))
for(const dir of ['data','uploads'])await fs.cp(path.join(isolation.root,dir),path.join(root,dir),{recursive:true})
Object.assign(process.env,{NODE_ENV:'production',HOST:'127.0.0.1',DATA_DIR:path.join(root,'data'),SLIDES_DATA_DIR:path.join(root,'data'),SLIDES_UPLOADS_DIR:path.join(root,'uploads')})
const require=createRequire(import.meta.url)
const {startServer,stopServer}=require('../../server/index.js')
const server=await startServer(0,{host:'127.0.0.1'})
const baseURL=`http://127.0.0.1:${server.address().port}`
const browser=await chromium.launch({headless:true})
const context=await browser.newContext({baseURL,viewport:{width:1440,height:900},storageState:{cookies:[],origins:[{origin:baseURL,localStorage:[{name:'navSlidesTutorialSeen',value:'true'}]}]}})
// This is a diagnostic, not a replacement 30-second acceptance run. The original
// failure and its data remain untouched. Browser CPU time distinguishes actual
// dispatch from delayed Playwright request delivery on a CPU-bound server loop.
const events=[]
await context.exposeBinding('__phase',(_,event)=>events.push(event))
await context.addInitScript(()=>{
 globalThis.__mark=(phase,detail)=>globalThis.__phase({phase,detail,time:performance.now()})
 const fetch=globalThis.fetch
 globalThis.fetch=function(...args){
  if(args[1]?.method==='PUT')globalThis.__mark('browser-put-dispatch',{url:String(args[0])})
  return Reflect.apply(fetch,this,args)
 }
})
await context.route('**/assets/EditorPage-*.js',async route=>{
 const response=await route.fetch();let text=await response.text()
 for(const name of ['kK','MK','NK','WK','jK']){
  const prefix=`function ${name}(`
  if(!text.includes(prefix))throw Error(`Missing dist phase ${name}`)
  text=text.replace(prefix,`function ${name}Original(`)
  text+=`\nfunction ${name}(...args){const start=performance.now();let result;try{return result=${name}Original(...args)}finally{globalThis.__mark('${name}',{ms:performance.now()-start,result:typeof result==='boolean'?result:result===null?'null':typeof result${name==='jK'?",mismatches:Object.keys(args[0]).filter(k=>k!=='instances'&&args[0][k]!==args[1][k])":""}})}}\n`
 }
 text=text.replace('PK(a,o.key),!0','PK(a,o.key),globalThis.__mark("baseline-accepted"),!0')
 await route.fulfill({response,body:text})
})
const page=await context.newPage()
const cdp=await context.newCDPSession(page)
try{
 const deck=await(await context.request.get(`/api/presentations/${prior.presentationId}`)).json()
 await context.grantPermissions(['clipboard-read','clipboard-write'])
 await page.goto(`/editor/${deck.id}`,{waitUntil:'domcontentloaded'})
 await page.waitForSelector('.ProseMirror-preview, [data-element-content]',{timeout:60000})
 const target=await exposedTarget(page,deck)
 await page.evaluate(()=>navigator.clipboard.writeText(' PREPUT-DIAGNOSTIC'))
 await page.mouse.dblclick(target.hitpoint.x,target.hitpoint.y)
 await page.getByTestId(`slide-element-${target.id}`).locator('.ProseMirror').waitFor({timeout:30000})
 await page.keyboard.press('ControlOrMeta+End')
 await cdp.send('Profiler.enable');await cdp.send('Profiler.start')
 const put=page.waitForRequest(r=>r.method()==='PUT'&&r.url().includes('/api/presentations/'),{timeout:30000})
 await page.evaluate(()=>__mark('typing-start'))
 await page.keyboard.press('ControlOrMeta+V')
 await page.evaluate(()=>__mark('typing-end'))
 await page.keyboard.press('Escape')
 const request=await put
 events.push({phase:'put-observed',at:Date.now(),bytes:request.postData()?.length})
 const {profile}=await cdp.send('Profiler.stop')
 await fs.writeFile(path.join(output,'client.cpuprofile'),JSON.stringify(profile))
 console.log(JSON.stringify(events,null,2))
}catch(error){events.push({error:error.stack});console.error(error)}finally{
 await fs.writeFile(path.join(output,'result.json'),JSON.stringify({root,baseURL,original,events},null,2))
 await browser.close();await stopServer(server)
 console.log(output)
}
