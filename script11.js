
/* =========================================================
   AZOBSS BACKEND CONNECTION FIX / DEBUG
========================================================= */
document.addEventListener('DOMContentLoaded', function(){

  function getStatusBox(){
    return document.getElementById('luckyDrawPrizeSaveStatus') ||
           document.getElementById('luckyDrawParticipantsStatus') ||
           document.getElementById('luckyDrawStatus');
  }

  function cleanBackendUrl(url){
    url = String(url || '').trim();

    if(!url) return '';

    // If user paste with path, keep only domain.
    url = url.replace(/\/api\/.*$/i, '');
    url = url.replace(/\/$/, '');

    // Render URL must be https
    if(url && !/^https?:\/\//i.test(url)){
      url = 'https://' + url;
    }

    return url;
  }

  window.azobssSetBackendUrl = function(){
    const current =
      localStorage.getItem('azobssLuckyDrawBackendUrl') ||
      window.AZOBSS_LUCKY_DRAW_API ||
      '';

    const input = prompt(
      'Masukkan URL Render backend sahaja. Contoh:\\nhttps://nama-service.onrender.com',
      current
    );

    if(!input) return '';

    const clean = cleanBackendUrl(input);
    localStorage.setItem('azobssLuckyDrawBackendUrl', clean);
    window.AZOBSS_LUCKY_DRAW_API = clean;

    const status = getStatusBox();
    if(status) status.textContent = 'Backend URL disimpan: ' + clean;

    return clean;
  };

  window.azobssGetBackendUrl = function(){
    let url =
      localStorage.getItem('azobssLuckyDrawBackendUrl') ||
      window.AZOBSS_LUCKY_DRAW_API ||
      '';

    url = cleanBackendUrl(url);

    if(url){
      localStorage.setItem('azobssLuckyDrawBackendUrl', url);
      window.AZOBSS_LUCKY_DRAW_API = url;
    }

    return url;
  };

  window.azobssTestBackendNow = async function(){
    const status = getStatusBox();
    let url = window.azobssGetBackendUrl();

    if(!url){
      url = window.azobssSetBackendUrl();
    }

    if(!url){
      if(status) status.textContent = 'Backend URL belum diset.';
      return;
    }

    const healthUrl = url + '/api/health';

    if(status) {
      status.innerHTML = 'Testing backend...<br><small>' + healthUrl + '</small>';
    }

    try{
      const controller = new AbortController();
      const timer = setTimeout(function(){ controller.abort(); }, 12000);

      const res = await fetch(healthUrl, {
        method: 'GET',
        cache: 'no-store',
        mode: 'cors',
        signal: controller.signal
      });

      clearTimeout(timer);

      let data = null;
      try { data = await res.json(); } catch(e) {}

      if(res.ok && data && data.ok){
        if(status) status.textContent = 'Backend OK âœ… ' + url;
        alert('Backend OK âœ…\\n' + url);
        return;
      }

      throw new Error('HTTP ' + res.status + ' - endpoint /api/health tidak return {ok:true}');
    }catch(error){
      const msg =
        'Backend test gagal âŒ\\n\\n' +
        'URL test:\\n' + healthUrl + '\\n\\n' +
        'Punca biasa:\\n' +
        '1. Render backend belum deploy / masih sleeping.\\n' +
        '2. URL salah. Pastikan guna URL Render backend, bukan URL website.\\n' +
        '3. Service Render error. Check Logs di Render.\\n' +
        '4. CORS belum allow domain website.\\n\\n' +
        'Cuba buka URL ini manual dalam browser:\\n' + healthUrl + '\\n\\n' +
        'Jika berjaya, ia patut keluar JSON: {"ok":true,...}\\n\\n' +
        'Error: ' + error.message;

      if(status) status.textContent = 'Backend test gagal âŒ Buka /api/health manual untuk check.';
      alert(msg);

      // Open health URL in new tab for direct diagnosis
      window.open(healthUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const setBtn = document.getElementById('setLuckyDrawBackendUrlButton');
  if(setBtn){
    setBtn.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      window.azobssSetBackendUrl();
    }, true);
  }

  const testBtn = document.getElementById('testLuckyDrawBackendButton');
  if(testBtn){
    testBtn.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      window.azobssTestBackendNow();
    }, true);
  }
});
