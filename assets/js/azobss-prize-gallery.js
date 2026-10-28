(function(){
 'use strict';
 const $=id=>document.getElementById(id),host=$('ld-prize-gallery'),input=$('prizeImageFile'),urls=$('prizeImageUrlInput');
 if(!host||!input||!urls)return;
 const list=$('ld-gallery-list'),drop=$('ld-gallery-drop'),note=$('ld-gallery-status'),summary=$('ld-gallery-count');
 let items=[],saved=[],dirty=false,busy=false,adding=false,dragged=null,nextId=0;
 const makeItem=value=>({id:++nextId,...value}),say=(message,error=false)=>{note.textContent=message;note.classList.toggle('error',error);};
 function normalUrl(raw){const url=new URL(raw,location.origin+'/lucky-draw/');if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.href.length>1200)throw Error('URL gambar tidak sah.');return url.href;}
 function release(){for(const item of items)if(item.file)URL.revokeObjectURL(item.src);}
 function button(label,text,action,disabled){const node=document.createElement('button');node.type='button';node.textContent=text;node.title=label;node.setAttribute('aria-label',label);node.disabled=disabled;node.addEventListener('click',action);return node;}
 function render(focus){
  list.replaceChildren();summary.textContent=items.length+' / 50 gambar'+(dirty?' · Belum disimpan':'');
  drop.classList.toggle('is-busy',busy||adding);host.setAttribute('aria-busy',String(busy||adding));
  host.querySelectorAll('input,button,textarea').forEach(node=>{node.disabled=busy||adding;});
  for(const [index,item] of items.entries()){
   const card=document.createElement('li');card.className='ld-gallery-card';card.dataset.galleryId=String(item.id);card.draggable=!busy&&!adding;
   const image=document.createElement('img');image.src=item.src;image.alt='Gambar hadiah '+(index+1);image.draggable=false;image.loading='lazy';
   image.addEventListener('error',()=>{image.classList.add('has-error');image.alt='Gambar tidak dapat dimuatkan';});
   const badge=document.createElement('span');badge.className='ld-gallery-badge';badge.textContent=index===0?'1 · Utama':String(index+1);
   const caption=document.createElement('span');caption.className='ld-gallery-caption';caption.textContent=item.file?item.file.name:'Gambar disimpan';caption.title=item.file?item.file.name:item.src;
   const controls=document.createElement('div');controls.className='ld-gallery-controls';
   controls.append(button('Jadikan gambar '+(index+1)+' utama','★',()=>move(item.id,0),busy||adding||index===0),button('Alih gambar '+(index+1)+' ke kiri','←',()=>move(item.id,index-1),busy||adding||index===0),button('Alih gambar '+(index+1)+' ke kanan','→',()=>move(item.id,index+1),busy||adding||index===items.length-1),button('Buang gambar '+(index+1),'×',()=>remove(item.id),busy||adding));
   card.append(image,badge,caption,controls);list.append(card);
  }
  if(!items.length){const empty=document.createElement('li');empty.className='ld-gallery-empty';empty.textContent='Belum ada gambar. Seret gambar ke ruang di atas untuk bermula.';list.append(empty);}
  if(focus)list.querySelector('[data-gallery-id="'+focus+'"] button:not(:disabled)')?.focus();
 }
 function changed(message){dirty=true;render();say(message+' Tekan Simpan hadiah untuk diterbitkan.');}
 function move(id,to){if(busy||adding)return;const from=items.findIndex(item=>item.id===id);if(from<0||to<0||to>=items.length||from===to)return;const [item]=items.splice(from,1);items.splice(to,0,item);changed('Susunan dikemas kini.');render(id);}
 function remove(id){if(busy||adding)return;const index=items.findIndex(item=>item.id===id);if(index<0)return;const [item]=items.splice(index,1);if(item.file)URL.revokeObjectURL(item.src);changed('Gambar dikeluarkan daripada senarai.');}
 function load(values,{force=false}={}){
  const unique=[...new Set(values.filter(Boolean).filter(value=>!String(value).includes('prize-placeholder')).map(normalUrl))].slice(0,50);
  saved=unique;if((dirty||adding||busy)&&!force)return;
  release();items=unique.map(src=>makeItem({src}));dirty=false;input.value='';render();say('Gambar pertama ialah gambar utama. Seret kad atau gunakan anak panah untuk susun.');
 }
 async function addFiles(files){
  if(busy||adding)return;adding=true;render();let added=0;const errors=[];
  try{for(const file of Array.from(files)){
   if(items.length>=50){errors.push('Maksimum 50 gambar.');break;}
   if(items.filter(item=>item.file).length>=10){errors.push('Maksimum 10 fail baharu bagi setiap simpanan.');break;}
   if(!/^image\/(jpeg|png|webp|gif|avif)$/i.test(file.type)){errors.push(file.name+': guna JPG, PNG, WebP, GIF atau AVIF.');continue;}
   if(!file.size||file.size>5*1024*1024){errors.push(file.name+': maksimum 5 MB setiap gambar.');continue;}
   if(items.some(item=>item.file&&item.file.name===file.name&&item.file.size===file.size&&item.file.lastModified===file.lastModified)){errors.push(file.name+': sudah ditambah.');continue;}
   const src=URL.createObjectURL(file);
   try{await new Promise((resolve,reject)=>{const image=new Image();image.onload=resolve;image.onerror=reject;image.src=src;});items.push(makeItem({file,src}));added++;}catch{URL.revokeObjectURL(src);errors.push(file.name+': gambar tidak dapat dibaca.');}
  }}finally{adding=false;input.value='';if(added)dirty=true;render();say((added?added+' gambar ditambah. Tekan Simpan hadiah. ':'')+errors.join(' '),!!errors.length);}
 }
 $('ld-gallery-pick').addEventListener('click',()=>input.click());input.addEventListener('change',()=>addFiles(input.files));
 drop.addEventListener('dragover',event=>{event.preventDefault();if(!busy&&!adding){drop.classList.add('is-over');event.dataTransfer.dropEffect='copy';}});
 drop.addEventListener('dragleave',event=>{if(!drop.contains(event.relatedTarget))drop.classList.remove('is-over');});
 drop.addEventListener('drop',event=>{event.preventDefault();drop.classList.remove('is-over');addFiles(event.dataTransfer.files);});
 // Prevent an image dropped just outside the target from navigating away from the editor.
 const panel=$('adminPrizePanel');panel.addEventListener('dragover',event=>{if(event.dataTransfer.types.includes('Files'))event.preventDefault();});panel.addEventListener('drop',event=>{if(event.dataTransfer.types.includes('Files'))event.preventDefault();});
 list.addEventListener('dragstart',event=>{const card=event.target.closest('[data-gallery-id]');if(!card||busy||adding)return;dragged=Number(card.dataset.galleryId);event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',String(dragged));card.classList.add('is-dragging');});
 list.addEventListener('dragover',event=>{if(dragged!==null){event.preventDefault();event.dataTransfer.dropEffect='move';const card=event.target.closest('[data-gallery-id]');list.querySelectorAll('.is-target').forEach(node=>node.classList.remove('is-target'));card?.classList.add('is-target');}});
 list.addEventListener('drop',event=>{event.preventDefault();if(dragged===null)return;const card=event.target.closest('[data-gallery-id]');if(card)move(dragged,items.findIndex(item=>item.id===Number(card.dataset.galleryId)));dragged=null;});
 list.addEventListener('dragend',()=>{dragged=null;list.querySelectorAll('.is-dragging,.is-target').forEach(node=>node.classList.remove('is-dragging','is-target'));});
 $('ld-gallery-reset').addEventListener('click',()=>load(saved,{force:true}));
 $('ld-gallery-save').addEventListener('click',()=>$('savePrizeButton').click());
 $('ld-gallery-add-urls').addEventListener('click',()=>{
  if(busy||adding)return;try{const values=urls.value.split(/[\n,]+/).map(value=>value.trim()).filter(Boolean).map(normalUrl);const fresh=[...new Set(values)].filter(src=>!items.some(item=>item.src===src));if(items.length+fresh.length>50)throw Error('Maksimum 50 gambar.');items.push(...fresh.map(src=>makeItem({src})));urls.value='';changed(fresh.length+' gambar URL ditambah.');}catch(error){say(error.message,true);}
 });
 window.azPrizeGallery={load,get dirty(){return dirty;},get busy(){return busy||adding;},setBusy(value){busy=value;render();},appendTo(form){
  if(adding)throw Error('Tunggu sehingga pratonton gambar selesai dimuatkan.');
  let index=0;const order=items.map(item=>{if(!item.file)return {kind:'url',url:item.src};form.append('images',item.file);return {kind:'upload',index:index++};});form.append('galleryOrder',JSON.stringify(order));
 }};
 load(urls.value.split(/[\n,]+/).map(value=>value.trim()).filter(Boolean));urls.value='';
 window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
 window.addEventListener('pagehide',event=>{if(!event.persisted)release();});
})();
