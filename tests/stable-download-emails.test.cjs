'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const server=fs.readFileSync(path.join(root,'deploy-server.js'),'utf8');
const {DOWNLOAD}=require('../lib/azobss-solattime-commerce');
const expected={azdm:'https://files.azobss.com/azdm/releases/Latest/AZDM-Setup.exe',liyabudun:'https://files.azobss.com/liyabudun/releases/Latest/Liyabudun_Setup.exe'};
for(const [product,name,next] of [['azdm','azAzdmSendSerialEmail','azVerifySolatTimePurchase'],['liyabudun','azSendSolatTimeSerialEmail','azFulfillAzdmOrder']]){
 test(`${product} future licence email has fixed installer URL in HTML and plain text`,async()=>{
  const start=server.indexOf(`async function ${name}(`),end=server.indexOf(`async function ${next}(`,start);
  assert.ok(start>=0&&end>start);
  let sent;
  const context={cleanToyyibEmail:s=>s,cleanPremiumText:s=>s,mailReady:()=>true,azAzdmSafeHtml:s=>s,
   SOLATTIME_INSTALLER_URL:DOWNLOAD,FRONTEND_BASE_URL:'https://www.azobss.com',azSendEmailWithOptionalPdf:async message=>{sent=message;}};
  vm.createContext(context);vm.runInContext(server.slice(start,end)+`\nthis.send=${name};`,context);
  await context.send({email:'fixture@example.invalid',orderId:'fixture-order',user:{username:'Fixture'}},product==='azdm'?[{serial:'FIXTURE-SERIAL'}]:{serial:'FIXTURE-SERIAL'});
  assert.ok(sent.text.includes(expected[product]));assert.ok(sent.html.includes(`href="${expected[product]}"`));
  assert.ok(!/releases\/\d+\.\d+\.\d+\//.test(sent.text));
 });
}
test('website direct download buttons use the same fixed paths',()=>{
 const html=fs.readFileSync(path.join(root,'Software-Tools/index.html'),'utf8');
 assert.ok(html.includes(expected.azdm));
 assert.equal(DOWNLOAD,expected.liyabudun);
 assert.ok(fs.readFileSync(path.join(root,'liyabudun/index.html'),'utf8').includes(expected.liyabudun));
});
