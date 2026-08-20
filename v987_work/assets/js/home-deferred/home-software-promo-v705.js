import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import { collection, getDocs, getFirestore } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

(function(){
  const root=document.getElementById('azHomeSoftwarePromo529');
  const link=document.getElementById('azHomeSoftwarePromoLink529');
  const image=document.getElementById('azHomeSoftwarePromoImage529');
  const title=document.getElementById('azHomeSoftwarePromoTitle529');
  const price=document.getElementById('azHomeSoftwarePromoPrice529');
  const prev=document.getElementById('azHomeSoftwarePromoPrev529');
  const next=document.getElementById('azHomeSoftwarePromoNext529');
  if(!root||!link||!image||!title||!price||!prev||!next) return;

  const firebaseConfig={
    apiKey:'AIzaSyDuf03esBSpddXAOwuP-uOmHVRp54pZyr8',
    authDomain:'azobss.firebaseapp.com',
    projectId:'azobss',
    storageBucket:'azobss.firebasestorage.app',
    messagingSenderId:'159277716405',
    appId:'1:159277716405:web:17d8924b6b6380e2b77ffc'
  };
  let promos=[];
  let index=0;
  let timer=0;
  let renderToken=0;

  function bool(v){
    if(v===true||v===1) return true;
    return /^(1|true|yes|on|enabled|active)$/i.test(String(v||'').trim());
  }
  function amount(v){
    const m=String(v??'').replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);
    return m?Number(m[0]):NaN;
  }
  function text(v,max=100){return String(v??'').replace(/\s+/g,' ').trim().slice(0,max);}
  function safeProductId(item){return text(item.productId||item.sku||item.id||item.docId||'',120);}
  function safeLogoName(v){
    return text(v||'software-logo',120).replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'')||'software-logo';
  }
  function imageUrl(item){
    const direct=text(item.promoImageUrl||item.promotionImageUrl||item.imageUrl||item.image||item.logoUrl||item.gifUrl||item.gif||'',1200);
    if(direct) return direct;
    return '/Software-Tools/images/logo/'+encodeURIComponent(safeLogoName(safeProductId(item)||item.name))+'.png';
  }
  function isActive(item){
    const status=text(item.status||'active',40).toLowerCase();
    return !/^(inactive|disabled|hidden|draft|deleted|archived|soldout|sold-out)$/.test(status);
  }
  function promoInfo(item){
    const saleRaw=text(item.price||item.salePrice||'',40);
    const oldRaw=text(item.originalPrice||item.promoOriginalPrice||item.oldPrice||item.beforePrice||item.listPrice||'',40);
    const sale=amount(saleRaw), old=amount(oldRaw);
    const discounted=Number.isFinite(sale)&&Number.isFinite(old)&&old>sale;
    const freePromo=bool(item.promoFreeEnabled||item.freePromoEnabled||item.promoFreeDownloadEnabled)&&Number(item.promoFreeLimit||item.promoFreeUnits||item.freePromoUnits||0)>0;
    const explicit=bool(item.homePromoEnabled||item.homePromotionEnabled||item.promoEnabled||item.promotionEnabled||item.onSale||item.featuredPromo);
    const badgePromo=/promo|sale|offer|discount/i.test(text(item.badge||item.label||'',80));
    if(!(discounted||freePromo||explicit||badgePromo)) return null;
    const save=discounted?Math.max(1,Math.round((1-sale/old)*100)):0;
    return {
      ...item,
      _id:safeProductId(item),
      _name:text(item.name||item.title||'Software Promotion',100),
      _image:imageUrl(item),
      _price:freePromo?'FREE':(saleRaw||'PROMO'),
      _save:save,
      _free:freePromo,
      _priority:Number(item.homePromoPriority||item.promoPriority||item.promotionPriority||0)||0,
      _created:Number(item.createdAtMs||item.updatedAtMs||(item.createdAt&&item.createdAt.seconds*1000)||0)||0
    };
  }
  function normalize(items){
    const seen=new Set();
    return (Array.isArray(items)?items:[])
      .filter(isActive)
      .map(promoInfo)
      .filter(Boolean)
      .filter(item=>{
        const key=(item._id||item._name).toLowerCase();
        if(!key||seen.has(key)) return false;
        seen.add(key);return true;
      })
      .sort((a,b)=>b._priority-a._priority||Number(b._free)-Number(a._free)||b._save-a._save||b._created-a._created)
      .slice(0,12);
  }
  function productHref(item){
    const id=item._id;
    return id?'/Software-Tools/?p='+encodeURIComponent(id):'/Software-Tools/';
  }
  function render(nextIndex,animate=true){
    if(!promos.length){root.hidden=true;return;}
    index=(nextIndex+promos.length)%promos.length;
    const item=promos[index];
    const token=++renderToken;
    if(animate) root.classList.add('is-changing');
    setTimeout(()=>{
      if(token!==renderToken) return;
      image.src=item._image;
      image.alt=item._name;
      title.textContent=item._name;
      price.textContent=item._price;
      link.href=productHref(item);
      link.setAttribute('aria-label','Buka promosi '+item._name);
      root.dataset.count=String(promos.length);
      root.dataset.index=String(index+1);
      root.hidden=false;
      requestAnimationFrame(()=>root.classList.remove('is-changing'));
    },animate?150:0);
  }
  function restart(){
    clearInterval(timer);
    if(promos.length>1&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
      timer=setInterval(()=>render(index+1,true),4600);
    }
  }
  function move(step){render(index+step,true);restart();}
  prev.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();move(-1);});
  next.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();move(1);});
  root.addEventListener('mouseenter',()=>clearInterval(timer));
  root.addEventListener('mouseleave',restart);
  root.addEventListener('focusin',()=>clearInterval(timer));
  root.addEventListener('focusout',restart);
  image.addEventListener('error',()=>{
    const item=promos[index];
    const fallback='/Software-Tools/images/logo/'+encodeURIComponent(safeLogoName(item?._id||item?._name))+'.png';
    if(image.src.indexOf(fallback)===-1){image.src=fallback;return;}
    image.src='/favicon-512x512.png';
  });

  async function fromFirestore(){
    try{
      const app=getApps().length?getApps()[0]:initializeApp(firebaseConfig);
      const snap=await getDocs(collection(getFirestore(app),'softwareTools'));
      return snap.docs.map(d=>({docId:d.id,...(d.data()||{})}));
    }catch(e){
      console.warn('AZOBSS home software promo Firestore load skipped:',e);
      return [];
    }
  }
  async function fromBundled(){
    try{
      const res=await fetch('/assets/data/home-software-promos-v704.json',{cache:'force-cache'});
      if(!res.ok) return [];
      const data=await res.json();
      return Array.isArray(data)?data:(Array.isArray(data.items)?data.items:[]);
    }catch(e){return [];}
  }
  async function start(){
    const remote=await fromFirestore();
    promos=normalize(remote);
    if(!promos.length){promos=normalize(await fromBundled());}
    if(!promos.length){root.hidden=true;return;}
    render(0,false);
    restart();
  }
  if('requestIdleCallback' in window){ requestIdleCallback(()=>start(),{timeout:2200}); }
  else { setTimeout(()=>start(),900); }
})();
//# sourceURL=/assets/js/home-deferred/home-software-promo-v705.js
