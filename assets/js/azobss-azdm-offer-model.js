(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.azdmOfferModel=factory();})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const defaults=()=>({enabled:true,product_id:'AZDM',name:'AZDM',fulfilment:'azdm',max_quantity:100,bulk_minimum:2,bulk_unit_cents:4000,plans:[{id:'annual',label:'1 Tahun',days:365,quantity:0,amount_cents:2500},{id:'lifetime',label:'Lifetime',days:0,quantity:0,amount_cents:5000}]});
  function integer(value,min,max,label){if(!Number.isInteger(value)||value<min||value>max)throw new Error(label+' tidak sah.');return value;}
  function normalize(value){
    if(!value||typeof value!=='object')throw new Error('Tetapan pakej diperlukan.');
    const id=String(value.product_id||'').trim(),name=String(value.name||'').trim();
    if(!/^[A-Za-z0-9_-]{1,100}$/.test(id)||!name||name.length>90||/[\x00-\x1f]/.test(name))throw new Error('Nama atau ID software tidak sah.');
    const fulfilment=value.fulfilment||'azdm';if(!['azdm','download'].includes(fulfilment))throw new Error('Cara pembelian tidak sah.');
    const max=integer(value.max_quantity,1,100,'Maksimum PC');
    const minimum=integer(value.bulk_minimum??0,0,100,'Minimum PC diskaun');
    const discount=integer(value.bulk_unit_cents??0,0,10000000,'Harga diskaun');
    if(minimum===1||(minimum>0&&(!discount||minimum>max)))throw new Error('Diskaun memerlukan minimum 2 PC dan harga yang sah.');
    if(!Array.isArray(value.plans)||!value.plans.length||value.plans.length>10)throw new Error('Sediakan antara 1 hingga 10 pakej.');
    const ids=new Set();
    const plans=value.plans.map(p=>{
      if(!p||!/^[-A-Za-z0-9_]{1,40}$/.test(p.id||'')||ids.has(p.id))throw new Error('ID pakej mesti unik.');ids.add(p.id);
      const label=String(p.label||'').trim();if(!label||label.length>60||/[\x00-\x1f]/.test(label))throw new Error('Nama pakej tidak sah.');
      const days=integer(p.days,0,36500,'Tempoh lesen'),quantity=integer(p.quantity,0,max,'Bilangan PC'),amount=integer(p.amount_cents,1,10000000,'Harga pakej');
      if(minimum&&days===0&&!quantity&&discount>=amount)throw new Error('Harga diskaun mesti lebih rendah daripada harga Lifetime biasa.');
      return {id:p.id,label,days,quantity,amount_cents:amount};
    });
    return {enabled:value.enabled===true,product_id:id,name,fulfilment,max_quantity:max,bulk_minimum:minimum,bulk_unit_cents:minimum?discount:0,plans};
  }
  function quote(value,planId,quantity){
    const offer=normalize(value);if(!offer.enabled)throw new Error('Pakej lesen belum diaktifkan.');
    const p=offer.plans.find(x=>x.id===planId);if(!p)throw new Error('Pakej tidak ditemui.');
    integer(quantity,1,offer.max_quantity,'Bilangan PC');if(p.quantity&&p.quantity!==quantity)throw new Error('Bilangan PC mesti mengikut pakej.');
    const discount=!p.quantity&&p.days===0&&offer.bulk_minimum&&quantity>=offer.bulk_minimum;
    const unit=discount?offer.bulk_unit_cents:p.amount_cents,total=p.quantity?p.amount_cents:unit*quantity;
    return {id:offer.product_id+':'+p.id,name:offer.name+' · '+p.label,days:p.days,quantity,unit_cents:p.quantity?Math.floor(total/quantity):unit,total_cents:total,fixed:p.quantity>0,discount:!!discount};
  }
  return {defaults,normalize,quote};
});
