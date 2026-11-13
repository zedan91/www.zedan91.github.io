'use strict';
const fs=require('node:fs'),path=require('node:path');
const {openEnvelope}=require('./azobss-source-price-audit');
const COMPONENTS=new Set(['CPU Intel','CPU AMD','RAM desktop','RAM laptop','Sound card','Optical drive','CPU cooler','AIO cooling','Casing','Fan','SSD SATA','SSD NVMe','SSD external','HDD internal','HDD external 2.5','HDD external 3.5','Power supply','Motherboard Intel','Motherboard AMD','GPU','GPU workstation']);
const ENGLISH={'CPU Intel':'Intel CPUs','CPU AMD':'AMD CPUs','RAM desktop':'Desktop Memory','RAM laptop':'Laptop Memory','Sound card':'Sound Cards','Optical drive':'Optical Drives','CPU cooler':'CPU Coolers','AIO cooling':'Liquid Cooling','Casing':'Cases','Fan':'Case Fans','SSD SATA':'SATA SSDs','SSD NVMe':'NVMe SSDs','SSD external':'External SSDs','HDD internal':'Hard Drives','HDD external 2.5':'Portable Hard Drives','HDD external 3.5':'Desktop External Drives','Power supply':'Power Supplies','Motherboard Intel':'Intel Motherboards','Motherboard AMD':'AMD Motherboards','GPU':'Graphics Cards','GPU workstation':'Workstation Graphics','Keyboard & mouse':'Keyboard & Mouse Combos','Mouse':'Mice','Keyboard':'Keyboards','Headphone & earphone':'Headsets & Earphones','Perisian Microsoft':'Microsoft Software','Perisian keselamatan':'Security Software','Office PC':'Office PCs','Mini PC':'Mini PCs','NAS enclosure':'NAS Enclosures','Network switch':'Network Switches','Router SIM':'Mobile Broadband','IP camera':'Security Cameras','Router':'Routers','Access point':'Access Points','USB flash drive':'USB Flash Drives','USB OTG':'USB OTG Drives','Memory card':'Memory Cards','Action camera':'Action Cameras','Interactive display':'Interactive Displays','Wireless microphone':'Wireless Microphones'};
function groupForCategory(category){return ['Mini PC','Office PC'].includes(category)?'prebuilt':COMPONENTS.has(category)?'components':'accessories';}
function variantId(id,index){return `${id}--${index}`;}
function loadViewnetProducts({rootDir,env=process.env,sellingPrice}={}){
 const sourceFile=path.join(rootDir,'Upgrade-Parts/catalog-v1518.json');
 if(!fs.existsSync(sourceFile))return [];
 const data=JSON.parse(fs.readFileSync(sourceFile,'utf8'));let costs=new Map();
 const secret=env.PC_SOURCE_PRICE_KEY||env.SOLATTIME_ORDER_CIPHER_KEY;
 if(secret){
  try{const privateData=JSON.parse(openEnvelope(fs.readFileSync(path.join(rootDir,'lib/data/upgrade-source-v1520.enc')),secret));costs=new Map(privateData.products.map(p=>[p.id,p]));}catch(_){/* Public dated prices remain reference-only; no fabricated source cost. */}
 }
 const products=[];
 for(const row of data.products||[]){
  if(!/^VNP-[a-zA-Z0-9-]+$/.test(row.id)||!row.name||!Array.isArray(row.options))continue;
  const group=groupForCategory(row.category),type=group==='prebuilt'?'desktop':'hardware';
  const photo=String(row.shopImage||row.image||''),photoOk=row.imageKind!=='illustration'&&/^\/PC-Build\/images\/shop\/[a-f0-9]{24}\.webp$/.test(photo)&&fs.existsSync(path.join(rootDir,photo.slice(1)));
  row.options.forEach((option,index)=>{
   const price=Number(option.price);if(!Number.isFinite(price)||price<=0)return;
   const original=costs.get(row.id),originalOption=original?.options?.[index];
   const cost=Number(originalOption?.cost)>0&&originalOption.label===option.label?Number(originalOption.cost):0;
   if(cost&&typeof sellingPrice==='function'&&sellingPrice(cost,{type}).price!==price)throw Error('viewnet_price_policy_mismatch');
   const name=String(row.displayName||row.name),optionLabel=String(option.label||'Harga');
   const specs=[...(row.specs||[])];
   if(optionLabel!=='Harga')specs.unshift((/^\d+(?:\.\d+)?(?:GB|TB)$/i.test(optionLabel)?'Capacity: ':/^\d+W$/i.test(optionLabel)?'Rated power: ':'Option: ')+optionLabel);
   if(row.note)specs.push('Purchase note: '+row.note);
   products.push({id:variantId(row.id,index),type,category:ENGLISH[row.category]||row.category,catalogGroup:group,name:name+(optionLabel==='Harga'?'':' — '+optionLabel),displayName:name+(optionLabel==='Harga'?'':' — '+optionLabel),brand:row.brand||name.split(/\s+/)[0],specs,
    sourceName:'Viewnet pricelist',storeId:'viewnet-pricelist',sourceUrl:'https://www.viewnet.com.my/price-list',sourceProvider:'viewnet-pdf',sourceVerified:true,specVerified:true,sourceRecordId:row.id,sourceOptionIndex:index,optionLabel,sourcePage:original?.sourcePage,sourceLine:original?.sourceLine,specSourceUrl:row.specSourceUrl||'',
    importedCatalog:true,variantId:String(index+1),snapshotPrice:cost,snapshotPriceClear:true,snapshotSellingPrice:price,snapshotCheckedAt:String(row.sourceDate||data.date||'2026-11-05')+'T00:00:00+08:00',sourceCheckedAt:String(row.sourceDate||data.date||'2026-11-05')+'T00:00:00+08:00',requiresSupplierConfirmation:true,
    image:photoOk?photo:'/assets/images/pc-product-unavailable.svg',imageKind:photoOk?row.imageKind:'illustration',imageModel:row.imageModel||'',photoUnavailable:!photoOk,localImageVerified:true,imageType:photoOk?'reviewed-model-photo-local':'missing-model-photo',imageCrop:'full-image',mediaVerified:photoOk});
  });
 }
 return products;
}
function publicViewnetProducts(products){return products.map(p=>({id:p.id,type:p.type,category:p.category,catalogGroup:p.catalogGroup,name:p.name,displayName:p.displayName,brand:p.brand,price:p.snapshotSellingPrice,priceStatus:'snapshot',priceCheckedAt:p.snapshotCheckedAt,available:false,availability:'unknown',requiresConfirmation:true,specs:p.specs,specSourceUrl:p.specSourceUrl,image:p.image,imageKind:p.imageKind,imageModel:p.imageModel,photoUnavailable:p.photoUnavailable,localImageVerified:true,imagePolicy:'local-locked',imageCrop:'full-image',sourceRecordId:p.sourceRecordId,sourceOptionIndex:p.sourceOptionIndex,optionLabel:p.optionLabel}));}
module.exports={loadViewnetProducts,publicViewnetProducts,groupForCategory,variantId};
