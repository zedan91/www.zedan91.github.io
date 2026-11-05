(function(){
'use strict';
const modes={
 full:{number:'01 / PAPARAN PENUH',title:'Maklumat harian,\ndalam satu pandangan.',description:'Jam, jadual solat, bar kemajuan dan baki masa ke solat seterusnya. Tarikh Masihi/Hijri, cuaca, cuti dan petikan peringatan disusun dalam widget desktop yang sama.',image:'full',alt:'Contoh paparan penuh Liyabudun.',list:['Jam analog, digital atau kedua-duanya.','Jadual solat mengikut zon pilihan anda.','Saiz, tema dan kedudukan boleh disesuaikan.','Akses kiblat dan kalendar cuti dari widget.']},
 compact:{number:'02 / PAPARAN KOMPAK',title:'Lebih kecil.\nMaklumat penting kekal.',description:'Untuk ruang kerja yang padat. Paparan kompak mengekalkan jam digital, waktu seterusnya, baki masa dan bar kemajuan, bersama tarikh serta butiran harian yang ringkas.',image:'compact',alt:'Contoh paparan kompak Liyabudun.',list:['Jam digital dan baki masa yang jelas.','Tarikh Masihi dan Hijri dalam paparan ringkas.','Cuaca serta cuti akan datang apabila tersedia.','Tukar mod dari butang widget atau menu Paparan.']},
 fullscreen:{number:'03 / SKRIN PENUH',title:'Jadual yang jelas,\npada paparan yang besar.',description:'Gunakan monitor untuk paparan jam dan jadual solat yang lebih besar. Mod skrin penuh juga mempunyai pilihan nama tempat, teks bergerak dan kiraan iqamah.',image:'fullscreen',alt:'Contoh mod skrin penuh Liyabudun dengan jam dan jadual solat.',list:['Paparan besar dengan latar dan jadual harian.','Nama tempat serta teks bergerak boleh ditetapkan.','Pilihan kiraan iqamah dalam mod skrin penuh.','Screensaver boleh dihidupkan mengikut tempoh tidak aktif.']}
};
const tabs=[...document.querySelectorAll('[data-display]')];
function selectMode(key,focus){
 const value=modes[key];if(!value)return;
 const image=document.getElementById('lyDisplayImage'),photo=document.getElementById('lyDisplayPhoto'),panel=document.getElementById('lyDisplayPanel');
 for(const tab of tabs){const selected=tab.dataset.display===key;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;if(selected){panel.setAttribute('aria-labelledby',tab.id);if(focus)tab.focus();}}
 image.src='/assets/liyabudun/'+value.image+'.webp';image.alt=value.alt;const dimensions={full:[720,1400],compact:[660,572],fullscreen:[2400,1480]}[key];image.width=dimensions[0];image.height=dimensions[1];
 photo.dataset.photo=image.getAttribute('src');photo.dataset.caption=value.alt;
 panel.classList.toggle('is-wide',key==='fullscreen');
 document.getElementById('lyDisplayNumber').textContent=value.number;
 document.getElementById('lyDisplayTitle').replaceChildren(...value.title.split('\n').flatMap((line,index)=>index?[document.createElement('br'),document.createTextNode(line)]:[document.createTextNode(line)]));
 document.getElementById('lyDisplayDescription').textContent=value.description;
 document.getElementById('lyDisplayList').replaceChildren(...value.list.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
}
for(const tab of tabs){tab.addEventListener('click',()=>selectMode(tab.dataset.display,false));tab.addEventListener('keydown',event=>{const index=tabs.indexOf(tab);let next;if(event.key==='ArrowRight')next=(index+1)%tabs.length;else if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;if(next!==undefined){event.preventDefault();selectMode(tabs[next].dataset.display,true);}});}
const dialog=document.getElementById('lyLightbox');let previousFocus=null;
function closePhoto(){if(dialog.open)dialog.close();}
document.addEventListener('click',event=>{const button=event.target.closest('[data-photo]');if(!button)return;const path=button.dataset.photo;if(!/^\/assets\/liyabudun\/[a-z0-9_-]+\.webp$/.test(path||''))return;previousFocus=button;const image=document.getElementById('lyLightboxImage');image.src=path;image.alt=button.dataset.caption||'';document.getElementById('lyLightboxCaption').textContent=button.dataset.caption||'';dialog.showModal();document.body.classList.add('ly-no-scroll');dialog.querySelector('button').focus();});
dialog.querySelector('.ly-lightbox-close').addEventListener('click',closePhoto);
dialog.addEventListener('click',event=>{if(event.target===dialog)closePhoto();});
dialog.addEventListener('close',()=>{document.body.classList.remove('ly-no-scroll');document.getElementById('lyLightboxImage').removeAttribute('src');if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});previousFocus=null;});
})();
