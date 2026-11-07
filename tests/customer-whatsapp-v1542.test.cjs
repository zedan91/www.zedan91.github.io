'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const contact=require('../assets/js/azobss-customer-whatsapp-v1542');
test('Malaysian customer phone formats resolve to the same direct WhatsApp recipient',()=>{
 for(const value of ['+60 11-3560 0723','011-3560 0723','601135600723','00601135600723','1135600723','+60 (0)11 3560 0723'])assert.equal(contact.url(value),'https://wa.me/601135600723');
 assert.equal(contact.url('+65 8123 4567'),'https://wa.me/6581234567');
 assert.equal(contact.url('+1 (212) 555-0123'),'https://wa.me/12125550123');
});
test('missing, malformed or ambiguous numbers never open a generic chat or the wrong concatenated recipient',()=>{
 for(const value of [null,'','-','customer@example.test','0123456789 / 0134567890','0123456789 ext123','+60+1135600723','javascript:alert(1)','123','+000123456789']){assert.equal(contact.url(value),'');assert.ok(!contact.action(value).includes('href='));}
});
test('direct contact opens only the customer chat without sending, sharing or altering a receipt',()=>{
 const html=contact.action('+60 11-3560 0723',{className:'az-sr-icon-btn wa',iconOnly:true});assert.ok(html.includes('href="https://wa.me/601135600723"'));assert.ok(html.includes('target="_blank"'));assert.ok(html.includes('rel="noopener noreferrer"'));assert.ok(html.includes('WhatsApp Customer'));assert.ok(!/\?text=|data-sr-doc-copy|data-sr-doc-share|data-sr-receipt-sent|onclick=/.test(html));
});
