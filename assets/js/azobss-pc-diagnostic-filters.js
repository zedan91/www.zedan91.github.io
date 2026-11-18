(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AZOBSSDiagnosticFilters=api;})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const clean=value=>String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const compact=value=>clean(value).replace(/[^\p{L}\p{N}]/gu,'');
  const missing=value=>!String(value??'').trim() || /^(?:unknown|n\/?a|none|null|not (?:available|detected|specified)|tidak (?:tersedia|dikesan|diketahui)|default string|system manufacturer|to be filled by o\.?e\.?m\.?)$/i.test(String(value).trim());
  function brand(row) {
    const value=String(row.manufacturer??'').trim();
    if(missing(value))return 'Tidak diketahui';
    const aliases=[[/micro[\s-]*star|\bmsi\b/i,'MSI'],[/hewlett[\s-]*packard|\bhp\b/i,'HP'],[/asustek|\basus\b/i,'ASUS'],[/\blenovo\b/i,'Lenovo'],[/\bdell\b/i,'Dell'],[/\bacer\b/i,'Acer'],[/\bapple\b/i,'Apple'],[/\bmicrosoft\b/i,'Microsoft'],[/\bfujitsu\b/i,'Fujitsu'],[/\btoshiba\b/i,'Toshiba'],[/\bdynabook\b/i,'Dynabook'],[/\bgigabyte\b/i,'Gigabyte'],[/\bhuawei\b/i,'Huawei'],[/\bsamsung\b/i,'Samsung']];
    return aliases.find(([pattern])=>pattern.test(value))?.[1] || value;
  }
  const hasBattery=row=>(row.batteries||[]).some(battery=>!missing(battery?.name));
  const collator=new Intl.Collator('ms',{numeric:true,sensitivity:'base'});
  const timestamp=row=>Date.parse(row.receivedAt)||0;
  const model=row=>row.hardware?.displayModel||row.model||'';
  function select(rows,{query='',brand:chosenBrand='',status='',battery='',sort='newest'}={}) {
    const words=clean(query).split(/\s+/).map(compact).filter(Boolean);
    const filtered=rows.filter(row=>{
      if(chosenBrand && brand(row)!==chosenBrand)return false;
      if(status==='sent' && row.status?.sent!==true || status==='unsent' && row.status?.sent===true)return false;
      if(battery==='detected' && !hasBattery(row) || battery==='missing' && hasBattery(row))return false;
      const text=words.length ? compact([brand(row),row.manufacturer,row.model,row.hardware?.displayModel,row.hardware?.cpuSummary,row.hardware?.deviceType,row.serial,row.id,row.status?.dealerPhone,...(row.batteries||[]).map(x=>x?.name)].join(' ')) : '';
      return words.every(word=>text.includes(word));
    });
    return filtered.sort((a,b)=>{
      const newest=timestamp(b)-timestamp(a),fallback=newest||collator.compare(a.id||'',b.id||'');
      switch(sort){
        case 'oldest': return timestamp(a)-timestamp(b)||collator.compare(a.id||'',b.id||'');
        case 'brand-asc': return collator.compare(brand(a),brand(b))||collator.compare(model(a),model(b))||fallback;
        case 'brand-desc': return collator.compare(brand(b),brand(a))||collator.compare(model(a),model(b))||fallback;
        case 'model': return collator.compare(model(a),model(b))||fallback;
        case 'serial': return collator.compare(a.serial||'',b.serial||'')||fallback;
        case 'unsent-first': return Number(a.status?.sent===true)-Number(b.status?.sent===true)||fallback;
        default:return fallback;
      }
    });
  }
  function brands(rows) {
    const counts=new Map();for(const row of rows){const name=brand(row);counts.set(name,(counts.get(name)||0)+1);}
    return [...counts].sort((a,b)=>collator.compare(a[0],b[0]));
  }
  return Object.freeze({brand,hasBattery,select,brands});
});
