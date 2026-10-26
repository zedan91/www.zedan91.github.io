/* AZOBSS v1428: PC retailer directory + main PC-Build filter integration. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else{root.AZOBSSPCRetailers=api;api.mount(root.document);}
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const labels={pc:'PC siap / Custom',parts:'Komponen',workstation:'Workstation',laptop:'Laptop',accessories:'Aksesori'};
  const text=value=>String(value||'').trim().replace(/\s+/g,' ').slice(0,160);
  let storeCache=[];
  let storeLoadPromise=null;

  function validStore(store){
    try{
      const url=new URL(store.url),scope=new URL('https://'+store.scope);
      const host=value=>value.replace(/^www\./,'');
      return /^[a-z0-9-]{2,40}$/.test(store.id)&&text(store.name)&&url.protocol==='https:'&&!url.username&&!url.password&&
        host(scope.hostname)===host(url.hostname)&&scope.pathname.replace(/\/$/,'')===url.pathname.replace(/\/$/,'')&&
        Array.isArray(store.categories)&&store.categories.length>0&&store.categories.every(c=>Object.hasOwn(labels,c));
    }catch{return false;}
  }
  function filter(stores,category='all',storeId='all'){
    return stores.filter(s=>validStore(s)&&(category==='all'||s.categories.includes(category))&&(storeId==='all'||s.id===storeId));
  }
  function searchURL(stores,keyword='',category='all'){
    const selected=filter(stores,category);
    if(!selected.length)return '';
    const query=text(keyword)||({pc:'desktop custom PC',parts:'PC components',workstation:'workstation PC',laptop:'laptop',accessories:'computer accessories'})[category]||'desktop PC components';
    const scopes=selected.map(s=>'site:'+s.scope).join(' OR ');
    return 'https://www.google.com/search?q='+encodeURIComponent('('+scopes+') '+query);
  }
  function unique(parts){
    const seen=new Set(),out=[];
    for(const raw of parts){const v=text(raw);if(!v)continue;const k=v.toLowerCase();if(seen.has(k))continue;seen.add(k);out.push(v);}
    return out;
  }
  function mainFilterKeyword(state={}){
    const segment={office:'office PC',package:'gaming PC',workstation:'workstation AI'};
    const cpu={amd:'AMD Ryzen',intel:'Intel Core'};
    const resolution={office:'office', '1080p':'1080p','1440p':'1440p','4k':'4K',workstation:'workstation',ai:'AI'};
    const gpu={nvidia:'NVIDIA GeForce',amd:'AMD Radeon',integrated:'integrated graphics'};
    const category={office:'office study',gaming:'gaming',performance:'creator performance',highend:'high end gaming',flagship:'flagship 4K',workstation:'workstation AI'};
    const parts=[];
    if(state.search)parts.push(state.search);
    if(state.segment&&state.segment!=='all')parts.push(segment[state.segment]||state.segment);
    if(state.cpuBrand&&state.cpuBrand!=='all')parts.push(cpu[state.cpuBrand]||state.cpuBrand);
    if(state.gpuModel&&state.gpuModel!=='all')parts.push(state.gpuModel);
    else if(state.gpuBrand&&state.gpuBrand!=='all')parts.push(gpu[state.gpuBrand]||state.gpuBrand);
    if(state.resolution&&state.resolution!=='all')parts.push(resolution[state.resolution]||state.resolution);
    if(state.category&&state.category!=='all')parts.push(category[state.category]||state.category);
    if(Number(state.budget)>0)parts.push('bawah RM'+Math.round(Number(state.budget)));
    return text(unique(parts).join(' '));
  }
  function buildSearchKeyword(build={}){
    const partMap={};
    for(const row of (Array.isArray(build.parts)?build.parts:[])){
      if(Array.isArray(row)&&row.length>1)partMap[String(row[0]||'').toLowerCase()]=String(row[1]||'');
    }
    return text(unique([
      build.name,
      partMap.cpu,
      build.gpuModel||partMap.gpu,
      partMap.ram,
      partMap.storage,
      build.resolution,
      ...(Array.isArray(build.softwareFit)?build.softwareFit.slice(0,3):[])
    ]).join(' '));
  }
  function getMainState(document){
    const value=id=>document.querySelector(id)?.value||'';
    const gpuModelEl=document.querySelector('#gpuModel');
    const gpuModel=gpuModelEl?.value&&gpuModelEl.value!=='all'?(gpuModelEl.options[gpuModelEl.selectedIndex]?.textContent||gpuModelEl.value):'all';
    return {search:value('#search'),segment:value('#segment')||'all',cpuBrand:value('#cpuBrand')||'all',resolution:value('#resolution')||'all',gpuBrand:value('#gpuBrand')||'all',gpuModel,category:value('#category')||'all',budget:value('#budget')||'0',storeId:value('#retailerStore')||'all'};
  }
  async function loadStores(document){
    if(storeCache.length)return storeCache;
    if(storeLoadPromise)return storeLoadPromise;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
    storeLoadPromise=(async()=>{
      try{
        const response=await fetch('/PC-Build/pc-retailers.json?v=1428',{signal:controller.signal,cache:'no-store'});
        if(!response.ok)throw Error('Directory unavailable');
        const data=await response.json();
        storeCache=(data.stores||[]).filter(validStore);
        if(!storeCache.length)throw Error('Directory empty');
        return storeCache;
      }finally{clearTimeout(timer);storeLoadPromise=null;}
    })();
    return storeLoadPromise;
  }
  function populateMainStore(document,stores){
    const select=document.querySelector('#retailerStore');if(!select)return;
    const keep=select.value||'all';
    select.replaceChildren();
    const all=document.createElement('option');all.value='all';all.textContent='Semua '+stores.length+' Kedai';select.append(all);
    for(const item of stores){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;select.append(option);}
    select.value=stores.some(s=>s.id===keep)?keep:'all';
  }
  function openBuildSearch(build){
    const openNow=stores=>{
      const url=searchURL(stores,buildSearchKeyword(build),'all');
      if(url&&typeof window!=='undefined')window.open(url,'_blank','noopener,noreferrer');
      return url;
    };
    if(storeCache.length)return openNow(storeCache);
    if(typeof document!=='undefined')loadStores(document).then(openNow).catch(()=>{});
    return '';
  }

  function mount(document){
    if(!document)return;
    const panel=document.querySelector('#pc-retailer-panel');if(!panel)return;
    const publicMode=panel.dataset.public==='1';
    const integrated=panel.dataset.integrated==='1';
    const form=panel.querySelector('form'),keyword=form?.querySelector('[name="keyword"]'),category=form?.querySelector('[name="category"]'),store=form?.querySelector('[name="store"]');
    const grid=panel.querySelector('[data-retailer-grid]'),status=panel.querySelector('[data-retailer-status]'),count=panel.querySelector('[data-retailer-count]'),allSearch=panel.querySelector('[data-retailer-search]'),more=panel.querySelector('[data-retailer-more]');
    let stores=[],loading=null,expanded=false;
    function admin(){try{return typeof globalThis.isAdminViewer==='function'&&globalThis.isAdminViewer()===true;}catch{return false;}}
    function link(label,url,className){const a=document.createElement('a');a.textContent=label;a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.className=className||'';return a;}
    function integratedState(){const state=getMainState(document);return {keyword:mainFilterKeyword(state),category:'all',storeId:state.storeId||'all'};}
    function legacyState(){return {keyword:keyword?.value||'',category:category?.value||'all',storeId:store?.value||'all'};}
    function currentState(){return integrated?integratedState():legacyState();}
    function render(){
      if(!stores.length)return;
      const state=currentState();
      const selected=filter(stores,state.category,state.storeId);grid.replaceChildren();
      count.textContent=stores.length+' kedai';
      const query=state.keyword||'desktop PC custom PC components Malaysia';
      if(integrated){
        status.textContent=selected.length?`${selected.length} kedai ikut filter utama · carian: ${query}`:'Tiada kedai sepadan. Pilih Semua Kedai.';
      }else{
        status.textContent=selected.length?selected.length+' kedai sepadan · carian dibuka melalui Google':'Tiada kedai untuk gabungan ini. Pilih Semua kedai atau kategori lain.';
      }
      const combined=searchURL(selected,query,state.category);
      allSearch.href=combined||'#';allSearch.hidden=!selected.length;
      allSearch.textContent=selected.length>1?`Cari spec ini di ${selected.length} kedai`:'Cari spec ini di kedai ini';
      for(const item of (expanded?selected:selected.slice(0,6))){
        const card=document.createElement('article');card.className='pc-retailer-card';
        const heading=document.createElement('h3');heading.textContent=item.name;
        const description=document.createElement('p');description.textContent=item.description;
        const tags=document.createElement('div');tags.className='pc-retailer-tags';tags.textContent=item.categories.map(c=>labels[c]).join(' · ');
        const actions=document.createElement('div');actions.className='pc-retailer-actions';
        actions.append(link(integrated?'Cari spec ini ↗':'Cari produk ↗',searchURL([item],query,state.category),'pc-retailer-primary'),link(item.linkLabel||'Buka kedai ↗',item.url));
        card.append(heading,description,tags,actions);grid.append(card);
      }
      more.hidden=selected.length<=6;more.textContent=expanded?'Ringkaskan senarai':'Lihat semua '+selected.length+' kedai';more.setAttribute('aria-expanded',String(expanded));
    }
    async function load(){
      if(stores.length||loading)return loading;
      loading=(async()=>{
        try{
          stores=await loadStores(document);
          if(integrated)populateMainStore(document,stores);
          if(store){
            store.replaceChildren();const all=document.createElement('option');all.value='all';all.textContent='Semua kedai';store.append(all);
            for(const item of stores){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;store.append(option);}
          }
          render();
        }catch{status.textContent='Senarai kedai belum dapat dimuat. Refresh halaman untuk cuba lagi.';allSearch.hidden=true;}
        finally{loading=null;}
      })();return loading;
    }
    function updateAccess(){
      if(publicMode){panel.hidden=false;load();return;}
      panel.hidden=!admin();if(panel.hidden)panel.open=false;else load();
    }
    if(form&&keyword&&category&&store){
      for(const element of [keyword,category,store])element.addEventListener(element===keyword?'input':'change',()=>{expanded=false;render();});
      form.addEventListener('submit',event=>{event.preventDefault();if((publicMode||admin())&&stores.length&&!allSearch.hidden)allSearch.click();});
    }
    if(integrated){
      const controls=['#search','#retailerStore','#segment','#cpuBrand','#resolution','#gpuBrand','#gpuModel','#category','#budget'];
      for(const selector of controls){const el=document.querySelector(selector);if(el)el.addEventListener(el.tagName==='INPUT'?'input':'change',()=>{expanded=false;render();});}
      globalThis.addEventListener('azobss-pc-main-filter-change',()=>{expanded=false;render();});
    }
    more?.addEventListener('click',()=>{expanded=!expanded;render();});
    panel.addEventListener('toggle',()=>{if(panel.open&&(publicMode||admin()))load();});
    if(!publicMode){for(const event of ['storage','azobss-auth-changed'])globalThis.addEventListener(event,updateAccess);new MutationObserver(updateAccess).observe(document.body,{attributes:true,attributeFilter:['class','data-role']});}
    updateAccess();
  }
  return {labels,validStore,filter,searchURL,mainFilterKeyword,buildSearchKeyword,getMainState,mount,openBuildSearch};
});
