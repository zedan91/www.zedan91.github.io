'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),os=require('node:os'),fs=require('node:fs'),path=require('node:path');
const {createPcShopRuntime}=require('../lib/azobss-pc-shop-runtime');
test('cross-origin source-price preflight succeeds before the actual GET enforces admin authentication',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'az-source-cors-'));let authCalls=0;
 fs.mkdirSync(path.join(root,'PC-Build/catalog/v1496'),{recursive:true});fs.writeFileSync(path.join(root,'PC-Build/catalog/v1496/sources.json'),JSON.stringify({sources:[]}));
 const send=(res,status,body,type,headers)=>{res.writeHead(status,{'Content-Type':type,'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization, x-admin-key',...headers});res.end(body);};
 const runtime=createPcShopRuntime({rootDir:root,getDb:()=>null,getUserIdentity:async()=>null,getAdminIdentity:async()=>{authCalls++;return null;},readBody:async()=>Buffer.alloc(0),send});
 const server=http.createServer(async(req,res)=>{const url=new URL(req.url,'http://localhost');const handled=await runtime.handle(req,res,{pathname:url.pathname,query:Object.fromEntries(url.searchParams)});if(handled!==false)return;if(req.method==='OPTIONS')return send(res,204,'','text/plain');send(res,404,'','text/plain');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 try{
  for(const route of ['source-prices?scope=upgrade','source-prices?scope=pc','source-prices?scope=builds','source-pricelist.pdf']){
   const response=await fetch(base+'/api/admin/pc-shop/'+route,{method:'OPTIONS',headers:{Origin:'https://www.azobss.com','Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'authorization,x-admin-key'}});
   assert.equal(response.status,204,route);assert.match(response.headers.get('Access-Control-Allow-Headers'),/Authorization/);assert.equal(await response.text(),'');
  }
  assert.equal(authCalls,0);
  const denied=await fetch(base+'/api/admin/pc-shop/source-prices?scope=upgrade',{headers:{Origin:'https://www.azobss.com',Authorization:'Bearer untrusted-fixture'}});assert.equal(denied.status,403);assert.equal((await denied.json()).error,'admin_required');assert.equal(authCalls,1);
 }finally{await new Promise(resolve=>server.close(resolve));fs.rmSync(root,{recursive:true,force:true});}
});
