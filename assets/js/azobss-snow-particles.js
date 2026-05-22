(function(){
  if (window.__azobssSnowParticles) return;
  window.__azobssSnowParticles = true;

  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'azobssSnowParticles';
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100vw',
    height: '100vh',
    pointerEvents: 'none',
    zIndex: '2',
    opacity: '0.62',
    mixBlendMode: 'screen'
  });

  const css = document.createElement('style');
  css.id = 'azobssSnowParticlesStyle';
  css.textContent = `
    #azobssSnowParticles{pointer-events:none!important;}
    .market-sticky-bar,.market-user-tools,.user-dropdown,.modal,.auth-modal,.swal2-container{position:relative;z-index:3200!important;}
    @media (max-width:760px){#azobssSnowParticles{opacity:.42!important;}}
  `;
  document.head.appendChild(css);
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let flakes = [];
  let rafId = 0;

  function resize(){
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth || document.documentElement.clientWidth || 1200;
    height = window.innerHeight || document.documentElement.clientHeight || 800;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);

    const count = Math.max(28, Math.min(95, Math.floor((width * height) / 18000)));
    flakes = Array.from({length: count}, () => makeFlake(true));
  }

  function makeFlake(randomY){
    const size = 1.2 + Math.random() * 3.2;
    return {
      x: Math.random() * width,
      y: randomY ? Math.random() * height : -10 - Math.random() * height * .2,
      r: size,
      s: .35 + Math.random() * 1.05,
      drift: (Math.random() - .5) * .55,
      swing: Math.random() * Math.PI * 2,
      alpha: .28 + Math.random() * .58
    };
  }

  function draw(){
    ctx.clearRect(0,0,width,height);
    for(const f of flakes){
      f.y += f.s;
      f.x += f.drift + Math.sin(f.swing) * .18;
      f.swing += .012;
      if(f.y > height + 12 || f.x < -18 || f.x > width + 18){
        Object.assign(f, makeFlake(false));
      }
      const glow = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 4.2);
      glow.addColorStop(0, `rgba(255,255,255,${f.alpha})`);
      glow.addColorStop(.45, `rgba(178,225,255,${f.alpha * .22})`);
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r * 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${Math.min(.9, f.alpha + .15)})`;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    rafId = requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize, {passive:true});
  document.addEventListener('visibilitychange', () => {
    if(document.hidden){ cancelAnimationFrame(rafId); }
    else { cancelAnimationFrame(rafId); draw(); }
  });
  resize();
  draw();
})();
