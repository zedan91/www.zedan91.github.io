
    const API_BASE = (localStorage.getItem('azobssLuckyDrawBackendUrl') || 'https://azobss-lucky-draw-api.onrender.com').replace(/\/$/, '');
    const ADMIN_USERNAME = 'zedan91';
    const MEMBER_PA_CODE = 'ZX6186';
    function getLuckyDrawTargetDate(){
      const now = new Date();
      const malaysiaParts = new Intl.DateTimeFormat('en-CA', {
        timeZone:'Asia/Kuala_Lumpur',
        year:'numeric',
        month:'2-digit',
        day:'2-digit',
        hour:'2-digit',
        minute:'2-digit',
        second:'2-digit',
        hour12:false
      }).formatToParts(now).reduce((acc, part) => {
        if(part.type !== 'literal') acc[part.type] = part.value;
        return acc;
      }, {});

      let year = Number(malaysiaParts.year);
      let month = Number(malaysiaParts.month); // 1-12
      let target = new Date(Date.UTC(year, month, 0, 14, 0, 0)); // 10:00 PM Malaysia = 14:00 UTC

      if(now.getTime() > target.getTime()){
        month += 1;
        if(month > 12){ month = 1; year += 1; }
        target = new Date(Date.UTC(year, month, 0, 14, 0, 0));
      }

      return target;
    }

    function formatLuckyDrawTargetText(date){
      try{
        return date.toLocaleString('en-MY', {
          timeZone:'Asia/Kuala_Lumpur',
          day:'2-digit',
          month:'2-digit',
          year:'numeric',
          hour:'2-digit',
          minute:'2-digit',
          hour12:true
        }) + ' Malaysia';
      }catch(e){
        return tr('targetFallback');
      }
    }
    const savedInviteFromUrl = cleanShareUsername(new URLSearchParams(location.search).get('invite') || '');
    if (savedInviteFromUrl) localStorage.setItem('azobssLuckyDrawLastInvite', savedInviteFromUrl);

    let luckyDrawEntriesCache = [];
    let referralClickCountCache = 0;

    const els = {
      auth: document.getElementById('siteAuthActions'),
      tools: document.getElementById('marketUserTools'),
      menu: document.getElementById('userMenu'),
      avatar: document.getElementById('userAvatar'),
      name: document.getElementById('signedInName'),
      paBm: document.getElementById('paBmNavButton'),
      inviteLink: document.getElementById('inviteLink'),
      inviteCode: document.getElementById('inviteCodeText'),
      shareStatus: document.getElementById('shareStatusText'),
      status: document.getElementById('joinStatus'),
      joinButton: document.getElementById('joinLuckyDrawButton'),
      copyButton: document.getElementById('copyInviteButton'),
      shareButton: document.getElementById('shareInviteButton'),
      confirmShareButton: document.getElementById('confirmShareButton'),
      authButton: document.getElementById('luckyDrawAuthButton'),
      langToggle: document.getElementById('luckyLangToggle'),
      countdown: document.getElementById('countdownText'),
      targetText: document.getElementById('targetText'),
      total: document.getElementById('participantTotal'),
      participants: document.getElementById('participantList'),
      winner: document.getElementById('winnerName'),
      winnerText: document.getElementById('winnerText'),
      prizeImage: document.getElementById('prizeImage'),
      prizeTitle: document.getElementById('prizeTitle'),
      prizeDescription: document.getElementById('prizeDescription'),
      prizeTitleInput: document.getElementById('prizeTitleInput'),
      prizeDescriptionInput: document.getElementById('prizeDescriptionInput'),
      prizeImageFile: document.getElementById('prizeImageFile'),
      prizeJsonInput: document.getElementById('prizeJsonInput'),
      adminStatus: document.getElementById('adminStatus')
    };

    function parseUser(raw){try{return raw ? JSON.parse(raw) : null;}catch(e){return null;}}
    function readUser(){
      return parseUser(sessionStorage.getItem('azobssCurrentUser')) ||
        parseUser(localStorage.getItem('azobssCurrentUser')) ||
        parseUser(sessionStorage.getItem('azobssUser')) ||
        parseUser(localStorage.getItem('azobssUser'));
    }
    function initials(name){
      return String(name || 'AZ').trim().split(/\s+/).slice(0,2).map(part => part.charAt(0).toUpperCase()).join('') || 'AZ';
    }
    function normalizeUsername(name){
      return String(name || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    }
    function cleanInviteCode(value){
      return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 24);
    }
    function cleanShareUsername(value){
      return normalizeUsername(value).slice(0, 40);
    }
    function buildInviteCode(usernameKey){
      return cleanShareUsername(usernameKey || 'user');
    }
    function monthKey(){
      const d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    }
    function getShareKey(user){
      return 'azobssLuckyReferralReady_' + monthKey() + '_' + (user && user.usernameKey || 'guest');
    }
    function getPendingShareKey(user){
      return 'azobssLuckyReferralCheck_' + monthKey() + '_' + (user && user.usernameKey || 'guest');
    }
    function getJoinKey(user){
      return 'azobssLuckyJoin_' + monthKey() + '_' + (user && user.usernameKey || 'guest');
    }
    function buildInviteUrl(user){
      const username = cleanShareUsername(user && (user.usernameKey || user.name || user.inviteCode));
      return location.origin + '/lucky-draw/?invite=' + encodeURIComponent(username);
    }
    function isAdmin(user){
      const key = normalizeUsername(user && (user.usernameKey || user.name));
      const role = String(user && user.role || '').trim().toLowerCase();
      return !!(user && (role === 'admin' || key === ADMIN_USERNAME));
    }
    function hasPaBmAccess(user){
      const code = cleanInviteCode(user && (user.invitedByCode || user.memberCode || user.paMemberCode));
      return !!(user && (isAdmin(user) || code === MEMBER_PA_CODE));
    }
    function escapeHtml(value){
      return String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    }
    async function apiFetch(path, options){
      const res = await fetch(API_BASE + path, options || {});
      return res;
    }

    const luckyDrawI18n = {
      ms: {
        langButton: 'English',
        kicker: 'Lucky Draw',
        title: 'Peraduan Lucky Draw User',
        intro: 'User yang login boleh join Lucky Draw selepas link username share dibuka oleh orang lain.',
        rule1: 'Login dahulu sebelum join Lucky Draw.',
        rule2: 'Share link username anda; sekurang-kurangnya 1 orang lain perlu buka link itu sebelum boleh join.',
        rule3: 'Satu device dan satu IP address hanya boleh join sekali untuk bulan ini.',
        linkLabel: 'Link share username',
        copyInvite: 'Copy Invite Link',
        shareWebsite: 'Share Website',
        checkReferral: 'Check Referral Click',
        joinLucky: 'Join Lucky Draw',
        auth: 'Login / Register',
        usernameShare: 'Username share',
        shareStatus: 'Status share',
        notShared: 'Belum share',
        noteTitle: 'Nota link share Lucky Draw',
        note1: 'Link share anda perlu dibuka oleh sekurang-kurangnya 1 orang lain sebelum anda boleh join Lucky Draw bulan ini.',
        note2: 'Buka link sendiri tidak dikira.',
        note3: 'Klik berulang dari device atau IP yang sama tidak akan dikira banyak kali.',
        countdownLabel: 'Lucky Draw akan berjalan dalam',
        targetFallback: 'Auto hujung bulan, 10:00 PM Malaysia',
        prizeSmall: 'Prize',
        winnerPending: 'Pemenang belum dipilih',
        totalParticipants: 'Jumlah peserta join',
        currentWinner: 'Pemenang bulan ini',
        winnerNone: 'Belum dipilih',
        prizeKicker: 'Hadiah Lucky Draw',
        prizeDefaultTitle: 'Hadiah belum diumumkan',
        prizeDefaultDesc: 'Admin belum upload hadiah Lucky Draw bulan ini.',
        adminTitle: 'Edit Hadiah Lucky Draw',
        adminPrizeTitle: 'Tajuk hadiah',
        adminPrizeDesc: 'Description hadiah',
        adminPrizeImage: 'Upload gambar hadiah',
        savePrize: 'Save Prize',
        applyJson: 'Apply JSON',
        downloadJson: 'Download JSON',
        refresh: 'Refresh',
        runDraw: 'Run Draw',
        testSpin: 'Test Spin',
        resetWinner: 'Reset Winner',
        resetParticipants: 'Reset Participants',
        resetJoinMonth: 'Reset Join Bulan Ini',
        exportParticipants: 'Export Peserta',
        participantsKicker: 'Peserta Lucky Draw',
        participantsTitle: 'Senarai peserta bulan ini',
        loginPlaceholder: 'Login dahulu untuk jana invite link',
        loginActive: 'Login dahulu untuk aktifkan Lucky Draw.',
        loginCheck: 'Login dahulu untuk check referral click.',
        checking: 'Checking referral click...',
        alreadyJoined: 'Anda sudah join Lucky Draw bulan ini.',
        referralValid: 'Referral click sudah valid. Button Join Lucky Draw sudah aktif.',
        referralMissing: 'Share link username kepada orang lain. Join aktif selepas sekurang-kurangnya 1 orang buka link anda.',
        referralCount: 'Referral click: ',
        noReferral: 'Belum ada referral click',
        copyLogin: 'Login dahulu sebelum copy invite link.',
        copied: 'Link username berjaya disalin. Join aktif selepas orang lain buka link ini.',
        shareLogin: 'Login dahulu sebelum share link.',
        shareText: 'Jom join AZOBSS Lucky Draw: ',
        shareOpened: 'Link sudah dibuka untuk share. Join hanya aktif selepas orang lain buka link anda.',
        shareCancelled: 'Share dibatalkan. Join belum aktif.',
        whatsappOpened: 'WhatsApp dibuka. Join hanya aktif selepas orang lain buka link anda.',
        joinLogin: 'Login dahulu sebelum join Lucky Draw.',
        joinSuccess: 'Anda berjaya join Lucky Draw bulan ini. Semoga berjaya!',
        entriesEmpty: 'Belum ada peserta Lucky Draw.',
        entriesBackendFail: 'Backend peserta belum dapat dibaca.',
        congrats: 'Tahniah ',
        exportEmpty: 'Tiada peserta untuk export.',
        exportDone: 'Export peserta selesai.',
        resetJoinFail: 'Reset join bulan ini gagal.',
        resetJoinConfirm: 'Reset join bulan ini? Semua peserta bulan semasa akan dikosongkan dan user boleh join semula.',
        runDrawConfirm: 'Run Lucky Draw untuk bulan ini? Pemenang akan disimpan.'
      },
      en: {
        langButton: 'BM',
        kicker: 'Lucky Draw',
        title: 'User Lucky Draw Contest',
        intro: 'Logged-in users can join the Lucky Draw after their username share link is opened by another person.',
        rule1: 'Log in first before joining the Lucky Draw.',
        rule2: 'Share your username link; at least 1 other person must open the link before you can join.',
        rule3: 'One device and one IP address can only join once for this month.',
        linkLabel: 'Username share link',
        copyInvite: 'Copy Invite Link',
        shareWebsite: 'Share Website',
        checkReferral: 'Check Referral Click',
        joinLucky: 'Join Lucky Draw',
        auth: 'Login / Register',
        usernameShare: 'Username share',
        shareStatus: 'Share status',
        notShared: 'Not shared yet',
        noteTitle: 'Lucky Draw share link note',
        note1: 'Your share link must be opened by at least 1 other person before you can join this month\'s Lucky Draw.',
        note2: 'Opening your own link does not count.',
        note3: 'Repeated clicks from the same device or IP address will not be counted multiple times.',
        countdownLabel: 'Lucky Draw will run in',
        targetFallback: 'Auto end of month, 10:00 PM Malaysia',
        prizeSmall: 'Prize',
        winnerPending: 'Winner has not been selected',
        totalParticipants: 'Total joined participants',
        currentWinner: 'This month\'s winner',
        winnerNone: 'Not selected yet',
        prizeKicker: 'Lucky Draw Prize',
        prizeDefaultTitle: 'Prize not announced yet',
        prizeDefaultDesc: 'This month\'s Lucky Draw prize has not been uploaded yet.',
        adminTitle: 'Edit Lucky Draw Prize',
        adminPrizeTitle: 'Prize title',
        adminPrizeDesc: 'Prize description',
        adminPrizeImage: 'Upload prize image',
        savePrize: 'Save Prize',
        applyJson: 'Apply JSON',
        downloadJson: 'Download JSON',
        refresh: 'Refresh',
        runDraw: 'Run Draw',
        testSpin: 'Test Spin',
        resetWinner: 'Reset Winner',
        resetParticipants: 'Reset Participants',
        resetJoinMonth: 'Reset Join This Month',
        exportParticipants: 'Export Participants',
        participantsKicker: 'Lucky Draw Participants',
        participantsTitle: 'Participant list for this month',
        loginPlaceholder: 'Log in first to generate invite link',
        loginActive: 'Log in first to activate Lucky Draw.',
        loginCheck: 'Log in first to check referral click.',
        checking: 'Checking referral click...',
        alreadyJoined: 'You have already joined this month\'s Lucky Draw.',
        referralValid: 'Referral click is valid. Join Lucky Draw button is now active.',
        referralMissing: 'Share your username link with someone else. Join will be active after at least 1 person opens your link.',
        referralCount: 'Referral click: ',
        noReferral: 'No referral click yet',
        copyLogin: 'Log in first before copying the invite link.',
        copied: 'Username link copied. Join will be active after someone else opens this link.',
        shareLogin: 'Log in first before sharing the link.',
        shareText: 'Join AZOBSS Lucky Draw: ',
        shareOpened: 'Share window opened. Join will only be active after someone else opens your link.',
        shareCancelled: 'Share cancelled. Join is not active yet.',
        whatsappOpened: 'WhatsApp opened. Join will only be active after someone else opens your link.',
        joinLogin: 'Log in first before joining Lucky Draw.',
        joinSuccess: 'You have successfully joined this month\'s Lucky Draw. Good luck!',
        entriesEmpty: 'No Lucky Draw participants yet.',
        entriesBackendFail: 'Participant backend cannot be read yet.',
        congrats: 'Congratulations ',
        exportEmpty: 'No participants to export.',
        exportDone: 'Participants export completed.',
        resetJoinFail: 'Reset join for this month failed.',
        resetJoinConfirm: 'Reset joins for this month? All current-month participants will be cleared and users can join again.',
        runDrawConfirm: 'Run Lucky Draw for this month? The winner will be saved.'
      }
    };

    let luckyDrawLang = localStorage.getItem('azobssLuckyDrawLang') === 'en' ? 'en' : 'ms';
    function tr(key){ return (luckyDrawI18n[luckyDrawLang] && luckyDrawI18n[luckyDrawLang][key]) || luckyDrawI18n.ms[key] || key; }
    function setText(selector, value){ const el = document.querySelector(selector); if (el) el.textContent = value; }
    function setTextAll(selector, values){ document.querySelectorAll(selector).forEach((el, index) => { if (values[index]) el.textContent = values[index]; }); }
    function applyLuckyDrawLanguage(){
      document.documentElement.setAttribute('data-lucky-lang', luckyDrawLang);
      if (els.langToggle) els.langToggle.textContent = tr('langButton');
      setText('.lucky-shell .top-grid .panel > .kicker', tr('kicker'));
      setText('.lucky-shell .top-grid .panel h1', tr('title'));
      setText('.lucky-shell .top-grid .panel > p', tr('intro'));
      setTextAll('.lucky-shell .rules li', [tr('rule1'), tr('rule2'), tr('rule3')]);
      setText('label[for="inviteLink"]', tr('linkLabel'));
      if (els.copyButton) els.copyButton.textContent = tr('copyInvite');
      if (els.shareButton) els.shareButton.textContent = tr('shareWebsite');
      if (els.joinButton) els.joinButton.textContent = tr('joinLucky');
      if (els.authButton) els.authButton.textContent = tr('auth');
      setTextAll('.mini-status span', [tr('usernameShare'), tr('shareStatus')]);
      setText('#referralInfoNote strong', tr('noteTitle'));
      setTextAll('#referralInfoNote li', [tr('note1'), tr('note2'), tr('note3')]);
      setText('.countdown-panel span', tr('countdownLabel'));
      setText('.spin-box strong', tr('prizeSmall'));
      setTextAll('.summary-box span', [tr('totalParticipants'), tr('currentWinner')]);
      setText('.prize-card .kicker', tr('prizeKicker'));
      setText('.admin-panel h2', tr('adminTitle'));
      setText('label[for="prizeTitleInput"]', tr('adminPrizeTitle'));
      setText('label[for="prizeDescriptionInput"]', tr('adminPrizeDesc'));
      setText('label[for="prizeImageFile"]', tr('adminPrizeImage'));
      setText('#savePrizeButton', tr('savePrize'));
      setText('#applyJsonButton', tr('applyJson'));
      setText('#downloadJsonButton', tr('downloadJson'));
      setText('#refreshPrizeButton', tr('refresh'));
      setText('#runDrawButton', tr('runDraw'));
      setText('#testSpinButton', tr('testSpin'));
      setText('#resetWinnerButton', tr('resetWinner'));
      setText('#resetParticipantsButton', tr('resetParticipants'));
      setText('#resetJoinMonthButton', tr('resetJoinMonth'));
      setText('#exportParticipantsButton', tr('exportParticipants'));
      setText('#refreshEntriesButton', tr('refresh'));
      setText('.participant-panel .kicker', tr('participantsKicker'));
      setText('.participant-panel h2', tr('participantsTitle'));
    }

    function setStatus(message, error){
      els.status.textContent = message || '';
      els.status.classList.toggle('error', !!error);
    }
    function setAdminStatus(message, error){
      els.adminStatus.textContent = message || '';
      els.adminStatus.classList.toggle('error', !!error);
    }
    function getDeviceId(){
      let id = localStorage.getItem('azobssLuckyDrawDeviceId');
      if (!id) {
        id = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem('azobssLuckyDrawDeviceId', id);
      }
      return id;
    }
    function getDeviceFingerprint(){
      return [
        getDeviceId(),
        navigator.userAgent,
        navigator.language,
        screen.width + 'x' + screen.height,
        Intl.DateTimeFormat().resolvedOptions().timeZone || ''
      ].join('|').slice(0, 150);
    }

    async function recordReferralClickFromUrl(){
      if (!savedInviteFromUrl) return;
      try {
        await apiFetch('/api/lucky-draw/referral-click', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            monthKey: monthKey(),
            ref: savedInviteFromUrl,
            visitorUsernameKey: cleanShareUsername((readUser() || {}).usernameKey || (readUser() || {}).name || ''),
            deviceFingerprint: getDeviceFingerprint()
          })
        });
      } catch(e) {}
    }

    async function loadReferralStatus(user){
      if (!user || !(user.usernameKey || user.name)) return 0;
      const username = cleanShareUsername(user.usernameKey || user.name);
      try {
        const res = await apiFetch('/api/lucky-draw/referral-status?monthKey=' + encodeURIComponent(monthKey()) + '&ref=' + encodeURIComponent(username));
        const data = await res.json().catch(() => ({}));
        referralClickCountCache = Number(data.count || 0);
        if (referralClickCountCache > 0) {
          localStorage.setItem(getShareKey(user), '1');
        }
        return referralClickCountCache;
      } catch(e) {
        return referralClickCountCache || 0;
      }
    }

    async function refreshReferralStatus(){
      const user = readUser();
      if (!user || !(user.usernameKey || user.name)) {
        setStatus(tr('loginCheck'), true);
        return;
      }
      setStatus(tr('checking'));
      await loadReferralStatus(user);
      updateInvitePanel();
    }

    function findCurrentUserEntry(user){
      if (!user) return null;
      const usernameKey = normalizeUsername(user.usernameKey || user.name);
      const uid = String(user.uid || '').trim();
      const inviteCode = cleanShareUsername(user.inviteCode || buildInviteCode(usernameKey));
      return (luckyDrawEntriesCache || []).find((entry) => {
        if (!entry || entry.deleted) return false;
        const entryUser = normalizeUsername(entry.usernameKey || entry.name);
        const entryUid = String(entry.uid || '').trim();
        const entryInvite = cleanShareUsername(entry.inviteCode || '');
        return (usernameKey && entryUser === usernameKey) ||
          (uid && entryUid && entryUid === uid) ||
          (inviteCode && entryInvite && entryInvite === inviteCode);
      }) || null;
    }

    function markJoinedLocal(user){
      if (!user) return;
      try { localStorage.setItem(getJoinKey(user), '1'); } catch(e) {}
    }

    function isDuplicateJoinError(error, data){
      const code = String(data && data.code || '').toUpperCase();
      const msg = String((data && data.error) || (error && error.message) || '').toLowerCase();
      return code.indexOf('DUPLICATE') >= 0 ||
        msg.indexOf('sudah join') >= 0 ||
        msg.indexOf('sudah digunakan') >= 0 ||
        msg.indexOf('already') >= 0 ||
        msg.indexOf('duplicate') >= 0;
    }

    function showJoinedStatus(user, message){
      markJoinedLocal(user);
      if (els.joinButton) els.joinButton.disabled = true;
      setStatus(message || tr('alreadyJoined'));
    }

    function showUser(){
      const user = readUser();
      const display = user && (user.usernameKey || user.name || (user.email ? String(user.email).split('@')[0] : ''));
      document.body.classList.toggle('is-admin', isAdmin(user));
      if (els.paBm) {
        const canPa = hasPaBmAccess(user);
        els.paBm.hidden = !canPa;
        els.paBm.classList.toggle('is-hidden', !canPa);
      }
      if (display) {
        els.name.textContent = display;
        els.avatar.textContent = initials(display);
        document.body.classList.add('is-authenticated');
        if (els.auth) els.auth.style.display = 'none';
        if (els.tools) els.tools.style.display = 'flex';
        if (els.authButton) els.authButton.style.display = 'none';
      } else {
        document.body.classList.remove('is-authenticated');
        if (els.auth) els.auth.style.display = 'flex';
        if (els.tools) els.tools.style.display = 'none';
        if (els.authButton) els.authButton.style.display = '';
      }
      updateInvitePanel();
    }

    function updateInvitePanel(){
      const user = readUser();
      if (!user || !(user.usernameKey || user.name)) {
        els.inviteLink.value = tr('loginPlaceholder');
        els.inviteCode.textContent = '-';
        els.shareStatus.textContent = tr('notShared');
        els.joinButton.disabled = true;
        if (els.confirmShareButton) {
          els.confirmShareButton.disabled = true;
          els.confirmShareButton.textContent = tr('checkReferral');
        }
        setStatus(tr('loginActive'), false);
        return;
      }

      if (!user.usernameKey) user.usernameKey = normalizeUsername(user.name);
      user.inviteCode = buildInviteCode(user.usernameKey);
      const inviteUrl = buildInviteUrl(user);
      const referralReady = localStorage.getItem(getShareKey(user)) === '1' || referralClickCountCache > 0;
      const backendJoined = !!findCurrentUserEntry(user);
      // Backend peserta adalah sumber utama. LocalStorage tidak lagi mengunci join
      // supaya admin boleh reset penyertaan bulan semasa dan user boleh join semula.
      const joined = backendJoined;
      if (backendJoined) markJoinedLocal(user);
      else { try { localStorage.removeItem(getJoinKey(user)); } catch(e) {} }
      els.inviteLink.value = inviteUrl;
      els.inviteCode.textContent = user.usernameKey;
      els.shareStatus.textContent = referralReady ? (tr('referralCount') + Math.max(1, referralClickCountCache)) : tr('noReferral');
      els.joinButton.disabled = joined || !referralReady;
      if (els.confirmShareButton) {
        els.confirmShareButton.disabled = joined;
        els.confirmShareButton.textContent = tr('checkReferral');
      }
      if (joined) setStatus(tr('alreadyJoined'));
      else if (referralReady) setStatus(tr('referralValid'));
      else setStatus(tr('referralMissing'));
    }

    function tickCountdown(){
      const target = getLuckyDrawTargetDate();
      const diff = Math.max(0, target.getTime() - Date.now());
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor(diff / 3600000) % 24;
      const minutes = Math.floor(diff / 60000) % 60;
      const seconds = Math.floor(diff / 1000) % 60;
      if(els.countdown){
        els.countdown.textContent = days + ' hari ' +
          String(hours).padStart(2,'0') + ':' +
          String(minutes).padStart(2,'0') + ':' +
          String(seconds).padStart(2,'0');
      }
      if(els.targetText){
        els.targetText.textContent = formatLuckyDrawTargetText(target);
      }
    }

    async function loadPrize(){
      try {
        const res = await apiFetch('/api/lucky-draw/prize?monthKey=' + encodeURIComponent(monthKey()), {cache:'no-store'});
        const data = await res.json();
        if (data && data.ok && data.prize) {
          renderPrize(data.prize);
          return;
        }
      } catch(e) {}

      try {
        const res = await fetch('/lucky-draw/giveaway-prize.json', {cache:'no-store'});
        const data = await res.json();
        renderPrize(data || {});
      } catch(e) {}
    }

    function normalizeImagePath(image){
      const value = String(image || '').trim();
      if (!value) return '/lucky-draw/prize-placeholder.svg';
      if (/^https?:\/\//i.test(value) || value.startsWith('data:image/')) return value;
      if (value.startsWith('../')) return value;
      return '../' + value.replace(/^\/+/, '');
    }
    function renderPrize(prize){
      const image = normalizeImagePath(prize.imageUrl || prize.image);
      const title = prize.title || tr('prizeDefaultTitle');
      const desc = prize.description || tr('prizeDefaultDesc');
      els.prizeImage.src = image;
      els.prizeTitle.textContent = title;
      els.prizeDescription.textContent = desc;
      els.prizeTitleInput.value = prize.title || '';
      els.prizeDescriptionInput.value = prize.description || '';
      els.prizeJsonInput.value = JSON.stringify({
        monthKey: prize.monthKey || monthKey(),
        title,
        description: desc,
        imageUrl: prize.imageUrl || prize.image || ''
      }, null, 2);
    }

    async function loadEntries(){
      try {
        const res = await apiFetch('/api/lucky-draw/entries?monthKey=' + encodeURIComponent(monthKey()), {cache:'no-store'});
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Entries error');
        const rows = Array.isArray(data.entries) ? data.entries : [];
        luckyDrawEntriesCache = rows.filter((entry) => !entry.deleted);
        els.total.textContent = String(data.total || luckyDrawEntriesCache.length || 0);
        renderParticipants(luckyDrawEntriesCache);
        updateInvitePanel();
      } catch(e) {
        els.participants.innerHTML = '<div class="empty">' + escapeHtml(tr('entriesBackendFail')) + '</div>';
      }
    }

    function renderParticipants(rows){
      if (!rows.length) {
        els.participants.innerHTML = '<div class="empty">' + escapeHtml(tr('entriesEmpty')) + '</div>';
        return;
      }
      els.participants.innerHTML = rows.slice(0, 20).map((entry, i) => {
        const name = escapeHtml(entry.name || entry.usernameKey || 'User');
        const joined = entry.joinedAt ? new Date(entry.joinedAt).toLocaleString('en-MY') : '-';
        return '<div class="participant-card"><div><strong>' + (i + 1) + '. ' + name + '</strong><span>' + escapeHtml(joined) + '</span></div></div>';
      }).join('');
    }

    async function loadWinner(){
      try {
        const res = await apiFetch('/api/lucky-draw/winner?monthKey=' + encodeURIComponent(monthKey()), {cache:'no-store'});
        const data = await res.json();
        const winner = data && data.winner;
        const name = winner ? (winner.name || winner.usernameKey || 'Winner') : tr('winnerNone');
        els.winner.textContent = name;
        els.winnerText.textContent = winner ? tr('congrats') + name : tr('winnerPending');
      } catch(e) {}
    }

    async function copyInvite(){
      const user = readUser();
      if (!user || !(user.usernameKey || user.name)) {
        setStatus(tr('copyLogin'), true);
        return;
      }
      await navigator.clipboard.writeText(els.inviteLink.value);
      setStatus(tr('copied'));
    }

    function shareInvite(){
      const user = readUser();
      if (!user || !(user.usernameKey || user.name)) {
        setStatus(tr('shareLogin'), true);
        return;
      }
      const inviteUrl = els.inviteLink.value;
      const text = tr('shareText') + inviteUrl;
      if (navigator.share) {
        navigator.share({title:'AZOBSS Lucky Draw', text, url:inviteUrl}).then(function(){
          setStatus(tr('shareOpened'));
          refreshReferralStatus();
        }).catch(function(){
          setStatus(tr('shareCancelled'), true);
        });
      } else {
        window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
        setStatus(tr('whatsappOpened'));
      }
    }

    function confirmShareDone(){
      refreshReferralStatus();
    }

    async function joinLuckyDraw(){
      const user = readUser();
      if (!user || !(user.usernameKey || user.name)) {
        setStatus(tr('joinLogin'), true);
        return;
      }
      if (findCurrentUserEntry(user)) {
        showJoinedStatus(user, tr('alreadyJoined'));
        return;
      }
      const referralReady = localStorage.getItem(getShareKey(user)) === '1' || referralClickCountCache > 0;
      if (!referralReady) {
        await loadReferralStatus(user);
      }
      if (!(localStorage.getItem(getShareKey(user)) === '1' || referralClickCountCache > 0)) {
        setStatus('Belum ada referral click valid. Share link username kepada orang lain dahulu.', true);
        return;
      }
      const usernameKey = normalizeUsername(user.usernameKey || user.name);
      const inviteCode = cleanShareUsername(usernameKey);
      const payload = {
        monthKey: monthKey(),
        usernameKey,
        uid: user.uid || '',
        name: user.name || usernameKey,
        phone: user.phone || '',
        contactEmail: user.contactEmail || user.email || '',
        inviteCode,
        inviteUrl: buildInviteUrl({usernameKey, inviteCode}),
        invitedByCode: cleanShareUsername(localStorage.getItem('azobssLuckyDrawLastInvite') || user.invitedByCode || ''),
        shareConfirmed: true,
        deviceFingerprint: getDeviceFingerprint()
      };
      setStatus('Sedang submit penyertaan...');
      if (els.joinButton) els.joinButton.disabled = true;
      try {
        const res = await apiFetch('/api/lucky-draw/entries', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
          if (isDuplicateJoinError(null, data)) {
            showJoinedStatus(user, data.error || tr('alreadyJoined'));
            await loadEntries();
            return;
          }
          throw new Error(data.error || 'Join gagal');
        }
        markJoinedLocal(user);
        updateInvitePanel();
        setStatus(tr('joinSuccess'));
        await loadEntries();
      } catch(e) {
        if (isDuplicateJoinError(e, null)) {
          showJoinedStatus(user, e.message || tr('alreadyJoined'));
          return;
        }
        if (els.joinButton) els.joinButton.disabled = false;
        setStatus(e.message || 'Join gagal.', true);
      }
    }

    async function savePrize(){
      if (!isAdmin(readUser())) {
        setAdminStatus('Admin sahaja boleh save hadiah.', true);
        return;
      }
      const form = new FormData();
      form.append('monthKey', monthKey());
      form.append('title', els.prizeTitleInput.value.trim());
      form.append('description', els.prizeDescriptionInput.value.trim());
      form.append('updatedBy', normalizeUsername(readUser().usernameKey || readUser().name));
      try {
        const parsed = JSON.parse(els.prizeJsonInput.value || '{}');
        if (parsed.imageUrl || parsed.image) form.append('imageUrl', parsed.imageUrl || parsed.image);
      } catch(e) {}
      if (els.prizeImageFile.files && els.prizeImageFile.files[0]) {
        form.append('image', els.prizeImageFile.files[0]);
      }
      setAdminStatus('Saving hadiah...');
      try {
        const res = await apiFetch('/api/lucky-draw/prize', {method:'POST', body:form});
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Save gagal');
        renderPrize(data.prize || {});
        setAdminStatus('Hadiah berjaya disimpan.');
      } catch(e) {
        setAdminStatus(e.message || 'Save hadiah gagal.', true);
      }
    }

    function applyJson(){
      try {
        const data = JSON.parse(els.prizeJsonInput.value || '{}');
        if (data.title !== undefined) els.prizeTitleInput.value = data.title;
        if (data.description !== undefined) els.prizeDescriptionInput.value = data.description;
        renderPrize({
          title: els.prizeTitleInput.value,
          description: els.prizeDescriptionInput.value,
          imageUrl: data.imageUrl || data.image || ''
        });
        setAdminStatus('JSON diaplikasi ke preview. Tekan Save Prize untuk publish.');
      } catch(e) {
        setAdminStatus('JSON tidak valid: ' + e.message, true);
      }
    }

    function downloadJson(){
      const payload = {
        monthKey: monthKey(),
        title: els.prizeTitleInput.value.trim(),
        description: els.prizeDescriptionInput.value.trim(),
        imageUrl: (() => {
          try { const data = JSON.parse(els.prizeJsonInput.value || '{}'); return data.imageUrl || data.image || ''; }
          catch(e) { return ''; }
        })(),
        updatedAt: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'Lucky-Draw-prize.json';
      a.click();
      URL.revokeObjectURL(a.href);
    }


    function requireLuckyDrawAdmin(){
      if (isAdmin(readUser())) return true;
      setAdminStatus('Admin sahaja boleh guna fungsi ini.', true);
      return false;
    }

    function activeLuckyRows(){
      return (luckyDrawEntriesCache || []).filter((entry) => entry && !entry.deleted && (entry.name || entry.usernameKey));
    }

    async function runLuckyDraw(){
      if (!requireLuckyDrawAdmin()) return;
      if (!confirm(tr('runDrawConfirm'))) return;
      setAdminStatus('Running lucky draw...');
      try {
        const res = await apiFetch('/api/lucky-draw/winner/spin', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({monthKey:monthKey()})
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Run draw gagal');
        const winner = data.winner || {};
        const name = winner.name || winner.usernameKey || 'Winner';
        els.winner.textContent = name;
        els.winnerText.textContent = data.alreadySelected ? 'Pemenang sudah dipilih: ' + name : 'Tahniah ' + name;
        setAdminStatus(data.alreadySelected ? 'Pemenang bulan ini sudah wujud. Reset Winner dahulu jika mahu draw semula.' : 'Pemenang berjaya dipilih dan disimpan.');
      } catch(e) {
        setAdminStatus(e.message || 'Run draw gagal.', true);
      }
    }

    function testLuckySpin(){
      if (!requireLuckyDrawAdmin()) return;
      const rows = activeLuckyRows();
      if (!rows.length) {
        setAdminStatus('Tiada peserta untuk test spin.', true);
        return;
      }
      setAdminStatus('Test spin sahaja. Pemenang tidak disimpan.');
      let step = 0;
      const maxStep = 24;
      const spinTimer = setInterval(() => {
        const pick = rows[Math.floor(Math.random() * rows.length)] || {};
        const name = pick.name || pick.usernameKey || 'User';
        els.winnerText.textContent = 'Spinning... ' + name;
        step += 1;
        if (step >= maxStep) {
          clearInterval(spinTimer);
          const finalPick = rows[Math.floor(Math.random() * rows.length)] || {};
          const finalName = finalPick.name || finalPick.usernameKey || 'User';
          els.winnerText.textContent = 'Test sahaja: ' + finalName;
          setAdminStatus('Test spin selesai. Tiada rekod winner disimpan.');
        }
      }, 90);
    }

    async function resetLuckyWinner(){
      if (!requireLuckyDrawAdmin()) return;
      if (!confirm('Reset winner bulan ini?')) return;
      setAdminStatus('Reset winner...');
      try {
        const res = await apiFetch('/api/lucky-draw/winner?monthKey=' + encodeURIComponent(monthKey()), {method:'DELETE'});
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Reset winner gagal');
        els.winner.textContent = tr('winnerNone');
        els.winnerText.textContent = tr('winnerPending');
        setAdminStatus('Winner bulan ini sudah direset.');
      } catch(e) {
        setAdminStatus(e.message || 'Reset winner gagal.', true);
      }
    }

    async function resetLuckyParticipants(){
      if (!requireLuckyDrawAdmin()) return;
      if (!confirm('Reset semua peserta bulan ini? Tindakan ini akan kosongkan senarai peserta bulan semasa.')) return;
      setAdminStatus('Reset peserta...');
      try {
        const res = await apiFetch('/api/lucky-draw/entries?monthKey=' + encodeURIComponent(monthKey()), {method:'DELETE'});
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Reset peserta gagal');
        await resetLuckyWinnerSilent();
        luckyDrawEntriesCache = [];
        renderParticipants([]);
        els.total.textContent = '0';
        clearCurrentBrowserJoinLock();
        updateInvitePanel();
        setAdminStatus('Peserta bulan ini sudah direset.');
      } catch(e) {
        setAdminStatus(e.message || 'Reset peserta gagal.', true);
      }
    }


    function clearCurrentBrowserJoinLock(){
      try {
        const keyPrefix = 'azobssLuckyJoin_' + monthKey() + '_';
        Object.keys(localStorage).forEach((key) => {
          if (key.indexOf(keyPrefix) === 0) localStorage.removeItem(key);
        });
      } catch(e) {}
    }

    async function resetJoinThisMonth(){
      if (!requireLuckyDrawAdmin()) return;
      if (!confirm('Reset join bulan ini? Semua user yang sudah join akan dianggap belum join dan boleh join semula bulan yang sama.')) return;
      setAdminStatus('Reset join bulan ini...');
      try {
        const res = await apiFetch('/api/lucky-draw/entries?monthKey=' + encodeURIComponent(monthKey()), {method:'DELETE'});
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Reset join bulan ini gagal');
        luckyDrawEntriesCache = [];
        renderParticipants([]);
        els.total.textContent = '0';
        clearCurrentBrowserJoinLock();
        await loadReferralStatus(readUser());
        updateInvitePanel();
        setAdminStatus('Join bulan ini sudah direset. User yang sudah join boleh join semula jika referral click masih valid.');
      } catch(e) {
        setAdminStatus(e.message || tr('resetJoinFail'), true);
      }
    }

    async function resetLuckyWinnerSilent(){
      try {
        await apiFetch('/api/lucky-draw/winner?monthKey=' + encodeURIComponent(monthKey()), {method:'DELETE'});
        els.winner.textContent = tr('winnerNone');
        els.winnerText.textContent = tr('winnerPending');
      } catch(e) {}
    }

    function exportLuckyParticipants(){
      if (!requireLuckyDrawAdmin()) return;
      const rows = activeLuckyRows();
      if (!rows.length) {
        setAdminStatus(tr('exportEmpty'), true);
        return;
      }
      const headers = ['No','Name','Username','Email','Phone','Invite Code','Invited By','Joined At'];
      const csvRows = [headers].concat(rows.map((entry, index) => [
        index + 1,
        entry.name || '',
        entry.usernameKey || '',
        entry.contactEmail || '',
        entry.phone || '',
        entry.inviteCode || '',
        entry.invitedByCode || '',
        entry.joinedAt || ''
      ]));
      const csv = csvRows.map((row) => row.map((value) => '"' + String(value).replace(/"/g, '""') + '"').join(',')).join('\n');
      const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'AZOBSS-Lucky-Draw-Participants-' + monthKey() + '.csv';
      a.click();
      URL.revokeObjectURL(a.href);
      setAdminStatus(tr('exportDone'));
    }

    if (els.langToggle) els.langToggle.addEventListener('click', function(){
      luckyDrawLang = luckyDrawLang === 'en' ? 'ms' : 'en';
      localStorage.setItem('azobssLuckyDrawLang', luckyDrawLang);
      applyLuckyDrawLanguage();
      updateInvitePanel();
      tickCountdown();
      loadWinner();
      loadEntries();
    });
    els.copyButton.addEventListener('click', copyInvite);
    els.shareButton.addEventListener('click', shareInvite);
    if (els.confirmShareButton) els.confirmShareButton.addEventListener('click', confirmShareDone);
    els.joinButton.addEventListener('click', joinLuckyDraw);
    document.getElementById('refreshEntriesButton').addEventListener('click', loadEntries);
    document.getElementById('refreshPrizeButton').addEventListener('click', loadPrize);
    document.getElementById('savePrizeButton').addEventListener('click', savePrize);
    document.getElementById('applyJsonButton').addEventListener('click', applyJson);
    document.getElementById('downloadJsonButton').addEventListener('click', downloadJson);
    document.getElementById('runDrawButton').addEventListener('click', runLuckyDraw);
    document.getElementById('testSpinButton').addEventListener('click', testLuckySpin);
    document.getElementById('resetWinnerButton').addEventListener('click', resetLuckyWinner);
    document.getElementById('resetParticipantsButton').addEventListener('click', resetLuckyParticipants);
    document.getElementById('resetJoinMonthButton').addEventListener('click', resetJoinThisMonth);
    document.getElementById('exportParticipantsButton').addEventListener('click', exportLuckyParticipants);

    window.addEventListener('storage', showUser);

    applyLuckyDrawLanguage();
    tickCountdown();
    setInterval(tickCountdown, 1000);
    showUser();
    recordReferralClickFromUrl();
    loadReferralStatus(readUser()).then(updateInvitePanel);
    loadPrize();
    loadEntries();
    loadWinner();
    setInterval(function(){ loadEntries(); loadReferralStatus(readUser()).then(updateInvitePanel); }, 30000);
  