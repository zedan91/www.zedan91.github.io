
/* AZOBSS carousel: center clicked chip only, no pullback while scrolling */
(function(){
  const scroll = document.getElementById('azobssNavScroll');
  if(!scroll) return;

  document.querySelectorAll('.azobss-nav-chip').forEach(function(chip){
    chip.addEventListener('click', function(){
      setTimeout(function(){
        chip.scrollIntoView({behavior:'smooth', inline:'center', block:'nearest'});
      }, 80);
    });
  });
})();
