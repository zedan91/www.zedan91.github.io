
(function(){
  try{
    if(location.hostname === 'azobss.com'){
      location.replace('https://www.azobss.com' + location.pathname + location.search + location.hash);
    }
  }catch(_e){}
})();
