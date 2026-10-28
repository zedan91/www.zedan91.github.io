'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const window={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../assets/js/azobss-solattime-workspace.js'),'utf8'),{window,document:{getElementById:()=>null}});
const {orderMatches,auditEvents}=window.azSolatTimeWorkspaceModel;
test('shared order search covers phone, UID and receipt without fetching or indexing serials',()=>{
 const order={customer:'Contoh',phone:'01112345678',account_uid:'uid-buyer',receipt_no:'AZR-fixture',license_id:'license-fixture'};
 for(const term of ['011123','uid-buyer','azr-fixture','license-fixture'])assert.ok(orderMatches(order,term));
 assert.equal(orderMatches(order,'different-account'),false);assert.equal(orderMatches({...order,serial:'SECRET-SERIAL'},'secret-serial'),false);
});
test('pending or reserved/review purchases do not claim a serial was issued or invent issuance times',()=>{
 const pending=auditEvents({order_id:'demo',status:'pending',fulfillment_state:'awaiting_payment',license_id:'reserved-id',email_status:'queued'});
 assert.equal(pending.some(event=>event.label==='Serial siap'),false);assert.equal(pending.some(event=>event.label==='Bayaran disahkan'),false);
 const review=auditEvents({order_id:'demo',status:'paid',fulfillment_state:'review',license_id:'reserved-id',email_status:'review'});
 assert.equal(review.some(event=>event.label==='Serial siap'),false);assert.ok(review.some(event=>event.state==='warning'));
});
test('audit uses recorded payment/email timestamps and current matching license status',()=>{
 const events=auditEvents({order_id:'demo',created_at:'2026-10-24T01:00:00Z',status:'paid',payment_verified_at:'2026-10-24T01:02:00Z',fulfillment_state:'complete',license_id:'id-a',email_status:'accepted',email_sent_at:'2026-10-24T01:03:00Z'}, {id:'id-a',customer:'Contoh',device_count:1,status:'blocked'});
 assert.equal(events.find(event=>event.label==='Bayaran disahkan').time,'2026-10-24T01:02:00Z');assert.equal(events.find(event=>event.label==='E-mel diterima penyedia').time,'2026-10-24T01:03:00Z');assert.equal(events.find(event=>event.label==='Serial siap').time,'');assert.ok(events.some(event=>event.label==='PC didaftarkan'));assert.ok(events.some(event=>event.label==='Status semasa: lesen disekat'));
});
