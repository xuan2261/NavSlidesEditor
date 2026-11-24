import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import inspector from 'node:inspector'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { chromium } from '@playwright/test'
import { exposedTarget, contentOf } from './helpers.mjs'
const reports='plans/261009-0901-navslides-full-reliability-deep-tdd/reports'
const priorFile=path.join(reports,'native-save-20261116-c95cf346-1eea-4284-a323-847f9764d1ed/result.json')
const prior=JSON.parse(await fs.readFile(priorFile,'utf8'))
const output=path.join(reports,`character-profile-${randomUUID()}`)
await fs.mkdir(output)
const root=await fs.mkdtemp(path.join(os.tmpdir(),'nav-character-profile-'))
const receipt={output,root,source:prior.retainedDataRoot,priorFile,priorTypingMs:prior.typingEnd.mono-prior.typingStart.mono,character:'x',events:[],status:'running'}
const save=()=>fs.writeFile(path.join(output,'result.json'),JSON.stringify(receipt,null,2))
await save()
let server,browser,stopServer,cdp,profiling=false,serverProfiling=false
const session=new inspector.Session();session.connect()
const post=(method,params={})=>new Promise((resolve,reject)=>session.post(method,params,(error,result)=>error?reject(error):resolve(result)))
try {
 for(const name of ['data','uploads']) await fs.cp(path.join(receipt.source,name),path.join(root,name),{recursive:true})
 Object.assign(process.env,{NODE_ENV:'production',HOST:'127.0.0.1',PORT:'0',DATA_DIR:path.join(root,'data'),SLIDES_DATA_DIR:path.join(root,'data'),SLIDES_UPLOADS_DIR:path.join(root,'uploads')})
 const require=createRequire(import.meta.url)
 const mod=require(path.resolve('server/index.js'));stopServer=mod.stopServer
 server=await mod.startServer(0,{host:'127.0.0.1'})
 const baseURL=`http://127.0.0.1:${server.address().port}`;receipt.baseURL=baseURL
 browser=await chromium.launch({headless:true})
 const context=await browser.newContext({baseURL,viewport:{width:1440,height:1000},storageState:{cookies:[],origins:[{origin:baseURL,localStorage:[{name:'navSlidesTutorialSeen',value:'true'}]}]}})
 const page=await context.newPage()
 const bundleName=(await fs.readdir('client/dist/assets')).find(n=>/^EditorPage-.*\.js$/.test(n))
 const bundlePath=path.resolve('client/dist/assets',bundleName),bundle=await fs.readFile(bundlePath,'utf8')
 receipt.bundle=bundlePath
 receipt.executable=process.execPath
 receipt.servedScripts=[]
 cdp=await context.newCDPSession(page)
 await cdp.send('Debugger.enable')
 const parsed=new Map()
 cdp.on('Debugger.scriptParsed',s=>{if(s.url.startsWith(baseURL))parsed.set(s.scriptId,s)})
 // Deliberately no route/response replacement.
 page.on('pageerror',e=>receipt.events.push({type:'error',at:Date.now(),error:e.stack}))
 const puts=new Map()
 page.on('request',request=>{if(request.method()==='PUT'){const row={type:'PUT',at:Date.now(),url:request.url()};puts.set(request,row);receipt.events.push(row)}})
 page.on('response',response=>{const row=puts.get(response.request());if(row){row.responseAt=Date.now();row.status=response.status()}})
 page.on('requestfinished',request=>{const row=puts.get(request);if(row)row.finishedAt=Date.now()})
 await page.goto(`/editor/${prior.presentationId}`,{waitUntil:'domcontentloaded'})
 await page.waitForSelector('.ProseMirror-preview, [data-element-content]',{timeout:120000})
 const response=await context.request.get(`/api/presentations/${prior.presentationId}`),deck=await response.json()
 const target=await exposedTarget(page,deck);receipt.target=target
 const before=contentOf(deck,target)
 await page.waitForTimeout(3000)
 const locator=page.getByTestId(`slide-element-${target.id}`)
 await page.mouse.dblclick(target.hitpoint.x,target.hitpoint.y)
 await locator.locator('.ProseMirror').waitFor({timeout:30000})
 await locator.locator('.ProseMirror').focus()
 await page.keyboard.press('ControlOrMeta+Home')
 receipt.diagnosticLabel='single-character prepend (acceptance harness uses ControlOrMeta+End)' 
 receipt.beforeText=await locator.locator('.ProseMirror').innerText()
 // Client-only capture; no competing server CPU profiler.
 await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:1000});await cdp.send('Profiler.start');profiling=true
 receipt.typingStart=Date.now();const start=performance.now()
 await page.keyboard.type('x');receipt.typingMs=performance.now()-start;receipt.typingEnd=Date.now()
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))
 receipt.profileEnd=Date.now()
 const {profile}=await cdp.send('Profiler.stop');profiling=false
 await fs.writeFile(path.join(output,'character.cpuprofile'),JSON.stringify(profile),{flag:'wx'})
 receipt.draftHeads=await page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('navslides-editor-draft:')).map(key=>{const raw=localStorage.getItem(key);let head;try{head=JSON.parse(raw)}catch{}return {key,length:raw?.length,version:head?.semanticDraftVersion ?? head?.version ?? 'full snapshot (no semanticDraftVersion)',format:head?.format,keys:head?Object.keys(head):[]}}))
 receipt.afterText=await locator.locator('.ProseMirror').innerText()
 receipt.exactCharacter=receipt.afterText==='x'+receipt.beforeText
 for(const [scriptId,s] of parsed){
  const {scriptSource}=await cdp.send('Debugger.getScriptSource',{scriptId})
  const file=`served-${scriptId}-${path.basename(new URL(s.url).pathname)}`
  await fs.writeFile(path.join(output,file),scriptSource,{flag:'wx'})
  receipt.servedScripts.push({scriptId,url:s.url,sourceMapURL:s.sourceMapURL,file})
 }
 const deadline=Date.now()
 while(![...puts.values()].some(r=>r.finishedAt&&r.status===200&&r.at>=receipt.typingStart)&&Date.now()<deadline) await new Promise(r=>setTimeout(r,200))
 // No server profile or persistence wait required for this character capture.
 // Payload parsing happens only after both profilers stop, never in the input window.
 for(const [request,row] of puts){try{row.targetContent=contentOf(request.postDataJSON(),target);row.changed=row.targetContent!==before;row.exactTarget=row.targetContent.includes(receipt.afterText)}catch{}}
 receipt.status=receipt.exactCharacter?'captured':'incomplete'
} catch(e){receipt.status='failed';receipt.error=e.stack;process.exitCode=1}
finally {
 if(profiling)try{const {profile}=await cdp.send('Profiler.stop');await fs.writeFile(path.join(output,'character.cpuprofile'),JSON.stringify(profile),{flag:'wx'})}catch(e){receipt.profileError=e.stack}
 if(serverProfiling)try{const {profile}=await post('Profiler.stop');await fs.writeFile(path.join(output,'server.cpuprofile'),JSON.stringify(profile),{flag:'wx'})}catch{}
 session.disconnect();await save()
 if(browser)await browser.close()
 if(server)await stopServer(server)
 console.log(JSON.stringify(receipt))
}
