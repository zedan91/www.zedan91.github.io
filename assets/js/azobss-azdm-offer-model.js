(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.azdmOfferModel=factory();})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const defaults=()=>({enabled:true,product_id:'AZDM',name:'AZDM',fulfilment:'azdm',max_quantity:100,bulk_minimum:2,bulk_unit_cents:4000,plans:[{id:'annual',label:'1 Year',days:365,quantity:0,amount_cents:2500},{id:'lifetime',label:'Lifetime',days:0,quantity:0,amount_cents:5000}]});
  function integer(value,min,max,label){if(!Number.isInteger(value)||value<min||value>max)throw new Error(label+' is invalid.');return value;}
  function normalize(value){
    if(!value||typeof value!=='object')throw new Error('Plan settings are required.');
    const id=String(value.product_id||'').trim(),name=String(value.name||'').trim();
    if(!/^[A-Za-z0-9_-]{1,100}$/.test(id)||!name||name.length>90||/[\x00-\x1f]/.test(name))throw new Error('Software name or ID is invalid.');
    const fulfilment=value.fulfilment||'azdm';if(!['azdm','download'].includes(fulfilment))throw new Error('Purchase method is invalid.');
    const max=integer(value.max_quantity,1,100,'Maximum PCs');
    const minimum=integer(value.bulk_minimum??0,0,100,'Minimum PCs for discount');
    const discount=integer(value.bulk_unit_cents??0,0,10000000,'Discount price');
    if(minimum===1||(minimum>0&&(!discount||minimum>max)))throw new Error('Discount requires at least 2 PCs and a valid price.');
    if(!Array.isArray(value.plans)||!value.plans.length||value.plans.length>10)throw new Error('Provide between 1 and 10 plans.');
    const ids=new Set();
    const plans=value.plans.map(p=>{
      if(!p||!/^[-A-Za-z0-9_]{1,40}$/.test(p.id||'')||ids.has(p.id))throw new Error('Plan ID must be unique.');ids.add(p.id);
      const label=String(p.label||'').trim();if(!label||label.length>60||/[\x00-\x1f]/.test(label))throw new Error('Plan name is invalid.');
      const days=integer(p.days,0,36500,'License duration'),quantity=integer(p.quantity,0,max,'Number of PCs'),amount=integer(p.amount_cents,1,10000000,'Plan price');
      if(minimum&&days===0&&!quantity&&discount>=amount)throw new Error('Discount price must be lower than the standard Lifetime price.');
      return {id:p.id,label,days,quantity,amount_cents:amount};
    });
    return {enabled:value.enabled===true,product_id:id,name,fulfilment,max_quantity:max,bulk_minimum:minimum,bulk_unit_cents:minimum?discount:0,plans};
  }
  function quote(value,planId,quantity){
    const offer=normalize(value);if(!offer.enabled)throw new Error('License plans are not enabled yet.');
    const p=offer.plans.find(x=>x.id===planId);if(!p)throw new Error('Plan not found.');
    integer(quantity,1,offer.max_quantity,'Number of PCs');if(p.quantity&&p.quantity!==quantity)throw new Error('Number of PCs must match the selected plan.');
    const discount=!p.quantity&&p.days===0&&offer.bulk_minimum&&quantity>=offer.bulk_minimum;
    const unit=discount?offer.bulk_unit_cents:p.amount_cents,total=p.quantity?p.amount_cents:unit*quantity;
    return {id:offer.product_id+':'+p.id,name:offer.name+' · '+p.label,days:p.days,quantity,unit_cents:p.quantity?Math.floor(total/quantity):unit,total_cents:total,fixed:p.quantity>0,discount:!!discount};
  }
  return {defaults,normalize,quote};
});
