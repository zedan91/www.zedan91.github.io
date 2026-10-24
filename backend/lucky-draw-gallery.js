// Explicit gallery manifests keep existing URLs and new uploads in one ordered list.
const fail=message=>{const error=new Error(message);error.status=400;throw error;};
export function parseGalleryOrder(raw,fileCount){
 if(fileCount>10)fail('Maksimum 10 fail baharu setiap simpanan.');
 let order;try{order=JSON.parse(raw);}catch{fail('Susunan gambar tidak sah. Muat semula dan cuba lagi.');}
 if(!Array.isArray(order)||order.length>50)fail('Maksimum 50 gambar hadiah.');
 const used=new Set();
 const result=order.map(item=>{
  if(!item||typeof item!=='object')fail('Item gambar tidak sah.');
  if(item.kind==='upload'){
   if(!Number.isInteger(item.index)||item.index<0||item.index>=fileCount||used.has(item.index))fail('Rujukan fail gambar tidak sah.');
   used.add(item.index);return {kind:'upload',index:item.index};
  }
  if(item.kind!=='url'||typeof item.url!=='string'||item.url.length>1200)fail('URL gambar tidak sah.');
  let url;try{url=new URL(item.url);}catch{fail('URL gambar mesti menggunakan http atau https.');}
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password)fail('URL gambar mesti menggunakan http atau https.');
  return {kind:'url',url:url.href};
 });
 if(used.size!==fileCount)fail('Terdapat fail tanpa kedudukan dalam galeri.');
 return result;
}
export async function savePrizeGallery({body,files,previous,uploadImage,localUrl,validateImage=async()=>{}}){
 const ordered=body.galleryOrder!==undefined;
 // Validate every reference and file before any upload or prize record write.
 const order=ordered?parseGalleryOrder(body.galleryOrder,files.length):null;
 if(ordered)for(const file of files)await validateImage(file);
 let urls=Array.isArray(previous.imageUrls)?previous.imageUrls.filter(Boolean):[];
 if(!urls.length)urls=[previous.imageUrl||previous.image].filter(Boolean);
 let storage=previous.imageStorage||(urls.length?'url':'');
 if(!ordered){
  let manual=[];
  if(body.imageUrls){try{const parsed=JSON.parse(body.imageUrls);if(Array.isArray(parsed))manual=parsed;}catch{manual=String(body.imageUrls).split(/[\n,]+/);}}
  manual=manual.map(value=>String(value||'').trim().slice(0,1200)).filter(Boolean);
  const single=String(body.imageUrl||'').trim().slice(0,1200);
  if(single&&!manual.includes(single))manual.unshift(single);
  if(manual.length)urls=manual;
 }
 const uploaded=[];
 for(const file of files.slice(0,10)){const persistent=await uploadImage(file);uploaded.push(persistent||localUrl(file));}
 if(ordered)urls=order.map(item=>item.kind==='url'?item.url:uploaded[item.index]);
 else if(uploaded.length)urls=uploaded;
 if(ordered||uploaded.length)storage=urls.some(url=>/\/uploads\/lucky-draw\//.test(url))?'backend-upload':urls.some(url=>/^https:\/\/res\.cloudinary\.com\//i.test(url))?'cloudinary':'url';
 return {imageUrls:urls,imageStorage:storage};
}
