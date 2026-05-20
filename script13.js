
/* AZOBSS true carousel nav controls */
(function(){
  const scroll = document.getElementById('azobssNavScroll');
  if(!scroll) return;

  const left = document.querySelector('.azobss-nav-left');
  const right = document.querySelector('.azobss-nav-right');

  function updateArrows(){
    if(!left || !right) return;
    left.classList.toggle('is-disabled', scroll.scrollLeft <= 4);
    right.classList.toggle('is-disabled', scroll.scrollLeft + scroll.clientWidth >= scroll.scrollWidth - 4);
  }

  function move(dir){
    scroll.scrollBy({
      left: dir * Math.max(260, Math.floor(scroll.clientWidth * 0.75)),
      behavior:'smooth'
    });
  }

  if(left) left.addEventListener('click', () => move(-1));
  if(right) right.addEventListener('click', () => move(1));

  scroll.addEventListener('scroll', updateArrows, {passive:true});
  window.addEventListener('resize', updateArrows);
  window.addEventListener('load', updateArrows);
  updateArrows();
})();
