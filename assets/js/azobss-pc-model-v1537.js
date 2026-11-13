(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AZOBSSPcModel=api;})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const stores={'all-it':'ALL IT','dotatech':'DOTATECH','brightstar':'BRIGHTSTAR','emarque':'EMARQUE','illegear':'ILLEGEAR','nb-plaza':'NB PLAZA','viewnet':'VIEWNET'};
 function storeKey(p={}){const id=String(p.id||p.productId||'').toLowerCase(),raw=String(p.storeId||p.storeName||p.sourceName||'').toLowerCase();if(/^vnp-/.test(id)||/viewnet/.test(raw))return 'viewnet';if(/^(?:allit|all-it|allithypermarket)[-]/.test(id)||/all.?it/.test(raw))return 'all-it';if(/^nb-plaza[-]/.test(id)||/nb.?plaza/.test(raw))return 'nb-plaza';for(const key of ['dotatech','brightstar','emarque','illegear'])if(id.startsWith(key+'-')||raw.includes(key))return key;return raw.replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'other';}
 function category(p={}){const original=String(p.category||'Accessories'),name=String(p.name||p.displayName||'').replace(/^\[[^\]]+\]\s*/,''),processor=/^(?:AMD\s+)?(?:Ryzen|Threadripper|Athlon)\b|^Intel\s+(?:Core|Pentium|Celeron|Xeon)\b|^Core\s+i[3579]\b/i.test(name);if(/NAS enclosure|Network Attached Storage|^NAS(?: Servers?)?$/i.test(original)||/\b(?:Synology\s+(?:DiskStation\s+)?(?:DS|RS)\d|QNAP\s+(?:TS|TVS|TBS|TR)-|ASUSTOR\s+(?:AS\d|LockerStor|Drivestor)|TerraMaster\s+F\d)/i.test(name)&&!/memory|ram module|expansion card/i.test(name))return 'NAS & Servers';if(/\b(?:PowerEdge|ProLiant|ThinkSystem|PRIMERGY)\s+\w/i.test(name)&&!/rack rail|memory|spare|license/i.test(name))return 'NAS & Servers';if(/CPU|Processor/i.test(original)&&!processor&&/cooler|cooling|heatsink|water.?block|liquid|thermal|\bAIO\b/i.test(name))return 'Cooling';return original==='Case'?'Casing':original;}
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
 return {stores,storeKey,category,rank,productUrl,gallery,useGroup,comparisonKeys};
});
