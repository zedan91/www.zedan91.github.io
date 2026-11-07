'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),extRoot=path.join(root,'azobss-firefox-whatsapp-pdf-bridge'),source=fs.readFileSync(path.join(extRoot,'background.js'),'utf8'),sales=fs.readFileSync(path.join(root,'assets/js/azobss-admin-sales-receipts.js'),'utf8');
function fixture(){
 let receive,removed;const sent=[],routes=[],tasks=[];
 const browser={runtime:{onMessage:{addListener:fn=>receive=fn}},tabs:{sendMessage:async(id,data)=>sent.push({id,...data}),onRemoved:{addListener:fn=>removed=fn}}};
 const sandbox={browser,console:{log(){}},URL,Map,Date,setInterval:fn=>tasks.push(fn),createAzobssWhatsappTabRouter1545:()=>({whatsappUrl:url=>String(url).startsWith('https://web.whatsapp.com/'),async route(sender,opts){routes.push(opts);await opts.beforeNavigate?.({id:40});return {whatsappTabId:40};}})};vm.createContext(sandbox);vm.runInContext(source,sandbox);
 const admin={url:'https://www.azobss.com/admin/',frameId:0,tab:{id:1}},wa={url:'https://web.whatsapp.com/send?phone=601100000001',frameId:0,tab:{id:40}};
 const payload={type:'AZOBSS_FIREFOX_WA_PDF_SHARE',requestId:'qa-1551-one',filename:'QA-Invoice.pdf',dataUrl:'data:application/pdf;base64,JVBERi0xLjcK',caption:'QA Invoice\nNotes: Installation included.',phone:'601100000001'};
 return {sent,routes,removed:id=>removed(id),share:(changes={},sender=admin)=>receive({...payload,...changes},sender),claim:(changes={},sender=wa)=>receive({type:'AZOBSS_FIREFOX_WA_PDF_CLAIM',bridgeVersion:1551,...changes},sender),status:(status,requestId=payload.requestId)=>receive({type:'AZOBSS_FIREFOX_WA_PDF_WHATSAPP_STATUS',status,requestId},wa)};
}
test('a PDF is atomically claimed once across concurrent polls and after a simulated content reload',async()=>{
 const f=fixture();assert.equal((await f.share()).ok,true);const results=await Promise.all(Array.from({length:12},()=>f.claim()));assert.equal(results.filter(r=>r.pending).length,1);assert.equal(results.find(r=>r.pending).caption,'QA Invoice\nNotes: Installation included.');assert.equal((await f.claim()).pending,false);
});
test('failure and caption warning consume the request without another attachment attempt',async()=>{
 for(const status of ['error','needs-caption','attached']){const f=fixture();await f.share();await f.claim();assert.equal((await f.status(status)).ok,true);for(let n=0;n<5;n++)assert.equal((await f.claim()).pending,false);assert.equal(f.sent.filter(r=>r.status===status).length,1);}
});
test('old content scripts cannot claim new requests; mismatched status cannot clear a current request',async()=>{
 const f=fixture();await f.share();assert.equal((await f.claim({bridgeVersion:1545})).pending,false);assert.equal((await f.status('error','different-request')).ok,false);assert.equal((await f.claim()).pending,true);
});
test('replayed share IDs never route or attach twice, including after error',async()=>{
 const f=fixture();await Promise.all([f.share(),f.share()]);assert.equal(f.routes.length,1);await f.claim();await f.status('error');assert.equal((await f.share()).ok,false);assert.equal(f.routes.length,1);
});
test('empty/truncated notes, invalid PDF and untrusted senders fail before routing',async()=>{
 for(const changes of [{caption:''},{caption:'x'.repeat(12001)},{dataUrl:'https://example.invalid/pdf'},{requestId:'bad id'},{phone:''}]){const f=fixture();assert.equal((await f.share(changes)).ok,false);assert.equal(f.routes.length,0);}
 const f=fixture();assert.equal((await f.share({}, {url:'https://evil.invalid/admin/',tab:{id:2}})).ok,false);assert.equal((await f.share({}, {url:'https://www.azobss.com/admin/',tab:{id:2},frameId:1})).ok,false);
});
function fn(name){const start=sales.indexOf('function '+name+'(');assert.ok(start>=0,name);const actual=sales.slice(Math.max(0,start-6),start)==='async '?'async ':'';const from=start-actual.length;const next=sales.slice(start+1).search(/\n(?:async )?function /);return sales.slice(from,next<0?sales.length:start+1+next);}
function salesFixture({ready=true,accept=true}={}){
 const posts=[],notices=[],copies=[];let prepared=0;const file=new File(['%PDF-1.7\nQA'],'QA.pdf',{type:'application/pdf'}),sandbox={notify:(...v)=>notices.push(v),waitForFirefoxBridgeReady:async()=>ready,prepareSingleActualPdf:async()=>{prepared++;return {file,text:'Quotation QA\nNotes: Two-year support.',row:{customerPhone:'01100000001'}};},copyPlainText:async text=>copies.push(text),blobToDataUrl:async()=> 'data:application/pdf;base64,JVBERg==',waitForFirefoxBridgeAcceptance:async()=>({ok:accept,status:accept?'accepted':'timeout'}),window:{postMessage:data=>posts.push(data)},location:{origin:'https://www.azobss.com'},normalizeWhatsAppPhone:()=> '601100000001',azSrFirefoxBridgeTransfers:new Map(),AZ_SR_FIREFOX_WA_BRIDGE_VERSION:1551,setSharePanelText(){},Date,Math};vm.createContext(sandbox);vm.runInContext(fn('firefoxPhysicalPdfToWhatsAppWeb'),sandbox);return {sandbox,posts,copies,notices,prepared:()=>prepared};
}
test('rapid clicks prepare and post one PDF with the complete note and leave the button locked',async()=>{
 const f=salesFixture(),context={mode:'single'},button={disabled:false,classList:{add(){},remove(){}}};await Promise.all([f.sandbox.firefoxPhysicalPdfToWhatsAppWeb(context,button),f.sandbox.firefoxPhysicalPdfToWhatsAppWeb(context,button)]);assert.equal(f.prepared(),1);assert.equal(f.posts.length,1);assert.equal(f.posts[0].caption,'Quotation QA\nNotes: Two-year support.');assert.equal(f.copies[0],f.posts[0].caption);assert.equal(button.disabled,true);await f.sandbox.firefoxPhysicalPdfToWhatsAppWeb(context,button);assert.equal(f.posts.length,1);
});
test('old/missing extension and acceptance timeout never trigger automatic fallback sends or retries',async()=>{
 const old=salesFixture({ready:false}),context={mode:'single'};await old.sandbox.firefoxPhysicalPdfToWhatsAppWeb(context);assert.equal(old.prepared(),0);assert.equal(old.posts.length,0);assert.equal(context.firefoxTransfer.phase,'requires-update');
 const f=salesFixture({accept:false}),c={mode:'single'};await f.sandbox.firefoxPhysicalPdfToWhatsAppWeb(c);await f.sandbox.firefoxPhysicalPdfToWhatsAppWeb(c);assert.equal(f.posts.length,1);assert.equal(c.firefoxTransfer.phase,'error');
});
test('quotation/invoice/receipt notes use correct labels and never put payment demands into quotations',()=>{
 const s={documentType:v=>v,documentNo:()=> 'QA-1551',money:n=>'RM'+n,statusDisplayLabel:row=>row.status,outstandingAmount:()=>50,toyyibPayPaymentUrl:(row,type)=>type==='invoice'?'https://example.invalid/pay':'',pendingMaybankPaymentText:()=> 'Maybank details'};vm.createContext(s);vm.runInContext(fn('documentShareText'),s);
 for(const kind of ['quotation','invoice','receipt']){const text=s.documentShareText({customerName:'QA',gross:100,status:kind==='receipt'?'paid':'pending',notes:'Line one\nLine two',quotationValidUntil:'2026-11-30'},kind);assert.ok(text.startsWith('AZOBSS '+{quotation:'Quotation',invoice:'Invoice',receipt:'Receipt'}[kind]));assert.ok(text.includes('Notes:\nLine one\nLine two'));if(kind==='quotation'){assert.ok(text.includes('no payment is requested'));assert.ok(!text.includes('Maybank'));assert.ok(!text.includes('Pay via'));assert.ok(text.includes('Valid until: 2026-11-30'));}}
});
test('WhatsApp automation contains no Send click, Enter submission or unsafe unscoped caption fallback',()=>{
 const wa=fs.readFileSync(path.join(extRoot,'whatsapp-bridge.js'),'utf8');assert.doesNotMatch(wa,/send\.click|key(?:Code|\s*:)\s*13|key\s*:\s*['"]Enter/);assert.ok(wa.includes('entry.phase')===false);assert.ok(wa.includes('attemptedRequests.add(payload.requestId)'));assert.ok(wa.includes('findPreviewCaptionBox(scope)'));assert.ok(!wa.includes('candidates[candidates.length - 1]'));assert.ok(!wa.includes("document.execCommand('selectAll'"));
});
