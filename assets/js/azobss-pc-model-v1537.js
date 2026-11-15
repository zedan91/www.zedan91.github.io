(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AZOBSSPcModel=api;})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const stores={'all-it':'ALL IT','dotatech':'DOTATECH','brightstar':'BRIGHTSTAR','emarque':'EMARQUE','illegear':'ILLEGEAR','nb-plaza':'NB PLAZA','viewnet':'VIEWNET'};
 function storeKey(p={}){const id=String(p.id||p.productId||'').toLowerCase(),raw=String(p.storeId||p.storeName||p.sourceName||'').toLowerCase();if(/^vnp-/.test(id)||/viewnet/.test(raw))return 'viewnet';if(/^(?:allit|all-it|allithypermarket)[-]/.test(id)||/all.?it/.test(raw))return 'all-it';if(/^nb-plaza[-]/.test(id)||/nb.?plaza/.test(raw))return 'nb-plaza';for(const key of ['dotatech','brightstar','emarque','illegear'])if(id.startsWith(key+'-')||raw.includes(key))return key;return raw.replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'other';}
 function category(p={}){const original=String(p.category||'Accessories'),name=String(p.name||p.displayName||'').replace(/^\[[^\]]+\]\s*/,''),processor=/^(?:AMD\s+)?(?:Ryzen|Threadripper|Athlon)\b|^Intel\s+(?:Core|Pentium|Celeron|Xeon)\b|^Core\s+i[3579]\b/i.test(name);if(/NAS enclosure|Network Attached Storage|^NAS(?: Servers?)?$/i.test(original)||/\b(?:Synology\s+(?:DiskStation\s+)?(?:DS|RS)\d|QNAP\s+(?:TS|TVS|TBS|TR)-|ASUSTOR\s+(?:AS\d|LockerStor|Drivestor)|TerraMaster\s+F\d)/i.test(name)&&!/memory|ram module|expansion card/i.test(name))return 'NAS & Servers';if(/\b(?:PowerEdge|ProLiant|ThinkSystem|PRIMERGY)\s+\w/i.test(name)&&!/rack rail|memory|spare|license/i.test(name))return 'NAS & Servers';if(/CPU|Processor/i.test(original)&&!processor&&/cooler|cooling|heatsink|water.?block|liquid|thermal|\bAIO\b/i.test(name))return 'Cooling';return original==='Case'?'Casing':original;}
 const storefrontAliases = new Map([
   ['cpu', 'CPUs'], ['intel cpus', 'CPUs'], ['amd cpus', 'CPUs'],
   ['motherboard', 'Motherboards'], ['intel motherboards', 'Motherboards'], ['amd motherboards', 'Motherboards'],
   ['gpu', 'Graphics Cards'], ['graphic card', 'Graphics Cards'], ['graphics card', 'Graphics Cards'],
   ['graphic cards', 'Graphics Cards'], ['graphics cards', 'Graphics Cards'],
   ['workstation graphics', 'Graphics Cards'],
   ['case', 'PC Cases'], ['cases', 'PC Cases'], ['casing', 'PC Cases'],
   ['power supply', 'Power Supplies'], ['keyboard', 'Keyboards'], ['mouse', 'Mice'],
 ]);
 function storefrontCategory(p={}){
   const original=category(p).trim(), key=original.toLowerCase();
   const name=[p.name,p.displayName].filter(Boolean).join(' ');
   if(storefrontAliases.get(key)==='Graphics Cards'&&/\b(?:gpu|graphics?\s+card)\s+(?:support\s+)?(?:holder|brace|bracket)\b/i.test(name))return 'GPU Accessories';
   if(/^(?:lcd |oled )?monitors?$/.test(key)){
     if(/\b(?:charger|wireless display receiver|smart (?:wi-fi )?plug)\b/i.test(name))return 'Accessories';
     if(/\bDivoom\s+Times\s+(?:Gate|Frame)\b/i.test(name))return 'Smart Displays';
     const panel=[name,...(Array.isArray(p.specs)?p.specs:[]).filter(s=>/^\s*(?:panel|display(?: type)?|screen(?: type)?|backlight)\s*:/i.test(s))].join(' ');
     if(key.startsWith('oled ')||/\b(?:OLED|WOLED|AMOLED)\b/i.test(panel))return 'OLED Monitors';
     if(key.startsWith('lcd ')||/\b(?:LCD|IPS|VA|TN|TFT|LED|WLED|PLS|AHVA)\b/i.test(panel))return 'LCD Monitors';
     return 'Monitors (Panel Unspecified)';
   }
   if(key==='ram')return /laptop|notebook|\bso[-\s]?dimm\b/i.test(name)?'Laptop Memory':'Desktop Memory';
   if(key==='ssd'||key==='hard drive'){
     if(/\b(?:ssd|solid state drive)\b/i.test(name)||key==='ssd'){
       if(/\b(?:portable|external)\b/i.test(name))return 'External SSDs';
       if(/\b(?:nvme|pcie)\b/i.test(name))return 'NVMe SSDs';
       if(/\bsata\b/i.test(name))return 'SATA SSDs';
       return 'SSDs (Interface Unspecified)';
     }
     if(/\b(?:external|portable)\b/i.test(name))return 'External Hard Drives';
     return 'Internal Hard Drives';
   }
   if(key==='hard drives')return 'Internal Hard Drives';
   if(key==='portable hard drives'||key==='desktop external drives')return 'External Hard Drives';
   if(key==='mouse & mousepad')return /\b(?:mouse\s*pad|mouse\s*mat|desk\s*mat)\b/i.test(name)?'Mouse Pads':'Mice';
   if(key==='cooling'){
     if(/\b(?:AIO|all[-\s]in[-\s]one|liquid cooler|liquid cooling|waterblock)\b/i.test(name))return 'Liquid Cooling';
     if(/\b(?:cooler|heatsink)\b/i.test(name)&&/\b(?:CPU|AM[45]|LGA\d+|heatsink)\b/i.test(name))return 'CPU Coolers';
     if(/\b(?:case|chassis|ARGB|RGB)\b.*\bfans?\b/i.test(name))return 'Case Fans';
     return 'Cooling Accessories';
   }
   return storefrontAliases.get(key)||original;
 }
 function rank(p){const c=category(p);return /^(?:CPU|Intel CPUs|AMD CPUs)$/i.test(c)?0:/Motherboard/i.test(c)?1:/Memory|RAM/i.test(c)?2:/Graphics|GPU/i.test(c)?3:/SSD|Drive/i.test(c)?4:/Power/i.test(c)?5:/Cool/i.test(c)?6:/Case|Casing/i.test(c)?7:8;}
 function productUrl(p={}){const id=String(p.productId||p.id||'');return id?'/PC-Build/?section=all&model='+encodeURIComponent(id):'/PC-Build/';}
 function gallery(p={}){return [...new Set([p.image,...(Array.isArray(p.images)?p.images:[])].filter(x=>typeof x==='string'&&(/^\/PC-Build\/images\//.test(x)||/^https:\/\//.test(x))))];}
 function useGroup(p={}){
   const c=category(p),name=String(p.displayName||p.name||''),t=name.toUpperCase();
   if(c==='NAS & Servers')return 'nas';
   if(/\bDRONES?\b/i.test(c+' '+name)||/^DJI\s+(?:MINI|MAVIC|AVATA|AIR\s+\d|NEO|FLIP)\b/i.test(name)&&!/battery|mount|charger|protect|propeller|bag/i.test(name))return 'drone';
   if(/\b(?:WORKSTATION|QUADRO|RTX\s+A\d{4})\b/i.test(c+' '+name))return 'workstation';
   if(/\bRTX\s*(?:[345]0[89]0)\b|\bRX\s*(?:7900\s*(?:XTX|XT)|9070\s*XT)\b/.test(t))return 'gaming-high';
   if(/\bRTX\s*[345]0[67]0\b|\bRX\s*(?:9060|9070|7700|7800)\b|\bARC\s+B580\b/.test(t))return 'gaming-mid';
   if(/\b(?:GTX\s*\d{4}|RTX\s*[23]050|RX\s*(?:6400|6500|6600)|ARC\s+A[357]\d{2})\b/.test(t))return 'gaming-entry';
   if(/\bgaming\b/i.test(name))return 'gaming-other';
   if(/\b(?:office|business|productivity|thinkcentre|prodesk|elitedesk|optiplex)\b/i.test(name)||/^(?:Printer|Microsoft Software|Scanners?)$/i.test(c))return 'office';
   return '';
 }
 function comparisonKeys(p={}){
   const brand=String(p.brand||'').toLowerCase().replace(/[^a-z0-9]+/g,'');
   if(!brand||['lainlain','other','unknown','generic'].includes(brand))return [];
   const compact=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'');
   const title=String(p.name||p.displayName||'');
   const keys=[];
   if(title.length>=12&&/\d/.test(title)&&!/varian|assorted|pilihan|choose|configur|bundle|(?:^| )or(?: |$)/i.test(title))keys.push(brand+'|title|'+compact(title)+'|'+compact(p.optionLabel));
   for(const spec of p.specs||[]){
     const match=String(spec).match(/^(?:manufacturer part number|part number|mpn)\s*:\s*([a-z0-9][-a-z0-9./]{4,50})$/i);
     if(match&&/[a-z]/i.test(match[1])&&/\d/.test(match[1]))keys.push(brand+'|part|'+compact(match[1]));
   }
   return keys;
 }
 return {stores,storeKey,category,storefrontCategory,rank,productUrl,gallery,useGroup,comparisonKeys};
});
