// Extracted from index.html. Order preserved.

document.addEventListener('DOMContentLoaded', function(){
  const btn = document.getElementById('testLuckyDrawBackendButton');
  const status = document.getElementById('luckyDrawPrizeSaveStatus') || document.getElementById('luckyDrawParticipantsStatus');
  if(!btn) return;

  function cleanUrl(url){
    url = String(url || '').trim();
    if(url && !url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
    return url.replace(/\/$/, '');
  }

  btn.addEventListener('click', async function(){
    let url = cleanUrl(localStorage.getItem('azobssLuckyDrawBackendUrl') || window.AZOBSS_LUCKY_DRAW_API || '');
    if(!url){
      url = cleanUrl(prompt('Masukkan URL Render backend:', '') || '');
      if(url) localStorage.setItem('azobssLuckyDrawBackendUrl', url);
    }

    if(!url){
      if(status) status.textContent = 'Backend URL belum diset.';
      return;
    }

    if(status) status.textContent = 'Testing backend: ' + url + '/api/health ...';

    try{
      const res = await fetch(url + '/api/health', { cache:'no-store' });
      const data = await res.json();
      if(data && data.ok){
        if(status) status.textContent = 'Backend OK ✅ URL: ' + url;
        alert('Backend OK ✅\n' + url);
      }else{
        throw new Error('Health response bukan OK');
      }
    }catch(e){
      if(status) status.textContent = 'Backend test gagal ❌ ' + e.message;
      alert('Backend test gagal ❌\n\nCuba buka URL ini dalam browser:\n' + url + '/api/health\n\nJika tak keluar {"ok":true}, Render belum live / URL salah.');
    }
  });
});
