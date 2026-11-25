'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync, sign } = require('node:crypto');
const { Readable } = require('node:stream');
const { createChipAdminTest } = require('../lib/azobss-chip-admin-test.cjs');

const keypair=generateKeyPairSync('rsa',{modulusLength:2048});
const pem=keypair.publicKey.export({type:'spki',format:'pem'});
const brandId='11111111-1111-1111-1111-111111111111';
const purchaseId='22222222-2222-2222-2222-222222222222';
const sandboxKey='synthetic-sandbox-key';
const liveKey='synthetic-live-key';

function fixture({testKey=sandboxKey, isTest=true, initialStatus='created'}={}) {
  const records=new Map();
  const calls=[];
  let payload;
  let providerStatus=initialStatus;
  const getDb=()=>({
    collection: name=>{
      assert.equal(name,'chipAdminTestPayments');
      return {doc:id=>({
        get:async()=>({ data:()=>records.get(id) }),
        set:async(fields,options)=>records.set(id,options?.merge?{...records.get(id),...fields}:fields)
      })};
    }
  });
  const fetchImpl=async (url,options)=>{
    const path=new URL(url).pathname;
    assert.equal(options.headers.Authorization,'Bearer '+sandboxKey);
    calls.push(path);
    if(path.endsWith('/public_key/')) return Response.json(pem);
    if(path.endsWith('/payment_methods/')) return Response.json({available_payment_methods:['fpx']});
    if(path.endsWith('/purchases/')) payload=JSON.parse(options.body);
    else assert.ok(path.endsWith('/purchases/'+purchaseId+'/'));
    return Response.json({
      id:purchaseId, brand_id:brandId, is_test:isTest, reference:payload.reference, status:providerStatus,
      checkout_url:'https://gate.chip-in.asia/p/'+purchaseId+'/', purchase:{currency:'MYR',total:100},
      payment:providerStatus==='paid'?{is_outgoing:false,currency:'MYR',amount:100}:null
    });
  };
  const service=createChipAdminTest({
    getDb, fetchImpl, frontendBase:'https://www.azobss.com',
    callbackUrl:'https://azobss-backend.onrender.com/api/chip/admin-test-callback',
    env:{CHIP_TEST_API_KEY:testKey,CHIP_TEST_BRAND_ID:brandId,CHIP_API_KEY:liveKey}
  });
  return {service,records,calls,payload:()=>payload,setPaid:()=>{providerStatus='paid';}};
}

function callbackRequest(purchase,{signatureIsValid=true}={}) {
  const body=Buffer.from(JSON.stringify(purchase));
  const signature=signatureIsValid ? sign('RSA-SHA256',body,keypair.privateKey).toString('base64') : 'QkFE';
  return Object.assign(Readable.from([body]),{headers:{'x-signature':signature}});
}

test('admin CHIP test uses the test key, fixed sandbox amount and isolated storage',async()=>{
  const f=fixture();
  const result=await f.service.create('fixture-admin');
  assert.equal(result.amountSen,100);
  assert.equal(f.payload().purchase.products[0].price,100);
  assert.equal(f.payload().send_receipt,false);
  assert.equal(f.payload().success_callback,'https://azobss-backend.onrender.com/api/chip/admin-test-callback');
  assert.equal(f.records.get(result.testId).status,'pending');
  assert.equal((await f.service.status(result.testId,'fixture-admin')).status,'pending');
  await assert.rejects(f.service.status(result.testId,'another-admin'),{statusCode:404});
  f.setPaid();
  assert.equal((await f.service.status(result.testId,'fixture-admin')).status,'paid');
  assert.equal(f.records.get(result.testId).status,'paid');
});

test('sandbox checkout rejects missing or reused live keys and withholds a live-mode link',async()=>{
  const reused=fixture({testKey:liveKey});
  assert.equal(reused.service.configuration(),'live_key_reused');
  await assert.rejects(reused.service.create('admin'),{statusCode:503});
  assert.equal(reused.calls.length,0);
  const missing=fixture({testKey:''});
  await assert.rejects(missing.service.create('admin'),{statusCode:503});
  assert.equal(missing.calls.length,0);
  const wrongMode=fixture({isTest:false});
  await assert.rejects(wrongMode.service.create('admin'),{statusCode:502});
  const [stored]=wrongMode.records.values();
  assert.equal(stored.status,'failed');
  assert.equal(stored.chipPurchaseId,undefined);
});

test('sandbox callback requires a valid signed test event and checks the provider for payment',async()=>{
  const f=fixture();
  const result=await f.service.create('admin');
  const payload={id:purchaseId,reference:result.testId,is_test:true,status:'paid'};
  await assert.rejects(f.service.callback(callbackRequest(payload,{signatureIsValid:false})),{statusCode:401});
  await assert.rejects(f.service.callback(callbackRequest({...payload,is_test:false})),{statusCode:409});
  assert.equal(await f.service.callback(callbackRequest(payload)),false);
  f.setPaid();
  assert.equal(await f.service.callback(callbackRequest(payload)),true);
  assert.equal(f.records.get(result.testId).status,'paid');
});

