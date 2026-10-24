(function(){
 'use strict';
 const trigger=document.getElementById('prizeImage'),title=document.getElementById('prizeTitle'),description=document.getElementById('prizeDescription'),counter=document.getElementById('prizeImageCounter'),shell=document.getElementById('prizeCarouselShell');
 if(!trigger||!title||!description||!shell)return;
 const dialog=document.createElement('dialog');dialog.className='ld-prize-lightbox';dialog.setAttribute('aria-labelledby','ld-prize-lightbox-title');
 dialog.innerHTML='<button class="ld-prize-lightbox-close" type="button">×</button><div class="ld-prize-lightbox-grid"><div class="ld-prize-lightbox-media"><img class="ld-prize-lightbox-image" alt=""><button class="ld-prize-lightbox-prev" type="button">‹</button><button class="ld-prize-lightbox-next" type="button">›</button><span class="ld-prize-lightbox-counter" aria-live="polite"></span></div><div class="ld-prize-lightbox-copy"><h2 id="ld-prize-lightbox-title"></h2><div class="ld-prize-lightbox-description"></div></div></div>';
 document.body.append(dialog);
 const image=dialog.querySelector('img'),heading=dialog.querySelector('h2'),copy=dialog.querySelector('.ld-prize-lightbox-description'),count=dialog.querySelector('.ld-prize-lightbox-counter'),close=dialog.querySelector('.ld-prize-lightbox-close'),previous=dialog.querySelector('.ld-prize-lightbox-prev'),next=dialog.querySelector('.ld-prize-lightbox-next');
 const english=()=>window.azLuckyBridge?.state?.().language==='en';
 function labels(){
  trigger.setAttribute('aria-label',english()?'Enlarge prize image and description':'Besarkan gambar dan deskripsi hadiah');
  close.setAttribute('aria-label',english()?'Close prize preview':'Tutup pratonton hadiah');
  previous.setAttribute('aria-label',english()?'Previous prize image':'Gambar hadiah sebelum');next.setAttribute('aria-label',english()?'Next prize image':'Gambar hadiah seterusnya');
 }
 function sync(){
  labels();if(!dialog.open)return;
  const src=trigger.src;if(image.src!==src)image.src=src;
  image.alt=title.textContent.trim();heading.textContent=title.textContent;
  // Copy only the already-rendered, escaped/linkified description from the prize card.
  copy.replaceChildren(...Array.from(description.childNodes,node=>node.cloneNode(true)));
  count.textContent=counter?.textContent||'';
  const single=shell.classList.contains('single');previous.hidden=single;next.hidden=single;count.hidden=single;
 }
 function open(){if(dialog.open)return;dialog.showModal();document.documentElement.classList.add('ld-prize-preview-open');sync();close.focus();}
 function move(step){document.getElementById(step<0?'prizePrevButton':'prizeNextButton')?.click();sync();}
 trigger.tabIndex=0;trigger.setAttribute('role','button');trigger.setAttribute('aria-haspopup','dialog');labels();
 trigger.addEventListener('click',open);
 trigger.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}});
 close.addEventListener('click',()=>dialog.close());previous.addEventListener('click',()=>move(-1));next.addEventListener('click',()=>move(1));
 dialog.addEventListener('keydown',event=>{if(!next.hidden&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();move(event.key==='ArrowLeft'?-1:1);}});
 dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();});
 dialog.addEventListener('close',()=>{document.documentElement.classList.remove('ld-prize-preview-open');if(trigger.isConnected)trigger.focus({preventScroll:true});});
 const observer=new MutationObserver(sync);
 observer.observe(trigger,{attributes:true,attributeFilter:['src','alt']});
 for(const node of [title,description,counter])if(node)observer.observe(node,{childList:true,subtree:true,characterData:true});
 window.addEventListener('ld:language',sync);
})();
