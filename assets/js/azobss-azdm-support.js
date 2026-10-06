(function(){
  if(new URLSearchParams(location.search).get('azdmSupport')!=='1')return;
  let attempts=0;
  const timer=window.azobssLongSessionInterval(()=>{
    const modal=document.getElementById('azSupportModal');
    const trigger=document.querySelector('[data-az-open-support],.market-user-tools [aria-label="Chat"],.market-user-tools [aria-label="Contact Admin / Support"]');
    if(modal&&trigger){clearInterval(timer);trigger.click();const text=modal.querySelector('textarea');if(text&&!text.value)text.value='Saya perlukan bantuan AZDM. No. pesanan: ';}
    else if(++attempts>=30)clearInterval(timer);
  },300);
})();
