
document.addEventListener('DOMContentLoaded', function(){
  const btn = document.getElementById('setLuckyDrawBackendUrlButton');
  if(!btn) return;

  btn.addEventListener('click', function(){
    const current = localStorage.getItem('azobssLuckyDrawBackendUrl') || window.AZOBSS_LUCKY_DRAW_API || '';
    const url = prompt('Masukkan URL Render backend Lucky Draw:', current) || '';
    if(url.trim()){
      const clean = cleanRenderBackendUrl(url);
      localStorage.setItem('azobssLuckyDrawBackendUrl', clean);
      window.AZOBSS_LUCKY_DRAW_API = clean;
      alert('Backend URL disimpan: ' + clean);
    }
  });
});
