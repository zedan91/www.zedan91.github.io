
/* AZOBSS topbar carousel scroll buttons */
(function(){
  const scroll = document.getElementById('azobssNavScroll');
  if(!scroll) return;

  const left = document.querySelector('.azobss-nav-left');
  const right = document.querySelector('.azobss-nav-right');

  function move(dir){
    scroll.scrollBy({ left: dir * Math.max(220, scroll.clientWidth * 0.7), behavior: 'smooth' });
  }

  if(left) left.addEventListener('click', () => move(-1));
  if(right) right.addEventListener('click', () => move(1));

  const links = Array.from(document.querySelectorAll('.azobss-nav-chip[href^="#"]'));
  const sections = links
    .map(a => ({ a, section: document.querySelector(a.getAttribute('href')) }))
    .filter(x => x.section);

  function setActive(){
    if(!sections.length) return;
    let current = sections[0];
    const y = window.scrollY + 150;

    sections.forEach(item => {
      if(item.section.offsetTop <= y) current = item;
    });

    links.forEach(a => a.classList.remove('is-active'));
    if(current && current.a){
      current.a.classList.add('is-active');
}
  }

  window.addEventListener('scroll', setActive, {passive:true});
  window.addEventListener('load', setActive);
  setActive();
})();
