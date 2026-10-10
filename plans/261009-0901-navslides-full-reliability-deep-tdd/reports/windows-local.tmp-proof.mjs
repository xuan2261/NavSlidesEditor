import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const repo=process.cwd(), reports=path.join(repo,'plans/261009-0901-navslides-full-reliability-deep-tdd/reports');
const owned=path.join(reports,'windows-local.tmp-root-policy-current-owned');
const node='C:/nvm4w/nodejs/node.exe';
const moduleAt=async p=>import(pathToFileURL(path.join(repo,p)).href);
const {sha256,hashCanonical}=await moduleAt('scripts/ci/release-receipt-canonical.mjs');
const support=await moduleAt('scripts/ci/release-evidence-test-support.mjs');
const receipts=await moduleAt('scripts/ci/release-receipts.mjs');
const {runPhysicalFeasibility}=await moduleAt('scripts/officecli/run-physical-feasibility.mjs');
const require=createRequire(import.meta.url), policy=require(path.join(repo,'config/release-target-policy.json'));
const files=['scripts/ci/windows-verification-evidence.mjs','scripts/ci/windows-verification-evidence.test.js','scripts/ci/release-receipt-workflow.mjs','scripts/ci/release-receipts.mjs','scripts/ci/release-evidence-test-support.mjs','scripts/ci/authenticode-policy.mjs','scripts/officecli/run-physical-feasibility.mjs','scripts/officecli/physical-feasibility-support.mjs','scripts/officecli/physical-feasibility-receipt.mjs','.github/workflows/reusable-windows-qualification.yml','server/services/pptx-import/officecli/qualification-manifest.json','config/release-target-policy.json','server/data/test-corpus/officecli/officecli-positive-powerpoint-16.pptx','server/data/test-corpus/adversarial/bad-crc.pptx','server/data/test-corpus/adversarial/malformed-xml.pptx'];
const inventory=async()=>Object.fromEntries(await Promise.all(files.map(async p=>[p,sha256(await fs.readFile(path.join(repo,p)))])));
const before=await inventory(), cases=[];
await fs.mkdir(owned,{recursive:true});
const json=async(p,v)=>{await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p,JSON.stringify(v));};
const fixture=()=>{
 const common={schemaVersion:'release-receipt-v1',policyVersion:policy.policyVersion,subjectSha:support.syntheticSubject,clientDigest:support.syntheticClient,lockHashes:{workspace:'d'.repeat(64),electron:'e'.repeat(64)}};
 const qualificationId=receipts.createQualificationId(common);
 const linuxReceipt=receipts.createHostReceipt({...common,qualificationId,host:'linux-ci',status:'passed',...support.syntheticLinuxLeaf()});
 const child={...common,qualificationId,parentReceiptHash:receipts.hashReceipt(linuxReceipt)};
 return {policy:structuredClone(policy),linuxReceipt,windowsAttestationPolicy:{repository:'example/repo',ref:'refs/tags/v1.17.0'},windowsReceipt:receipts.createHostReceipt({...child,host:'windows',status:'passed',...support.syntheticWindowsLeaf()}),linuxDesktopReceipt:receipts.createNotSelectedReceipt({...child,host:'linux-desktop'}),macosDesktopReceipt:receipts.createNotSelectedReceipt({...child,host:'macos-desktop'})};
};
async function direct(name,id,caller,args,expected,fn){let actualError=null,code=null,result;
 try{result=await fn();}catch(e){actualError=e.message;code=e.code??null;}
 const passed=expected===null?!actualError:!!actualError&&expected.test(actualError+' '+code);
 cases.push({name,id,caller,args,expectedError:expected?.source??null,actualError,actualCode:code,returnedSuccessArtifact:result!==undefined,passed,scope:'synthetic safe contract input; not physical qualification'});
}
await direct('release-consumer-positive-control','control','createGreenShaRoot', 'existing synthetic fixture()',null,()=>receipts.createGreenShaRoot(fixture()));
for(const kind of ['office','fidelity']) await direct(`P12-01 missing-${kind}-physical-receipt`,'P12-01','scripts/ci/release-receipts.mjs:createGreenShaRoot -> assertWindowsLeafEvidence',`delete windowsReceipt.evidence.${kind}`,/Windows actual leaf evidence is required/,()=>{const x=fixture();delete x.windowsReceipt.evidence[kind];return receipts.createGreenShaRoot(x);});
await direct('P12-03 wrong-pinned-fixture-hash-at-root','P12-03','createGreenShaRoot -> assertWindowsLeafEvidence -> assertAuthoritativeReceipt','office.raw.fixtures[1].sha256=E*64; rawCanonicalHash and officecli gate rebound',/Fixture.*invalid|Fixture.*match|fixture/i,()=>{const x=fixture(),o=x.windowsReceipt.evidence.office;o.raw.fixtures[1].sha256='E'.repeat(64);o.rawCanonicalHash=hashCanonical(o.raw);x.windowsReceipt.gates['officecli-physical']=hashCanonical(o);return receipts.createGreenShaRoot(x);});
const workflow=await fs.readFile(path.join(repo,'.github/workflows/reusable-windows-qualification.yml'),'utf8');
const body=workflow.split('      - name: Sign with protected external signer')[1].split('      - name: ')[0].split('        run: |\n')[1].split('\n').filter(l=>l.startsWith('          ')).map(l=>l.slice(10)).join('\n')+'\n';
const cli=path.join(repo,'scripts/ci/release-receipt-workflow.mjs');
const run=(command,args,cwd,env={})=>{const r=spawnSync(command,args,{cwd,env:{...process.env,...env},encoding:'utf8',timeout:30000});return {command,args,cwd,status:r.status,signal:r.signal,stdout:r.stdout??'',stderr:r.stderr??'',error:r.error?.message??null};};
for(const [name,script,expected] of [['missing','',/protected signing policy input missing/],['relative','relative-signer.ps1',/signing script must be absolute/],['inside-checkout',path.join(owned,'signing-inside.ps1'),/signer must be outside checkout/]]){
 const cwd=path.join(owned,'signer-'+name);await fs.mkdir(cwd,{recursive:true});
 const ps=path.join(cwd,'windows-local.tmp-caller.ps1');await fs.writeFile(ps,"$ErrorActionPreference = 'Stop'\n"+body+"Set-Content -LiteralPath downstream-success.txt -Value 'not reached'\n");
 const execution=run('pwsh',['-NoProfile','-NonInteractive','-File',ps],cwd,{WINDOWS_SIGNING_SCRIPT:script,WINDOWS_SIGNING_SUBJECT:'CN=Synthetic',WINDOWS_SIGNING_THUMBPRINT:'A'.repeat(40),RFC3161_TIMESTAMP_URL:'https://synthetic.invalid',GITHUB_WORKSPACE:owned});
 const absent=await fs.access(path.join(cwd,'evidence/authenticode/signer')).then(()=>false,()=>true),successAbsent=await fs.access(path.join(cwd,'downstream-success.txt')).then(()=>false,()=>true);
 cases.push({name:'P12-04 protected-signer-'+name,id:'P12-04',caller:'exact extracted reusable-windows-qualification.yml Sign with protected external signer',body,bodySha256:sha256(body),expectedExit:1,expectedError:expected.source,execution,noSignerInvocation:true,noSuccessArtifact:absent&&successAbsent,passed:execution.status===1&&expected.test(execution.stderr)&&absent&&successAbsent});
}
const guards=require(path.join(repo,'server/services/pptx-import/pptx-guards.js'));
for(const name of ['control','bad-crc.pptx','malformed-xml.pptx']){
 const cwd=path.join(owned,'false-accept-'+name);await fs.mkdir(cwd,{recursive:true});
 const m=structuredClone(support.pinnedManifest);m.license={...m.license,textSha256:'A'.repeat(64),upstreamNoticeStatus:'absent',redistributionReviewStatus:'reviewed-not-bundled'};m.provenance={acquisitionTimestampRequired:true,releaseCommitVerified:true,checksumManifestVerified:true};
 const observations=[],pending=[];
 let resolveCounterpart;const counterpartSettled=new Promise(resolve=>{resolveCounterpart=resolve;});
 const probe={lstatFile:async()=>({isFile:()=>true,isSymbolicLink:()=>false,isReparsePoint:()=>false}),realpath:async p=>p,statFile:async()=>({isFile:()=>true,isReparsePoint:()=>false,size:m.releaseAsset.byteLength,nlink:1,dev:1,ino:2}),hashFile:async()=>m.releaseAsset.sha256};
 let result,actualError=null,actualCode=null;
 const options={binary:'C:\\admin\\officecli.exe',valid:path.join(repo,files[12]),malformed:['bad-crc.pptx','malformed-xml.pptx'].map(n=>path.join(repo,'server/data/test-corpus/adversarial',n)),acquiredAt:'2000-01-01T00:00:00Z',executionRoot:path.join(cwd,'execution'),workspaceRoot:path.join(cwd,'workspace')};
 try{result=await runPhysicalFeasibility(options,{platform:'win32',evidenceMode:'test-double',manifest:m,probe,inspectBinary:async()=>({canonicalPath:'C:\\admin\\officecli.exe',sha256:m.releaseAsset.sha256,byteLength:m.releaseAsset.byteLength}),stageExecutionCopy:async()=>({canonicalPath:'C:\\staged\\officecli.exe',sha256:m.releaseAsset.sha256,byteLength:m.releaseAsset.byteLength}),validatePptxPackage:(p,n)=>{const task=(async()=>{if(n===name){await counterpartSettled;observations.push({name:n,forcedResult:'accepted'});return {fileSize:(await fs.stat(p)).size};}try{const r=await guards.validatePptxPackage(p,n);observations.push({name:n,actualGuard:'accepted'});return r;}catch(e){observations.push({name:n,actualGuard:'rejected',code:e.code??e.reason??null});throw e;}finally{if(n!=='officecli-positive-powerpoint-16.pptx'&&n!==name)resolveCounterpart();}})();pending.push(task);return task;},runBoundedProcess:async({argv})=>({exitCode:0,stdout:argv[0]==='--version'?m.version+'\n':'{"success":true,"data":{"count":0,"errors":[]}}',stderr:''})});}catch(e){actualError=e.message;actualCode=e.code??null;}
 const settlements=await Promise.allSettled(pending);
 const passed=name==='control'?result?.status==='test-only'&&result?.authoritative===false&&result.fixtures.length===3&&result.fixtures.every(f=>f.ok)&&observations.every(o=>!o.forcedResult):actualCode==='MALFORMED_FIXTURE_ACCEPTED'&&result===undefined&&observations.some(o=>o.name===name&&o.forcedResult==='accepted')&&observations.some(o=>o.name!==name&&o.actualGuard==='rejected');
 cases.push({id:'P12-08',name:'P12-08 '+(name==='control'?'production-guards-safe-positive-control':'forced-false-acceptance-'+name),caller:'runPhysicalFeasibility -> validateFixture(expected=reject)',options,seam:'Synthetic binary/version/validate process outputs; selected target forced accepted, positive and counterpart use production guard; callback settlements awaited without sleeps',expectedError:name==='control'?null:'MALFORMED_FIXTURE_ACCEPTED',actualError,actualCode,observations,settlements:settlements.map(s=>({status:s.status,code:s.reason?.code??s.reason?.reason??null})),returnedReceipt:result?{status:result.status,authoritative:result.authoritative,fixtures:result.fixtures}:null,noSuccessArtifact:result===undefined||result.authoritative===false,passed});
}
const identity='https://github.com/example/repo/.github/workflows/reusable-windows-qualification.yml@refs/tags/v1.17.0';
for(const name of ['control','old-source','missing-one-exe','missing-one-attested-exe']){
 const cwd=path.join(owned,'attestation-'+name);await fs.mkdir(path.join(cwd,'post-download'),{recursive:true});await fs.mkdir(path.join(cwd,'evidence'),{recursive:true});
 const names=['NavSlides Editor Setup 1.17.0.exe','NavSlides Editor 1.17.0.exe'];const digests={};
 for(const exe of names){const bytes=Buffer.from('Synthetic plain text, never executed: '+exe);digests[exe]=sha256(bytes);if(name!=='missing-one-exe'||exe===names[0])await fs.writeFile(path.join(cwd,'post-download',exe),bytes);}
 await json(path.join(cwd,'package.json'),{version:'1.17.0'});const raw=[support.syntheticGhResult(digests,identity)];
 if(name==='old-source')raw[0].verificationResult.signature.certificate.sourceRepositoryDigest='b'.repeat(40);
 if(name==='missing-one-attested-exe')raw[0].verificationResult.statement.subject.pop();
 const input=path.join(cwd,'verified.json');await json(input,raw);const inputBefore=sha256(await fs.readFile(input));
 const execution=run(node,[cli,'attestation-windows',input,support.syntheticSubject,support.syntheticClient,identity],cwd);
 const exists=await fs.access(path.join(cwd,'evidence/attestation-policy.json')).then(()=>true,()=>false);const hashExists=await fs.access(path.join(cwd,'evidence/attestation-verification.sha256')).then(()=>true,()=>false);
 const expected=name==='control'?null:name==='old-source'?/certificate\/source\/workflow\/issuer mismatch/:name==='missing-one-exe'?/artifact completeness\/version mismatch/:/artifact digest coverage is incomplete/;
 cases.push({name:'P12-15 attestation-windows-'+name,id:'P12-15',caller:cli,execution,expectedExit:name==='control'?0:1,expectedError:expected?.source??null,noSuccessArtifact:!exists&&!hashExists,inputUnchanged:inputBefore===sha256(await fs.readFile(input)),passed:name==='control'?execution.status===0&&exists&&hashExists:execution.status===1&&expected.test(execution.stderr)&&!exists&&!hashExists});
}
const sig=structuredClone(Object.values(support.syntheticWindowsLeaf().evidence.signatures)[0]);sig.signerDeclaration={status:'passed',testDouble:true};sig.postDownload={...sig.postDownload,status:'HashMismatch'};
const policyCwd=path.join(owned,'failed-verifier-policy');await fs.mkdir(policyCwd,{recursive:true});const signaturePath=path.join(policyCwd,'independent-failed.json');await json(signaturePath,sig);
const execution=run(node,[path.join(repo,'scripts/ci/authenticode-policy.mjs'),signaturePath,sig.preUpload.signerSubject,sig.preUpload.signerThumbprint],policyCwd);
cases.push({name:'P12-16 signer-passed-independent-verifier-failed-policy',id:'P12-16',caller:'actual authenticode-policy.mjs CLI verifyAuthenticodeEvidence',signerDeclaration:sig.signerDeclaration,explicitIndependentResult:sig.postDownload,verifierPresent:!!sig.postVerifier,execution,expectedExit:1,expectedError:'post-download signature is not Valid',noSuccessArtifact:execution.stdout.trim()==='',passed:execution.status===1&&execution.stderr.includes('post-download signature is not Valid')&&execution.stdout.trim()===''});
const validInput=path.join(policyCwd,'independent-valid.json');await json(validInput,{...sig,postDownload:{...sig.postDownload,status:'Valid'}});
const validExecution=run(node,[path.join(repo,'scripts/ci/authenticode-policy.mjs'),validInput,sig.preUpload.signerSubject,sig.preUpload.signerThumbprint],policyCwd);
cases.push({name:'P12-16 signer-passed-independent-verifier-valid-policy-control',id:'P12-16',caller:'actual authenticode-policy.mjs CLI verifyAuthenticodeEvidence',execution:validExecution,expectedExit:0,passed:validExecution.status===0&&JSON.parse(validExecution.stdout).verified===true});
const captureCwd=path.join(owned,'failed-verifier-capture');await fs.mkdir(path.join(captureCwd,'evidence'),{recursive:true});const exe=path.join(captureCwd,'synthetic.exe');await fs.writeFile(exe,'Synthetic unsigned EXE never executed');await json(path.join(captureCwd,'evidence/synthetic.exe.json'),{...sig,postDownload:null});
const prior=sha256(await fs.readFile(path.join(captureCwd,'evidence/synthetic.exe.json')));
const seam=path.join(captureCwd,'windows-local.tmp-failed-verifier.mjs');await fs.writeFile(seam,`import cp from 'node:child_process'; import {syncBuiltinESMExports} from 'node:module'; import fs from 'node:fs'; cp.execFileSync=(file,args)=>{ fs.appendFileSync('calls.jsonl',JSON.stringify({file,args})+'\\n'); if(args.includes('$PSVersionTable.PSVersion.ToString()'))return 'synthetic-verifier-1\\n'; if(args[0]==='verify'){const e=new Error('synthetic independent verifier explicit exit47');e.status=47;throw e;} throw new Error('unexpected seam call'); };syncBuiltinESMExports(); process.argv=[process.execPath,${JSON.stringify(cli)},'authenticode-post',${JSON.stringify(exe)},'evidence']; await import(${JSON.stringify(pathToFileURL(cli).href)});`);
const binaryHash=sha256(await fs.readFile(node));const captureExecution=run(node,[seam],captureCwd,{WINDOWS_VERIFIER_PATH:node,WINDOWS_VERIFIER_SHA256:binaryHash,WINDOWS_VERIFIER_VERSION:'synthetic-verifier-1',WINDOWS_SIGNTOOL_PATH:node,WINDOWS_SIGNTOOL_SHA256:binaryHash});
const calls=(await fs.readFile(path.join(captureCwd,'calls.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
cases.push({name:'P12-16 signer-passed-independent-process-verifier-exit47',id:'P12-16',caller:'actual release-receipt-workflow.mjs authenticode-post -> captureAuthenticode; isolated execFileSync seam installed via syncBuiltinESMExports',signerDeclaration:{status:'passed',testDouble:true},execution:captureExecution,calls,explicitVerifierExit:47,expectedExit:1,expectedError:'independent Authenticode/RFC3161/chain verification failed',noSuccessArtifact:prior===sha256(await fs.readFile(path.join(captureCwd,'evidence/synthetic.exe.json'))),passed:captureExecution.status===1&&captureExecution.stderr.includes('independent Authenticode/RFC3161/chain verification failed')&&calls.some(c=>c.args[0]==='verify')&&prior===sha256(await fs.readFile(path.join(captureCwd,'evidence/synthetic.exe.json')))});
const after=await inventory();
const preservedNames=['windows-local-remaining-proof.json','windows-local-remaining-proof-pre-counsel.json','windows-local-remaining-proof-green.json','windows-local-remaining-proof-final.json','windows-local-remaining-proof-settled.json'];
const preserved=Object.fromEntries(await Promise.all(preservedNames.map(async n=>[n,sha256(await fs.readFile(path.join(reports,n)))])));
const initial=JSON.parse(await fs.readFile(path.join(reports,'windows-local-remaining-proof.json'),'utf8'));
const result={schemaVersion:1,recordedAt:new Date().toISOString(),scope:'Bounded local synthetic production consumers and exact extracted signer caller only; no OfficeCLI/PowerPoint/signer/EXE execution, network, browser, app mutation or publication',cases,inputs:{before,after,unchanged:JSON.stringify(before)===JSON.stringify(after)},passed:cases.every(c=>c.passed)&&JSON.stringify(before)===JSON.stringify(after),physicalBlockers:['Real physical OfficeCLI and PowerPoint receipts and host qualification remain absent','Protected signer authority, genuine NSIS/portable binaries, independent Windows trust/RFC3161 and genuine EXE attestations are not exercised'],temporarySandbox:owned};
result.inputs.sameAsInitial=JSON.stringify(before)===JSON.stringify(initial.inputs.before);result.priorRawHashes=preserved;
const changed=Object.keys(before).filter(p=>before[p]!==initial.inputs.before[p]).map(p=>({path:p,oldSha256:initial.inputs.before[p],newSha256:before[p]}));
const approvedChange={path:'scripts/ci/release-receipts.mjs',oldSha256:'46c5d4cf14d18d975d498786cae4f1326c08a2f79b96f2c9075d471b53ef9653',newSha256:'2329c1e49d60f7cb3be375054ecd618e871cc51e4c963aabd18b64e63ab23592',semantics:'Main approved createGreenShaRoot return policyDigest: hashReceipt(policy)'};
result.inputs.changedFromInitial=changed;result.inputs.approvedChange=approvedChange;result.inputs.onlyApprovedChange=changed.length===1&&changed[0].path===approvedChange.path&&changed[0].oldSha256===approvedChange.oldSha256&&changed[0].newSha256===approvedChange.newSha256;
result.counsel='Main relayed approved sole root policyDigest change; mandatory before==after and exact known-change fingerprint binding retained; all 17 Windows proofs re-executed';result.passed=result.passed&&result.inputs.onlyApprovedChange;
await json(path.join(reports,'windows-local-remaining-proof-root-policy-current.json'),result);console.log(JSON.stringify({passed:result.passed,cases:cases.map(({name,passed,actualError,actualCode,execution})=>({name,passed,actualError,actualCode,status:execution?.status,stderr:execution?.stderr})),unchanged:result.inputs.unchanged,sameAsInitial:result.inputs.sameAsInitial,onlyApprovedChange:result.inputs.onlyApprovedChange,changedFromInitial:changed}));
