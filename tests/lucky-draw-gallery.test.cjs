const {test}=require('node:test'),assert=require('node:assert/strict');
const gallery=import('../backend/lucky-draw-gallery.js');
const old=['https://example.com/old-a.jpg','https://example.com/old-b.jpg'];
test('mixed retained and uploaded photos persist in the exact chosen order, including a new main photo',async()=>{
 const {savePrizeGallery}=await gallery,calls=[];
 const result=await savePrizeGallery({body:{galleryOrder:JSON.stringify([{kind:'upload',index:1},{kind:'url',url:old[1]},{kind:'upload',index:0}]),imageUrls:JSON.stringify(old),imageUrl:old[0]},files:['new-a','new-b'],previous:{imageUrls:old},uploadImage:async file=>{calls.push(file);return 'https://res.cloudinary.com/demo/'+file+'.jpg';},localUrl:()=>assert.fail('unexpected fallback')});
 assert.deepEqual(calls,['new-a','new-b']);assert.deepEqual(result.imageUrls,['https://res.cloudinary.com/demo/new-b.jpg',old[1],'https://res.cloudinary.com/demo/new-a.jpg']);assert.equal(result.imageStorage,'cloudinary');
});
test('reordering/removing existing images and clearing the gallery override stale JSON and primary URL',async()=>{
 const {savePrizeGallery}=await gallery;
 for(const entries of [[{kind:'url',url:old[1]}],[]]){
  const result=await savePrizeGallery({body:{galleryOrder:JSON.stringify(entries),imageUrl:old[0],imageUrls:JSON.stringify(old)},files:[],previous:{imageUrls:old},uploadImage:()=>assert.fail('no upload needed')});assert.deepEqual(result.imageUrls,entries.map(item=>item.url));
 }
});
test('bad manifests, unsafe URLs, missing/duplicate file references and limits fail before any upload',async()=>{
 const {savePrizeGallery}=await gallery;
 const cases=[['broken',[]],['{}',[]],[JSON.stringify([{kind:'url',url:'javascript:alert(1)'}]),[]],[JSON.stringify([{kind:'url',url:'https://user:secret@example.com/a.jpg'}]),[]],[JSON.stringify([{kind:'upload',index:0},{kind:'upload',index:0}]),['a']],[JSON.stringify([{kind:'upload',index:-1}]),['a']],['[]',['unreferenced']],[JSON.stringify(Array.from({length:51},()=>({kind:'url',url:old[0]}))),[]],['[]',Array(11).fill('a')]];
 for(const [raw,files] of cases)await assert.rejects(()=>savePrizeGallery({body:{galleryOrder:raw},files,previous:{imageUrls:old},uploadImage:()=>assert.fail('invalid input uploaded')}),error=>error.status===400);
});
test('all image bytes validate before uploads; a corrupt last image never partially changes the gallery',async()=>{
 const {savePrizeGallery}=await gallery;let uploads=0;
 await assert.rejects(()=>savePrizeGallery({body:{galleryOrder:JSON.stringify([{kind:'upload',index:0},{kind:'upload',index:1}])},files:['good','corrupt'],previous:{imageUrls:old},validateImage:async file=>{if(file==='corrupt')throw Error('invalid image');},uploadImage:async()=>{uploads++;}}),/invalid image/);assert.equal(uploads,0);
});
test('local fallback storage remains flagged when mixed with persistent existing pictures',async()=>{
 const {savePrizeGallery}=await gallery;
 const result=await savePrizeGallery({body:{galleryOrder:JSON.stringify([{kind:'url',url:old[0]},{kind:'upload',index:0}])},files:['new'],previous:{},uploadImage:async()=>null,localUrl:()=> 'https://api.example.com/uploads/lucky-draw/new.jpg'});assert.equal(result.imageStorage,'backend-upload');assert.equal(result.imageUrls.length,2);
});
test('legacy clients retain existing images or replace them with uploads as before',async()=>{
 const {savePrizeGallery}=await gallery,base={body:{},files:[],previous:{imageUrls:[],imageUrl:old[0]},uploadImage:async file=>'https://example.com/'+file+'.jpg'};
 assert.deepEqual((await savePrizeGallery(base)).imageUrls,[old[0]]);
 assert.deepEqual((await savePrizeGallery({...base,body:{imageUrls:JSON.stringify(old)}})).imageUrls,old);
 assert.deepEqual((await savePrizeGallery({...base,files:['new']})).imageUrls,['https://example.com/new.jpg']);
});
test('production prize route retains admin middleware and writes the ordered gallery, main URL and explicit empty gallery',async()=>{
 const fs=require('node:fs'),path=require('node:path'),{savePrizeGallery}=await gallery;
 const code=fs.readFileSync(path.join(__dirname,'../backend/server.js'),'utf8');
 const route=code.slice(code.indexOf('app.post("/api/lucky-draw/prize",'),code.indexOf('// Simple alias for browser test'));
 let handler,written,uploadCalls=0;const admin=()=>{},uploadMiddleware=()=>{};
 const app={post:(name,auth,upload,fn)=>{assert.equal(name,'/api/lucky-draw/prize');assert.equal(auth,admin);assert.equal(upload,uploadMiddleware);handler=fn;}};
 const upload={fields:spec=>{assert.deepEqual(spec,[{name:'image',maxCount:1},{name:'images',maxCount:10}]);return uploadMiddleware;}};
 new Function('app','requireAdmin','upload','monthKey','luckyPrizeStore','savePrizeGallery','sharp','uploadLuckyPrizeImagePersistent','fs','PUBLIC_BASE_URL',route)(app,admin,upload,()=> '2026-10',{storage:'firestore',get:async()=>({imageUrls:old}),save:async(_,value)=>{written=value;}},savePrizeGallery,()=>({metadata:async()=>({format:'jpeg',width:10,height:10})}),async()=>{uploadCalls++;return 'https://res.cloudinary.com/demo/new.jpg';},{unlinkSync:()=>{}},'https://api.example.com');
 const response=()=>({statusCode:200,status(value){this.statusCode=value;return this;},json(value){this.body=value;}});
 let res=response();await handler({body:{title:'Prize',galleryOrder:JSON.stringify([{kind:'upload',index:0},{kind:'url',url:old[1]}])},files:{images:[{path:'fixture.jpg'}]}},res);
 assert.equal(res.statusCode,200);assert.equal(res.body.galleryProtocol,1);assert.equal(res.body.persistentImage,true);assert.equal(uploadCalls,1);assert.deepEqual(written.imageUrls,['https://res.cloudinary.com/demo/new.jpg',old[1]]);assert.equal(written.imageUrl,written.imageUrls[0]);assert.deepEqual(written.images,written.imageUrls);
 res=response();await handler({body:{title:'Prize',galleryOrder:'[]'},files:{}},res);assert.equal(written.imageUrl,'');assert.deepEqual(written.images,[]);
 written=null;res=response();await handler({body:{galleryOrder:'invalid'},files:{}},res);assert.equal(res.statusCode,400);assert.equal(written,null);
});
