
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
    let luckyDrawEntriesTotalCache = 0;
    let luckyDrawEntriesOffsetCache = 0;
    let prizeCarouselImages = [];
    let prizeCarouselIndex = 0;
    let prizeImageValidationSeq = 0;
    let luckyDrawReferralAuditCache = [];
    let luckyDrawAbuseAuditCache = [];
    let referralClickCountCache = 0;
    let luckyDrawJoinBlockCache = null;
    let luckyDrawWinnerSelected = false;
    let luckyDrawCurrentWinnerCache = null;
    let luckyDrawRollingTimer = null;
    let luckyDrawRollingActive = false;

    const els = {
      auth: document.getElementById('siteAuthActions'),
      tools: document.getElementById('marketUserTools'),
      menu: document.getElementById('userMenu'),
      avatar: document.getElementById('userAvatar'),
      name: document.getElementById('signedInName'),
      paBm: document.getElementById('paBmNavButton'),
      inviteLink: document.getElementById('inviteLink'),
      productRequirementText: document.getElementById('productShareRequirementText'),
      inviteCode: document.getElementById('inviteCodeText'),
      shareStatus: document.getElementById('shareStatusText'),
      stepLogin: document.getElementById('luckyStepLogin'),
      stepReferral: document.getElementById('luckyStepReferral'),
      stepJoin: document.getElementById('luckyStepJoin'),
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
      drawSummaryTitle: document.getElementById('drawSummaryTitle'),
      drawSummaryParticipantsLabel: document.getElementById('drawSummaryParticipantsLabel'),
      drawSummaryShareLabel: document.getElementById('drawSummaryShareLabel'),
      drawSummaryPrizeLabel: document.getElementById('drawSummaryPrizeLabel'),
      drawSummaryStatusLabel: document.getElementById('drawSummaryStatusLabel'),
      drawSummaryLatestLabel: document.getElementById('drawSummaryLatestLabel'),
      drawSummaryParticipants: document.getElementById('drawSummaryParticipants'),
      drawSummaryShares: document.getElementById('drawSummaryShares'),
      drawSummaryPrize: document.getElementById('drawSummaryPrize'),
      drawSummaryStatus: document.getElementById('drawSummaryStatus'),
      drawSummaryLatest: document.getElementById('drawSummaryLatest'),
      prizeImage: document.getElementById('prizeImage'),
      prizeCarouselShell: document.getElementById('prizeCarouselShell'),
      prizePrevButton: document.getElementById('prizePrevButton'),
      prizeNextButton: document.getElementById('prizeNextButton'),
      prizeImageCounter: document.getElementById('prizeImageCounter'),
      prizeTitle: document.getElementById('prizeTitle'),
      prizeDescription: document.getElementById('prizeDescription'),
      prizeTitleInput: document.getElementById('prizeTitleInput'),
      prizeDescriptionInput: document.getElementById('prizeDescriptionInput'),
      prizeImageFile: document.getElementById('prizeImageFile'),
      prizeImageUrlInput: document.getElementById('prizeImageUrlInput'),
      prizeJsonInput: document.getElementById('prizeJsonInput'),
      prizeJsonFileInput: document.getElementById('prizeJsonFileInput'),
      adminStatus: document.getElementById('adminStatus'),
      winnerHistory: document.getElementById('winnerHistoryList'),
      refreshWinnerHistoryButton: document.getElementById('refreshWinnerHistoryButton'),
      referralAuditList: document.getElementById('referralAuditList'),
      referralAuditStatus: document.getElementById('referralAuditStatus'),
      referralAuditValidTotal: document.getElementById('referralAuditValidTotal'),
      referralAuditSharerTotal: document.getElementById('referralAuditSharerTotal'),
      referralAuditSelfTotal: document.getElementById('referralAuditSelfTotal'),
      referralAuditDuplicateTotal: document.getElementById('referralAuditDuplicateTotal'),
      refreshReferralAuditButton: document.getElementById('refreshReferralAuditButton'),
      exportReferralAuditButton: document.getElementById('exportReferralAuditButton'),
      abuseAuditList: document.getElementById('abuseAuditList'),
      abuseAuditStatus: document.getElementById('abuseAuditStatus'),
      abuseAuditTotal: document.getElementById('abuseAuditTotal'),
      abuseAuditSelfTotal: document.getElementById('abuseAuditSelfTotal'),
      abuseAuditDuplicateClickTotal: document.getElementById('abuseAuditDuplicateClickTotal'),
      abuseAuditDuplicateJoinTotal: document.getElementById('abuseAuditDuplicateJoinTotal'),
      refreshAbuseAuditButton: document.getElementById('refreshAbuseAuditButton'),
      exportAbuseAuditButton: document.getElementById('exportAbuseAuditButton')
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
      return location.origin + '/Software-Tools/?ref=' + encodeURIComponent(username);
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
    function azobssAdminApiKey(){
      try{
        return sessionStorage.getItem('azobssAdminApiKey') || localStorage.getItem('azobssAdminApiKey') || localStorage.getItem('azobssLuckyDrawAdminKey') || '';
      }catch(_){ return ''; }
    }
    function azobssWithAdminHeaders(options){
      const opts = Object.assign({}, options || {});
      const headers = Object.assign({}, opts.headers || {});
      const key = azobssAdminApiKey();
      if(key && !headers['x-admin-key']) headers['x-admin-key'] = key;
      opts.headers = headers;
      return opts;
    }
    async function apiFetch(path, options){
      const res = await fetch(API_BASE + path, azobssWithAdminHeaders(options));
      return res;
    }

    const luckyDrawI18n = {
      ms: {
        langButton: 'English',
        kicker: 'Lucky Draw',
        title: 'Peraduan Lucky Draw User',
        intro: 'User yang login boleh join Lucky Draw selepas link produk berbayar Software/CAD dibuka oleh orang lain.',
        rule1: 'Login dahulu sebelum join Lucky Draw.',
        rule2: 'Share mana-mana produk berbayar di Software Tools atau CAD Tools.',
        rule3: 'Tekan Check Product Share untuk semak status sebelum join.',
        linkLabel: 'Syarat share produk berbayar',
        copyInvite: 'Open Software Tools',
        shareWebsite: 'Open CAD Tools',
        checkReferral: 'Check Product Share',
        joinLucky: 'Join Lucky Draw',
        auth: 'Login / Register',
        usernameShare: 'Username share',
        shareStatus: 'Status produk share',
        notShared: 'Belum cukup syarat',
        status1: 'Status 1',
        status2: 'Status 2',
        status3: 'Status 3',
        loginOkTitle: 'Sudah login',
        loginOkDesc: 'Akaun anda aktif untuk Lucky Draw.',
        loginNeedTitle: 'Login dahulu',
        loginNeedDesc: 'Akaun diperlukan untuk join.',
        referralOkTitle: 'Syarat share lengkap',
        referralOkDesc: 'Link anda sudah dibuka oleh orang lain.',
        referralNeedTitle: 'Belum cukup syarat',
        referralNeedDesc: 'Produk berbayar perlu dibuka oleh orang lain.',
        joinedTitle: 'Sudah join',
        joinedDesc: 'Penyertaan bulan ini sudah direkod.',
        joinReadyTitle: 'Boleh join sekarang',
        joinReadyDesc: 'Tekan Join Lucky Draw untuk masuk senarai.',
        joinNeedTitle: 'Belum boleh join',
        joinNeedDesc: 'Button Join akan aktif selepas syarat lengkap.',
        drawClosedTitle: 'Draw bulan ini selesai',
        drawClosedDesc: 'Penyertaan baru telah ditutup.',
        noteTitle: 'Nota syarat share produk berbayar',
        note1: 'Link produk berbayar yang anda share perlu dibuka oleh sekurang-kurangnya 1 orang lain sebelum anda boleh join Lucky Draw bulan ini.',
        note2: 'Buka link produk sendiri tidak dikira.',
        note3: 'Klik berulang dari device atau IP yang sama tidak akan dikira banyak kali.',
        countdownLabel: 'Lucky Draw akan berjalan dalam',
        targetFallback: 'Auto hujung bulan, 10:00 PM Malaysia',
        prizeSmall: 'Prize',
        winnerPending: 'Pemenang belum dipilih',
        rollingTitle: '🎰 Sedang memilih pemenang...',
        rollingNote: 'Nama peserta sedang diputar. Keputusan akan disimpan selepas Run Draw selesai.',
        testRollingTitle: '🎰 Test Spin',
        testWinnerPrefix: '🎰 Keputusan Test Spin',
        testRollingNote: 'Ini hanya preview. Winner belum disimpan.',
        winnerFinalTitle: '🎉 Pemenang Bulan Ini',
        winnerFinalNote: 'Keputusan winner bulan ini sudah disimpan.',
        totalParticipants: 'Jumlah peserta join',
        currentWinner: 'Pemenang bulan ini',
        summaryTitle: 'Ringkasan Lucky Draw bulan ini',
        summaryParticipants: 'Peserta join',
        summaryProductShare: 'Product share anda',
        summaryPrize: 'Hadiah',
        summaryStatus: 'Status',
        summaryLatest: 'Peserta terbaru',
        summaryOpen: 'Dibuka sehingga hujung bulan, 10:00 malam',
        summaryClosed: 'Draw bulan ini sudah selesai',
        summaryNoParticipants: 'Belum ada peserta.',
        winnerNone: 'Belum dipilih',
        prizeKicker: 'Hadiah Lucky Draw',
        prizeDefaultTitle: 'Hadiah belum diumumkan',
        prizeDefaultDesc: 'Admin belum upload hadiah Lucky Draw bulan ini.',
        prizeScrollHint: 'Scroll untuk baca semua description.',
        adminTitle: 'Edit Hadiah Lucky Draw',
        adminPrizeTitle: 'Tajuk hadiah',
        adminPrizeDesc: 'Description hadiah',
        adminPrizeImage: 'Upload gambar hadiah',
        adminPrizeImageUrl: 'URL gambar kekal',
        adminPrizeImageUrlHint: 'Untuk long term, guna URL gambar dari Cloudinary/Firebase Storage/CDN.',
        savePrize: 'Save Prize',
        syncBackend: 'Sync from Backend',
        syncFolderPrize: 'Sync Folder Prize',
        loadJson: 'Load Prize JSON',
        applyJson: 'Apply JSON',
        downloadJson: 'Export Prize JSON',
        refresh: 'Refresh',
        runDraw: 'Run Draw',
        testSpin: 'Test Spin',
        resetWinner: 'Reset Winner',
        resetParticipants: 'Reset Participants',
        resetJoinMonth: 'Reset Join Bulan Ini',
        exportParticipants: 'Export Peserta',
        participantsKicker: 'Peserta Lucky Draw',
        participantsTitle: 'Senarai peserta bulan ini',
        winnerHistoryKicker: 'Winner History',
        winnerHistoryTitle: 'Sejarah pemenang Lucky Draw',
        winnerHistoryEmpty: 'Belum ada sejarah pemenang.',
        winnerHistoryLoadFail: 'Winner history belum dapat dibaca.',
        winnerHistoryTotal: 'Jumlah peserta',
        winnerHistorySelectedAt: 'Dipilih pada',
        referralAuditKicker: 'Referral Audit',
        referralAuditTitle: 'Semakan link share bulan ini',
        referralAuditValidTotal: 'Valid click',
        referralAuditSharerTotal: 'User dapat click',
        referralAuditSelfTotal: 'Self click',
        referralAuditDuplicateTotal: 'Duplicate blocked',
        referralAuditRefresh: 'Refresh Audit',
        referralAuditExport: 'Export Audit',
        referralAuditEmpty: 'Belum ada rekod link share bulan ini.',
        referralAuditFail: 'Referral audit belum dapat dibaca.',
        referralAuditExportEmpty: 'Tiada referral audit untuk export.',
        referralAuditExportDone: 'Export referral audit selesai.',
        referralAuditValid: 'valid',
        referralAuditIgnored: 'tidak dikira',
        referralAuditDuplicate: 'duplicate',
        abuseAuditKicker: 'Anti-Abuse Log',
        abuseAuditTitle: 'Log percubaan mencurigakan bulan ini',
        abuseAuditTotal: 'Jumlah log',
        abuseAuditSelfTotal: 'Self share',
        abuseAuditDuplicateClickTotal: 'Duplicate click',
        abuseAuditDuplicateJoinTotal: 'Duplicate join',
        abuseAuditRefresh: 'Refresh Log',
        abuseAuditExport: 'Export Log',
        abuseAuditEmpty: 'Belum ada log mencurigakan bulan ini.',
        abuseAuditFail: 'Anti-abuse log belum dapat dibaca.',
        abuseAuditExportEmpty: 'Tiada anti-abuse log untuk export.',
        abuseAuditExportDone: 'Export anti-abuse log selesai.',
        loginPlaceholder: 'Share produk berbayar Software/CAD untuk aktifkan join',
        productRequirement: 'Buka mana-mana produk berbayar Software/CAD dan tekan <strong>Share for Lucky Draw</strong>. Join aktif selepas link produk itu dibuka oleh orang lain.',
        loginActive: 'Login dahulu untuk aktifkan Lucky Draw.',
        loginCheck: 'Login dahulu untuk check product share.',
        checking: 'Checking product share...',
        alreadyJoined: 'Anda sudah join Lucky Draw bulan ini.',
        referralValid: 'Klik produk berbayar sudah valid. Button Join Lucky Draw sudah aktif.',
        joinBlockedDevice: 'Syarat share produk sudah valid, tetapi device ini sudah digunakan untuk join Lucky Draw bulan ini.',
        joinBlockedIp: 'Syarat share produk sudah valid, tetapi IP address ini sudah digunakan untuk join Lucky Draw bulan ini.',
        joinBlockedAccount: 'Akaun ini sudah join Lucky Draw bulan ini.',
        joinBlockedGeneric: 'Syarat share produk sudah valid, tetapi anda belum boleh join bulan ini.',
        referralMissing: 'Share link username kepada orang lain. Join aktif selepas sekurang-kurangnya 1 orang buka link anda.',
        referralCount: 'Valid product click: ',
        noReferral: 'Belum ada klik produk valid',
        copyLogin: 'Login dahulu sebelum buka Software Tools.',
        copied: 'Link username berjaya disalin. Join aktif selepas orang lain buka link ini.',
        shareLogin: 'Login dahulu sebelum buka CAD Tools.',
        shareText: 'Jom join AZOBSS Lucky Draw: ',
        shareOpened: 'Link sudah dibuka untuk share. Join hanya aktif selepas orang lain buka link anda.',
        shareCancelled: 'Share dibatalkan. Join belum aktif.',
        whatsappOpened: 'WhatsApp dibuka. Join hanya aktif selepas orang lain buka link produk anda.',
        joinLogin: 'Login dahulu sebelum join Lucky Draw.',
        joinSuccess: 'Anda berjaya join Lucky Draw bulan ini. Semoga berjaya!',
        entriesEmpty: 'Belum ada peserta Lucky Draw.',
        entriesBackendFail: 'Backend peserta belum dapat dibaca.',
        congrats: 'Tahniah ',
        exportEmpty: 'Tiada peserta untuk export.',
        exportDone: 'Export peserta selesai.',
        resetJoinFail: 'Reset join bulan ini gagal.',
        resetJoinConfirm: 'Reset join bulan ini? Semua peserta bulan semasa akan dikosongkan dan user boleh join semula.',
        drawClosed: 'Lucky Draw bulan ini sudah selesai. Join telah ditutup.',
        runDrawConfirm: 'Run Lucky Draw untuk bulan ini? Pemenang akan disimpan.'
      },
      en: {
        langButton: 'BM',
        kicker: 'Lucky Draw',
        title: 'User Lucky Draw Contest',
        intro: 'Logged-in users can join the Lucky Draw after their share link is opened by another person.',
        rule1: 'Log in first before joining the Lucky Draw.',
        rule2: 'Click Open CAD Tools to share your username link.',
        rule3: 'Click Check Product Share to check your status before joining.',
        linkLabel: 'Paid product share requirement',
        copyInvite: 'Open Software Tools',
        shareWebsite: 'Open CAD Tools',
        checkReferral: 'Check Product Share',
        joinLucky: 'Join Lucky Draw',
        auth: 'Login / Register',
        usernameShare: 'Username share',
        shareStatus: 'Product share status',
        notShared: 'Not shared yet',
        status1: 'Status 1',
        status2: 'Status 2',
        status3: 'Status 3',
        loginOkTitle: 'Logged in',
        loginOkDesc: 'Your account is active for Lucky Draw.',
        loginNeedTitle: 'Log in first',
        loginNeedDesc: 'An account is required to join.',
        referralOkTitle: 'Share requirement complete',
        referralOkDesc: 'Your link has been opened by another person.',
        referralNeedTitle: 'Requirement not met',
        referralNeedDesc: 'Your link must be opened by another person.',
        joinedTitle: 'Already joined',
        joinedDesc: 'Your entry for this month has been recorded.',
        joinReadyTitle: 'Ready to join',
        joinReadyDesc: 'Click Join Lucky Draw to enter the list.',
        joinNeedTitle: 'Not ready to join',
        joinNeedDesc: 'The Join button will activate after the requirement is complete.',
        drawClosedTitle: 'This month draw is complete',
        drawClosedDesc: 'New entries are now closed.',
        noteTitle: 'Paid product share note',
        note1: 'Your paid product share link must be opened by at least 1 other person before you can join this month\'s Lucky Draw.',
        note2: 'Opening your own link does not count.',
        note3: 'Repeated clicks from the same device or IP address will not be counted multiple times.',
        countdownLabel: 'Lucky Draw will run in',
        targetFallback: 'Auto end of month, 10:00 PM Malaysia',
        prizeSmall: 'Prize',
        winnerPending: 'Winner has not been selected',
        rollingTitle: '🎰 Picking winner...',
        rollingNote: 'Participant names are rolling. The result will be saved after Run Draw completes.',
        testRollingTitle: '🎰 Test Spin',
        testWinnerPrefix: '🎰 Test Spin Result',
        testRollingNote: 'Preview only. Winner is not saved.',
        winnerFinalTitle: '🎉 This Month Winner',
        winnerFinalNote: 'This month winner result has been saved.',
        totalParticipants: 'Total joined participants',
        currentWinner: 'This month\'s winner',
        summaryTitle: 'This month Lucky Draw summary',
        summaryParticipants: 'Joined participants',
        summaryProductShare: 'Your product share',
        summaryPrize: 'Prize',
        summaryStatus: 'Status',
        summaryLatest: 'Latest participants',
        summaryOpen: 'Open until month end, 10:00 PM',
        summaryClosed: 'This month draw is complete',
        summaryNoParticipants: 'No participants yet.',
        winnerNone: 'Not selected yet',
        prizeKicker: 'Lucky Draw Prize',
        prizeDefaultTitle: 'Prize not announced yet',
        prizeDefaultDesc: 'This month\'s Lucky Draw prize has not been uploaded yet.',
        prizeScrollHint: 'Scroll to read the full description.',
        adminTitle: 'Edit Lucky Draw Prize',
        adminPrizeTitle: 'Prize title',
        adminPrizeDesc: 'Prize description',
        adminPrizeImage: 'Upload prize image',
        adminPrizeImageUrl: 'Persistent image URL',
        adminPrizeImageUrlHint: 'For long term, use an image URL from Cloudinary/Firebase Storage/CDN.',
        savePrize: 'Save Prize',
        syncBackend: 'Sync from Backend',
        syncFolderPrize: 'Sync Folder Prize',
        loadJson: 'Load Prize JSON',
        applyJson: 'Apply JSON',
        downloadJson: 'Export Prize JSON',
        refresh: 'Refresh',
        runDraw: 'Run Draw',
        testSpin: 'Test Spin',
        resetWinner: 'Reset Winner',
        resetParticipants: 'Reset Participants',
        resetJoinMonth: 'Reset Join This Month',
        exportParticipants: 'Export Participants',
        participantsKicker: 'Lucky Draw Participants',
        participantsTitle: 'Participant list for this month',
        winnerHistoryKicker: 'Winner History',
        winnerHistoryTitle: 'Lucky Draw winner history',
        winnerHistoryEmpty: 'No winner history yet.',
        winnerHistoryLoadFail: 'Winner history could not be loaded yet.',
        winnerHistoryTotal: 'Total participants',
        winnerHistorySelectedAt: 'Selected at',
        referralAuditKicker: 'Referral Audit',
        referralAuditTitle: 'This month share link audit',
        referralAuditValidTotal: 'Valid clicks',
        referralAuditSharerTotal: 'Users with clicks',
        referralAuditSelfTotal: 'Self clicks',
        referralAuditDuplicateTotal: 'Duplicates blocked',
        referralAuditRefresh: 'Refresh Audit',
        referralAuditExport: 'Export Audit',
        referralAuditEmpty: 'No share link record for this month yet.',
        referralAuditFail: 'Referral audit could not be loaded yet.',
        referralAuditExportEmpty: 'No referral audit to export.',
        referralAuditExportDone: 'Referral audit export completed.',
        referralAuditValid: 'valid',
        referralAuditIgnored: 'not counted',
        referralAuditDuplicate: 'duplicate',
        abuseAuditKicker: 'Anti-Abuse Log',
        abuseAuditTitle: 'This month suspicious attempt log',
        abuseAuditTotal: 'Total logs',
        abuseAuditSelfTotal: 'Self share',
        abuseAuditDuplicateClickTotal: 'Duplicate click',
        abuseAuditDuplicateJoinTotal: 'Duplicate join',
        abuseAuditRefresh: 'Refresh Log',
        abuseAuditExport: 'Export Log',
        abuseAuditEmpty: 'No suspicious log for this month yet.',
        abuseAuditFail: 'Anti-abuse log could not be loaded yet.',
        abuseAuditExportEmpty: 'No anti-abuse log to export.',
        abuseAuditExportDone: 'Anti-abuse log export completed.',
        loginPlaceholder: 'Share a paid Software/CAD product to unlock join',
        productRequirement: 'Open any paid Software/CAD product and tap <strong>Share for Lucky Draw</strong>. Join activates after another person opens that product link.',
        loginActive: 'Log in first to activate Lucky Draw.',
        loginCheck: 'Log in first to check product share.',
        checking: 'Checking product share...',
        alreadyJoined: 'You have already joined this month\'s Lucky Draw.',
        referralValid: 'Paid product click is valid. Join Lucky Draw button is now active.',
        joinBlockedDevice: 'Paid product share is valid, but this device has already been used to join this month.',
        joinBlockedIp: 'Paid product share is valid, but this IP address has already been used to join this month.',
        joinBlockedAccount: 'This account has already joined the Lucky Draw this month.',
        joinBlockedGeneric: 'Paid product share is valid, but you cannot join this month.',
        referralMissing: 'Share any paid Software/CAD product. Join will be active after at least 1 person opens your product link.',
        referralCount: 'Valid product click: ',
        noReferral: 'No valid product click yet',
        copyLogin: 'Log in first before opening Software Tools.',
        copied: 'Choose any paid product, then tap the Share for Lucky Draw button.',
        shareLogin: 'Log in first before opening CAD Tools.',
        shareText: 'AZOBSS paid product: ',
        shareOpened: 'Product share window opened. Join will only be active after someone else opens your product link.',
        shareCancelled: 'Share cancelled. Join is not active yet.',
        whatsappOpened: 'WhatsApp opened. Join will only be active after someone else opens your product link.',
        joinLogin: 'Log in first before joining Lucky Draw.',
        joinSuccess: 'You have successfully joined this month\'s Lucky Draw. Good luck!',
        entriesEmpty: 'No Lucky Draw participants yet.',
        entriesBackendFail: 'Participant backend cannot be read yet.',
        congrats: 'Congratulations ',
        exportEmpty: 'No participants to export.',
        exportDone: 'Participants export completed.',
        resetJoinFail: 'Reset join for this month failed.',
        resetJoinConfirm: 'Reset joins for this month? All current-month participants will be cleared and users can join again.',
        drawClosed: 'This month\'s Lucky Draw is finished. Joining is now closed.',
        runDrawConfirm: 'Run Lucky Draw for this month? The winner will be saved.'
      }
    };

    let luckyDrawLang = localStorage.getItem('azobssLuckyDrawLang') === 'en' ? 'en' : 'ms';
    function tr(key){ return (luckyDrawI18n[luckyDrawLang] && luckyDrawI18n[luckyDrawLang][key]) || luckyDrawI18n.ms[key] || key; }
    function updatePrizeDescScrollHint(){
      const hint = document.getElementById('prizeDescScrollHint');
      const desc = document.getElementById('prizeDescription');
      if (!hint || !desc) return;
      const isMobile = window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
      const canScroll = desc.scrollHeight > desc.clientHeight + 8;
      hint.style.display = (isMobile && canScroll) ? 'flex' : 'none';
    }

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
      if (els.productRequirementText) els.productRequirementText.innerHTML = tr('productRequirement');
      if (els.copyButton) els.copyButton.textContent = tr('copyInvite');
      if (els.shareButton) els.shareButton.textContent = tr('shareWebsite');
      if (els.joinButton) els.joinButton.textContent = tr('joinLucky');
      if (els.authButton) els.authButton.textContent = tr('auth');
      setTextAll('.mini-status span', [tr('usernameShare'), tr('shareStatus')]);
      updateJoinChecklist(readUser(), referralClickCountCache > 0 || (readUser() && localStorage.getItem(getShareKey(readUser())) === '1'), !!findCurrentUserEntry(readUser()));
      setText('#referralInfoNote strong', tr('noteTitle'));
      setTextAll('#referralInfoNote li', [tr('note1'), tr('note2'), tr('note3')]);
      setText('.countdown-panel span', tr('countdownLabel'));
      setText('#drawSummaryTitle', tr('summaryTitle'));
      setText('#drawSummaryParticipantsLabel', tr('summaryParticipants'));
      setText('#drawSummaryShareLabel', tr('summaryProductShare'));
      setText('#drawSummaryPrizeLabel', tr('summaryPrize'));
      setText('#drawSummaryStatusLabel', tr('summaryStatus'));
      setText('#drawSummaryLatestLabel', tr('summaryLatest'));
      updateLuckyDrawSummary();
      setTextAll('.summary-box span', [tr('totalParticipants'), tr('currentWinner')]);
      setText('.prize-panel .kicker', tr('prizeKicker'));
      setText('#prizeDescScrollHint', tr('prizeScrollHint'));
      setText('.admin-panel h2', tr('adminTitle'));
      setText('label[for="prizeTitleInput"]', tr('adminPrizeTitle'));
      setText('label[for="prizeDescriptionInput"]', tr('adminPrizeDesc'));
      setText('label[for="prizeImageFile"]', tr('adminPrizeImage'));
      setText('label[for="prizeImageUrlInput"]', tr('adminPrizeImageUrl'));
      const imageUrlHint = document.querySelector('label[for="prizeImageUrlInput"] + input + small'); if (imageUrlHint) imageUrlHint.textContent = tr('adminPrizeImageUrlHint');
      const titleInput = document.getElementById('prizeTitleInput'); if (titleInput) titleInput.placeholder = tr('adminPrizeTitle');
      const imageUrlInput = document.getElementById('prizeImageUrlInput'); if (imageUrlInput) imageUrlInput.placeholder = 'https://...';
      const descInput = document.getElementById('prizeDescriptionInput'); if (descInput) descInput.placeholder = tr('adminPrizeDesc');
      setText('#savePrizeButton', tr('savePrize'));
      setText('#syncPrizeButton', tr('syncBackend'));
      setText('#syncFolderPrizeButton', tr('syncFolderPrize'));
      setText('#loadJsonButton', tr('loadJson'));
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
      setText('.participants .kicker', tr('participantsKicker'));
      setText('.participants h2', tr('participantsTitle'));
      setText('#winnerHistoryKicker', tr('winnerHistoryKicker'));
      setText('#winnerHistoryTitle', tr('winnerHistoryTitle'));
      setText('#refreshWinnerHistoryButton', tr('refresh'));
      setText('#referralAuditKicker', tr('referralAuditKicker'));
      setText('#referralAuditTitle', tr('referralAuditTitle'));
      setText('#referralAuditTotalLabel', tr('referralAuditValidTotal'));
      setText('#referralAuditSharerLabel', tr('referralAuditSharerTotal'));
      setText('#referralAuditSelfLabel', tr('referralAuditSelfTotal'));
      setText('#referralAuditDuplicateLabel', tr('referralAuditDuplicateTotal'));
      setText('#refreshReferralAuditButton', tr('referralAuditRefresh'));
      setText('#exportReferralAuditButton', tr('referralAuditExport'));
      setText('#abuseAuditKicker', tr('abuseAuditKicker'));
      setText('#abuseAuditTitle', tr('abuseAuditTitle'));
      setText('#abuseAuditTotalLabel', tr('abuseAuditTotal'));
      setText('#abuseAuditSelfLabel', tr('abuseAuditSelfTotal'));
      setText('#abuseAuditDuplicateClickLabel', tr('abuseAuditDuplicateClickTotal'));
      setText('#abuseAuditDuplicateJoinLabel', tr('abuseAuditDuplicateJoinTotal'));
      setText('#refreshAbuseAuditButton', tr('abuseAuditRefresh'));
      setText('#exportAbuseAuditButton', tr('abuseAuditExport'));
    }

    function setJoinStep(el, state, label, title, desc){
      if (!el) return;
      el.classList.remove('ok','warn','closed');
      el.classList.add(state || 'warn');
      const span = el.querySelector('span');
      const strong = el.querySelector('strong');
      const small = el.querySelector('small');
      if (span) span.textContent = label || '';
      if (strong) strong.textContent = title || '';
      if (small) small.textContent = desc || '';
    }
    function updateJoinChecklist(user, referralReady, joined){
      const loggedIn = !!(user && (user.usernameKey || user.name));
      setJoinStep(els.stepLogin, loggedIn ? 'ok' : 'warn', tr('status1'), loggedIn ? tr('loginOkTitle') : tr('loginNeedTitle'), loggedIn ? tr('loginOkDesc') : tr('loginNeedDesc'));
      setJoinStep(els.stepReferral, referralReady ? 'ok' : 'warn', tr('status2'), referralReady ? tr('referralOkTitle') : tr('referralNeedTitle'), referralReady ? tr('referralOkDesc') : tr('referralNeedDesc'));
      if (luckyDrawWinnerSelected) {
        setJoinStep(els.stepJoin, 'closed', tr('status3'), tr('drawClosedTitle'), tr('drawClosedDesc'));
      } else if (joined) {
        setJoinStep(els.stepJoin, 'ok', tr('status3'), tr('joinedTitle'), tr('joinedDesc'));
      } else if (loggedIn && referralReady) {
        setJoinStep(els.stepJoin, 'ok', tr('status3'), tr('joinReadyTitle'), tr('joinReadyDesc'));
      } else {
        setJoinStep(els.stepJoin, 'warn', tr('status3'), tr('joinNeedTitle'), tr('joinNeedDesc'));
      }
    }
    function setStatus(message, error){
      els.status.textContent = message || '';
      els.status.classList.toggle('error', !!error);
    }
    function getJoinBlockMessage(block){
      const code = String((block && block.code) || '').toUpperCase();
      const reason = String((block && block.reason) || '').trim();
      if (code === 'ALREADY_JOINED' || code === 'DUPLICATE_USER' || code === 'DUPLICATE_UID') return tr('joinBlockedAccount');
      if (code === 'DUPLICATE_DEVICE') return tr('joinBlockedDevice');
      if (code === 'DUPLICATE_IP') return tr('joinBlockedIp');
      return reason || tr('joinBlockedGeneric');
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
        const query = '/api/lucky-draw/product-referral-status?monthKey=' + encodeURIComponent(monthKey()) +
          '&ref=' + encodeURIComponent(username) +
          '&deviceFingerprint=' + encodeURIComponent(getDeviceFingerprint());
        const res = await apiFetch(query);
        const data = await res.json().catch(() => ({}));
        referralClickCountCache = Number(data.count || 0);
        luckyDrawJoinBlockCache = data && data.blockCode ? { code: data.blockCode, reason: data.blockReason || '' } : null;
        if (referralClickCountCache > 0 && !luckyDrawJoinBlockCache) {
          localStorage.setItem(getShareKey(user), '1');
        } else if (luckyDrawJoinBlockCache) {
          localStorage.removeItem(getShareKey(user));
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
      updateLuckyDrawSummary();
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
        if (els.inviteLink) els.inviteLink.value = tr('loginPlaceholder');
        if (els.productRequirementText) els.productRequirementText.innerHTML = tr('productRequirement');
        els.inviteCode.textContent = '-';
        els.shareStatus.textContent = tr('notShared');
        els.joinButton.disabled = true;
        if (els.confirmShareButton) {
          els.confirmShareButton.disabled = true;
          els.confirmShareButton.textContent = tr('checkReferral');
        }
        updateJoinChecklist(null, false, false);
        setStatus(tr('loginActive'), false);
        return;
      }

      if (!user.usernameKey) user.usernameKey = normalizeUsername(user.name);
      user.inviteCode = buildInviteCode(user.usernameKey);
      const inviteUrl = buildInviteUrl(user);
      const referralReadyRaw = localStorage.getItem(getShareKey(user)) === '1' || referralClickCountCache > 0;
      const joinBlocked = !!luckyDrawJoinBlockCache;
      const referralReady = referralReadyRaw && !joinBlocked;
      const backendJoined = !!findCurrentUserEntry(user);
      // Backend peserta adalah sumber utama. LocalStorage tidak lagi mengunci join
      // supaya admin boleh reset penyertaan bulan semasa dan user boleh join semula.
      const joined = backendJoined;
      if (backendJoined) markJoinedLocal(user);
      else { try { localStorage.removeItem(getJoinKey(user)); } catch(e) {} }
      if (els.inviteLink) els.inviteLink.value = luckyDrawLang === 'en' ? 'Open Software/CAD paid product and tap the Share for Lucky Draw button' : 'Buka produk berbayar Software/CAD dan tekan button Share for Lucky Draw';
      if (els.productRequirementText) els.productRequirementText.innerHTML = tr('productRequirement');
      els.inviteCode.textContent = user.usernameKey;
      els.shareStatus.textContent = joinBlocked ? getJoinBlockMessage(luckyDrawJoinBlockCache) : (referralReady ? (tr('referralCount') + Math.max(1, referralClickCountCache)) : tr('noReferral'));
      els.joinButton.disabled = luckyDrawWinnerSelected || joined || joinBlocked || !referralReady;
      updateJoinChecklist(user, referralReady, joined);
      if (els.confirmShareButton) {
        els.confirmShareButton.disabled = joined;
        els.confirmShareButton.textContent = tr('checkReferral');
      }
      if (luckyDrawWinnerSelected) setStatus(tr('drawClosed'));
      else if (joined) setStatus(tr('alreadyJoined'));
      else if (joinBlocked) setStatus(getJoinBlockMessage(luckyDrawJoinBlockCache), true);
      else if (referralReady) setStatus(tr('referralValid'));
      else setStatus(tr('referralMissing'));
      updateLuckyDrawSummary();
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
        const res = await apiFetch('/api/lucky-draw/prize?autoFolderSync=1&monthKey=' + encodeURIComponent(monthKey()) + '&baseUrl=' + encodeURIComponent(location.origin) + '&_=' + Date.now(), {cache:'no-store'});
        const data = await res.json();
        if (data && data.ok && data.prize) {
          renderPrize(data.prize);
          mergePublicFolderPrizeFallback(data.prize);
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
      if (value.startsWith('/')) return value;
      if (value.startsWith('../')) return value;
      // giveaway-prize.json lives in /lucky-draw/. Relative names like hadiah1.jpg
      // must point to /lucky-draw/hadiah1.jpg, not /hadiah1.jpg.
      return '/lucky-draw/' + value.replace(/^\/+/, '');
    }

    function prizeImageExists(url){
      return new Promise(resolve => {
        if (!url) return resolve(false);
        if (/^data:image\//i.test(url)) return resolve(true);
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url + (url.includes('?') ? '&' : '?') + 'azv=' + Date.now();
      });
    }

    async function getPublicFolderPrizeImages(jsonData){
      const candidates = [];
      const add = (v) => {
        if (Array.isArray(v)) return v.forEach(add);
        String(v || '').split(/[\r\n,]+/).forEach(x => {
          const raw = x.trim();
          if (raw) candidates.push(normalizeImagePath(raw));
        });
      };
      add(jsonData && (jsonData.imageUrls || jsonData.images || []));
      add(jsonData && (jsonData.imageUrl || jsonData.image || ''));
      const exts = ['jpg','jpeg','png','webp','gif'];
      for (let i = 1; i <= 20; i++) exts.forEach(ext => candidates.push('/lucky-draw/hadiah' + i + '.' + ext));
      const unique = [];
      const seen = new Set();
      for (const item of candidates) {
        const key = String(item || '').trim();
        if (!key || seen.has(key) || key.includes('prize-placeholder')) continue;
        seen.add(key);
        if (await prizeImageExists(key)) unique.push(key);
      }
      return unique;
    }

    async function mergePublicFolderPrizeFallback(currentPrize){
      try {
        const res = await fetch('/lucky-draw/giveaway-prize.json?azv=' + Date.now(), {cache:'no-store'});
        if (!res.ok) return;
        const jsonData = await res.json();
        const folderImages = await getPublicFolderPrizeImages(jsonData || {});
        const currentImages = getPrizeImages(currentPrize || {}).filter(v => !String(v).includes('prize-placeholder'));
        if (folderImages.length > currentImages.length) {
          renderPrize(Object.assign({}, currentPrize || {}, jsonData || {}, {
            imageUrl: folderImages[0] || '',
            image: folderImages[0] || '',
            imageUrls: folderImages,
            images: folderImages,
            imageStorage: 'public-folder-direct-fallback'
          }));
        }
      } catch(e) {}
    }

    function escapeHtml(value){
      return String(value || '').replace(/[&<>"']/g, function(ch){
        return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]);
      });
    }
    function linkifyPrizeDescription(value){
      const escaped = escapeHtml(value || '');
      return escaped.replace(/(https?:\/\/[^\s<]+)/gi, function(rawUrl){
        let url = rawUrl;
        let tail = '';
        while(/[),.;!?]$/.test(url)){
          tail = url.slice(-1) + tail;
          url = url.slice(0, -1);
        }
        return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + url + '</a>' + tail;
      });
    }
    function updateLuckyDrawSummary(){
      try{
        const rows = (luckyDrawEntriesCache || []).filter(entry => entry && !entry.deleted);
        const totalCount = luckyDrawEntriesTotalCache || Number((els.total && els.total.textContent) || 0) || rows.length || 0;
        if (els.drawSummaryParticipants) els.drawSummaryParticipants.textContent = String(totalCount);
        if (els.drawSummaryShares) els.drawSummaryShares.textContent = String(referralClickCountCache || 0);
        if (els.drawSummaryPrize) els.drawSummaryPrize.textContent = (els.prizeTitle && els.prizeTitle.textContent) || tr('prizeDefaultTitle');
        if (els.drawSummaryStatus) els.drawSummaryStatus.textContent = luckyDrawWinnerSelected ? tr('summaryClosed') : tr('summaryOpen');
        if (els.drawSummaryLatest) {
          const latest = rows.slice().sort((a,b) => Number(b.joinedAtMs || 0) - Number(a.joinedAtMs || 0) || new Date(b.joinedAt || 0).getTime() - new Date(a.joinedAt || 0).getTime()).slice(0,5);
          if (!latest.length) {
            els.drawSummaryLatest.textContent = tr('summaryNoParticipants');
          } else {
            els.drawSummaryLatest.innerHTML = latest.map((entry, i) => {
              const name = escapeHtml(entry.name || entry.usernameKey || 'User');
              const joined = entry.joinedAt ? new Date(entry.joinedAt).toLocaleString('en-MY', {timeZone:'Asia/Kuala_Lumpur', day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}) : '-';
              const participantNo = Math.max(1, totalCount - i);
              return '<div><b>' + participantNo + '. ' + name + '</b><small>' + escapeHtml(joined) + '</small></div>';
            }).join('');
          }
        }
      }catch(e){}
    }

    function splitPrizeImageUrls(value){
      if (Array.isArray(value)) return value.map(v => String(v || '').trim()).filter(Boolean);
      return String(value || '').split(/[\n,]+/).map(v => v.trim()).filter(Boolean);
    }

    function getPrizeImages(prize){
      const images = [];
      splitPrizeImageUrls(prize.imageUrls || prize.images).forEach(v => images.push(v));
      splitPrizeImageUrls(prize.imageUrl || prize.image).forEach(v => images.push(v));
      const clean = [];
      const seen = new Set();
      images.forEach(v => {
        const key = String(v || '').trim();
        if (!key || seen.has(key)) return;
        seen.add(key);
        clean.push(normalizeImagePath(key));
      });
      return clean.length ? clean : ['/lucky-draw/prize-placeholder.svg'];
    }

    function updatePrizeCarousel(){
      if (!prizeCarouselImages.length) prizeCarouselImages = ['/lucky-draw/prize-placeholder.svg'];
      if (prizeCarouselIndex < 0) prizeCarouselIndex = prizeCarouselImages.length - 1;
      if (prizeCarouselIndex >= prizeCarouselImages.length) prizeCarouselIndex = 0;
      if (els.prizeImage) {
        els.prizeImage.onerror = function(){
          try {
            const failed = prizeCarouselImages.splice(prizeCarouselIndex, 1)[0];
            console.warn('AZOBSS Lucky Draw prize image failed, skipped:', failed);
            if (!prizeCarouselImages.length) {
              prizeCarouselImages = ['/lucky-draw/prize-placeholder.svg'];
              prizeCarouselIndex = 0;
            }
            if (prizeCarouselIndex >= prizeCarouselImages.length) prizeCarouselIndex = 0;
            updatePrizeCarousel();
          } catch(e) {
            this.onerror = null;
            this.src = '/lucky-draw/prize-placeholder.svg';
          }
        };
        els.prizeImage.src = prizeCarouselImages[prizeCarouselIndex];
      }
      if (els.prizeImageCounter) els.prizeImageCounter.textContent = (prizeCarouselIndex + 1) + ' / ' + prizeCarouselImages.length;
      if (els.prizeCarouselShell) els.prizeCarouselShell.classList.toggle('single', prizeCarouselImages.length <= 1);
    }

    async function validateAndSetPrizeImages(images){
      const seq = ++prizeImageValidationSeq;
      const list = (images || []).map(v => String(v || '').trim()).filter(v => v && !v.includes('prize-placeholder'));
      if (!list.length) return;
      const valid = [];
      for (const url of list) {
        if (seq !== prizeImageValidationSeq) return;
        try {
          if (await prizeImageExists(url)) valid.push(url);
        } catch(e) {}
      }
      if (seq !== prizeImageValidationSeq) return;
      if (valid.length) {
        prizeCarouselImages = valid;
        if (prizeCarouselIndex >= valid.length) prizeCarouselIndex = 0;
        if (prizeCarouselIndex < 0) prizeCarouselIndex = 0;
        updatePrizeCarousel();
      } else {
        prizeCarouselImages = ['/lucky-draw/prize-placeholder.svg'];
        prizeCarouselIndex = 0;
        updatePrizeCarousel();
      }
    }

    function movePrizeImage(step){
      prizeCarouselIndex += step;
      updatePrizeCarousel();
    }

    function renderPrize(prize){
      const images = getPrizeImages(prize || {});
      const title = prize.title || tr('prizeDefaultTitle');
      const desc = prize.description || tr('prizeDefaultDesc');
      prizeImageValidationSeq += 1;
      prizeCarouselImages = images;
      prizeCarouselIndex = 0;
      updatePrizeCarousel();
      validateAndSetPrizeImages(images);
      els.prizeTitle.textContent = title;
      els.prizeDescription.innerHTML = linkifyPrizeDescription(desc);
      setTimeout(updatePrizeDescScrollHint, 60);
      updateLuckyDrawSummary();
      els.prizeTitleInput.value = prize.title || '';
      els.prizeDescriptionInput.value = prize.description || '';
      const urlList = splitPrizeImageUrls(prize.imageUrls || prize.images || []);
      const singleUrl = prize.imageUrl || prize.image || '';
      if (!urlList.length && singleUrl) urlList.push(singleUrl);
      if (els.prizeImageUrlInput) els.prizeImageUrlInput.value = urlList.join('\n');
      els.prizeJsonInput.value = JSON.stringify({
        monthKey: prize.monthKey || monthKey(),
        title,
        description: desc,
        imageUrl: urlList[0] || '',
        imageUrls: urlList,
        imageStorage: prize.imageStorage || ''
      }, null, 2);
    }

    async function loadEntries(){
      try {
        const res = await apiFetch('/api/lucky-draw/entries?monthKey=' + encodeURIComponent(monthKey()) + '&limit=20&page=1', {cache:'no-store'});
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Entries error');
        const rows = Array.isArray(data.entries) ? data.entries : [];
        luckyDrawEntriesCache = rows.filter((entry) => !entry.deleted);
        luckyDrawEntriesTotalCache = Number(data.total || luckyDrawEntriesCache.length || 0);
        luckyDrawEntriesOffsetCache = Number(data.offset || 0);
        els.total.textContent = String(luckyDrawEntriesTotalCache);
        renderParticipants(luckyDrawEntriesCache, luckyDrawEntriesTotalCache, luckyDrawEntriesOffsetCache);
        updateLuckyDrawSummary();
        updateInvitePanel();
      } catch(e) {
        els.participants.innerHTML = '<div class="empty">' + escapeHtml(tr('entriesBackendFail')) + '</div>';
      }
    }

    function renderParticipants(rows, totalCount, offset){
      if (!rows.length) {
        els.participants.innerHTML = '<div class="empty">' + escapeHtml(tr('entriesEmpty')) + '</div>';
        return;
      }
      const total = Number(totalCount || luckyDrawEntriesTotalCache || rows.length || 0);
      const startOffset = Number(offset || luckyDrawEntriesOffsetCache || 0);
      const orderedRows = rows.slice(0, 20).sort((a,b) => Number(b.joinedAtMs || 0) - Number(a.joinedAtMs || 0) || new Date(b.joinedAt || 0).getTime() - new Date(a.joinedAt || 0).getTime());
      els.participants.innerHTML = orderedRows.map((entry, i) => {
        const name = escapeHtml(entry.name || entry.usernameKey || 'User');
        const joined = entry.joinedAt ? new Date(entry.joinedAt).toLocaleString('en-MY') : '-';
        const participantNo = Math.max(1, total - startOffset - i);
        return '<div class="participant-card"><div><strong>' + participantNo + '. ' + name + '</strong><span>' + escapeHtml(joined) + '</span></div></div>';
      }).join('');
    }

    async function loadWinner(){
      try {
        const res = await apiFetch('/api/lucky-draw/winner?monthKey=' + encodeURIComponent(monthKey()), {cache:'no-store'});
        const data = await res.json();
        const winner = data && data.winner;
        luckyDrawCurrentWinnerCache = winner || null;
        luckyDrawWinnerSelected = !!winner;
        const name = winner ? (winner.name || winner.usernameKey || 'Winner') : tr('winnerNone');
        els.winner.textContent = name;
        if (!luckyDrawRollingActive) {
          if (winner) finishWinnerRolling(name, {test:false});
          else els.winnerText.textContent = tr('winnerPending');
        }
        updateLuckyDrawSummary();
        updateInvitePanel();
      } catch(e) {}
    }

    function formatWinnerDate(value){
      if (!value) return '-';
      const d = new Date(value);
      if (isNaN(d.getTime())) return String(value);
      try {
        return d.toLocaleString('en-MY', {
          timeZone:'Asia/Kuala_Lumpur',
          day:'2-digit',
          month:'2-digit',
          year:'numeric',
          hour:'2-digit',
          minute:'2-digit',
          hour12:true
        });
      } catch(e) {
        return d.toLocaleString();
      }
    }

    function renderWinnerHistory(winners){
      if (!els.winnerHistory) return;
      const rows = Array.isArray(winners) ? winners.filter(Boolean) : [];
      if (!rows.length) {
        els.winnerHistory.innerHTML = '<div class="empty">' + escapeHtml(tr('winnerHistoryEmpty')) + '</div>';
        return;
      }
      els.winnerHistory.innerHTML = rows.map((winner) => {
        const name = winner.name || winner.usernameKey || 'Winner';
        const username = winner.usernameKey ? '@' + winner.usernameKey : '';
        const total = Number(winner.participantTotal || 0);
        return '<div class="participant-item">' +
          '<strong>' + escapeHtml(winner.monthName || winner.monthKey || '-') + '</strong>' +
          '<span>' + escapeHtml(name) + (username ? ' <small>' + escapeHtml(username) + '</small>' : '') + '</span>' +
          '<small>' + escapeHtml(tr('winnerHistoryTotal')) + ': ' + escapeHtml(total) + ' · ' + escapeHtml(tr('winnerHistorySelectedAt')) + ': ' + escapeHtml(formatWinnerDate(winner.selectedAt)) + '</small>' +
        '</div>';
      }).join('');
    }

    async function loadWinnerHistory(){
      if (!els.winnerHistory) return;
      try {
        const res = await apiFetch('/api/lucky-draw/winner-history?limit=24', {cache:'no-store'});
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error || 'Winner history gagal');
        renderWinnerHistory(data.winners || []);
      } catch(e) {
        els.winnerHistory.innerHTML = '<div class="empty">' + escapeHtml(tr('winnerHistoryLoadFail')) + '</div>';
      }
    }



    function maskAuditValue(value, left){
      const text = String(value || '').trim();
      if (!text) return '-';
      const keep = Number(left || 6);
      if (text.length <= keep) return text;
      return text.slice(0, keep) + '…';
    }

    function setReferralAuditStatus(message, error){
      if (!els.referralAuditStatus) return;
      els.referralAuditStatus.textContent = message || '';
      els.referralAuditStatus.classList.toggle('error', !!error);
    }

    function renderReferralAudit(payload){
      if (!els.referralAuditList) return;
      const summary = (payload && payload.summary) || {};
      const rows = Array.isArray(payload && payload.clicks) ? payload.clicks : [];
      luckyDrawReferralAuditCache = rows;
      if (els.referralAuditValidTotal) els.referralAuditValidTotal.textContent = String(summary.validClicks || 0);
      if (els.referralAuditSharerTotal) els.referralAuditSharerTotal.textContent = String(summary.uniqueSharers || 0);
      if (els.referralAuditSelfTotal) els.referralAuditSelfTotal.textContent = String(summary.selfClicks || 0);
      if (els.referralAuditDuplicateTotal) els.referralAuditDuplicateTotal.textContent = String(summary.duplicateClicks || 0);
      if (!rows.length) {
        els.referralAuditList.innerHTML = '<div class="empty">' + escapeHtml(tr('referralAuditEmpty')) + '</div>';
        return;
      }
      els.referralAuditList.innerHTML = rows.slice(0, 40).map((row, index) => {
        const valid = !!row.valid;
        const duplicate = !!row.duplicate;
        const label = valid ? tr('referralAuditValid') : (duplicate ? tr('referralAuditDuplicate') : tr('referralAuditIgnored'));
        const time = row.clickedAt ? formatWinnerDate(row.clickedAt) : '-';
        const visitor = row.visitorUsernameKey ? '@' + row.visitorUsernameKey : 'Guest / visitor';
        return '<div class="referral-audit-card">' +
          '<strong>' + (index + 1) + '. @' + escapeHtml(row.ref || '-') + ' — ' + escapeHtml(label) + '</strong>' +
          '<span>Visitor: ' + escapeHtml(visitor) + ' · Time: ' + escapeHtml(time) + '</span>' +
          '<small>Device: ' + escapeHtml(maskAuditValue(row.deviceFingerprint, 12)) + ' · IP: ' + escapeHtml(maskAuditValue(row.ipAddress, 8)) + ' · Reason: ' + escapeHtml(row.reason || (valid ? 'VALID_CLICK' : '-')) + '</small>' +
        '</div>';
      }).join('');
    }

    async function loadReferralAudit(){
      if (!els.referralAuditList) return;
      if (!requireLuckyDrawAdmin()) return;
      setReferralAuditStatus('Loading referral audit...');
      try {
        const res = await apiFetch('/api/lucky-draw/referral-audit?monthKey=' + encodeURIComponent(monthKey()) + '&limit=80', {cache:'no-store'});
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error || 'Referral audit gagal');
        renderReferralAudit(data);
        setReferralAuditStatus('Referral audit updated.');
      } catch(e) {
        if (els.referralAuditList) els.referralAuditList.innerHTML = '<div class="empty">' + escapeHtml(tr('referralAuditFail')) + '</div>';
        setReferralAuditStatus(e.message || tr('referralAuditFail'), true);
      }
    }

    function exportReferralAudit(){
      if (!requireLuckyDrawAdmin()) return;
      const rows = luckyDrawReferralAuditCache || [];
      if (!rows.length) {
        setReferralAuditStatus(tr('referralAuditExportEmpty'), true);
        return;
      }
      const headers = ['No','Month','Share Username','Visitor Username','Valid','Duplicate','Reason','Clicked At','Device','IP'];
      const csvRows = [headers].concat(rows.map((row, index) => [
        index + 1,
        row.monthKey || monthKey(),
        row.ref || '',
        row.visitorUsernameKey || '',
        row.valid ? 'YES' : 'NO',
        row.duplicate ? 'YES' : 'NO',
        row.reason || '',
        row.clickedAt || '',
        row.deviceFingerprint || '',
        row.ipAddress || ''
      ]));
      const csv = csvRows.map((row) => row.map((value) => '"' + String(value).replace(/"/g, '""') + '"').join(',')).join('\n');
      const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'AZOBSS-Lucky-Draw-Referral-Audit-' + monthKey() + '.csv';
      a.click();
      URL.revokeObjectURL(a.href);
      setReferralAuditStatus(tr('referralAuditExportDone'));
    }

    function setAbuseAuditStatus(message, error){
      if (!els.abuseAuditStatus) return;
      els.abuseAuditStatus.textContent = message || '';
      els.abuseAuditStatus.classList.toggle('error', !!error);
    }

    function renderAbuseAudit(payload){
      if (!els.abuseAuditList) return;
      const summary = (payload && payload.summary) || {};
      const byType = summary.byType || {};
      const rows = Array.isArray(payload && payload.logs) ? payload.logs : [];
      luckyDrawAbuseAuditCache = rows;
      const duplicateJoin = Object.keys(byType).filter(k => k.indexOf('DUPLICATE_JOIN') === 0).reduce((n,k) => n + Number(byType[k] || 0), 0);
      if (els.abuseAuditTotal) els.abuseAuditTotal.textContent = String(summary.total || 0);
      if (els.abuseAuditSelfTotal) els.abuseAuditSelfTotal.textContent = String(byType.SELF_REFERRAL_CLICK || 0);
      if (els.abuseAuditDuplicateClickTotal) els.abuseAuditDuplicateClickTotal.textContent = String(byType.DUPLICATE_REFERRAL_CLICK || 0);
      if (els.abuseAuditDuplicateJoinTotal) els.abuseAuditDuplicateJoinTotal.textContent = String(duplicateJoin);
      if (!rows.length) {
        els.abuseAuditList.innerHTML = '<div class="empty">' + escapeHtml(tr('abuseAuditEmpty')) + '</div>';
        return;
      }
      els.abuseAuditList.innerHTML = rows.slice(0, 40).map((row, index) => {
        const time = row.createdAt ? formatWinnerDate(row.createdAt) : '-';
        const target = row.ref ? '@' + row.ref : (row.usernameKey ? '@' + row.usernameKey : '-');
        const visitor = row.visitorUsernameKey ? '@' + row.visitorUsernameKey : 'Guest / visitor';
        return '<div class="abuse-audit-card">' +
          '<strong>' + (index + 1) + '. ' + escapeHtml(row.type || '-') + ' — ' + escapeHtml(target) + '</strong>' +
          '<span>Visitor/User: ' + escapeHtml(visitor) + ' · Time: ' + escapeHtml(time) + '</span>' +
          '<small>Device: ' + escapeHtml(maskAuditValue(row.deviceFingerprint, 12)) + ' · IP: ' + escapeHtml(maskAuditValue(row.ipAddress, 8)) + ' · Reason: ' + escapeHtml(row.reason || '-') + '</small>' +
        '</div>';
      }).join('');
    }

    async function loadAbuseAudit(){
      if (!els.abuseAuditList) return;
      if (!requireLuckyDrawAdmin()) return;
      setAbuseAuditStatus('Loading anti-abuse log...');
      try {
        const res = await apiFetch('/api/lucky-draw/abuse-audit?monthKey=' + encodeURIComponent(monthKey()) + '&limit=120', {cache:'no-store'});
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error || 'Anti-abuse log gagal');
        renderAbuseAudit(data);
        setAbuseAuditStatus('Anti-abuse log updated.');
      } catch(e) {
        if (els.abuseAuditList) els.abuseAuditList.innerHTML = '<div class="empty">' + escapeHtml(tr('abuseAuditFail')) + '</div>';
        setAbuseAuditStatus(e.message || tr('abuseAuditFail'), true);
      }
    }

    function exportAbuseAudit(){
      if (!requireLuckyDrawAdmin()) return;
      const rows = luckyDrawAbuseAuditCache || [];
      if (!rows.length) {
        setAbuseAuditStatus(tr('abuseAuditExportEmpty'), true);
        return;
      }
      const headers = ['No','Month','Type','Share Username','Username','Visitor Username','Reason','Created At','Device','IP'];
      const csvRows = [headers].concat(rows.map((row, index) => [
        index + 1,
        row.monthKey || monthKey(),
        row.type || '',
        row.ref || '',
        row.usernameKey || '',
        row.visitorUsernameKey || '',
        row.reason || '',
        row.createdAt || '',
        row.deviceFingerprint || '',
        row.ipAddress || ''
      ]));
      const csv = csvRows.map((row) => row.map((value) => '"' + String(value).replace(/"/g, '""') + '"').join(',')).join('\n');
      const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'AZOBSS-Lucky-Draw-Anti-Abuse-Log-' + monthKey() + '.csv';
      a.click();
      URL.revokeObjectURL(a.href);
      setAbuseAuditStatus(tr('abuseAuditExportDone'));
    }

    async function copyInvite(){
      const user = readUser();
      if (!user || !(user.usernameKey || user.name)) {
        setStatus(tr('copyLogin'), true);
        return;
      }
      location.href = '/Software-Tools/';
    }

    function shareInvite(){
      const user = readUser();
      if (!user || !(user.usernameKey || user.name)) {
        setStatus(tr('shareLogin'), true);
        return;
      }
      location.href = '/CAD-Tools-&-Resources/';
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
      await loadWinner();
      if (luckyDrawWinnerSelected) {
        updateInvitePanel();
        setStatus(tr('drawClosed'), true);
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
      if (luckyDrawJoinBlockCache) {
        updateInvitePanel();
        setStatus(getJoinBlockMessage(luckyDrawJoinBlockCache), true);
        return;
      }
      if (!(localStorage.getItem(getShareKey(user)) === '1' || referralClickCountCache > 0)) {
        setStatus('Belum ada klik valid dari link produk berbayar. Share mana-mana Software/CAD berbayar dahulu.', true);
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
        productShareConfirmed: true,
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
            const code = String(data && data.code || '').toUpperCase();
            if (code === 'DUPLICATE_DEVICE' || code === 'DUPLICATE_IP') {
              luckyDrawJoinBlockCache = { code, reason: data.error || '' };
              updateInvitePanel();
              setStatus(getJoinBlockMessage(luckyDrawJoinBlockCache), true);
              return;
            }
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
          setStatus(e.message || tr('joinBlockedGeneric'), true);
          return;
        }
        if (els.joinButton) els.joinButton.disabled = false;
        setStatus(e.message || 'Join gagal.', true);
      }
    }

    async function syncPrizeFromFolder(){
      if (!isAdmin(readUser())) {
        setAdminStatus('Admin sahaja boleh sync folder hadiah.', true);
        return;
      }
      const baseUrl = location.origin;
      setAdminStatus('Sedang scan /lucky-draw/giveaway-prize.json dan hadiah1.jpg, hadiah2.jpg...');
      try {
        const res = await apiFetch('/api/lucky-draw/prize/sync-folder', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({
            monthKey: monthKey(),
            baseUrl,
            prizeJsonPath: '/lucky-draw/giveaway-prize.json',
            imagePrefix: '/lucky-draw/hadiah',
            maxImages: 20,
            updatedBy: normalizeUsername(readUser().usernameKey || readUser().name)
          })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error || 'Sync folder gagal');
        renderPrize(data.prize || {});
        if (els.prizeTitleInput) els.prizeTitleInput.value = (data.prize && data.prize.title) || '';
        if (els.prizeDescriptionInput) els.prizeDescriptionInput.value = (data.prize && data.prize.description) || '';
        if (els.prizeImageUrlInput) els.prizeImageUrlInput.value = splitPrizeImageUrls((data.prize && (data.prize.imageUrls || data.prize.images || data.prize.imageUrl || data.prize.image)) || '').join('\n');
        if (els.prizeJsonInput) els.prizeJsonInput.value = JSON.stringify(data.prize || {}, null, 2);
        const count = Array.isArray(data.syncedImages) ? data.syncedImages.length : 0;
        setAdminStatus('Sync folder berjaya. ' + count + ' gambar disimpan ke storage/backend.');
      } catch(e) {
        setAdminStatus((e && e.message) ? e.message : 'Sync folder gagal.', true);
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
      if (els.prizeImageUrlInput && els.prizeImageUrlInput.value.trim()) {
        const urls = splitPrizeImageUrls(els.prizeImageUrlInput.value.trim());
        if (urls.length) {
          form.append('imageUrl', urls[0]);
          form.append('imageUrls', JSON.stringify(urls));
        }
      }
      form.append('updatedBy', normalizeUsername(readUser().usernameKey || readUser().name));
      try {
        const parsed = JSON.parse(els.prizeJsonInput.value || '{}');
        if (parsed.imageUrls || parsed.images) form.append('imageUrls', JSON.stringify(splitPrizeImageUrls(parsed.imageUrls || parsed.images)));
        if (parsed.imageUrl || parsed.image) form.append('imageUrl', parsed.imageUrl || parsed.image);
      } catch(e) {}
      if (els.prizeImageFile.files && els.prizeImageFile.files.length) {
        Array.from(els.prizeImageFile.files).slice(0, 10).forEach(file => form.append('images', file));
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

    function openPrizeJsonFile(){
      if (!isAdmin(readUser())) {
        setAdminStatus('Admin sahaja boleh load JSON.', true);
        return;
      }
      if (!els.prizeJsonFileInput) {
        setAdminStatus('Input JSON file tidak ditemui.', true);
        return;
      }
      els.prizeJsonFileInput.value = '';
      els.prizeJsonFileInput.click();
    }

    async function handlePrizeJsonFile(event){
      const file = event && event.target && event.target.files ? event.target.files[0] : null;
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          throw new Error('Format JSON mesti object.');
        }
        els.prizeJsonInput.value = JSON.stringify(data, null, 2);
        applyJson();
        setAdminStatus('JSON berjaya dimuat dari file. Semak preview, kemudian tekan Save Prize untuk publish.');
      } catch(e) {
        setAdminStatus('Load JSON gagal: ' + (e.message || e), true);
      }
    }

    function applyJson(){
      try {
        const data = JSON.parse(els.prizeJsonInput.value || '{}');
        if (data.title !== undefined) els.prizeTitleInput.value = data.title;
        if (data.description !== undefined) els.prizeDescriptionInput.value = data.description;
        if (els.prizeImageUrlInput && (data.imageUrls !== undefined || data.images !== undefined || data.imageUrl !== undefined || data.image !== undefined)) {
          const urls = splitPrizeImageUrls(data.imageUrls || data.images || []);
          if (!urls.length && (data.imageUrl || data.image)) urls.push(data.imageUrl || data.image);
          els.prizeImageUrlInput.value = urls.join('\n');
        }
        renderPrize({
          title: els.prizeTitleInput.value,
          description: els.prizeDescriptionInput.value,
          imageUrls: splitPrizeImageUrls((els.prizeImageUrlInput && els.prizeImageUrlInput.value) || data.imageUrls || data.images || data.imageUrl || data.image || ''),
          imageUrl: splitPrizeImageUrls((els.prizeImageUrlInput && els.prizeImageUrlInput.value) || data.imageUrls || data.images || data.imageUrl || data.image || '')[0] || ''
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
        imageUrls: (() => {
          if (els.prizeImageUrlInput && els.prizeImageUrlInput.value.trim()) return splitPrizeImageUrls(els.prizeImageUrlInput.value.trim());
          try { const data = JSON.parse(els.prizeJsonInput.value || '{}'); return splitPrizeImageUrls(data.imageUrls || data.images || data.imageUrl || data.image || ''); }
          catch(e) { return []; }
        })(),
        imageUrl: (() => {
          const urls = (els.prizeImageUrlInput && els.prizeImageUrlInput.value.trim()) ? splitPrizeImageUrls(els.prizeImageUrlInput.value.trim()) : [];
          if (urls[0]) return urls[0];
          try { const data = JSON.parse(els.prizeJsonInput.value || '{}'); return splitPrizeImageUrls(data.imageUrls || data.images || data.imageUrl || data.image || '')[0] || ''; }
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

    function setWinnerRollBox(title, name, note, mode){
      if (!els.winnerText) return;
      const safeTitle = escapeHtml(title || '');
      const safeName = escapeHtml(name || '-');
      const safeNote = escapeHtml(note || '');
      const extra = mode ? ' ' + String(mode).replace(/[^a-z0-9_-]/gi, '') : '';
      els.winnerText.innerHTML = '<span class="draw-winner-rollbox' + extra + '">' +
        '<span class="roll-label">' + safeTitle + '</span>' +
        '<span class="roll-name">' + safeName + '</span>' +
        (safeNote ? '<span class="roll-note">' + safeNote + '</span>' : '') +
      '</span>';
    }

    function getSpinNamePool(finalName){
      const rows = activeLuckyRows();
      const names = rows.map((entry) => entry.name || entry.usernameKey || '').filter(Boolean);
      if (finalName && !names.includes(finalName)) names.push(finalName);
      return names.length ? names : [finalName || 'User'];
    }

    function startWinnerRolling(options){
      const opt = options || {};
      const names = getSpinNamePool(opt.finalName);
      const title = opt.test ? tr('testRollingTitle') : tr('rollingTitle');
      const note = opt.test ? tr('testRollingNote') : tr('rollingNote');
      let index = 0;
      clearWinnerRolling(false);
      luckyDrawRollingActive = true;
      setWinnerRollBox(title, names[0], note, opt.test ? 'is-test' : '');
      luckyDrawRollingTimer = setInterval(() => {
        index = (index + 1) % names.length;
        setWinnerRollBox(title, names[index], note, opt.test ? 'is-test' : '');
      }, opt.speed || 90);
    }

    function clearWinnerRolling(resetActive){
      if (luckyDrawRollingTimer) {
        clearInterval(luckyDrawRollingTimer);
        luckyDrawRollingTimer = null;
      }
      if (resetActive !== false) luckyDrawRollingActive = false;
    }

    function finishWinnerRolling(finalName, options){
      const opt = options || {};
      const title = opt.test ? tr('testWinnerPrefix') : tr('winnerFinalTitle');
      const note = opt.test ? tr('testRollingNote') : tr('winnerFinalNote');
      clearWinnerRolling(true);
      setWinnerRollBox(title, finalName || 'User', note, opt.test ? 'is-test' : 'is-final');
    }

    async function runLuckyDraw(){
      if (!requireLuckyDrawAdmin()) return;
      if (!confirm(tr('runDrawConfirm'))) return;
      const rows = activeLuckyRows();
      if (rows.length) startWinnerRolling({test:false});
      setAdminStatus('Running lucky draw...');
      const startedAt = Date.now();
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
        const remaining = Math.max(0, 1800 - (Date.now() - startedAt));
        await new Promise(resolve => setTimeout(resolve, remaining));
        els.winner.textContent = name;
        finishWinnerRolling(name, {test:false});
        luckyDrawWinnerSelected = true;
        updateInvitePanel();
        if (!data.alreadySelected) {
          try {
            if (typeof window.azobssPublishLuckyDrawWinnerNotification === 'function') {
              await window.azobssPublishLuckyDrawWinnerNotification(winner);
            }
          } catch(notificationError) {
            console.warn('AZOBSS Lucky Draw winner notification skipped:', notificationError);
          }
        }
        await loadWinnerHistory();
        setAdminStatus(data.alreadySelected ? 'Pemenang bulan ini sudah wujud. Join bulan ini kekal ditutup. Reset Winner dahulu jika mahu buka semula.' : 'Pemenang berjaya dipilih, notifikasi dipublish, dan join bulan ini sudah ditutup.');
      } catch(e) {
        clearWinnerRolling(true);
        if (!luckyDrawCurrentWinnerCache) els.winnerText.textContent = tr('winnerPending');
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
      startWinnerRolling({test:true, speed:80});
      setTimeout(() => {
        const finalPick = rows[Math.floor(Math.random() * rows.length)] || {};
        const finalName = finalPick.name || finalPick.usernameKey || 'User';
        finishWinnerRolling(finalName, {test:true});
        setAdminStatus('Test spin selesai. Tiada rekod winner disimpan.');
      }, 2200);
    }

    async function resetLuckyWinner(){
      if (!requireLuckyDrawAdmin()) return;
      if (!confirm('Reset winner bulan ini?')) return;
      setAdminStatus('Reset winner...');
      try {
        const res = await apiFetch('/api/lucky-draw/winner?monthKey=' + encodeURIComponent(monthKey()), {method:'DELETE'});
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Reset winner gagal');
        clearWinnerRolling(true);
        els.winner.textContent = tr('winnerNone');
        if (els.winnerText) els.winnerText.textContent = tr('winnerPending');
        els.winnerText.textContent = tr('winnerPending');
        luckyDrawWinnerSelected = false;
        luckyDrawCurrentWinnerCache = null;
        updateInvitePanel();
        await loadWinnerHistory();
        setAdminStatus('Winner bulan ini sudah direset. Join bulan ini dibuka semula jika syarat referral cukup.');
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
        luckyDrawEntriesTotalCache = 0;
        luckyDrawEntriesOffsetCache = 0;
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
        luckyDrawEntriesTotalCache = 0;
        luckyDrawEntriesOffsetCache = 0;
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
        luckyDrawWinnerSelected = false;
        updateInvitePanel();
      } catch(e) {}
    }


    function exportDateMY(value){
      if (!value) return '';
      const d = new Date(value);
      if (isNaN(d.getTime())) return String(value);
      try {
        return d.toLocaleString('en-MY', {
          timeZone:'Asia/Kuala_Lumpur',
          day:'2-digit',
          month:'2-digit',
          year:'numeric',
          hour:'2-digit',
          minute:'2-digit',
          second:'2-digit',
          hour12:true
        });
      } catch(e) { return d.toLocaleString(); }
    }

    function shortHash(value, keep){
      const text = String(value || '').trim();
      if (!text) return '';
      const size = keep || 12;
      return text.length > size ? text.slice(0, size) + '...' : text;
    }

    async function exportLuckyParticipants(){
      if (!requireLuckyDrawAdmin()) return;
      setAdminStatus('Export peserta penuh dari backend...');
      try {
        const res = await apiFetch('/api/lucky-draw/entries/export?monthKey=' + encodeURIComponent(monthKey()), {cache:'no-store'});
        if (!res.ok) {
          let msg = 'Export peserta gagal.';
          try { const data = await res.json(); msg = data.error || msg; } catch(e) {}
          throw new Error(msg);
        }
        const blob = await res.blob();
        if (!blob || !blob.size) throw new Error(tr('exportEmpty'));
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'AZOBSS-Lucky-Draw-Participants-' + monthKey() + '.csv';
        a.click();
        URL.revokeObjectURL(a.href);
        setAdminStatus(tr('exportDone'));
      } catch(e) {
        setAdminStatus(e.message || 'Export peserta gagal.', true);
      }
    }

    if (els.langToggle) els.langToggle.addEventListener('click', function(){
      luckyDrawLang = luckyDrawLang === 'en' ? 'ms' : 'en';
      localStorage.setItem('azobssLuckyDrawLang', luckyDrawLang);
      applyLuckyDrawLanguage();
      updateInvitePanel();
      tickCountdown();
      loadWinner();
      loadEntries();
      loadWinnerHistory();
    });
    els.copyButton.addEventListener('click', copyInvite);
    els.shareButton.addEventListener('click', shareInvite);
    if (els.confirmShareButton) els.confirmShareButton.addEventListener('click', confirmShareDone);
    els.joinButton.addEventListener('click', joinLuckyDraw);
    document.getElementById('refreshEntriesButton').addEventListener('click', loadEntries);
    if (els.refreshWinnerHistoryButton) els.refreshWinnerHistoryButton.addEventListener('click', loadWinnerHistory);
    if (els.refreshReferralAuditButton) els.refreshReferralAuditButton.addEventListener('click', loadReferralAudit);
    if (els.exportReferralAuditButton) els.exportReferralAuditButton.addEventListener('click', exportReferralAudit);
    if (els.refreshAbuseAuditButton) els.refreshAbuseAuditButton.addEventListener('click', loadAbuseAudit);
    if (els.exportAbuseAuditButton) els.exportAbuseAuditButton.addEventListener('click', exportAbuseAudit);
    document.getElementById('refreshPrizeButton').addEventListener('click', loadPrize);
    if (els.prizePrevButton) els.prizePrevButton.addEventListener('click', function(){ movePrizeImage(-1); });
    if (els.prizeNextButton) els.prizeNextButton.addEventListener('click', function(){ movePrizeImage(1); });
    const syncPrizeButton = document.getElementById('syncPrizeButton'); if (syncPrizeButton) syncPrizeButton.addEventListener('click', async () => { setAdminStatus('Sync hadiah dari backend...'); await loadPrize(); setAdminStatus('Hadiah terkini sudah sync dari backend.'); });
    const syncFolderPrizeButton = document.getElementById('syncFolderPrizeButton'); if (syncFolderPrizeButton) syncFolderPrizeButton.addEventListener('click', syncPrizeFromFolder);
    document.getElementById('savePrizeButton').addEventListener('click', savePrize);
    document.getElementById('loadJsonButton').addEventListener('click', openPrizeJsonFile);
    if (els.prizeJsonFileInput) els.prizeJsonFileInput.addEventListener('change', handlePrizeJsonFile);
    document.getElementById('applyJsonButton').addEventListener('click', applyJson);
    document.getElementById('downloadJsonButton').addEventListener('click', downloadJson);
    document.getElementById('runDrawButton').addEventListener('click', runLuckyDraw);
    document.getElementById('testSpinButton').addEventListener('click', testLuckySpin);
    document.getElementById('resetWinnerButton').addEventListener('click', resetLuckyWinner);
    document.getElementById('resetParticipantsButton').addEventListener('click', resetLuckyParticipants);
    document.getElementById('resetJoinMonthButton').addEventListener('click', resetJoinThisMonth);
    document.getElementById('exportParticipantsButton').addEventListener('click', exportLuckyParticipants);

    window.addEventListener('storage', showUser);
    window.addEventListener('resize', updatePrizeDescScrollHint);

    applyLuckyDrawLanguage();
    tickCountdown();
    setInterval(tickCountdown, 1000);
    showUser();
    recordReferralClickFromUrl();
    loadReferralStatus(readUser()).then(updateInvitePanel);
    loadPrize();
    setTimeout(updatePrizeDescScrollHint, 500);
    loadEntries();
    loadWinner();
    loadWinnerHistory();
    if (isAdmin(readUser())) loadReferralAudit();
    setInterval(function(){ loadEntries(); loadReferralStatus(readUser()).then(updateInvitePanel); if (isAdmin(readUser())) loadReferralAudit(); }, 30000);
  