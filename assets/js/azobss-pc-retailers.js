/* PC sourcing directory. Display-only: no price imports or changes to ordering. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else{root.AZOBSSPCRetailers=api;api.mount(root.document);}
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const labels={pc:'PC siap / Custom',parts:'Komponen',workstation:'Workstation',laptop:'Laptop',accessories:'Aksesori'};
  const text=value=>String(value||'').trim().replace(/\s+/g,' ').slice(0,160);
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
  function mount(document){
    const panel=document.querySelector('#pc-retailer-panel');if(!panel)return;
    const form=panel.querySelector('form'),keyword=panel.querySelector('[name="keyword"]'),category=panel.querySelector('[name="category"]'),store=panel.querySelector('[name="store"]');
    const grid=panel.querySelector('[data-retailer-grid]'),status=panel.querySelector('[data-retailer-status]'),count=panel.querySelector('[data-retailer-count]'),allSearch=panel.querySelector('[data-retailer-search]'),more=panel.querySelector('[data-retailer-more]');
    let stores=[],loading=null,expanded=false;
    function admin(){try{return typeof globalThis.isAdminViewer==='function'&&globalThis.isAdminViewer()===true;}catch{return false;}}
    function link(label,url,className){const a=document.createElement('a');a.textContent=label;a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.className=className||'';return a;}
    function render(){
      const selected=filter(stores,category.value,store.value);grid.replaceChildren();
      count.textContent=stores.length+' kedai';
      status.textContent=selected.length?selected.length+' kedai sepadan · carian dibuka melalui Google':'Tiada kedai untuk gabungan ini. Pilih Semua kedai atau kategori lain.';
      allSearch.href=searchURL(selected,keyword.value,category.value)||'#';allSearch.hidden=!selected.length;
      allSearch.textContent=selected.length>1?'Cari di '+selected.length+' kedai':'Cari di kedai ini';
      for(const item of (expanded?selected:selected.slice(0,6))){
        const card=document.createElement('article');card.className='pc-retailer-card';
        const heading=document.createElement('h3');heading.textContent=item.name;
        const description=document.createElement('p');description.textContent=item.description;
        const tags=document.createElement('div');tags.className='pc-retailer-tags';tags.textContent=item.categories.map(c=>labels[c]).join(' · ');
        const actions=document.createElement('div');actions.className='pc-retailer-actions';
        actions.append(link('Cari produk ↗',searchURL([item],keyword.value,category.value),'pc-retailer-primary'),link(item.linkLabel||'Buka kedai ↗',item.url));
        card.append(heading,description,tags,actions);grid.append(card);
      }
      more.hidden=selected.length<=6;more.textContent=expanded?'Ringkaskan senarai':'Lihat semua '+selected.length+' kedai';more.setAttribute('aria-expanded',String(expanded));
    }
    async function load(){
      if(stores.length||loading)return loading;
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
      loading=(async()=>{
        try{
          const response=await fetch('/PC-Build/pc-retailers.json?v=1427',{signal:controller.signal});
          if(!response.ok)throw Error('Directory unavailable');
          const data=await response.json();stores=(data.stores||[]).filter(validStore);
          if(!stores.length)throw Error('Directory empty');
          store.replaceChildren();const all=document.createElement('option');all.value='all';all.textContent='Semua kedai';store.append(all);
          for(const item of stores){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;store.append(option);}
          render();
        }catch{status.textContent='Senarai kedai belum dapat dimuat. Tutup dan buka semula panel untuk cuba lagi.';allSearch.hidden=true;}
        finally{clearTimeout(timer);loading=null;}
      })();return loading;
    }
    function updateAccess(){panel.hidden=!admin();if(panel.hidden)panel.open=false;else load();}
    for(const element of [keyword,category,store])element.addEventListener(element===keyword?'input':'change',()=>{expanded=false;render();});
    form.addEventListener('submit',event=>{event.preventDefault();if(admin()&&stores.length&&!allSearch.hidden)allSearch.click();});
    more.addEventListener('click',()=>{expanded=!expanded;render();});
    panel.addEventListener('toggle',()=>{if(panel.open&&admin())load();});
    for(const event of ['storage','azobss-auth-changed'])globalThis.addEventListener(event,updateAccess);
    new MutationObserver(updateAccess).observe(document.body,{attributes:true,attributeFilter:['class','data-role']});
    updateAccess();
  }
  return {labels,validStore,filter,searchURL,mount};
});
