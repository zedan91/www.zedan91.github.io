'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { runInNewContext } = require('node:vm');
const crypto = require('node:crypto');
const { createBusinessPayments } = require('../lib/azobss-business-payments.cjs');
const { createChipAdapter } = require('../lib/azobss-chip-collect.cjs');

const root=path.join(__dirname,'..');
const brandId='11111111-1111-1111-1111-111111111111';
const purchaseId='22222222-2222-2222-2222-222222222222';
const order={
  orderId:'chip-fixture', chipPurchaseId:purchaseId, amountSen:3900,
  status:'pending', paymentMethod:'chip', source:'Software'
};

test('manual bank is a scoped backup and old admin saves preserve its setting',async()=>{
  let settings={stripe:true};
  const ref={get:async()=>({data:()=>settings}),set:async patch=>Object.assign(settings,patch)};
  const payments=createBusinessPayments({root,env:{},getDb:()=>({collection:()=>({doc:()=>ref})}),
    stripeReady:()=>true,toyyibReady:()=>true
  });
  assert.equal((await payments.options('software')).bank,null);
  assert.equal((await payments.options('cad')).bank,null);
  assert.ok((await payments.options()).bank);
  assert.equal((await payments.options('software')).stripe,true);
  await payments.saveBackups({digitalBank:true,toyyibpay:false,stripe:false});
  await payments.saveBackups({toyyibpay:true,stripe:false});
  assert.ok((await payments.options('software')).bank);
  assert.ok((await payments.options('cad')).bank);
});

function chipFixture(status,{mismatch=false,cancelRace=false}={}){
  const calls=[];
  let providerStatus=status;
  const adapter=createChipAdapter({apiKey:'fixture',brandId,fetchImpl:async(url,opts)=>{
    calls.push({url,method:opts.method});
    if(opts.method==='POST'){
      providerStatus=cancelRace?'paid':'cancelled';
      if(cancelRace)return Response.json({message:'Already paid'},{status:400});
    }
    return Response.json({id:purchaseId,brand_id:brandId,is_test:false,reference:mismatch?'other':order.orderId,
      status:providerStatus,purchase:{currency:'MYR',total:3900},
      payment:providerStatus==='paid'?{is_outgoing:false,currency:'MYR',amount:3900}:null
    });
  }});
  return {adapter,calls};
}

test('CHIP cancellation checks purchase identity and waits for in-flight payments',async()=>{
  const editable=chipFixture('viewed');
  assert.equal((await editable.adapter.cancel(order)).providerStatus,'cancelled');
  assert.deepEqual(editable.calls.map(x=>x.method),['GET','POST']);
  assert.match(editable.calls[1].url,/\/cancel\/$/);
  for(const fixture of [chipFixture('viewed',{mismatch:true}),chipFixture('pending_execute'),chipFixture('paid')]){
    await fixture.adapter.cancel(order);
    assert.deepEqual(fixture.calls.map(x=>x.method),['GET']);
  }
  const race=chipFixture('created',{cancelRace:true});
  assert.equal((await race.adapter.cancel(order)).paid,true);
  assert.deepEqual(race.calls.map(x=>x.method),['GET','POST','GET']);
});

function cancellationFixture(override={},providerStatus='cancelled'){
  const token=Buffer.alloc(32,7).toString('base64url');
  const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
  let stored={...order,chipCancelHash:hash(token),...override};
  let providerCalls=0;
  let writes=0;
  const source=readFileSync(path.join(root,'deploy-server.js'),'utf8');
  const block=source.slice(source.indexOf('function azIsDigitalChipCheckout('),source.indexOf('async function azVerifyAndFinalizeDigitalChip('));
  const fns=runInNewContext(block+'({cancel:azCancelDigitalChipCheckout,sync:azSyncClosedDigitalChipOrder})',{
    Buffer,crypto,cleanPremiumText:value=>String(value||'').trim(),azBankReportHash:hash,
    azBusinessPaymentError:(message,statusCode)=>Object.assign(new Error(message),{statusCode}),
    azIsManualSalesInvoiceOrder:()=>false,azIsMembershipOrder:()=>false,
    isPaBmPremiumOrder:()=>false,isPublicPaPremiumOrder:()=>false,
    azIsAzdmPremiumOrder:()=>false,azIsEbookGeneratorAccessOrder:()=>false,
    azAutomaticCheckoutPending:row=>row.status==='pending',
    findPremiumOrderByAnyDeep:async()=>stored,upsertPremiumOrder:x=>x,
    azWithOrderFinalizeLock:async(_order,fn)=>fn(),
    getAzobssBackendDb:()=>({
      collection:()=>({doc:()=>({})}),
      runTransaction:async fn=>fn({get:async()=>({data:()=>stored}),set:(_ref,value)=>{writes++;stored={...stored,...value};}})
    }),
    azBusinessPayments:{chipAdapter:()=>({cancel:async()=>{providerCalls++;return {paid:false,providerStatus};}})}
  });
  return {token,fns,read:()=>stored,calls:()=>providerCalls,writes:()=>writes};
}

test('customer cancel token is required and confirmed cancellations are hidden without deleting the order',async()=>{
  const fixture=cancellationFixture();
  await assert.rejects(fixture.fns.cancel({orderId:order.orderId,cancelToken:'a'.repeat(43)},{}),{statusCode:403});
  assert.equal(fixture.calls(),0);
  const request={orderId:order.orderId,cancelToken:fixture.token};
  assert.equal((await fixture.fns.cancel(request,{})).status,'cancelled');
  assert.equal(fixture.read().hiddenFromSalesReceipts,true);
  assert.equal(fixture.read().orderId,order.orderId);
  assert.equal(fixture.read().paymentUrl,'');
  assert.equal((await fixture.fns.cancel(request,{})).status,'cancelled');
  assert.equal(fixture.calls(),1);
  assert.equal(fixture.writes(),1);
});

test('a confirmed terminal result cannot overwrite a locally paid sale or hide a pending result',async()=>{
  const paid=cancellationFixture({status:'paid'});
  assert.equal((await paid.fns.sync(order,{providerStatus:'cancelled'})).status,'paid');
  assert.equal(paid.writes(),0);
  const pending=cancellationFixture({},'pending_execute');
  assert.equal((await pending.fns.cancel({orderId:order.orderId,cancelToken:pending.token},{})).status,'pending');
  assert.equal(pending.writes(),0);
  const legacy=cancellationFixture({chipCancelHash:''});
  assert.equal((await legacy.fns.cancel({orderId:order.orderId},{},true)).status,'cancelled');
});

test('the checkout return sends a scoped cancel request and clears only its own pending entry',async()=>{
  const file=readFileSync(path.join(root,'assets/js/azobss-business-checkout.js'),'utf8');
  const token=Buffer.alloc(32,8).toString('base64url');
  const records=new Map([
    ['azobss_pending_payment_checkout',JSON.stringify({orderId:order.orderId})],
    ['azobssEbookGeneratorPendingV1351',JSON.stringify({orderId:'other'})]
  ]);
  const requests=[];
  let status;
  let page;
  const window={};
  runInNewContext(file,{
    window,URL,URLSearchParams,AbortSignal,history:{replaceState:(_state,_title,url)=>{page=url;}},
    location:{href:'https://www.azobss.com/Software-Tools/?payment=chip_cancelled&orderId='+order.orderId+'#chipCancel='+token},
    document:{readyState:'complete',createElement:()=>({setAttribute(){},style:{}}),body:{prepend:value=>{status=value;}}},
    localStorage:{getItem:k=>records.get(k),removeItem:k=>records.delete(k)},
    fetch:async(url,opts)=>{requests.push({url,body:JSON.parse(opts.body),method:opts.method});return Response.json({ok:true,status:'cancelled'});}
  });
  await window.AZOBSSBusinessCheckout.cancelReturn();
  assert.equal(requests.length,1);
  assert.equal(requests[0].method,'POST');
  assert.deepEqual(requests[0].body,{orderId:order.orderId,cancelToken:token});
  assert.equal(records.has('azobss_pending_payment_checkout'),false);
  assert.equal(records.has('azobssEbookGeneratorPendingV1351'),true);
  assert.equal(page,'https://www.azobss.com/Software-Tools/');
  assert.match(status.textContent,/CHIP confirmed cancellation/);
});


test('new digital CHIP links supply a hidden cancel token and an independent failure return',async()=>{
  const source=readFileSync(path.join(root,'deploy-server.js'),'utf8');
  const block=source.slice(source.indexOf('async function azStartChipPayment('),source.indexOf('async function azCreateManualChipInvoiceLink('));
  const saved=[];
  let requested;
  const start=runInNewContext(block+'azStartChipPayment',{
    URL,crypto,isPaBmPremiumOrder:()=>false,isPublicPaPremiumOrder:()=>false,CHIP_SECTIONS:{software:'Software'},
    azIsMembershipOrder:()=>false,azIsDigitalChipCheckout:()=>true,azValidEmailLike:()=>true,
    azBankReportHash:value=>crypto.createHash('sha256').update(value).digest('hex'),
    azStripeDigitalUrlWithQuery:(base,values)=>{
      const u=new URL(base);
      for(const [k,v] of Object.entries(values))u.searchParams.set(k,v);
      return u.href;
    },
    azPersistPremiumOrder:async row=>{saved.push(row);return {ok:true};},upsertPremiumOrder:row=>row,
    azBusinessPayments:{chipAdapter:()=>({create:async value=>{
      requested=value;
      return {purchaseId,paymentUrl:'https://gate.chip-in.asia/p/fixture/'};
    }})},
    publicBaseUrlFromReq:()=> 'https://backend.example.test'
  });
  await start({...order,buyerEmail:'buyer@example.test',productName:'Sample'}, {},
    'https://www.azobss.com/Software-Tools/?payment=chip_return',
    'https://www.azobss.com/Software-Tools/?payment=chip_cancelled');
  const cancel=new URL(requested.cancelUrl);
  const token=new URLSearchParams(cancel.hash.slice(1)).get('chipCancel');
  assert.equal(cancel.searchParams.get('orderId'),order.orderId);
  assert.match(token,/^[A-Za-z0-9_-]{43}$/);
  assert.equal(saved[0].chipCancelHash,crypto.createHash('sha256').update(token).digest('hex'));
  assert.equal(saved[0].chipCancelToken,undefined);
  assert.equal(saved.at(-1).chipPurchaseId,purchaseId);
  assert.equal(new URL(requested.failureUrl).searchParams.get('payment'),'chip_failed');
  assert.equal(new URL(requested.failureUrl).hash,'');
});

