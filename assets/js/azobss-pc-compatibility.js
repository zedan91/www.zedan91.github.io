(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AZOBSSPcCompatibility=api;})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const cpuIds=new Set(['intel-cpu','amd-cpu']),boardIds=new Set(['intel-mobo','amd-mobo']);
 const text=p=>String(p?.label||p?.displayName||p?.name||'');
 const specs=p=>Array.isArray(p?.specs)?p.specs.map(String):[];
 const field=(p,re)=>specs(p).filter(s=>re.test(s)).map(s=>s.replace(/^[^:]*:/,'')).join(' ');
 const num=(s,re)=>{const m=String(s).match(re);return m?Number(m[1]):null;};
 const socket=s=>{const m=String(s).toUpperCase().match(/\b(?:FC)?(LGA\s*(?:115[0156]|1200|1700|1851|2066|4677)|AM[45]|STR[45]|TR4)\b/);return m?m[1].replace(/\s/g,''):'';};
 function cpuSocket(s){
  const t=String(s).toUpperCase();if(/XEON\s+W[3579]-[234]\d{3}/.test(t))return'LGA4677';
  const tr=t.match(/THREADRIPPER.*?\b([23789])\d{3}[WX]/);if(tr)return Number(tr[1])>=7?'STR5':tr[1]==='3'?'STR4':'TR4';
  if(/\b(?:CORE\s+)?ULTRA\s+[3579]\s+[23]\d{2}(?:K|KF|F|T|S)?\b/.test(t))return'LGA1851';
  const intel=t.match(/\bI[3579][-\s]?(\d{4,5})(?:KF|F|K|T|KS)?\b/);if(intel){const n=Number(intel[1]);return n>=12000&&n<15000?'LGA1700':n>=10000&&n<12000?'LGA1200':n>=6000&&n<10000?'LGA1151':'';}
  if(/ATHLON\s+3000G/.test(t))return'AM4';const ryzen=t.match(/RYZEN\s+(?:[3579]\s+)?(\d{4})(?:X3D|GT|G|X|F)?\b/);return ryzen?(Number(ryzen[1])>=7000?'AM5':'AM4'):'';
 }
 function boardSocket(s){const t=String(s).toUpperCase();for(const [re,value] of [[/\bW790/,'LGA4677'],[/\b(?:TRX50|WRX90)/,'STR5'],[/\bTRX40/,'STR4'],[/\b(?:H610|B660|B760|H670|H770|Z690|Z790|Q670)/,'LGA1700'],[/\b(?:H810|B860|Z890|Q870)/,'LGA1851'],[/\b(?:H410|B460|H470|Z490|H510|B560|H570|Z590)/,'LGA1200'],[/\b(?:A320|A520|B350|B450|B550|X370|X470|X570)/,'AM4'],[/\b(?:A620|B650E?|X670E?|B840|B850|X870E?)/,'AM5']])if(re.test(t))return value;return'';}
 function ramType(s){const t=String(s).toUpperCase();return /DDR\s*5|\bD5\b/.test(t)?'DDR5':/DDR\s*4|\bD4\b/.test(t)?'DDR4':/DDR\s*3/.test(t)?'DDR3':'';}
 function forms(s){const t=String(s).toUpperCase(),out=[];if(/E[-\s]?ATX/.test(t))out.push('EATX');if(/MICRO[-\s]?ATX|M[-\s]?ATX|\bMATX\b/.test(t))out.push('mATX');if(/MINI[-\s]?ITX|\bITX\b/.test(t))out.push('ITX');if(/(?:^|[\s,/])ATX\b/.test(t.replace(/MICRO[-\s]?ATX|E[-\s]?ATX|M[-\s]?ATX/g,'')))out.push('ATX');return out;}
 function cpuIgp(p){const f=field(p,/^integrated graphics\s*:/i);if(/none|no|not included|not available/i.test(f))return false;if(f.trim())return true;const t=text(p).toUpperCase();if(/THREADRIPPER|XEON/.test(t))return false;if(/INTEL|CORE\s+ULTRA/.test(t))return !/\d+(?:KF|F)\b/.test(t);if(/RYZEN/.test(t)){if(/\d{4}F\b/.test(t))return false;if(/\d{4}(?:G|GT)\b/.test(t))return true;const m=t.match(/RYZEN\s+(?:[3579]\s+)?(\d{4})/);return m?Number(m[1])>=7000:null;}return null;}
 function metadata(cat,p){
  const label=text(p),all=label+' '+specs(p).join(' '),m={...p?.meta};
  if(cpuIds.has(cat)){m.socket=socket(field(p,/^(?:CPU |Processor )?Socket\s*:/i))||cpuSocket(label)||m.socket||'';m.igp=cpuIgp(p);}
  if(boardIds.has(cat)){
   m.socket=socket(field(p,/^(?:CPU |Processor )?Socket\s*:/i))||boardSocket(label)||m.socket||'';
   m.ramType=ramType(field(p,/^(?:Memory|RAM)(?: type)?\s*:/i))||ramType(label)||(m.socket==='AM4'?'DDR4':['AM5','LGA1851','STR5','LGA4677'].includes(m.socket)?'DDR5':'')||m.ramType||'';
   m.formFactor=forms(field(p,/^(?:Motherboard )?Form factor\s*:/i))[0]||forms(label)[0]||(/\b(?:H610|B660|B760|B860|A520|B550|A620|B650|B850)M(?:\b|-)/i.test(label)?'mATX':/\b(?:H610|B660|B760|B860|A520|B550|A620|B650|B850)I(?:\b|-)/i.test(label)?'ITX':'')||m.formFactor||'';
   m.ramSlots=num(field(p,/^(?:Memory|RAM|DIMM)(?: slots?)?\s*:/i),/\b([1248])\s*(?:x\s*)?(?:DDR[345]\s*)?(?:DIMM|slots?)\b/i)??num(field(p,/^(?:Memory|RAM|DIMM) slots?\s*:/i),/^\s*([1248])\s*$/);
   m.maxRamGB=num(field(p,/^(?:Maximum|Max\.?)(?: supported)? (?:memory|RAM)(?: capacity)?\s*:/i),/(\d+)\s*GB/i);
   const nv=field(p,/^(?:M\.2|NVMe)(?: slots?)?\s*:/i);m.nvmeSlots=/\b(?:none|no|0)\b/i.test(nv)?0:num(nv,/(\d+)\s*(?:x|slots?|$)/i);
   m.sataPorts=num(field(p,/^SATA(?: ports?)?\s*:/i),/\b(\d+)\s*(?:x|ports?|$)/i);
  }
  if(cat==='ram'){
   m.ramType=ramType(field(p,/^(?:Memory|RAM)(?: type)?\s*:/i))||ramType(label)||m.ramType||'';
   m.ramForm=/SO[-\s]?DIMM|laptop|notebook/i.test(all)?'SODIMM':'DIMM';
   const kit=all.match(/\b([248])\s*[x×]\s*(\d+)\s*GB/i);m.modules=kit?Number(kit[1]):/two[-\s]?module|\b2\s*(?:DIMM|modules)|dual.*kit/i.test(all)?2:1;
   m.ramGB=kit?Number(kit[1])*Number(kit[2]):num(field(p,/^(?:Total )?Capacity\s*:/i),/(\d+)\s*GB/i)??num(label,/(\d+)\s*GB/i);
   m.registered=/\b(?:RDIMM|registered|LRDIMM)\b/i.test(all)&&!/unregistered/i.test(all);
  }
  if(cat==='case'){
   m.boardForms=forms(field(p,/^(?:Motherboard|Mainboard)(?: support| compatibility| form factors?)?\s*:/i));if(!m.boardForms.length&&m.maxMobo)m.boardForms=[m.maxMobo];
   m.maxGpuMM=num(field(p,/^(?:Max(?:imum)? )?(?:GPU|Graphics card|VGA)(?: length| clearance)?\s*:/i),/(\d+)\s*mm/i);
   m.maxCoolerMM=num(field(p,/^(?:Max(?:imum)? )?CPU cooler(?: height| clearance)?\s*:/i),/(\d+)\s*mm/i);
   const rad=field(p,/^(?:Radiator|Liquid cooling)(?: support| sizes?)?\s*:/i);m.radiators=[...rad.matchAll(/\b(120|140|240|280|360|420)\b/g)].map(x=>Number(x[1]));m.radiatorsKnown=!!rad.trim();
   m.psuForms=(field(p,/^(?:PSU|Power supply)(?: support| form factors?| compatibility)?\s*:/i).toUpperCase().match(/SFX-L|SFX|ATX/g)||[]);
  }
  if(cat==='cooler'){
   m.sockets=[];const sf=field(p,/^(?:CPU )?(?:supported )?sockets?(?: support)?\s*:/i);for(const x of sf.matchAll(/\b(?:FC)?(AM[45]|LGA\s*(?:115[0156]|1200|1700|1851|2066|4677)|STR[45]|TR4)\b/gi))m.sockets.push(x[1].toUpperCase().replace(/\s/g,''));
   const liquid=/Liquid Cooling|\bAIO\b|liquid cooler/i.test((p.section||'')+' '+label);m.radiator=num(field(p,/^Radiator size\s*:/i),/\b(120|140|240|280|360|420)\b/)??(liquid?num(label,/\b(120|140|240|280|360|420)(?:\s*mm|\b)/i):0);
   m.heightMM=num(field(p,/^(?:Cooler |Heatsink )?Height\s*:/i),/(\d+(?:\.\d+)?)\s*mm/i);
  }
  if(cat==='gpu'){
   m.minPsu=num(field(p,/^(?:Recommended|Minimum|Required)(?: system)? (?:PSU|power supply)(?: power| wattage)?\s*:/i),/(\d+)\s*W/i);
   // NVIDIA reference minimums; partner models can require more. Explicit model specs take precedence.
   if(!m.minPsu&&/RTX\s*5060\s*TI/i.test(label))m.minPsu=600;else if(!m.minPsu&&/RTX\s*5060\b/i.test(label))m.minPsu=550;
   m.lengthMM=num(field(p,/^(?:Card |GPU )?Length\s*:/i),/(\d+(?:\.\d+)?)\s*mm/i);
  }
  if(cat==='psu'){m.wattage=num(field(p,/^(?:Rated power|Wattage|Power output)\s*:/i),/(\d{3,4})\s*W/i)??num(label,/(\d{3,4})\s*W\b/i);m.psuForm=(field(p,/^Form factor\s*:/i).toUpperCase().match(/SFX-L|SFX|ATX/)||[])[0]||'';}
  if(cat==='ssd'||cat==='hdd'){
   m.external=/external|portable|USB/i.test(p.section||'')||/^(?:Connection|Interface):.*USB/im.test(specs(p).join('\n'));
   m.nvme=/NVMe/i.test(p.section||'')||/NVMe/i.test(field(p,/^Interface\s*:/i))||/NVMe/i.test(label);
   m.sata=!m.external&&!m.nvme&&(/SATA/i.test(p.section||label)||cat==='hdd');
   m.gen=num(all,/(?:PCIe\s*|Gen\s*)([345])(?:\.0|\b)/i);
  }
  return m;
 }
 const family=c=>cpuIds.has(c)?'cpu':boardIds.has(c)?'mobo':c;
 function inspect(entries){
  const rows=entries.filter(e=>e.p).map(e=>({...e,m:metadata(e.cat,e.p),qty:Math.max(1,Number(e.qty)||1),kind:family(e.cat)})),issues=[];
  const add=(level,code,message,related)=>issues.push({level,code,message,related});
  const of=kind=>rows.filter(r=>r.kind===kind),one=kind=>of(kind)[0];
  const cpu=one('cpu'),mb=one('mobo'),gpu=one('gpu'),psu=one('psu'),cs=one('case'),cool=one('cooler'),ram=of('ram');
  if(of('cpu').length>1)add('error','cpu-count','Pilih satu processor sahaja.',of('cpu'));
  if(of('mobo').length>1)add('error','board-count','Pilih satu motherboard sahaja.',of('mobo'));
  if(cpu&&mb){
   if(cpu.cat.split('-')[0]!==mb.cat.split('-')[0])add('error','platform','Processor dan motherboard berlainan platform Intel / AMD.',[cpu,mb]);
   if(cpu.m.socket&&mb.m.socket&&cpu.m.socket!==mb.m.socket)add('error','socket',`CPU ${cpu.m.socket} tidak serasi dengan motherboard ${mb.m.socket}.`,[cpu,mb]);
   else add('warning','bios',cpu.m.socket&&mb.m.socket?'Soket sepadan; sokongan CPU dan versi BIOS model motherboard perlu disahkan oleh AZOBSS.':'Soket model belum lengkap; perlu semakan AZOBSS sebelum sebut harga.',[cpu,mb]);
  }
  for(const r of ram){
   if(r.m.ramForm==='SODIMM')add('error','ram-form','RAM SO-DIMM laptop tidak sesuai dengan slot DIMM desktop.',[r]);
   const type=mb?.m.ramType||(cpu?.m.socket==='AM4'?'DDR4':cpu&&['AM5','LGA1851','STR5','LGA4677'].includes(cpu.m.socket)?'DDR5':'');
   if(type&&r.m.ramType&&type!==r.m.ramType)add('error','ram-type',`RAM ${r.m.ramType} tidak serasi; platform menggunakan ${type}.`,[r,mb||cpu]);
   if(r.m.registered){const desktop=['AM4','AM5','LGA1151','LGA1200','LGA1700','LGA1851'].includes(mb?.m.socket||cpu?.m.socket);add(desktop?'error':'warning','registered-memory','RAM registered memerlukan motherboard dan CPU yang menyokong jenis ECC/RDIMM ini.',[r,...(mb?[mb]:cpu?[cpu]:[])]);}
  }
  if(new Set(ram.map(r=>r.m.ramType).filter(Boolean)).size>1)add('error','ram-mix','RAM DDR berlainan generasi tidak boleh dicampur.',ram);
  if(mb&&ram.length){
   const modules=ram.reduce((n,r)=>n+r.m.modules*r.qty,0),gb=ram.reduce((n,r)=>n+(r.m.ramGB||0)*r.qty,0);
   if(mb.m.ramSlots&&modules>mb.m.ramSlots)add('error','ram-slots',`${modules} modul RAM melebihi ${mb.m.ramSlots} slot motherboard.`,[mb,...ram]);
   if(mb.m.maxRamGB&&gb>mb.m.maxRamGB)add('error','ram-capacity',`${gb}GB RAM melebihi had motherboard ${mb.m.maxRamGB}GB.`,[mb,...ram]);
   if(!mb.m.ramType)add('warning','ram-unknown','Jenis RAM motherboard belum dinyatakan; perlu semakan AZOBSS.',[mb,...ram]);
   if(!mb.m.ramSlots||!mb.m.maxRamGB)add('warning','ram-limits-unknown','Bilangan slot dan had kapasiti RAM model motherboard perlu disahkan.',[mb,...ram]);
  }
  if(cpu&&cool){if(cpu.m.socket&&cool.m.sockets.length&&!cool.m.sockets.includes(cpu.m.socket))add('error','cooler-socket',`Cooler tidak menyokong soket CPU ${cpu.m.socket}.`,[cpu,cool]);if(!cool.m.sockets.length)add('warning','cooler-unknown','Soket mounting dan kapasiti penyejukan cooler perlu disahkan.',[cpu,cool]);}
  if(mb&&cs){
   if(mb.m.formFactor&&cs.m.boardForms.length&&!cs.m.boardForms.includes(mb.m.formFactor))add('error','board-case',`Motherboard ${mb.m.formFactor} tidak termasuk format yang disokong casing.`,[mb,cs]);
   if(!cs.m.boardForms.length||!mb.m.formFactor)add('warning','case-unknown','Format motherboard dan ruang casing belum lengkap; perlu semakan ukuran.',[mb,cs]);
  }
  if(gpu&&cs){if(gpu.m.lengthMM&&cs.m.maxGpuMM&&gpu.m.lengthMM>cs.m.maxGpuMM)add('error','gpu-case',`GPU ${gpu.m.lengthMM}mm melebihi ruang casing ${cs.m.maxGpuMM}mm.`,[gpu,cs]);if(!gpu.m.lengthMM||!cs.m.maxGpuMM)add('warning','gpu-clearance','Panjang GPU, ketebalan slot dan ruang selepas radiator perlu disahkan.',[gpu,cs]);}
  if(cool&&cs){
   if(cool.m.radiator&&cs.m.radiatorsKnown&&!cs.m.radiators.includes(cool.m.radiator))add('error','radiator',`Casing tidak menyokong radiator ${cool.m.radiator}mm.`,[cool,cs]);
   if(!cool.m.radiator&&cool.m.heightMM&&cs.m.maxCoolerMM&&cool.m.heightMM>cs.m.maxCoolerMM)add('error','cooler-height',`Cooler ${cool.m.heightMM}mm melebihi ruang casing ${cs.m.maxCoolerMM}mm.`,[cool,cs]);
   if(cool.m.radiator&&!cs.m.radiatorsKnown||!cool.m.radiator&&(!cool.m.heightMM||!cs.m.maxCoolerMM))add('warning','cooler-clearance','Saiz cooler / radiator dan ruang pemasangan casing perlu disahkan.',[cool,cs]);
  }
  if(psu&&cs){if(psu.m.psuForm&&cs.m.psuForms.length&&!cs.m.psuForms.includes(psu.m.psuForm))add('error','psu-case',`PSU ${psu.m.psuForm} tidak termasuk format PSU casing.`,[psu,cs]);if(!psu.m.psuForm||!cs.m.psuForms.length)add('warning','psu-form','Format, panjang PSU dan ruang kabel casing perlu disahkan.',[psu,cs]);}
  if(psu&&gpu){if(gpu.m.minPsu&&psu.m.wattage&&psu.m.wattage<gpu.m.minPsu)add('error','psu-power',`GPU memerlukan PSU sekurang-kurangnya ${gpu.m.minPsu}W; pilihan sekarang ${psu.m.wattage}W.`,[psu,gpu]);add('warning','power-connectors','Kapasiti kuasa penuh CPU/GPU dan penyambung EPS/PCIe/12V-2x6 perlu disahkan untuk model sebenar.',[psu,gpu]);}
  const storage=[...of('ssd'),...of('hdd')],nvme=storage.filter(r=>r.m.nvme&&!r.m.external),sata=storage.filter(r=>r.m.sata);
  if(mb){const n=nvme.reduce((n,r)=>n+r.qty,0),s=sata.reduce((n,r)=>n+r.qty,0);if(mb.m.nvmeSlots!==null&&mb.m.nvmeSlots!==undefined&&n>mb.m.nvmeSlots)add('error','nvme-slots',`${n} SSD NVMe melebihi ${mb.m.nvmeSlots} slot motherboard.`,[mb,...nvme]);if(mb.m.sataPorts!==null&&mb.m.sataPorts!==undefined&&s>mb.m.sataPorts)add('error','sata-ports',`${s} pemacu SATA melebihi ${mb.m.sataPorts} port motherboard.`,[mb,...sata]);if(storage.length)add('warning','storage-review','Format M.2/SATA, saiz SSD dan perkongsian lane/port motherboard perlu disahkan; generasi PCIe boleh mempengaruhi kelajuan.',[mb,...storage]);}
  if(cpu&&!gpu&&cpu.m.igp===false)add('error','display','CPU ini tiada integrated graphics; Graphic Card diperlukan untuk paparan.',[cpu]);
  if(cpu&&!cool)add('warning','cooler-missing','CPU cooler belum dipilih; semak sama ada CPU dibekalkan bersama cooler.',[cpu]);
  for(const [kind,label] of [['cpu','Processor'],['mobo','Motherboard'],['ram','RAM'],['psu','PSU'],['case','Casing']])if(!one(kind))add('warning','missing-'+kind,label+' belum dipilih.',[]);
  return {issues,errors:[...new Set(issues.filter(i=>i.level==='error').map(i=>i.message))],warnings:[...new Set(issues.filter(i=>i.level==='warning').map(i=>i.message))]};
 }
 function fit(cat,p,selected,options={}){
  const target={cat,p,qty:options.qty||1,lineIndex:options.lineIndex||0};
  const kept=selected.filter(e=>!(e.cat===cat&&(!['ram','ssd','hdd','fans'].includes(cat)||e.lineIndex===target.lineIndex))&&!(cpuIds.has(cat)&&cpuIds.has(e.cat)));
  const result=inspect([...kept,target]);const relevant=result.issues.filter(i=>i.related.some(e=>e.p===p));
  // Missing supporting components are actionable in the summary, not a reason to prevent adding the CPU first.
  const bad=relevant.find(i=>i.level==='error'&&i.code!=='display');
  return {ok:!bad,reason:bad?.message||'',warning:relevant.find(i=>i.level==='warning')?.message||''};
 }
 return {metadata,inspect,fit,cpuSocket,boardSocket,ramType,cpuIgp};
});
