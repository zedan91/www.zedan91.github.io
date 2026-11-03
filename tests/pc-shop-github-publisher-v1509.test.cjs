const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const source = p => fs.readFileSync(path.join(ROOT,p), 'utf8');

test('v1509 publishing remains server-only and requires a verified administrator', () => {
  const server = source('backend/server.js');
  const code = source('backend/pc-shop-github-image-publisher.js');
  const client = source('assets/js/azobss-pc-image-editor-v1508.js');
  const viewer = source('assets/js/azobss-pc-shop-v1487.js');
  assert.match(server, /registerPcShopGithubImagePublisher\(app,\s*\{multer, getFirebaseAdminIdentity, azBackendTrustedAdminIdentity\}\)/);
  assert.match(code, /getFirebaseAdminIdentity\(req\)/);
  assert.match(code, /azBackendTrustedAdminIdentity\(identity\)/);
  assert.match(code, /never ADMIN_KEY header only/);
  assert.match(code, /AZOBSS_GITHUB_TOKEN/);
  assert.match(code, /sharp\(req\.file\.buffer/);
  assert.match(code, /limitInputPixels:8_000_000/);
  assert.match(code, /image-publish/);
  assert.match(client, /data-photo-publish/);
  assert.match(client, /azobssGetFirebaseAuthHeaders\(true\)/);
  assert.match(viewer, /function openImageViewer\(p\)\{[^}]*dedicatedImageViewer\([^;]*'hardware',String\(p.id\|\|p.productId\|\|''\)/);
  assert.doesNotMatch(client, /GITHUB_TOKEN|github_pat_|ghp_|api\.github\.com/);
});

test('v1509 GitHub publish atomically writes exact image + map + cache-busted PC page', async () => {
  const {publishAtomically} = await import('../backend/pc-shop-github-image-publisher.js');
  const calls = [];
  const refs = [];
  const postBlobs=[];
  const savedFetch=global.fetch;
  const parent='a'.repeat(40),tree='b'.repeat(40),commit='e'.repeat(40);
  const map='window.AZOBSS_PC_LOCAL_HARDWARE_IMAGES={"version":"1505","ready":false,"expected":14,"downloaded":0,"byId":{},"byName":{}};';
  const html='<script src="/PC-Build/images/products/local-hardware-map-v1505.js?v=1506"></script>';
  const response=(status,data)=>({ok:status>=200&&status<300,status,json:async()=>data});
  global.fetch=async (url,opts={})=>{
    const method=opts.method||'GET';calls.push({url,method});
    if(url.endsWith('/git/ref/heads/main')&&method==='GET')return response(200,{object:{sha:parent}});
    if(url.endsWith('/git/commits/'+parent))return response(200,{tree:{sha:tree}});
    if(url.includes('/contents/PC-Build/images/products/local-hardware-map-v1505.js'))return response(200,{content:Buffer.from(map).toString('base64')});
    if(url.includes('/contents/PC-Build/index.html'))return response(200,{content:Buffer.from(html).toString('base64')});
    if(url.endsWith('/git/blobs')&&method==='POST'){
      const body=JSON.parse(opts.body);postBlobs.push(body);
      return response(201,{sha:(String(postBlobs.length).repeat(40)).slice(0,40)});
    }
    if(url.endsWith('/git/trees')&&method==='POST'){
      const body=JSON.parse(opts.body);refs.push(body);return response(201,{sha:'d'.repeat(40)});
    }
    if(url.endsWith('/git/commits')&&method==='POST')return response(201,{sha:commit});
    if(url.endsWith('/git/refs/heads/main')&&method==='PATCH')return response(200,{});
    throw new Error('Unexpected GitHub API call: '+method+' '+url);
  };
  try{
    const result=await publishAtomically({token:'mock-only',repo:'zedan91/www.zedan91.github.io',branch:'main',kind:'hardware',id:'allit-deepcool-cc310',name:'DeepCool CC310 Micro-ATX Case - Black',imageBuffer:Buffer.from('image-test-only')});
    assert.equal(result.commit,commit);
    assert.equal(result.imagePath,'PC-Build/images/products/admin-edit-allit-deepcool-cc310.webp');
    assert.match(result.imageUrl,/\/PC-Build\/images\/products\/admin-edit-allit-deepcool-cc310\.webp\?v=[a-f0-9]{12}/);
    assert.equal(refs.length,1);
    assert.deepEqual(refs[0].tree.map(x=>x.path),[
      'PC-Build/images/products/admin-edit-allit-deepcool-cc310.webp',
      'PC-Build/images/products/local-hardware-map-v1505.js',
      'PC-Build/index.html'
    ]);
    const mapBlob=postBlobs.find(x=>x.encoding==='utf-8'&&x.content.startsWith('window.AZOBSS_PC_LOCAL_HARDWARE_IMAGES='));
    assert.ok(mapBlob);
    assert.match(mapBlob.content, /"ready":true/);
    assert.match(mapBlob.content,/"allit-deepcool-cc310":"\/PC-Build\/images\/products\/admin-edit-allit-deepcool-cc310.webp\?v=/);
    const htmlBlob=postBlobs.find(x=>x.encoding==='utf-8'&&x.content.includes('<script'));
    assert.ok(htmlBlob);
    assert.match(htmlBlob.content,/local-hardware-map-v1505\.js\?v=\d+-[a-f0-9]{12}/);
    assert.ok(calls.some(x=>x.url.endsWith('/git/refs/heads/main')&&x.method==='PATCH'));
  } finally{global.fetch=savedFetch;}
});
