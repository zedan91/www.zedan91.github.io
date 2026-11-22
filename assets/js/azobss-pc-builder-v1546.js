(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AZOBSSPcBuilder1546=api;})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const categoryMap={'Intel CPUs':'intel-cpu','AMD CPUs':'amd-cpu','Intel Motherboards':'intel-mobo','AMD Motherboards':'amd-mobo','Desktop Memory':'ram','CPU Coolers':'cooler','Cooling':'cooler','Casing':'case','Liquid Cooling':'cooler','Graphics Cards':'gpu','Workstation Graphics':'gpu','Power Supplies':'psu','Cases':'case','SATA SSDs':'ssd','NVMe SSDs':'ssd','Hard Drives':'hdd','Monitor':'monitor','Keyboards':'keyboard','Mice':'mouse','Keyboard & Mouse Combos':'combo','Headsets & Earphones':'headset','Speaker':'speaker','Case Fans':'fans','Routers':'wifi-router','Optical Drives':'optical','Microsoft Software':'software','Security Software':'software','Microphone':'streaming','Wireless Microphones':'streaming','Sound Cards':'streaming'};
 const clean=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'');
 function searchWords(value){
  // Split model codes at letter/number boundaries without matching inside ordinary words.
  return (String(value||'').toLowerCase().match(/[a-z]+|[0-9]+/g)||[]);
 }
 function matchTerm(words,term){
  return words.some((_,start)=>{
   let prefix='';
   for(let i=start;i<words.length&&prefix.length<term.length;i++)prefix+=words[i];
   return prefix.startsWith(term);
  });
 }
 function matches(option,query){
  const terms=String(query||'').trim().split(/\s+/).map(clean).filter(Boolean);
  if(!terms.length)return true;
  const fields=[option.label,option.brand,option.section,option._catId,option._catLabel].map(searchWords);
  return terms.every(term=>fields.some(words=>matchTerm(words,term)));
 }
 function productLabel(p){
  const original=String(p.displayName||p.name||'').trim(),source=String(p.name||'').trim();
  const brand=String(p.brand||'').trim(),type=/^(?:SATA|NVMe) SSDs$/.test(p.category)?p.category.replace(/SSDs$/,'SSD'):'';
  let label=original;
  if(type&&source.length>label.length&&!clean(label).includes(clean(source))&&clean(source).includes(clean(label)))label=source;
  if(brand&&!/^(?:lain-lain|other|generic)$/i.test(brand)&&!clean(label).includes(clean(brand)))label=brand+' '+label;
  if(type){label=label.replace(/\s+[345](?=\s+[—–-])/,'');const gen=(p.specs||[]).join(' ').match(/PCIe\s*([345])\.0/i);if(!clean(label).includes(clean(type)))label+=' · '+type;if(type==='NVMe SSD'&&gen&&!/\bGen\s*[345]\b/i.test(label))label+=' Gen '+gen[1];}
  const variant=String(p.optionLabel||'').trim();
  if(variant&&!/^(?:harga|seunit|default)$/i.test(variant)&&!clean(label).includes(clean(variant)))label+=' · '+variant;
  return label;
 }
 function categoryFor(p){
  const category=String(p.category||''),name=String(p.name||p.displayName||'');
  if(/^(?:CPU|CPUs|Processors)$/i.test(category)&&!/cooler|cooling|heatsink/i.test(name))return /Intel|Core\s+i[3579]/i.test(name+' '+p.brand)?'intel-cpu':/AMD|Ryzen|Athlon|Threadripper/i.test(name+' '+p.brand)?'amd-cpu':'';
  if(/^Motherboards?$/i.test(category)){const text=name+' '+(p.specs||[]).join(' ');return /\b(?:AM[45]|A320|A520|A620|B450|B550|B650|B850|X570|X670|X870|TRX50|WRX90)(?:[MI])?\b/i.test(text)?'amd-mobo':/\b(?:LGA\s*\d+|H410|H510|H610|H810|B460|B560|B660|B760|B860|Z490|Z590|Z690|Z790|Z890|W790)(?:[MI])?\b/i.test(text)?'intel-mobo':'';}
  if(/^(?:Mice|Mouse & Mousepad)$/i.test(category)&&/mouse\s*pad|mouse\s*mat|desk\s*mat/i.test(name))return 'mousepad';
  if(/^(?:Routers|Networking|Wireless Adapters|Wi-Fi Adapters)$/i.test(category)&&/\b(?:USB|PCIe?|PCI-E)\b/i.test(name)&&/wi-?fi|wireless|802\.11/i.test(name)&&!/router|access point/i.test(name))return 'wifi-receiver';
  return categoryMap[category]||({'Internal Hard Drives':'hdd','External Hard Drives':'hdd','Portable Hard Drives':'hdd','Desktop External Drives':'hdd','LCD Monitors':'monitor','OLED Monitors':'monitor','Monitors (Panel Unspecified)':'monitor','Graphics Cards':'gpu','Power Supply':'psu','PC Cases':'case','Mouse Pads':'mousepad','Webcam & Capture':'streaming','Drawing Tablets':'tablet','Gaming Chairs':'chair','Gaming Desks':'desk'}[category])||'';
 }
 function mergeProducts(reference,live,policy){
  if(!policy?.ok||!Array.isArray(policy.hiddenProductIds)||!Array.isArray(policy.hiddenStoreIds))return [];
  const hiddenIds=new Set(policy.hiddenProductIds.map(v=>String(v).toLowerCase())),hiddenStores=new Set(policy.hiddenStoreIds.map(v=>String(v).toLowerCase()));
  if(hiddenStores.has('viewnet')||hiddenStores.has('viewnet-pricelist'))return [];
  const merged=new Map((reference||[]).map(p=>[String(p.id),{...p,requiresConfirmation:true}]));
  for(const p of live||[]){
   const id=String(p.id),old=merged.get(id);
   if(p.hidden===true||p.priceStatus==='unavailable'||p.availability==='unavailable'){merged.delete(id);continue;}
   const fresh=!old||p.priceStatus==='live'||Date.parse(p.priceCheckedAt||'')>=Date.parse(old.priceCheckedAt||'');
   merged.set(id,{...(old||{}),...(fresh?p:{}),requiresConfirmation:true});
  }
  return [...merged.values()].filter(p=>!hiddenIds.has(String(p.id).toLowerCase())&&!hiddenIds.has(String(p.sourceRecordId||'').toLowerCase())&&p.hidden!==true);
 }
 function catalog(products,templates){
  const categories=templates.map(c=>({...c,options:[]})),by=new Map(categories.map(c=>[c.id,c]));
  for(const p of products||[]){
   const c=by.get(categoryFor(p));
   if(!c||!p.sourceRecordId||!/^VNP-/.test(String(p.id))||!Number.isFinite(Number(p.price))||Number(p.price)<=0||p.hidden===true)continue;
   c.options.push({id:String(p.id),label:productLabel(p),brand:String(p.brand||'').trim()||'Other',section:String(p.category),
    price:Number(p.price),priceMode:'azobss-selling',sourceRecordId:String(p.sourceRecordId),sourceOptionIndex:Number(p.sourceOptionIndex)||0,
    priceCheckedAt:String(p.priceCheckedAt||''),specs:Array.isArray(p.specs)?p.specs:[],image:String(p.image||''),requiresConfirmation:true});
  }
  for(const c of categories)c.options.sort((a,b)=>a.section.localeCompare(b.section)||a.brand.localeCompare(b.brand)||a.label.localeCompare(b.label));
  return {source:'AZOBSS reference selling prices',categories};
 }
 function compactShare(lines){
  return Object.values(lines).flat().filter(row=>/^VNP-[a-f0-9]{12}--\d+$/i.test(row.productId||''))
   .map(row=>row.productId.slice(4).replace('--','.')+(Number(row.qty)>1?'x'+Math.min(20,Math.floor(Number(row.qty))):'')).join('~');
 }
 function decodeShare(value,categories){
  const index=new Map(categories.flatMap(c=>c.options.map(p=>[p.id,c.id]))),lines={};
  for(const token of String(value).slice(0,1600).split('~').slice(0,60)){
   const match=/^([a-f0-9]{12})\.(\d+)(?:x(\d+))?$/i.exec(token);
   if(!match)continue;
   const productId='VNP-'+match[1]+'--'+match[2],category=index.get(productId);
   if(category)(lines[category]??=[]).push({productId,qty:Math.max(1,Math.min(20,Number(match[3])||1))});
  }
  return lines;
 }
 function coolerSockets(specs=[]){
  const sockets=new Set();
  for(const row of specs){
   if(!/^(?:CPU )?(?:supported )?sockets?(?: support)?\s*:/i.test(row))continue;
   for(const m of row.matchAll(/\b(AM[45]|LGA\s*(?:115[0156]|1200|1700|1851|2066|4677)|sTR[45]|TR4)\b/gi))sockets.add(m[1].toUpperCase().replace(/\s/g,''));
  }
  return sockets;
 }
 return {catalog,matches,categoryMap,categoryFor,mergeProducts,compactShare,decodeShare,coolerSockets};
});
