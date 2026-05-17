import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
    import {
      getAuth,
      createUserWithEmailAndPassword,
      signInWithEmailAndPassword,
      deleteUser,
      signOut,
      onAuthStateChanged,
      setPersistence,
      browserSessionPersistence
    } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
    import {
      getFirestore,
      collection,
      doc,
      getDoc,
      getDocs,
      onSnapshot,
      runTransaction,
      setDoc,
      serverTimestamp,
      increment,
      query,
      where
    } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

    const firebaseConfig = {
      apiKey: 'AIzaSyDuf03esBSpddXAOwuP-uOmHVRp54pZyr8',
      authDomain: 'azobss.firebaseapp.com',
      projectId: 'azobss',
      storageBucket: 'azobss.firebasestorage.app',
      messagingSenderId: '159277716405',
      appId: '1:159277716405:web:17d8924b6b6380e2b77ffc'
    };

    const firebaseReady = !firebaseConfig.apiKey.includes('PASTE_');
    const firebaseApp = firebaseReady ? initializeApp(firebaseConfig) : null;
    const auth = firebaseReady ? getAuth(firebaseApp) : null;
    const db = firebaseReady ? getFirestore(firebaseApp) : null;
    const signupGateRef = firebaseReady ? doc(db, 'settings', 'signupGate') : null;

    const ADMIN_USERNAME = 'zedan91';
    const PURCHASE_PRICE = 5;
    const BM_SBM_PURCHASE_PRICE = 3;
    const SIGNUP_GATE_DURATION_MS = 5 * 60 * 1000;
    sessionStorage.removeItem('azobssSignupOpenUntil');

    const signupForm = document.getElementById('signupForm');
    const unlockSignupButton = document.getElementById('unlockSignupButton');
    const signupGateNotice = document.getElementById('signupGateNotice');
    const showSignupButton = document.getElementById('showSignupButton');
    const signupFields = document.getElementById('signupFields');
    const signupName = document.getElementById('signupName');
    const signupPhone = document.getElementById('signupPhone');
    const signupCountrySearch = document.getElementById('signupCountrySearch');
    const signupCountryMenu = document.getElementById('signupCountryMenu');
    const signupCountryButton = document.getElementById('signupCountryButton');
    const signupPhonePrefix = document.getElementById('signupPhonePrefix');
    const signupEmail = document.getElementById('signupEmail');
    const signupPassword = document.getElementById('signupPassword');
    const signupError = document.getElementById('signupError');
    const loginForm = document.getElementById('loginForm');
    const loginName = document.getElementById('loginName');
    const loginPassword = document.getElementById('loginPassword');
    const loginError = document.getElementById('loginError');
    const loginInfo = document.getElementById('loginInfo');
    const loginToast = document.getElementById('loginToast');
    const requestCard = document.getElementById('requestCard');
    const requestSection = document.getElementById('request');
    const heroRequestButton = document.getElementById('heroRequestButton');
    const userMenu = document.getElementById('userMenu');
    const userAvatar = document.getElementById('userAvatar');
    const signedInName = document.getElementById('signedInName');
    const logoutButton = document.getElementById('logoutButton');
    const userUpgradeButton = document.getElementById('userUpgradeButton');
    const siteAuthActions = document.getElementById('siteAuthActions');
    const siteSignInButton = document.getElementById('siteSignInButton');
    const siteSignUpButton = document.getElementById('siteSignUpButton');
    const siteAuthModal = document.getElementById('siteAuthModal');
    const siteAuthTitle = document.getElementById('siteAuthTitle');
    const siteAuthClose = document.getElementById('siteAuthClose');
    const siteSignInForm = document.getElementById('siteSignInForm');
    const siteSignUpForm = document.getElementById('siteSignUpForm');
    const switchToSiteSignup = document.getElementById('switchToSiteSignup');
    const switchToSiteSignin = document.getElementById('switchToSiteSignin');
    const siteLoginName = document.getElementById('siteLoginName');
    const siteLoginPassword = document.getElementById('siteLoginPassword');
    const siteLoginError = document.getElementById('siteLoginError');
    const siteSignInSubmitButton = document.getElementById('siteSignInSubmitButton');
    const siteSignupName = document.getElementById('siteSignupName');
    const siteSignupPassword = document.getElementById('siteSignupPassword');
    const siteSignupPhone = document.getElementById('siteSignupPhone');
    const siteSignupCountrySearch = document.getElementById('siteSignupCountrySearch');
    const siteSignupCountryMenu = document.getElementById('siteSignupCountryMenu');
    const siteSignupCountryButton = document.getElementById('siteSignupCountryButton');
    const siteSignupPhonePrefix = document.getElementById('siteSignupPhonePrefix');
    const siteSignupEmail = document.getElementById('siteSignupEmail');
    const siteSignupInviteCode = document.getElementById('siteSignupInviteCode');
    const siteSignupError = document.getElementById('siteSignupError');
    const memberUpgradeWrap = document.getElementById('memberUpgradeWrap');
    const memberUpgradeCode = document.getElementById('memberUpgradeCode');
    const memberUpgradeButton = document.getElementById('memberUpgradeButton');
    const memberUpgradeStatus = document.getElementById('memberUpgradeStatus');
    const paForm = document.getElementById('paForm');
    const loginSubmitButton = document.getElementById('loginSubmitButton');
    const paNumber = document.getElementById('paNumber');
    const negeri = document.getElementById('negeri');
    const paError = document.getElementById('paError');
    const paStatus = document.getElementById('paStatus');
    const paLinkPreview = document.getElementById('paLinkPreview');
    const downloadTifButton = document.getElementById('downloadTifButton');
    const downloadResultActions = document.getElementById('downloadResultActions');
    const confirmDownloadButton = document.getElementById('confirmDownloadButton');
    const failedDownloadButton = document.getElementById('failedDownloadButton');
    const signupInviteCode = document.getElementById('signupInviteCode');
    const luckyDrawInviteLink = document.getElementById('luckyDrawInviteLink');
    const copyLuckyDrawInviteButton = document.getElementById('copyLuckyDrawInviteButton');
    const shareLuckyDrawButton = document.getElementById('shareLuckyDrawButton');
    const joinLuckyDrawButton = document.getElementById('joinLuckyDrawButton');
    const luckyDrawStatus = document.getElementById('luckyDrawStatus');
    const luckyDrawInviteCode = document.getElementById('luckyDrawInviteCode');
    const luckyDrawShareStatus = document.getElementById('luckyDrawShareStatus');
    const luckyDrawJoinStatus = document.getElementById('luckyDrawJoinStatus');
    const adminPurchasePanel = document.getElementById('adminPurchasePanel');
    const refreshPurchaseButton = document.getElementById('refreshPurchaseButton');
    const togglePurchaseRecordsButton = document.getElementById('togglePurchaseRecordsButton');
    const purchaseRecordTools = document.getElementById('purchaseRecordTools');
    const purchaseRecordSearch = document.getElementById('purchaseRecordSearch');
    const purchaseRecordSort = document.getElementById('purchaseRecordSort');
    const purchaseAdminError = document.getElementById('purchaseAdminError');
    const purchaseSummaryList = document.getElementById('purchaseSummaryList');
    const purchaseRecordsPagination = document.getElementById('purchaseRecordsPagination');
    const purchasePanelTitle = document.getElementById('purchasePanelTitle');
    const purchasePanelNote = document.getElementById('purchasePanelNote');
    const userPaPurchasePanel = document.getElementById('userPaPurchasePanel');
    const userPaPurchaseSearch = document.getElementById('userPaPurchaseSearch');
    const userPaPurchaseSort = document.getElementById('userPaPurchaseSort');
    const userPaPurchaseList = document.getElementById('userPaPurchaseList');
    const userPaPurchasePagination = document.getElementById('userPaPurchasePagination');
    const registeredUsersPanel = document.getElementById('registeredUsersPanel');
    const refreshUsersButton = document.getElementById('refreshUsersButton');
    const registeredUserSearch = document.getElementById('registeredUserSearch');
    const registeredUserSort = document.getElementById('registeredUserSort');
    const registeredUsersError = document.getElementById('registeredUsersError');
    const registeredUsersList = document.getElementById('registeredUsersList');
    const registeredUsersPagination = document.getElementById('registeredUsersPagination');
    const registeredUsersToday = document.getElementById('registeredUsersToday');
    const registeredUsersMonth = document.getElementById('registeredUsersMonth');
    const liveUsersList = document.getElementById('liveUsersList');
    const liveUsersPagination = document.getElementById('liveUsersPagination');
    const loginHistoryList = document.getElementById('loginHistoryList');
    const loginHistoryPagination = document.getElementById('loginHistoryPagination');
    const loginHistoryToday = document.getElementById('loginHistoryToday');
    const loginHistoryMonth = document.getElementById('loginHistoryMonth');
    const guestHistoryList = document.getElementById('guestHistoryList');
    const guestHistoryPagination = document.getElementById('guestHistoryPagination');
    const guestVisitsToday = document.getElementById('guestVisitsToday');
    const guestVisitsMonth = document.getElementById('guestVisitsMonth');
    const adminOnlineSummary = document.getElementById('adminOnlineSummary');
    const onlineGuestCount = document.getElementById('onlineGuestCount');
    const onlineUserCount = document.getElementById('onlineUserCount');
    const copyAccountButton = document.getElementById('copyAccountButton');
    const qrCopyStatus = document.getElementById('qrCopyStatus');
    const receiptWhatsappButton = document.getElementById('receiptWhatsappButton');
    const BANK_ACCOUNT_NUMBER = '162405194110';
    let isLoggedIn = false;
    let signupGateOpen = false;
    let currentUser = null;
    let signupGateTimer = null;
    let pendingDownload = null;
    let allPurchaseSummaries = [];
    let purchaseRecordsPage = 1;
    let purchaseRecordsVisible = true;
    let allUserPaPurchases = [];
    let allAdminPurchaseLogs = [];
    const adminPurchaseDetailsOpen = new Set();
    const adminPurchaseDetailsPage = new Map();
    let userPaPurchasePage = 1;
    let allRegisteredUsers = [];
    let registeredUsersPage = 1;
    let allLiveUsers = [];
    let liveUsersPage = 1;
    let allLoginHistory = [];
    let loginHistoryPage = 1;
    let allGuestHistory = [];
    let guestHistoryPage = 1;
    const HISTORY_PAGE_SIZE = 3;
    const PURCHASE_RECORDS_PAGE_SIZE = 10;
    const USER_PA_PURCHASE_PAGE_SIZE = 5;
    const HISTORY_PAGINATION_MAX_BUTTONS = 10;
    let presenceHeartbeatTimer = null;
    let liveUsersUnsubscribe = null;
    let guestOnlineUnsubscribe = null;
    let visitorPresenceTimer = null;
    let visitorIpAddress = sessionStorage.getItem('azobssVisitorIpv4Address') || '';
    let visitorIpPromise = null;
    let authRestoreUnsubscribe = null;
    let authStateReady = false;

    function stopAuthRestoreListener() {
      if (authRestoreUnsubscribe) {
        authRestoreUnsubscribe();
        authRestoreUnsubscribe = null;
      }
    }

    async function ensureAuthSessionPersistence() {
      if (!firebaseReady || !auth) {
        return;
      }

      try {
        await setPersistence(auth, browserSessionPersistence);
      } catch (error) {
        // Session persistence is a convenience layer; login can continue if the browser blocks it.
      }
    }

    function cleanPaNumber(value) {
      return value
        .trim()
        .toUpperCase()
        .replace(/^PA/i, '')
        .replace(/\.TIF$/i, '')
        .replace(/[^0-9]/g, '');
    }

    function buildPdfUrl() {
      const number = cleanPaNumber(paNumber.value);
      const selectedNegeri = negeri.value;

      if (!number || !selectedNegeri) {
        return '';
      }

      return `https://azobss-backend.onrender.com/api/pa-pdf?noPA=PA${number}.TIF&negeri=${encodeURIComponent(selectedNegeri)}`;
    }

    function updatePreview() {
      const url = buildPdfUrl();
      paError.textContent = '';
      paStatus.style.display = 'none';
      downloadTifButton.hidden = false;
      downloadTifButton.style.display = 'inline-block';
      downloadResultActions.hidden = true;
      downloadResultActions.style.display = 'none';
      pendingDownload = null;
      paLinkPreview.textContent = url || 'Link PDF akan dijana selepas nombor PA dan negeri dipilih.';
    }

    function normalizeUsername(name) {
      return name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    }

    function buildUserEmail(usernameKey) {
      return `${usernameKey}@azobss.local`;
    }

    function cleanInviteCode(value) {
      return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 24);
    }

    function buildInviteCode(usernameKey) {
      const cleanName = normalizeUsername(usernameKey || 'user').toUpperCase();
      return `AZ${cleanName.slice(0, 10)}${String(cleanName.length + 91).slice(-2)}`;
    }

    function getInitialInviteCode() {
      try {
        return cleanInviteCode(new URLSearchParams(window.location.search).get('invite') || '');
      } catch (error) {
        return '';
      }
    }

    function buildInviteUrl(user) {
      const code = cleanInviteCode(user && user.inviteCode ? user.inviteCode : buildInviteCode(user && user.usernameKey ? user.usernameKey : ''));
      const url = new URL(window.location.href);
      url.hash = '';
      url.searchParams.set('invite', code);
      return url.toString();
    }

    function getLuckyDrawMonthKey() {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    function getLuckyDrawShareKey(usernameKey = currentUser && currentUser.usernameKey) {
      return `azobssLuckyShare_${getLuckyDrawMonthKey()}_${usernameKey || 'guest'}`;
    }

    function getLuckyDrawJoinKey(usernameKey = currentUser && currentUser.usernameKey) {
      return `azobssLuckyJoin_${getLuckyDrawMonthKey()}_${usernameKey || 'guest'}`;
    }

    function getSavedUser() {
      const savedUser = sessionStorage.getItem('azobssCurrentUser');
      return savedUser ? JSON.parse(savedUser) : null;
    }

    function saveCurrentUser(user) {
      sessionStorage.setItem('azobssCurrentUser', JSON.stringify(user));
    }

    function clearCurrentUser() {
      sessionStorage.removeItem('azobssCurrentUser');
    }

    async function cleanupPartialAuthSession() {
      clearCurrentUser();
      sessionStorage.removeItem('azobssLoggedIn');

      try {
        if (auth && auth.currentUser) {
          await signOut(auth);
        }
      } catch (error) {
        // Auth cleanup should not hide the original login/signup error.
      }
    }

    function showAccessToast(message) {
      loginToast.textContent = message;
      loginToast.style.display = 'block';

      setTimeout(function () {
        loginToast.style.display = 'none';
      }, 3000);
    }

    function getInitials(name) {
      return name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(function (word) {
          return word[0].toUpperCase();
        })
        .join('') || 'AZ';
    }

    function showSignedInUser(user) {
      signedInName.textContent = user.name;
      userAvatar.textContent = getInitials(user.name);
      userMenu.style.display = 'flex';
      siteAuthActions.style.display = 'none';
      if (userUpgradeButton) {
        userUpgradeButton.hidden = isAdminUser(user) || user.paAccess !== false;
      }
    }

    function updateReceiptWhatsappLink(user = currentUser) {
      if (!receiptWhatsappButton) return;
      const username = user && (user.usernameKey || normalizeUsername(user.name || ''));
      const payerText = username ? `Saya ${username}` : 'Saya';
      const message = `${payerText} sudah buat bayaran untuk PA. Saya akan share resit pembayaran di sini.`;
      receiptWhatsappButton.href = `https://wa.me/601135600723?text=${encodeURIComponent(message)}`;
    }

    function updateLuckyDrawPanel() {
      if (!luckyDrawInviteLink || !luckyDrawInviteCode || !luckyDrawShareStatus || !luckyDrawJoinStatus || !luckyDrawStatus) return;

      if (!currentUser || !currentUser.usernameKey) {
        luckyDrawInviteLink.value = 'Login untuk dapatkan invite link';
        luckyDrawInviteCode.textContent = '-';
        luckyDrawShareStatus.textContent = 'Belum share';
        luckyDrawJoinStatus.textContent = 'Belum join';
        luckyDrawStatus.textContent = 'Login dahulu untuk aktifkan cabutan bertuah.';
        if (joinLuckyDrawButton) joinLuckyDrawButton.disabled = false;
        return;
      }

      const inviteCode = currentUser.inviteCode || buildInviteCode(currentUser.usernameKey);
      const inviteUrl = buildInviteUrl({ ...currentUser, inviteCode });
      const hasShared = localStorage.getItem(getLuckyDrawShareKey(currentUser.usernameKey)) === '1';
      const hasJoined = localStorage.getItem(getLuckyDrawJoinKey(currentUser.usernameKey)) === '1';

      luckyDrawInviteLink.value = inviteUrl;
      luckyDrawInviteCode.textContent = inviteCode;
      luckyDrawShareStatus.textContent = hasShared ? 'Sudah share' : 'Belum share';
      luckyDrawJoinStatus.textContent = hasJoined ? 'Sudah join' : 'Belum join';
      luckyDrawStatus.textContent = hasJoined
        ? 'Anda sudah join cabutan bertuah bulan ini.'
        : hasShared
        ? 'Share sudah direkod. Anda boleh join cabutan bertuah.'
        : 'Share website dahulu sebelum join cabutan bertuah.';
      if (joinLuckyDrawButton) joinLuckyDrawButton.disabled = hasJoined;
    }

    async function resolveInviterByCode(inviteCode, newUsernameKey) {
      const code = cleanInviteCode(inviteCode);
      if (!code || !firebaseReady || !db) return null;
      try {
        const inviteQuery = query(collection(db, 'users'), where('inviteCode', '==', code));
        const snapshot = await getDocs(inviteQuery);
        let inviter = null;
        snapshot.forEach(function (item) {
          const data = item.data();
          if (!inviter && data.usernameKey && data.usernameKey !== newUsernameKey && !data.deleted) inviter = data;
        });
        return inviter;
      } catch (error) {
        return null;
      }
    }

    async function recordInviteProof(inviter, invitedUser, inviteCode) {
      if (!inviter || !inviter.usernameKey || !invitedUser || !invitedUser.usernameKey || !firebaseReady || !db) return;
      try {
        await setDoc(doc(db, 'inviteRecords', `${inviter.usernameKey}_${invitedUser.usernameKey}`), {
          inviteCode: cleanInviteCode(inviteCode),
          inviterUsernameKey: inviter.usernameKey,
          invitedUsernameKey: invitedUser.usernameKey,
          invitedName: invitedUser.name || invitedUser.usernameKey,
          invitedContactEmail: invitedUser.contactEmail || '',
          createdAt: serverTimestamp(),
          createdAtMs: Date.now()
        }, { merge: true });
        await setDoc(doc(db, 'users', inviter.usernameKey), {
          inviteCount: increment(1),
          lastInviteAt: serverTimestamp()
        }, { merge: true });
      } catch (error) {
        try {
          const records = JSON.parse(localStorage.getItem('azobssInviteRecords') || '[]');
          records.push({ inviteCode: cleanInviteCode(inviteCode), inviterUsernameKey: inviter.usernameKey, invitedUsernameKey: invitedUser.usernameKey, createdAtMs: Date.now() });
          localStorage.setItem('azobssInviteRecords', JSON.stringify(records.slice(-100)));
        } catch (storageError) {}
      }
    }

    function isAdminUser(user) {
      return user && user.usernameKey === ADMIN_USERNAME;
    }


    function renderAdminPaDetailPagination(usernameKey, totalItems, currentPage) {
      const pageSize = 5;
      const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

      if (totalPages <= 1) {
        return '';
      }

      const maxButtons = 10;
      let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
      let endPage = Math.min(totalPages, startPage + maxButtons - 1);

      if (endPage - startPage + 1 < maxButtons) {
        startPage = Math.max(1, endPage - maxButtons + 1);
      }

      const buttons = [
        { text: '<<', page: 1, disabled: currentPage === 1 },
        { text: 'P', page: Math.max(1, currentPage - 1), disabled: currentPage === 1 }
      ];

      for (let i = startPage; i <= endPage; i += 1) {
        buttons.push({ text: String(i), page: i, active: i === currentPage });
      }

      buttons.push({ text: 'N', page: Math.min(totalPages, currentPage + 1), disabled: currentPage === totalPages });
      buttons.push({ text: '>>', page: totalPages, disabled: currentPage === totalPages });

      return `
        <div class="admin-pa-detail-pagination">
          ${buttons.map(function (button) {
            return `
              <button class="admin-pa-page-btn${button.active ? ' is-active' : ''}" type="button"
                data-admin-detail-user="${escapeHtml(usernameKey)}"
                data-admin-detail-page="${button.page}"
                ${button.disabled ? 'disabled' : ''}>
                ${button.text}
              </button>
            `;
          }).join('')}
        </div>
      `;
    }

    function getPurchaseProductType(log) {
      const type = String(log.productType || log.product || '').trim().toUpperCase();
      return type === 'BM' || type === 'SBM' ? type : 'PA';
    }

    function getPurchaseAmount(log) {
      const amount = Number(log && log.amount);
      if (Number.isFinite(amount) && amount > 0) return amount;
      return getPurchaseProductType(log) === 'PA' ? PURCHASE_PRICE : BM_SBM_PURCHASE_PRICE;
    }

    function getPurchaseItemText(log) {
      const type = getPurchaseProductType(log || {});
      if (type === 'PA') {
        const pa = log && log.paNumber ? String(log.paNumber).replace(/^PA/i, '') : '';
        return pa ? `PA${pa}` : '-';
      }
      const station = (log && (log.stationNo || log.itemCode || log.paNumber)) ? String(log.stationNo || log.itemCode || log.paNumber).replace(/^(BM|SBM)\s*/i, '') : '';
      return station ? `${type} ${station}` : type;
    }

    function renderPurchaseSummaries(summaries, requestedPage = purchaseRecordsPage) {
      if (!summaries.length) {
        purchaseRecordsPage = 1;
        purchaseSummaryList.innerHTML = '<div class="purchase-summary-item">No purchase records yet.</div>';
        renderHistoryPagination(purchaseRecordsPagination, 0, purchaseRecordsPage, 'purchaseRecords');
        return;
      }

      const pageData = getHistoryPageItems(summaries, requestedPage, PURCHASE_RECORDS_PAGE_SIZE);
      purchaseRecordsPage = pageData.page;
      const adminMode = isAdminUser(currentUser);

      purchaseSummaryList.innerHTML = pageData.pageItems.map(function (summary) {
        const units = summary.totalUnits || 0;
        const amount = summary.totalAmount || 0;
        const lastPa = summary.lastItemText || (summary.lastPa ? `PA${String(summary.lastPa).replace(/^PA/i, '')}` : '-');
        const summaryTime = cleanSummaryDateTimeText(formatPurchaseSummaryDate(summary));
        const usernameKey = summary.usernameKey || '';

        if (adminMode) {
          const isOpen = adminPurchaseDetailsOpen.has(usernameKey);
          const userLogs = allAdminPurchaseLogs
            .filter(function (log) {
              return (log.usernameKey && log.usernameKey === usernameKey) || (summary.uid && log.uid === summary.uid);
            })
            .sort(function (a, b) {
              return getPurchaseLogMs(b) - getPurchaseLogMs(a);
            });

          const detailPageSize = 5;
          const detailTotalPages = Math.max(1, Math.ceil(userLogs.length / detailPageSize));
          const savedDetailPage = Number(adminPurchaseDetailsPage.get(usernameKey) || 1);
          const detailPage = Math.min(Math.max(savedDetailPage, 1), detailTotalPages);
          adminPurchaseDetailsPage.set(usernameKey, detailPage);
          const pagedLogs = userLogs.slice((detailPage - 1) * detailPageSize, detailPage * detailPageSize);
          const detailsHtml = isOpen
            ? `
              <div class="admin-purchase-user-details">
                ${pagedLogs.length ? pagedLogs.map(function (log) {
                  const paText = getPurchaseItemText(log);
                  const amountText = `RM${getPurchaseAmount(log)}`;

                  return `
                    <div class="admin-pa-detail-row">
                      <span>Item: <strong>${escapeHtml(paText)}</strong></span>
                      <span>Negeri: <strong>${escapeHtml(log.negeri || '-')}</strong><br>Amount: <strong>${escapeHtml(amountText)}</strong></span>
                      <span>Date/Time:<br><strong>${escapeHtml(formatPurchaseLogDate(log))}</strong></span>
                    </div>
                  `;
                }).join('') : '<div class="admin-pa-detail-row">No PA purchase details yet.</div>'}
                ${renderAdminPaDetailPagination(usernameKey, userLogs.length, detailPage)}
              </div>
            `
            : '';

          return `
            <div class="purchase-summary-item admin-purchase-user-card">
              <div class="admin-purchase-user-top">
                <span><strong>${escapeHtml(summary.name || usernameKey || '-')}</strong><br>${escapeHtml(summary.phone || '-')}</span>
                <span>Unit: <strong>${units}</strong></span>
                <span>Total: <strong>RM${amount}</strong></span>
                <span class="admin-lastpa-wrap">
                  <span class="admin-lastpa-wrap">
              <span>Last: <strong>${escapeHtml(lastPa)}</strong></span>
              ${summaryTime !== '-' ? `<span class="admin-lastpa-time">${escapeHtml(summaryTime)}</span>` : ''}
            </span>
                <span>
                  <button class="admin-purchase-detail-btn" type="button" data-toggle-purchase-details="${escapeHtml(usernameKey)}">${isOpen ? 'Hide' : 'Show'}</button>
                  <button class="small-action-btn" type="button" data-reset-purchase="${escapeHtml(usernameKey)}">Reset</button>
                </span>
              </div>
              ${detailsHtml}
            </div>
          `;
        }

        return `
          <div class="purchase-summary-item">
            <span><strong>${escapeHtml(summary.name || usernameKey || '-')}</strong><br>${escapeHtml(summary.phone || '-')}</span>
            <span>Unit: <strong>${units}</strong></span>
            <span>Total: <strong>RM${amount}</strong></span>
            <span>Last: <strong>${escapeHtml(lastPa)}</strong></span>
          </div>
        `;
      }).join('');

      renderHistoryPagination(purchaseRecordsPagination, pageData.totalPages, purchaseRecordsPage, 'purchaseRecords');
    }

    function getFirestoreTimestampMs(value) {
      if (value && typeof value.toMillis === 'function') {
        return value.toMillis();
      }

      if (value && typeof value.seconds === 'number') {
        return value.seconds * 1000;
      }

      return 0;
    }

    function getPurchaseUpdatedMs(summary) {
      return getFirestoreTimestampMs(summary.updatedAt)
        || getFirestoreTimestampMs(summary.resetAt)
        || 0;
    }

    function getPurchaseLogMs(log) {
      return getFirestoreTimestampMs(log.createdAt)
        || log.createdAtMs
        || 0;
    }

    function formatPurchaseLogDate(log) {
      const ms = getPurchaseLogMs(log);
      return cleanSummaryDateTimeText(ms ? new Date(ms).toLocaleString('en-MY', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) : '-');
    }


    function cleanSummaryDateTimeText(value) {
      const text = String(value || '').trim();
      if (!text || text === '-') return '-';
      const parts = text.split(/<br\s*\/?>|\n|\r/i).map(function(x){ return x.trim(); }).filter(Boolean);
      return parts[0] || '-';
    }

    function formatPurchaseSummaryDate(summary) {
      const ms = getPurchaseUpdatedMs(summary);
      return ms ? new Date(ms).toLocaleString('en-MY', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) : '-';
    }

    function getFilteredUserPaPurchases() {
      const queryText = (userPaPurchaseSearch ? userPaPurchaseSearch.value : '').trim().toLowerCase();
      const sortMode = userPaPurchaseSort ? userPaPurchaseSort.value : 'newest';
      let logs = allUserPaPurchases.slice();

      if (queryText) {
        logs = logs.filter(function (log) {
          const searchable = [
            getPurchaseItemText(log),
            log.productType || '',
            log.paNumber || '',
            log.stationNo || '',
            log.itemCode || '',
            log.negeri || '',
            log.daerah || '',
            log.bandar || '',
            log.amount || '',
            formatPurchaseLogDate(log)
          ].join(' ').toLowerCase();

          return searchable.includes(queryText);
        });
      }

      logs.sort(function (a, b) {
        if (sortMode === 'oldest') {
          return getPurchaseLogMs(a) - getPurchaseLogMs(b);
        }

        if (sortMode === 'paAsc') {
          return getPurchaseItemText(a).localeCompare(getPurchaseItemText(b));
        }

        if (sortMode === 'paDesc') {
          return getPurchaseItemText(b).localeCompare(getPurchaseItemText(a));
        }

        if (sortMode === 'state') {
          return String(a.negeri || '').localeCompare(String(b.negeri || ''))
            || getPurchaseLogMs(b) - getPurchaseLogMs(a);
        }

        return getPurchaseLogMs(b) - getPurchaseLogMs(a);
      });

      return logs;
    }

    function renderUserPaPurchases(logs, requestedPage = userPaPurchasePage) {
      if (!userPaPurchaseList || !userPaPurchasePagination) {
        return;
      }

      if (!logs.length) {
        userPaPurchasePage = 1;
        userPaPurchaseList.innerHTML = '<div class="purchase-summary-item">No PA purchase list yet.</div>';
        renderHistoryPagination(userPaPurchasePagination, 0, userPaPurchasePage, 'userPaPurchases');
        return;
      }

      const pageData = getHistoryPageItems(logs, requestedPage, USER_PA_PURCHASE_PAGE_SIZE);
      userPaPurchasePage = pageData.page;

      userPaPurchaseList.innerHTML = pageData.pageItems.map(function (log) {
        const paText = getPurchaseItemText(log);
        const amountText = `RM${getPurchaseAmount(log)}`;

        return `
          <div class="user-pa-item">
            <span>Item: <strong>${escapeHtml(paText)}</strong></span>
            <span>Negeri: <strong>${escapeHtml(log.negeri || '-')}</strong><br>Amount: <strong>${escapeHtml(amountText)}</strong></span>
            <span>Date/Time:<br><strong>${escapeHtml(formatPurchaseLogDate(log))}</strong></span>
          </div>
        `;
      }).join('');

      renderHistoryPagination(userPaPurchasePagination, pageData.totalPages, userPaPurchasePage, 'userPaPurchases');
    }

    function applyUserPaPurchaseFilters(requestedPage = 1) {
      renderUserPaPurchases(getFilteredUserPaPurchases(), requestedPage);
    }

    async function loadUserPaPurchaseLogs() {
      if (!userPaPurchasePanel || !currentUser || !auth.currentUser) {
        return;
      }

      try {
        const logsQuery = query(
          collection(db, 'purchaseLogs'),
          where('uid', '==', auth.currentUser.uid)
        );

        const logsSnapshot = await getDocs(logsQuery);
        const logs = [];

        logsSnapshot.forEach(function (item) {
          const data = item.data();

          if (!data.deleted) {
            logs.push({
              id: item.id,
              ...data
            });
          }
        });

        allUserPaPurchases = logs;
        applyUserPaPurchaseFilters(1);
      } catch (error) {
        if (userPaPurchaseList) {
          userPaPurchaseList.innerHTML = `<div class="purchase-summary-item">Failed to read PA list: ${escapeHtml(error.code || error.message)}</div>`;
        }
        if (userPaPurchasePagination) {
          userPaPurchasePagination.innerHTML = '';
        }
      }
    }

    function getFilteredPurchaseSummaries() {
      const queryText = (purchaseRecordSearch ? purchaseRecordSearch.value : '').trim().toLowerCase();
      const sortMode = purchaseRecordSort ? purchaseRecordSort.value : 'amountDesc';
      let summaries = allPurchaseSummaries.slice();

      if (queryText) {
        summaries = summaries.filter(function (summary) {
          const searchable = [
            summary.usernameKey || '',
            summary.name || '',
            summary.phone || '',
            summary.lastPa || '',
            summary.lastItemText || '',
            summary.lastNegeri || ''
          ].join(' ').toLowerCase();

          return searchable.includes(queryText);
        });
      }

      summaries.sort(function (a, b) {
        if (sortMode === 'amountAsc') {
          return (a.totalAmount || 0) - (b.totalAmount || 0)
            || (a.usernameKey || '').localeCompare(b.usernameKey || '');
        }

        if (sortMode === 'unitsDesc') {
          return (b.totalUnits || 0) - (a.totalUnits || 0)
            || (a.usernameKey || '').localeCompare(b.usernameKey || '');
        }

        if (sortMode === 'unitsAsc') {
          return (a.totalUnits || 0) - (b.totalUnits || 0)
            || (a.usernameKey || '').localeCompare(b.usernameKey || '');
        }

        if (sortMode === 'updatedNewest') {
          return getPurchaseUpdatedMs(b) - getPurchaseUpdatedMs(a)
            || (a.usernameKey || '').localeCompare(b.usernameKey || '');
        }

        if (sortMode === 'username') {
          return (a.usernameKey || '').localeCompare(b.usernameKey || '');
        }

        return (b.totalAmount || 0) - (a.totalAmount || 0)
          || (a.usernameKey || '').localeCompare(b.usernameKey || '');
      });

      return summaries;
    }

    function applyPurchaseRecordFilters(requestedPage = 1) {
      renderPurchaseSummaries(getFilteredPurchaseSummaries(), requestedPage);
    }
    function setPurchaseRecordsVisible(visible) {
      purchaseRecordsVisible = visible;

      if (togglePurchaseRecordsButton) {
        togglePurchaseRecordsButton.textContent = visible ? 'Hide Records' : 'Show Records';
      }

      if (purchaseSummaryList) {
        purchaseSummaryList.hidden = !visible;
      }

      if (purchaseRecordsPagination) {
        purchaseRecordsPagination.hidden = !visible;
      }

      if (purchaseRecordTools && isAdminUser(currentUser)) {
        purchaseRecordTools.hidden = !visible;
      }
    }
    async function resetPurchaseSummary(usernameKey) {
      if (!isAdminUser(currentUser) || !usernameKey) {
        return;
      }

      if (!confirm(`Reset purchase records for ${usernameKey}?`)) {
        return;
      }

      try {
        purchaseAdminError.textContent = '';
        const userSnapshot = await getDoc(doc(db, 'users', usernameKey));
        const userData = userSnapshot.exists() ? userSnapshot.data() : {};
        const userUid = userData.uid || '';
        const logsSnapshot = await getDocs(collection(db, 'purchaseLogs'));
        const resetLogWrites = [];

        logsSnapshot.forEach(function (item) {
          const data = item.data();
          const matchesUser = (data.usernameKey && data.usernameKey === usernameKey)
            || (userUid && data.uid === userUid);

          if (matchesUser && !data.deleted) {
            resetLogWrites.push(setDoc(doc(db, 'purchaseLogs', item.id), {
              deleted: true,
              resetBy: currentUser.usernameKey,
              resetAt: serverTimestamp()
            }, { merge: true }));
          }
        });

        await Promise.all(resetLogWrites);

        await setDoc(doc(db, 'purchaseSummaries', usernameKey), {
          usernameKey,
          uid: userUid || null,
          name: userData.name || usernameKey,
          phone: userData.phone || '',
          totalUnits: 0,
          totalAmount: 0,
          lastPa: '',
          lastNegeri: '',
          deleted: false,
          deletedAt: null,
          deletedBy: null,
          resetBy: currentUser.usernameKey,
          resetAt: serverTimestamp()
        }, { merge: true });

        adminPurchaseDetailsOpen.delete(usernameKey);
        adminPurchaseDetailsPage.delete(usernameKey);
        await loadPurchaseRecords();
      } catch (error) {
        purchaseAdminError.textContent = `Failed to reset purchase records: ${error.code || error.message}`;
      }
    }

    async function loadPurchaseRecords() {
      if (!currentUser) {
        return;
      }

      if (firebaseReady && auth && !auth.currentUser) {
        return;
      }

      try {
        purchaseAdminError.textContent = '';
        const summaries = [];
        purchaseRecordTools.hidden = !isAdminUser(currentUser) || !purchaseRecordsVisible;
        if (togglePurchaseRecordsButton) {
          togglePurchaseRecordsButton.style.display = isAdminUser(currentUser) ? 'inline-block' : 'none';
        }

        if (userPaPurchasePanel) {
          userPaPurchasePanel.hidden = false;
        }

        if (isAdminUser(currentUser)) {
          if (userPaPurchasePanel) {
            userPaPurchasePanel.hidden = true;
          }

          purchasePanelTitle.textContent = 'Purchase Records Users';
          purchasePanelNote.textContent = 'Price: PA RM5/unit, BM/SBM RM3/unit. Admin can view all active user purchase records.';

          const activeUsersByKey = new Map();
          const usersSnapshot = await getDocs(collection(db, 'users'));

          usersSnapshot.forEach(function (item) {
            const data = item.data();
            const usernameKey = data.usernameKey || item.id;

            if (!data.deleted && usernameKey) {
              activeUsersByKey.set(usernameKey, {
                usernameKey,
                ...data
              });
            }
          });

          const logsSnapshot = await getDocs(collection(db, 'purchaseLogs'));
          const adminLogs = [];

          logsSnapshot.forEach(function (item) {
            const data = item.data();

            if (!data.deleted) {
              adminLogs.push({
                id: item.id,
                ...data
              });
            }
          });

          allAdminPurchaseLogs = adminLogs;

          const summarySnapshot = await getDocs(collection(db, 'purchaseSummaries'));
          const summariesByKey = new Map();

          summarySnapshot.forEach(function (item) {
            const data = item.data();
            const usernameKey = data.usernameKey || item.id;

            if (data.deleted || !activeUsersByKey.has(usernameKey)) {
              return;
            }

            const userLogs = adminLogs
              .filter(function (log) {
                return (log.usernameKey && log.usernameKey === usernameKey) || (data.uid && log.uid === data.uid);
              });
            const latestUserLog = userLogs
              .slice()
              .sort(function (a, b) {
                return getPurchaseLogMs(b) - getPurchaseLogMs(a);
              })[0];
            const logTotalUnits = userLogs.length;
            const logTotalAmount = userLogs.reduce(function(total, log) { return total + getPurchaseAmount(log); }, 0);

            summariesByKey.set(usernameKey, {
              ...activeUsersByKey.get(usernameKey),
              ...data,
              usernameKey,
              totalUnits: logTotalUnits || data.totalUnits || 0,
              totalAmount: logTotalUnits ? logTotalAmount : data.totalAmount || 0,
              lastPa: latestUserLog ? String(latestUserLog.paNumber || latestUserLog.itemCode || latestUserLog.stationNo || '').replace(/^PA/i, '') : data.lastPa || '',
              lastItemText: latestUserLog ? getPurchaseItemText(latestUserLog) : (data.lastItemText || ''),
              lastNegeri: latestUserLog ? latestUserLog.negeri : data.lastNegeri || '',
              updatedAt: latestUserLog ? latestUserLog.createdAt : data.updatedAt
            });
          });

          activeUsersByKey.forEach(function (user, usernameKey) {
            const fallbackLogs = adminLogs
              .filter(function (log) {
                return (log.usernameKey && log.usernameKey === usernameKey) || (user.uid && log.uid === user.uid);
              })
              .sort(function (a, b) {
                return getPurchaseLogMs(b) - getPurchaseLogMs(a);
              });
            const fallbackLatestLog = fallbackLogs[0];

            summaries.push(summariesByKey.get(usernameKey) || {
              usernameKey,
              uid: user.uid,
              name: user.name || usernameKey,
              phone: user.phone || '',
              totalUnits: fallbackLogs.length || 0,
              totalAmount: fallbackLogs.reduce(function(total, log) { return total + getPurchaseAmount(log); }, 0),
              lastPa: fallbackLatestLog ? String(fallbackLatestLog.paNumber || fallbackLatestLog.itemCode || fallbackLatestLog.stationNo || '').replace(/^PA/i, '') : '',
              lastItemText: fallbackLatestLog ? getPurchaseItemText(fallbackLatestLog) : '',
              lastNegeri: fallbackLatestLog ? fallbackLatestLog.negeri : '',
              updatedAt: fallbackLatestLog ? fallbackLatestLog.createdAt : null
            });
          });
        } else {
          allAdminPurchaseLogs = [];
          adminPurchaseDetailsOpen.clear();
          adminPurchaseDetailsPage.clear();
          purchasePanelTitle.textContent = 'Purchase Records Saya';
          purchasePanelNote.textContent = 'Price: PA RM5/unit, BM/SBM RM3/unit. You can only view your own records.';

          await loadUserPaPurchaseLogs();

          const userLogs = allUserPaPurchases.slice();
          const totalUnits = userLogs.length;
          const totalAmount = userLogs.reduce(function(total, log) { return total + getPurchaseAmount(log); }, 0);
          const latestLog = userLogs
            .slice()
            .sort(function (a, b) {
              return getPurchaseLogMs(b) - getPurchaseLogMs(a);
            })[0];

          if (totalUnits || currentUser) {
            summaries.push({
              usernameKey: currentUser.usernameKey,
              uid: currentUser.uid,
              name: currentUser.name || currentUser.usernameKey,
              phone: currentUser.phone || '',
              totalUnits,
              totalAmount,
              lastPa: latestLog ? String(latestLog.paNumber || latestLog.itemCode || latestLog.stationNo || '').replace(/^PA/i, '') : '',
              lastItemText: latestLog ? getPurchaseItemText(latestLog) : '',
              lastNegeri: latestLog ? latestLog.negeri : '',
              updatedAt: latestLog ? latestLog.createdAt : null
            });
          }
        }

        allPurchaseSummaries = summaries;
        setPurchaseRecordsVisible(purchaseRecordsVisible);
        applyPurchaseRecordFilters();
      } catch (error) {
        purchaseAdminError.textContent = `Failed to read purchase records: ${error.code || error.message}`;
      }
    }

    function escapeHtml(value) {
      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function getUserCreatedMs(user) {
      const createdAt = user.createdAt;

      if (createdAt && typeof createdAt.toMillis === 'function') {
        return createdAt.toMillis();
      }

      if (createdAt && typeof createdAt.seconds === 'number') {
        return createdAt.seconds * 1000;
      }

      return 0;
    }

    function formatUserCreatedDate(user) {
      const createdMs = getUserCreatedMs(user);
      return createdMs ? new Date(createdMs).toLocaleString('en-MY') : '-';
    }

    function isRegisteredUserOnline(user) {
      return user.online === true && user.lastSeenMs && Date.now() - user.lastSeenMs <= 90000;
    }
    function getFilteredRegisteredUsers() {
      const queryText = (registeredUserSearch.value || '').trim().toLowerCase();
      const sortMode = registeredUserSort.value || 'username';
      let users = allRegisteredUsers.slice();

      if (queryText) {
        users = users.filter(function (user) {
          const usernameKey = user.usernameKey || normalizeUsername(user.name || '');
          const searchable = [
            usernameKey,
            user.name || '',
            user.phone || '',
            user.contactEmail || '',
            user.email || ''
          ].join(' ').toLowerCase();

          return searchable.includes(queryText);
        });
      }

      if (sortMode === 'onlineOnly') {
        users = users.filter(isRegisteredUserOnline);
      }

      if (sortMode === 'paAllowed') {
        users = users.filter(function (user) {
          const usernameKey = user.usernameKey || normalizeUsername(user.name || '');
          return usernameKey === ADMIN_USERNAME || user.paAccess !== false;
        });
      }

      users.sort(function (a, b) {
        if (sortMode === 'onlineOnly') {
          return (b.lastSeenMs || 0) - (a.lastSeenMs || 0);
        }

        if (sortMode === 'paAllowed') {
          return (a.usernameKey || '').localeCompare(b.usernameKey || '');
        }

        if (sortMode === 'dateNewest') {
          return getUserCreatedMs(b) - getUserCreatedMs(a);
        }

        if (sortMode === 'dateOldest') {
          return getUserCreatedMs(a) - getUserCreatedMs(b);
        }

        return (a.usernameKey || '').localeCompare(b.usernameKey || '');
      });

      return users;
    }

    function applyRegisteredUserFilters(requestedPage = 1) {
      renderRegisteredUsers(getFilteredRegisteredUsers(), requestedPage);
    }

    function renderRegisteredUsers(users, requestedPage = registeredUsersPage) {
      if (!users.length) {
        registeredUsersPage = 1;
        registeredUsersList.innerHTML = '<div class="purchase-summary-item">No matching user records found.</div>';
        renderHistoryPagination(registeredUsersPagination, 0, registeredUsersPage, 'registeredUsers');
        return;
      }

      const pageData = getHistoryPageItems(users, requestedPage, PURCHASE_RECORDS_PAGE_SIZE);
      registeredUsersPage = pageData.page;

      registeredUsersList.innerHTML = pageData.pageItems.map(function (user) {
        const usernameKey = user.usernameKey || normalizeUsername(user.name || '');
        const isAdminRecord = usernameKey === ADMIN_USERNAME;
        const paAccess = isAdminRecord || user.paAccess !== false;
        const isOnline = isRegisteredUserOnline(user);
        const deleteButton = isAdminRecord
          ? ''
          : `<button class="small-action-btn" type="button" data-delete-user="${escapeHtml(usernameKey)}">Delete</button>`;

        return `
          <div class="purchase-summary-item user-edit-item" data-user-key="${escapeHtml(usernameKey)}">
            <div class="user-record-summary">
              <div class="user-record-summary-main">
                <strong>${escapeHtml(user.name || usernameKey)}</strong>
                <span>Username: <strong>${escapeHtml(usernameKey || '-')}</strong></span>
                <span>Role: <strong>${isAdminRecord ? 'Admin' : 'User'}</strong> | Status: <strong>${isOnline ? 'Online' : 'Offline'}</strong></span>
              </div>
              <div class="user-compact-actions">
                <button class="small-action-btn blue" type="button" data-toggle-user-edit="${escapeHtml(usernameKey)}">Edit</button>
                ${deleteButton}
              </div>
            </div>
            <div class="user-edit-details">
              <div class="user-record-extra">
                Date registered: <strong>${escapeHtml(formatUserCreatedDate(user))}</strong><br>
                UID: <strong>${escapeHtml(user.uid ? user.uid.slice(0, 8) : '-')}</strong>
              </div>
              <div class="user-edit-grid">
                <label>
                  Name
                  <input type="text" data-user-field="name" value="${escapeHtml(user.name || '')}">
                </label>
                <label>
                  Phone
                  <input type="text" data-user-field="phone" value="${escapeHtml(user.phone || '')}">
                </label>
                <label>
                  Email
                  <input type="email" data-user-field="contactEmail" value="${escapeHtml(user.contactEmail || '')}">
                </label>
                <label>
                  PA Access
                  <select data-user-field="paAccess" ${isAdminRecord ? 'disabled' : ''}>
                    <option value="true" ${paAccess ? 'selected' : ''}>Allowed</option>
                    <option value="false" ${!paAccess ? 'selected' : ''}>Not allowed</option>
                  </select>
                </label>
              </div>
              <div class="user-edit-actions">
                <button class="small-action-btn blue" type="button" data-save-user="${escapeHtml(usernameKey)}">Save Details</button>
              </div>
            </div>
          </div>
        `;
      }).join('');

      renderHistoryPagination(registeredUsersPagination, pageData.totalPages, registeredUsersPage, 'registeredUsers');
    }
    async function saveRegisteredUserDetails(usernameKey, itemElement) {
      if (!isAdminUser(currentUser) || !usernameKey || !itemElement) {
        return;
      }

      const name = itemElement.querySelector('[data-user-field="name"]').value.trim();
      const phone = itemElement.querySelector('[data-user-field="phone"]').value.trim();
      const contactEmail = itemElement.querySelector('[data-user-field="contactEmail"]').value.trim();
      const paAccessValue = itemElement.querySelector('[data-user-field="paAccess"]').value === 'true';

      if (!name) {
        registeredUsersError.textContent = 'Name cannot be empty.';
        return;
      }

      if (contactEmail && !isValidEmail(contactEmail)) {
        registeredUsersError.textContent = 'Please enter a valid email address.';
        return;
      }

      try {
        registeredUsersError.textContent = '';
        await setDoc(doc(db, 'users', usernameKey), {
          name,
          phone,
          contactEmail,
          paAccess: usernameKey === ADMIN_USERNAME ? true : paAccessValue,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.usernameKey
        }, { merge: true });

        if (currentUser.usernameKey === usernameKey) {
          const updatedUser = {
            ...currentUser,
            name,
            phone,
            contactEmail,
            paAccess: true
          };
          saveCurrentUser(updatedUser);
          setLoggedIn(updatedUser);
        }

        registeredUsersError.style.color = '#bbf7d0';
        registeredUsersError.textContent = `Saved details for ${usernameKey}.`;
        await loadRegisteredUsers();
      } catch (error) {
        registeredUsersError.style.color = '#fecaca';
        registeredUsersError.textContent = `Failed to save user details: ${error.code || error.message}`;
      }
    }

    async function deleteRegisteredUser(usernameKey) {
      if (!isAdminUser(currentUser) || !usernameKey || usernameKey === ADMIN_USERNAME) {
        return;
      }

      if (!confirm(`Delete user record for ${usernameKey}? This also hides the user from admin purchase records.`)) {
        return;
      }

      try {
        registeredUsersError.textContent = '';
        await setDoc(doc(db, 'users', usernameKey), {
          deleted: true,
          deletedAt: serverTimestamp(),
          deletedBy: currentUser.usernameKey
        }, { merge: true });

        await setDoc(doc(db, 'purchaseSummaries', usernameKey), {
          usernameKey,
          totalUnits: 0,
          totalAmount: 0,
          lastPa: '',
          lastNegeri: '',
          deleted: true,
          deletedAt: serverTimestamp(),
          deletedBy: currentUser.usernameKey
        }, { merge: true });

        await loadRegisteredUsers();
        await loadPurchaseRecords();
      } catch (error) {
        registeredUsersError.textContent = `Failed to delete user record: ${error.code || error.message}`;
      }
    }

    async function loadRegisteredUsers() {
      if (!isAdminUser(currentUser)) {
        return;
      }

      if (firebaseReady && auth && !auth.currentUser) {
        return;
      }

      try {
        registeredUsersError.textContent = '';
        const snapshot = await getDocs(collection(db, 'users'));
        const users = [];

        snapshot.forEach(function (item) {
          const data = item.data();
          if (!data.deleted) {
            users.push(data);
          }
        });

        allRegisteredUsers = users;
        updateHistoryTotals(users, registeredUsersToday, registeredUsersMonth, getUserCreatedMs);
        applyRegisteredUserFilters();
        renderLoginHistory(users);
      } catch (error) {
        registeredUsersError.textContent = `Failed to read user records: ${error.code || error.message}`;
      }
    }

    function getStartOfTodayMs() {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      return date.getTime();
    }

    function getStartOfMonthMs() {
      const date = new Date();
      date.setDate(1);
      date.setHours(0, 0, 0, 0);
      return date.getTime();
    }

    function updateHistoryTotals(items, todayElement, monthElement, timestampGetter) {
      if (!todayElement || !monthElement) {
        return;
      }

      const startOfToday = getStartOfTodayMs();
      const startOfMonth = getStartOfMonthMs();
      let todayCount = 0;
      let monthCount = 0;

      items.forEach(function (item) {
        const eventMs = timestampGetter(item) || 0;

        if (eventMs >= startOfToday) {
          todayCount += 1;
        }

        if (eventMs >= startOfMonth) {
          monthCount += 1;
        }
      });

      todayElement.textContent = todayCount;
      monthElement.textContent = monthCount;
    }

    function getPaginationWindow(currentPage, totalPages) {
      const maxButtons = HISTORY_PAGINATION_MAX_BUTTONS;
      let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
      let endPage = Math.min(totalPages, startPage + maxButtons - 1);

      if (endPage - startPage + 1 < maxButtons) {
        startPage = Math.max(1, endPage - maxButtons + 1);
      }

      return { startPage, endPage };
    }

    function renderHistoryPagination(container, totalPages, currentPage, historyType) {
      if (!container) {
        return;
      }

      if (totalPages <= 1) {
        container.innerHTML = '';
        return;
      }

      const windowRange = getPaginationWindow(currentPage, totalPages);
      const buttons = [];
      buttons.push(`<button class="guest-history-page-btn" type="button" data-history-type="${historyType}" data-history-page="1" ${currentPage === 1 ? 'disabled' : ''}>&lt;&lt;</button>`);
      buttons.push(`<button class="guest-history-page-btn" type="button" data-history-type="${historyType}" data-history-action="previous" ${currentPage === 1 ? 'disabled' : ''}>P</button>`);

      for (let page = windowRange.startPage; page <= windowRange.endPage; page += 1) {
        const activeClass = page === currentPage ? ' is-active' : '';
        buttons.push(`<button class="guest-history-page-btn${activeClass}" type="button" data-history-type="${historyType}" data-history-page="${page}">${page}</button>`);
      }

      buttons.push(`<button class="guest-history-page-btn" type="button" data-history-type="${historyType}" data-history-action="next" ${currentPage === totalPages ? 'disabled' : ''}>N</button>`);
      buttons.push(`<button class="guest-history-page-btn" type="button" data-history-type="${historyType}" data-history-page="${totalPages}" ${currentPage === totalPages ? 'disabled' : ''}>&gt;&gt;</button>`);
      container.innerHTML = buttons.join('');
    }

    function getHistoryPageItems(items, requestedPage, pageSize = HISTORY_PAGE_SIZE) {
      const totalPages = Math.ceil(items.length / pageSize);
      const page = Math.min(Math.max(requestedPage, 1), totalPages || 1);
      const startIndex = (page - 1) * pageSize;

      return {
        page,
        totalPages,
        pageItems: items.slice(startIndex, startIndex + pageSize)
      };
    }

    function renderLiveUsers(users, requestedPage = liveUsersPage) {
      if (!liveUsersList) {
        return;
      }

      const onlineUsers = users
        .filter(function (user) {
          return !user.deleted;
        })
        .sort(function (a, b) {
          return (a.usernameKey || '').localeCompare(b.usernameKey || '');
        });

      allLiveUsers = onlineUsers;

      if (!onlineUsers.length) {
        liveUsersPage = 1;
        liveUsersList.innerHTML = '<div class="purchase-summary-item">No users are online right now.</div>';
        renderHistoryPagination(liveUsersPagination, 0, liveUsersPage, 'liveUsers');
        return;
      }

      const pageData = getHistoryPageItems(onlineUsers, requestedPage);
      liveUsersPage = pageData.page;

      liveUsersList.innerHTML = pageData.pageItems.map(function (user) {
        const lastSeen = user.lastSeenMs ? new Date(user.lastSeenMs).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' }) : 'now';
        return `
          <div class="live-user-item">
            <span><strong>${escapeHtml(user.name || user.usernameKey || '-')}</strong> ${escapeHtml(user.phone || '')}</span>
            <span class="live-user-time">${escapeHtml(lastSeen)}</span>
          </div>
        `;
      }).join('');

      renderHistoryPagination(liveUsersPagination, pageData.totalPages, liveUsersPage, 'liveUsers');
    }

    function renderLoginHistory(users, requestedPage = loginHistoryPage) {
      if (!loginHistoryList) {
        return;
      }

      const historyUsers = users
        .filter(function (user) {
          return !user.deleted && user.lastLoginMs;
        })
        .sort(function (a, b) {
          return (b.lastLoginMs || 0) - (a.lastLoginMs || 0);
        });

      allLoginHistory = historyUsers;
      updateHistoryTotals(historyUsers, loginHistoryToday, loginHistoryMonth, function (user) {
        return user.lastLoginMs || 0;
      });

      if (!historyUsers.length) {
        loginHistoryPage = 1;
        loginHistoryList.innerHTML = '<div class="purchase-summary-item">No login history yet.</div>';
        renderHistoryPagination(loginHistoryPagination, 0, loginHistoryPage, 'loginHistory');
        return;
      }

      const pageData = getHistoryPageItems(historyUsers, requestedPage);
      loginHistoryPage = pageData.page;

      loginHistoryList.innerHTML = pageData.pageItems.map(function (user) {
        const loginTime = new Date(user.lastLoginMs).toLocaleString('en-MY', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        const loginCount = user.loginCount ? `Login: ${user.loginCount}` : '';

        return `
          <div class="live-user-item">
            <span><strong>${escapeHtml(user.name || user.usernameKey || '-')}</strong> ${escapeHtml(user.phone || '')}</span>
            <span class="live-user-time">${escapeHtml(loginTime)} ${escapeHtml(loginCount)}</span>
          </div>
        `;
      }).join('');

      renderHistoryPagination(loginHistoryPagination, pageData.totalPages, loginHistoryPage, 'loginHistory');
    }

    function renderGuestHistory(guests, requestedPage = guestHistoryPage) {
      if (!guestHistoryList) {
        return;
      }

      const historyGuests = guests
        .filter(function (guest) {
          return guest.lastSeenMs;
        })
        .sort(function (a, b) {
          return (b.lastSeenMs || 0) - (a.lastSeenMs || 0);
        });

      allGuestHistory = historyGuests;
      updateHistoryTotals(historyGuests, guestVisitsToday, guestVisitsMonth, function (guest) {
        return guest.firstSeenMs || guest.lastSeenMs || 0;
      });

      if (!historyGuests.length) {
        guestHistoryPage = 1;
        guestHistoryList.innerHTML = '<div class="purchase-summary-item">No guest history yet.</div>';
        renderHistoryPagination(guestHistoryPagination, 0, guestHistoryPage, 'guestHistory');
        return;
      }

      const pageData = getHistoryPageItems(historyGuests, requestedPage);
      guestHistoryPage = pageData.page;

      guestHistoryList.innerHTML = pageData.pageItems.map(function (guest) {
        const lastSeen = new Date(guest.lastSeenMs).toLocaleString('en-MY', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        const status = guest.isActive ? 'Online' : 'Offline';

        return `
          <div class="live-user-item">
            <span><strong>${escapeHtml(guest.guestName)}</strong></span>
            <span class="live-user-time">${escapeHtml(lastSeen)} ${escapeHtml(status)}</span>
          </div>
        `;
      }).join('');

      renderHistoryPagination(guestHistoryPagination, pageData.totalPages, guestHistoryPage, 'guestHistory');
    }

    function startLiveUsersListener() {
      if (!firebaseReady || !auth.currentUser || !isAdminUser(currentUser) || liveUsersUnsubscribe) {
        return;
      }

      liveUsersUnsubscribe = onSnapshot(collection(db, 'users'), function (snapshot) {
        const now = Date.now();
        const liveUsers = [];
        const registeredUsersFromSnapshot = [];

        snapshot.forEach(function (item) {
          const data = item.data();
          if (!data.deleted) {
            registeredUsersFromSnapshot.push(data);
          }

          if (!data.deleted && data.online === true && data.lastSeenMs && now - data.lastSeenMs <= 90000) {
            liveUsers.push(data);
          }
        });

        liveUsers.sort(function (a, b) {
          return (a.usernameKey || '').localeCompare(b.usernameKey || '');
        });

        renderLiveUsers(liveUsers);
        renderLoginHistory(registeredUsersFromSnapshot);

        if (registeredUserSort.value === 'onlineOnly') {
          allRegisteredUsers = registeredUsersFromSnapshot;
          applyRegisteredUserFilters();
        }
      }, function () {
        renderLiveUsers([]);
        renderLoginHistory([]);
      });
    }

    function stopLiveUsersListener() {
      if (liveUsersUnsubscribe) {
        liveUsersUnsubscribe();
        liveUsersUnsubscribe = null;
      }

      renderLiveUsers([]);
      renderLoginHistory([]);
      onlineUserCount.textContent = '0';
    }

    async function recordLoginHistory(user) {
      if (!firebaseReady || !auth || !auth.currentUser || !user || !user.usernameKey) {
        return;
      }

      try {
        await setDoc(doc(db, 'users', user.usernameKey), {
          uid: user.uid || auth.currentUser.uid,
          usernameKey: user.usernameKey,
          name: user.name || user.usernameKey,
          phone: user.phone || '',
          email: user.email || auth.currentUser.email || '',
          contactEmail: user.contactEmail || '',
          lastLoginMs: Date.now(),
          lastLoginAt: serverTimestamp(),
          loginCount: increment(1)
        }, { merge: true });
      } catch (error) {
        // Login history should not block access if Firestore is temporarily unavailable.
      }
    }

    async function updatePresence(online) {
      if (!firebaseReady || !currentUser || !currentUser.usernameKey) {
        return;
      }

      try {
        await setDoc(doc(db, 'users', currentUser.usernameKey), {
          uid: currentUser.uid,
          usernameKey: currentUser.usernameKey,
          name: currentUser.name || currentUser.usernameKey,
          phone: currentUser.phone || '',
          online,
          lastSeenMs: Date.now(),
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (error) {
        // Presence is optional; keep the main login flow working if rules block it.
      }
    }

    function startPresenceHeartbeat() {
      if (presenceHeartbeatTimer) {
        clearInterval(presenceHeartbeatTimer);
      }

      updatePresence(true);
      presenceHeartbeatTimer = setInterval(function () {
        updatePresence(true);
      }, 30000);
    }

    function stopPresenceHeartbeat() {
      if (presenceHeartbeatTimer) {
        clearInterval(presenceHeartbeatTimer);
        presenceHeartbeatTimer = null;
      }
    }

    function buildGuestNameFromIp(ipAddress) {
      return ipAddress ? `Guest(${ipAddress})` : 'Guest(unknown IP)';
    }

    async function resolveVisitorIpAddress() {
      if (visitorIpAddress) {
        return visitorIpAddress;
      }

      if (!visitorIpPromise) {
        visitorIpPromise = fetch('https://api.ipify.org?format=json', { cache: 'no-store' })
          .then(function (response) {
            if (!response.ok) {
              throw new Error('IP lookup failed');
            }

            return response.json();
          })
          .then(function (data) {
            visitorIpAddress = typeof data.ip === 'string' && /^\d{1,3}(\.\d{1,3}){3}$/.test(data.ip) ? data.ip : '';

            if (visitorIpAddress) {
              sessionStorage.setItem('azobssVisitorIpv4Address', visitorIpAddress);
            }

            return visitorIpAddress;
          })
          .catch(function () {
            return '';
          });
      }

      return visitorIpPromise;
    }

    function getGuestName(ipAddress) {
      const guestName = buildGuestNameFromIp(ipAddress);
      sessionStorage.setItem('azobssGuestName', guestName);
      return guestName;
    }

    function getGuestFirstSeenMs() {
      let firstSeenMs = Number(sessionStorage.getItem('azobssGuestFirstSeenMs'));

      if (!firstSeenMs) {
        firstSeenMs = Date.now();
        sessionStorage.setItem('azobssGuestFirstSeenMs', String(firstSeenMs));
      }

      return firstSeenMs;
    }

    function getGuestDisplayName(data) {
      return buildGuestNameFromIp(data.ipAddress || '');
    }

    async function updateVisitorPresence(online) {
      if (!firebaseReady || !authStateReady) {
        return;
      }

      const visitorId = getVisitorId();
      const isSignedInVisitor = Boolean(currentUser);
      const ipAddress = isSignedInVisitor ? '' : await resolveVisitorIpAddress();
      const guestName = isSignedInVisitor ? '' : getGuestName(ipAddress);
      const lastSeenMs = Date.now();

      try {
        await setDoc(doc(db, 'sitePresence', visitorId), {
          visitorId,
          online,
          type: isSignedInVisitor ? 'user' : 'guest',
          usernameKey: isSignedInVisitor ? currentUser.usernameKey : '',
          name: isSignedInVisitor ? currentUser.name : guestName,
          guestName,
          ipAddress: isSignedInVisitor ? '' : ipAddress,
          firstSeenMs: isSignedInVisitor ? null : getGuestFirstSeenMs(),
          lastSeenMs,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (error) {
        // Visitor presence is optional; keep the website usable if rules block it.
      }
    }

    function startVisitorPresenceHeartbeat() {
      if (!authStateReady) {
        return;
      }

      if (visitorPresenceTimer) {
        clearInterval(visitorPresenceTimer);
      }

      updateVisitorPresence(true);
      visitorPresenceTimer = setInterval(function () {
        updateVisitorPresence(true);
      }, 30000);
    }

    function setAdminOnlineSummaryVisible(visible) {
      if (!adminOnlineSummary) {
        return;
      }

      adminOnlineSummary.hidden = !visible;
      adminOnlineSummary.classList.toggle('is-visible', visible);
    }

    function startGuestOnlineListener() {
      if (!firebaseReady || !auth.currentUser || !isAdminUser(currentUser) || guestOnlineUnsubscribe) {
        return;
      }

      setAdminOnlineSummaryVisible(true);

      guestOnlineUnsubscribe = onSnapshot(collection(db, 'sitePresence'), function (snapshot) {
        const now = Date.now();
        let guests = 0;
        const onlineUsers = new Set();
        const guestHistory = [];

        snapshot.forEach(function (item) {
          const data = item.data();
          const visitorId = data.visitorId || item.id;
          const isActive = data.online === true && data.lastSeenMs && now - data.lastSeenMs <= 90000;

          if (data.type === 'guest') {
            if (isActive) {
              guests += 1;
            }

            guestHistory.push({
              visitorId,
              guestName: getGuestDisplayName(data, visitorId),
              firstSeenMs: data.firstSeenMs || data.lastSeenMs || 0,
              lastSeenMs: data.lastSeenMs || 0,
              isActive
            });
          }

          if (data.type === 'user' && isActive) {
            onlineUsers.add(data.usernameKey || data.visitorId || item.id);
          }
        });

        onlineGuestCount.textContent = guests;
        onlineUserCount.textContent = onlineUsers.size;
        renderGuestHistory(guestHistory);
      }, function () {
        onlineGuestCount.textContent = '0';
        onlineUserCount.textContent = '0';
        renderGuestHistory([]);
      });
    }

    function stopGuestOnlineListener() {
      if (guestOnlineUnsubscribe) {
        guestOnlineUnsubscribe();
        guestOnlineUnsubscribe = null;
      }

      onlineGuestCount.textContent = '0';
      onlineUserCount.textContent = '0';
      renderGuestHistory([]);
      setAdminOnlineSummaryVisible(false);
    }

    async function recordPurchaseItem(item) {
      if (!currentUser) {
        openSiteAuth('signin');
        throw new Error('Please log in before downloading.');
      }

      const productType = String(item.productType || 'PA').toUpperCase();
      const itemCode = String(item.itemCode || item.paNumber || item.stationNo || '').trim();
      const selectedNegeri = item.negeri || item.selectedNegeri || '';
      const amount = Number(item.amount || (productType === 'PA' ? PURCHASE_PRICE : BM_SBM_PURCHASE_PRICE));
      const purchaseId = `${Date.now()}-${currentUser.usernameKey}-${productType}-${itemCode || 'item'}`;
      const summaryRef = doc(db, 'purchaseSummaries', currentUser.usernameKey);
      const logRef = doc(db, 'purchaseLogs', purchaseId);
      const purchaseLog = {
        purchaseId,
        uid: currentUser.uid,
        usernameKey: currentUser.usernameKey,
        name: currentUser.name,
        phone: currentUser.phone || '',
        productType,
        itemCode,
        paNumber: productType === 'PA' ? itemCode : '',
        stationNo: productType === 'BM' || productType === 'SBM' ? itemCode : '',
        negeri: selectedNegeri,
        daerah: item.daerah || '',
        bandar: item.bandar || '',
        amount,
        url: item.url || item.downloadUrl || '',
        deleted: false,
        createdAt: serverTimestamp()
      };

      await setDoc(logRef, purchaseLog);

      try {
        await runTransaction(db, async function (transaction) {
          const summarySnapshot = await transaction.get(summaryRef);
          const currentSummary = summarySnapshot.exists() ? summarySnapshot.data() : {};
          const totalUnits = Number(currentSummary.totalUnits || 0) + 1;
          const totalAmount = Number(currentSummary.totalAmount || 0) + amount;

          transaction.set(summaryRef, {
            uid: currentUser.uid,
            usernameKey: currentUser.usernameKey,
            name: currentUser.name,
            phone: currentUser.phone || '',
            totalUnits,
            totalAmount,
            lastPa: productType === 'PA' ? itemCode : '',
            lastItemText: getPurchaseItemText(purchaseLog),
            lastNegeri: selectedNegeri,
            deleted: false,
            deletedAt: null,
            deletedBy: null,
            updatedAt: serverTimestamp()
          }, { merge: true });
        });
      } catch (error) {
        // purchaseLogs is the source of truth; summary is only a fast admin cache.
      }

      await loadPurchaseRecords();
    }

    async function recordPurchase(paValue, selectedNegeri, url) {
      return recordPurchaseItem({ productType: 'PA', itemCode: paValue, negeri: selectedNegeri, url, amount: PURCHASE_PRICE });
    }

    window.azobssRecordPurchase = recordPurchaseItem;

    function closeSignupAccess() {
      showSignupButton.hidden = true;
      signupFields.hidden = true;
      showSignupButton.style.display = 'none';
      signupFields.style.display = 'none';
      signupGateNotice.style.display = 'none';
      signupGateNotice.textContent = '';
    }

    function clearSignupGateTimer() {
      if (signupGateTimer) {
        clearTimeout(signupGateTimer);
        signupGateTimer = null;
      }
    }

    function showGlobalSignupAccess(message = '') {
      if (isLoggedIn && !isAdminUser(currentUser)) {
        return;
      }

      showSignupButton.hidden = true;
      signupFields.hidden = false;
      showSignupButton.style.display = 'none';
      signupFields.style.display = 'block';

      if (message) {
        signupGateNotice.style.display = 'block';
        signupGateNotice.textContent = message;
      }
    }

    function formatSignupGateTime(remainingMs) {
      const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;

      if (minutes > 0 && seconds > 0) {
        return `${minutes} minit ${seconds} saat`;
      }

      if (minutes > 0) {
        return `${minutes} minit`;
      }

      return `${seconds} saat`;
    }

    function updateSignupGateCountdown(remainingMs) {
      signupGateNotice.style.display = 'block';
      signupGateNotice.textContent = `Signup is open for 1 user only. Auto closes in ${formatSignupGateTime(remainingMs)}.`;
    }

    async function closeExpiredSignupGate() {
      try {
        await setDoc(signupGateRef, {
          open: false,
          closedReason: 'expired',
          closedAt: serverTimestamp()
        }, { merge: true });
      } catch (error) {
        signupGateNotice.style.display = 'block';
        signupGateNotice.textContent = `Failed to close expired signup: ${error.code || error.message}`;
      }
    }

    async function openSignupAccess() {
      const expiresAtMs = Date.now() + SIGNUP_GATE_DURATION_MS;

      await setDoc(signupGateRef, {
        open: true,
        openedAt: serverTimestamp(),
        expiresAtMs,
        openedBy: 'admin',
        mode: 'one-time'
      }, { merge: true });

      showGlobalSignupAccess('Online signup is open for 1 registration only. Auto closes in 5 minutes.');
      showAccessToast('Online signup is open for 1 registration only.');
    }

    function restoreSignupAccess() {
      closeSignupAccess();
    }

    async function claimSignupAccess(usernameKey) {
      await runTransaction(db, async function (transaction) {
        const gateSnapshot = await transaction.get(signupGateRef);
        const gateData = gateSnapshot.exists() ? gateSnapshot.data() : {};
        const expiresAtMs = Number(gateData.expiresAtMs || 0);

        if (gateData.open !== true || (expiresAtMs && expiresAtMs <= Date.now())) {
          throw new Error('signup-gate-closed');
        }

        transaction.set(signupGateRef, {
          open: false,
          claimedBy: usernameKey,
          claimedAt: serverTimestamp(),
          mode: 'one-time'
        }, { merge: true });
      });
    }

    if (firebaseReady) {
      onSnapshot(signupGateRef, function (snapshot) {
        const gateData = snapshot.exists() ? snapshot.data() : {};
        const expiresAtMs = Number(gateData.expiresAtMs || 0);
        const remainingMs = expiresAtMs - Date.now();

        clearSignupGateTimer();
        signupGateOpen = gateData.open === true && remainingMs > 0;

        if (signupGateOpen) {
          if (isLoggedIn && !isAdminUser(currentUser)) {
            signupFields.hidden = true;
            signupFields.style.display = 'none';
            signupGateNotice.style.display = 'none';
            signupGateNotice.textContent = '';
          } else {
            showGlobalSignupAccess();
            updateSignupGateCountdown(remainingMs);
          }

          signupGateTimer = setInterval(function () {
            const nextRemainingMs = expiresAtMs - Date.now();

            if (nextRemainingMs <= 0) {
              clearSignupGateTimer();
              closeExpiredSignupGate();

              if (!isAdminUser(currentUser)) {
                closeSignupAccess();
              } else {
                signupGateNotice.style.display = 'block';
                signupGateNotice.textContent = 'Signup time has expired. Click Open Signup Once to reopen.';
              }

              return;
            }

            if (!(isLoggedIn && !isAdminUser(currentUser))) {
              updateSignupGateCountdown(nextRemainingMs);
            }
          }, 1000);
        } else if (gateData.open === true && expiresAtMs && remainingMs <= 0) {
          closeExpiredSignupGate();
          if (!isAdminUser(currentUser)) {
            closeSignupAccess();
          } else {
            signupGateNotice.style.display = 'block';
            signupGateNotice.textContent = 'Signup time has expired. Click Open Signup Once to reopen.';
          }
        } else if (!isLoggedIn) {
          closeSignupAccess();
        } else if (isAdminUser(currentUser)) {
          signupGateNotice.style.display = 'block';
          signupGateNotice.textContent = 'Signup is not open yet. Click Open Signup Once to open registration.';
        }
      }, function () {
        signupGateNotice.style.display = 'block';
        signupGateNotice.textContent = 'Online signup gate cannot be read yet. Check Firestore Rules for settings/signupGate.';
      });
    }



    function buildFullPhone(countryCode, phoneValue) {
      const codeMatch = String(countryCode || 'Malaysia +60').match(/\+\d+(?:-\d+)?/);
      const cleanCode = codeMatch ? codeMatch[0] : '+60';
      const cleanPhone = String(phoneValue || '').replace(/[^0-9]/g, '').replace(/^0+/, '');
      return cleanPhone ? `${cleanCode}${cleanPhone}` : '';
    }
    const countryIsoMap = {
      'Afghanistan': 'AF', 'Aland Islands': 'AX', 'Albania': 'AL', 'Algeria': 'DZ', 'American Samoa': 'AS', 'Andorra': 'AD', 'Angola': 'AO', 'Anguilla': 'AI', 'Antigua and Barbuda': 'AG', 'Argentina': 'AR', 'Armenia': 'AM', 'Aruba': 'AW', 'Australia': 'AU', 'Austria': 'AT', 'Azerbaijan': 'AZ',
      'Bahamas': 'BS', 'Bahrain': 'BH', 'Bangladesh': 'BD', 'Barbados': 'BB', 'Belarus': 'BY', 'Belgium': 'BE', 'Belize': 'BZ', 'Benin': 'BJ', 'Bermuda': 'BM', 'Bhutan': 'BT', 'Bolivia': 'BO', 'Bosnia and Herzegovina': 'BA', 'Botswana': 'BW', 'Brazil': 'BR', 'British Virgin Islands': 'VG', 'Brunei': 'BN', 'Bulgaria': 'BG', 'Burkina Faso': 'BF', 'Burundi': 'BI',
      'Cambodia': 'KH', 'Cameroon': 'CM', 'Canada': 'CA', 'Cape Verde': 'CV', 'Cayman Islands': 'KY', 'Central African Republic': 'CF', 'Chad': 'TD', 'Chile': 'CL', 'China': 'CN', 'Colombia': 'CO', 'Comoros': 'KM', 'Congo': 'CG', 'Costa Rica': 'CR', 'Croatia': 'HR', 'Cuba': 'CU', 'Cyprus': 'CY', 'Czech Republic': 'CZ',
      'Denmark': 'DK', 'Djibouti': 'DJ', 'Dominica': 'DM', 'Dominican Republic': 'DO', 'Ecuador': 'EC', 'Egypt': 'EG', 'El Salvador': 'SV', 'Equatorial Guinea': 'GQ', 'Eritrea': 'ER', 'Estonia': 'EE', 'Eswatini': 'SZ', 'Ethiopia': 'ET',
      'Fiji': 'FJ', 'Finland': 'FI', 'France': 'FR', 'French Guiana': 'GF', 'French Polynesia': 'PF', 'Gabon': 'GA', 'Gambia': 'GM', 'Georgia': 'GE', 'Germany': 'DE', 'Ghana': 'GH', 'Gibraltar': 'GI', 'Greece': 'GR', 'Greenland': 'GL', 'Grenada': 'GD', 'Guam': 'GU', 'Guatemala': 'GT', 'Guernsey': 'GG', 'Guinea': 'GN', 'Guinea-Bissau': 'GW', 'Guyana': 'GY',
      'Haiti': 'HT', 'Honduras': 'HN', 'Hong Kong': 'HK', 'Hungary': 'HU', 'Iceland': 'IS', 'India': 'IN', 'Indonesia': 'ID', 'Iran': 'IR', 'Iraq': 'IQ', 'Ireland': 'IE', 'Isle of Man': 'IM', 'Israel': 'IL', 'Italy': 'IT', 'Ivory Coast': 'CI',
      'Jamaica': 'JM', 'Japan': 'JP', 'Jersey': 'JE', 'Jordan': 'JO', 'Kazakhstan': 'KZ', 'Kenya': 'KE', 'Kiribati': 'KI', 'Kosovo': 'XK', 'Kuwait': 'KW', 'Kyrgyzstan': 'KG', 'Laos': 'LA', 'Latvia': 'LV', 'Lebanon': 'LB', 'Lesotho': 'LS', 'Liberia': 'LR', 'Libya': 'LY', 'Liechtenstein': 'LI', 'Lithuania': 'LT', 'Luxembourg': 'LU',
      'Macau': 'MO', 'Madagascar': 'MG', 'Malawi': 'MW', 'Malaysia': 'MY', 'Maldives': 'MV', 'Mali': 'ML', 'Malta': 'MT', 'Marshall Islands': 'MH', 'Mauritania': 'MR', 'Mauritius': 'MU', 'Mexico': 'MX', 'Micronesia': 'FM', 'Moldova': 'MD', 'Monaco': 'MC', 'Mongolia': 'MN', 'Montenegro': 'ME', 'Montserrat': 'MS', 'Morocco': 'MA', 'Mozambique': 'MZ', 'Myanmar': 'MM',
      'Namibia': 'NA', 'Nauru': 'NR', 'Nepal': 'NP', 'Netherlands': 'NL', 'New Caledonia': 'NC', 'New Zealand': 'NZ', 'Nicaragua': 'NI', 'Niger': 'NE', 'Nigeria': 'NG', 'North Korea': 'KP', 'North Macedonia': 'MK', 'Northern Mariana Islands': 'MP', 'Norway': 'NO',
      'Oman': 'OM', 'Pakistan': 'PK', 'Palau': 'PW', 'Palestine': 'PS', 'Panama': 'PA', 'Papua New Guinea': 'PG', 'Paraguay': 'PY', 'Peru': 'PE', 'Philippines': 'PH', 'Poland': 'PL', 'Portugal': 'PT', 'Puerto Rico': 'PR', 'Qatar': 'QA',
      'Romania': 'RO', 'Russia': 'RU', 'Rwanda': 'RW', 'Saint Kitts and Nevis': 'KN', 'Saint Lucia': 'LC', 'Saint Vincent and the Grenadines': 'VC', 'Samoa': 'WS', 'San Marino': 'SM', 'Sao Tome and Principe': 'ST', 'Saudi Arabia': 'SA', 'Senegal': 'SN', 'Serbia': 'RS', 'Seychelles': 'SC', 'Sierra Leone': 'SL', 'Singapore': 'SG', 'Slovakia': 'SK', 'Slovenia': 'SI', 'Solomon Islands': 'SB', 'Somalia': 'SO', 'South Africa': 'ZA', 'South Korea': 'KR', 'South Sudan': 'SS', 'Spain': 'ES', 'Sri Lanka': 'LK', 'Sudan': 'SD', 'Suriname': 'SR', 'Sweden': 'SE', 'Switzerland': 'CH', 'Syria': 'SY',
      'Taiwan': 'TW', 'Tajikistan': 'TJ', 'Tanzania': 'TZ', 'Thailand': 'TH', 'Timor-Leste': 'TL', 'Togo': 'TG', 'Tonga': 'TO', 'Trinidad and Tobago': 'TT', 'Tunisia': 'TN', 'Turkey': 'TR', 'Turkmenistan': 'TM', 'Turks and Caicos Islands': 'TC', 'Tuvalu': 'TV',
      'Antarctica': 'AQ', 'Uganda': 'UG', 'Ukraine': 'UA', 'United Arab Emirates': 'AE', 'United Kingdom': 'GB', 'United States': 'US', 'Uruguay': 'UY', 'Uzbekistan': 'UZ', 'Vanuatu': 'VU', 'Vatican City': 'VA', 'Venezuela': 'VE', 'Vietnam': 'VN', 'Yemen': 'YE', 'Zambia': 'ZM', 'Zimbabwe': 'ZW'
    };

    function isoToFlag(isoCode) {
      if (!isoCode) return 'UN';
      return isoCode.toUpperCase().replace(/./g, function (char) {
        return String.fromCodePoint(127397 + char.charCodeAt(0));
      });
    }

    const countryDialOptions = Array.from(document.querySelectorAll('#countryDialCodeOptions option'))
      .map(function (option) {
        const value = option.value;
        const match = value.match(/^(.+)\s(\+\d+(?:-\d+)?)$/);
        const name = match ? match[1] : value;
        const dial = match ? match[2] : '';
        return {
          name,
          dial,
          value,
          flag: isoToFlag(countryIsoMap[name])
        };
      })
      .filter(function (item) { return item.value; });

    function closeCountryMenus() {
      document.querySelectorAll('.country-code-menu.is-open').forEach(function (menu) {
        menu.classList.remove('is-open');
      });
      document.querySelectorAll('.country-code-button[aria-expanded="true"]').forEach(function (button) {
        button.setAttribute('aria-expanded', 'false');
      });
    }

    function getSelectedCountry(selectedValue) {
      return countryDialOptions.find(function (item) { return item.value === selectedValue; }) || countryDialOptions.find(function (item) { return item.name === 'Malaysia'; });
    }

    function updateCountryButton(button, selectedValue) {
      if (!button) return;
      const selected = getSelectedCountry(selectedValue);
      button.innerHTML = `<span class="country-flag">${selected.flag}</span><span>${selected.dial}</span>`;
    }

    function updatePhonePrefix(prefixElement, selectedValue) {
      if (!prefixElement) return;
      const selected = getSelectedCountry(selectedValue);
      prefixElement.textContent = selected.dial;
    }

    function renderCountryOptions(hiddenInput, optionsWrap, button, prefixElement, searchValue) {
      const rawQuery = String(searchValue || '').toLowerCase().trim();
      const numericQuery = rawQuery.replace(/[^0-9+\-]/g, '');
      const matches = countryDialOptions
        .filter(function (item) {
          const countryName = item.name.toLowerCase();
          return !rawQuery || countryName.startsWith(rawQuery) || countryName.includes(rawQuery) || (numericQuery && item.dial.includes(numericQuery));
        });

      optionsWrap.innerHTML = '';
      matches.forEach(function (item) {
        const optionButton = document.createElement('button');
        optionButton.type = 'button';
        optionButton.className = 'country-code-option';
        optionButton.innerHTML = `<span>${item.flag}</span><span>${item.name}</span><span class="country-option-dial">${item.dial}</span>`;
        optionButton.addEventListener('mousedown', function (event) {
          event.preventDefault();
          hiddenInput.value = item.value;
          updateCountryButton(button, item.value);
          updatePhonePrefix(prefixElement, item.value);
          closeCountryMenus();
        });
        optionsWrap.appendChild(optionButton);
      });

      if (!matches.length) {
        const emptyButton = document.createElement('button');
        emptyButton.type = 'button';
        emptyButton.className = 'country-code-option';
        emptyButton.textContent = 'No country found';
        emptyButton.disabled = true;
        optionsWrap.appendChild(emptyButton);
      }
    }

    function renderCountryMenu(hiddenInput, menu, button, prefixElement, searchValue) {
      menu.innerHTML = '';

      const searchInput = document.createElement('input');
      searchInput.className = 'country-menu-search';
      searchInput.type = 'search';
      searchInput.placeholder = 'Search country...';
      searchInput.value = searchValue || '';
      menu.appendChild(searchInput);

      const optionsWrap = document.createElement('div');
      optionsWrap.className = 'country-menu-options';
      menu.appendChild(optionsWrap);

      renderCountryOptions(hiddenInput, optionsWrap, button, prefixElement, searchInput.value);

      searchInput.addEventListener('input', function () {
        renderCountryOptions(hiddenInput, optionsWrap, button, prefixElement, searchInput.value);
      });

      menu.classList.add('is-open');
      button.setAttribute('aria-expanded', 'true');
      setTimeout(function () { searchInput.focus(); }, 0);
    }
    function setupCountrySearch(hiddenInput, menu, button, prefixElement) {
      if (!hiddenInput || !menu || !button) return;
      updateCountryButton(button, hiddenInput.value);
      updatePhonePrefix(prefixElement, hiddenInput.value);

      button.addEventListener('click', function () {
        const isOpen = menu.classList.contains('is-open');
        closeCountryMenus();
        if (!isOpen) {
          renderCountryMenu(hiddenInput, menu, button, prefixElement, '');
        }
      });

      hiddenInput.addEventListener('change', function () {
        updateCountryButton(button, hiddenInput.value);
        updatePhonePrefix(prefixElement, hiddenInput.value);
      });
    }

    function setCountryValue(input, button, prefixElement, value) {
      if (!input) return;
      input.value = value;
      updateCountryButton(button, value);
      updatePhonePrefix(prefixElement, value);
    }
    setupCountrySearch(siteSignupCountrySearch, siteSignupCountryMenu, siteSignupCountryButton, siteSignupPhonePrefix);
    setupCountrySearch(signupCountrySearch, signupCountryMenu, signupCountryButton, signupPhonePrefix);

    document.addEventListener('click', function (event) {
      if (!event.target.closest('.country-combo')) {
        closeCountryMenus();
      }
    });

    if (siteSignupInviteCode) siteSignupInviteCode.value = getInitialInviteCode();
    if (signupInviteCode) signupInviteCode.value = getInitialInviteCode();
    updateLuckyDrawPanel();

    function isValidEmail(value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }

    function clearSiteAuthInputs() {
      siteSignInForm.reset();
      siteSignUpForm.reset();
      siteLoginError.textContent = '';
      siteSignupError.textContent = '';
      memberUpgradeStatus.textContent = '';
      memberUpgradeCode.value = '';
      if (siteSignupInviteCode) siteSignupInviteCode.value = getInitialInviteCode();
      setCountryValue(siteSignupCountrySearch, siteSignupCountryButton, siteSignupPhonePrefix, 'Malaysia +60');
      closeCountryMenus();
    }

    function setButtonLoading(button, isLoading, loadingText, defaultText) {
      if (!button) {
        return;
      }

      button.disabled = isLoading;
      button.setAttribute('aria-busy', isLoading ? 'true' : 'false');
      button.innerHTML = isLoading
        ? `<span class="button-loading-spinner" aria-hidden="true"></span><span>${loadingText}</span>`
        : defaultText;
    }

    function openSiteAuth(mode = 'signin') {
      const isSignup = mode === 'signup' || mode === 'upgrade';
      siteAuthTitle.textContent = isSignup ? 'Sign up' : 'Sign in';
      siteSignInForm.hidden = isSignup;
      siteSignUpForm.hidden = !isSignup;
      siteLoginError.textContent = '';
      siteSignupError.textContent = '';
      memberUpgradeStatus.textContent = '';
      memberUpgradeCode.value = '';
      memberUpgradeWrap.hidden = mode !== 'upgrade' || !isLoggedIn;
      memberUpgradeWrap.style.display = mode === 'upgrade' && isLoggedIn ? 'grid' : 'none';
      siteAuthModal.classList.add('is-open');
      siteAuthModal.setAttribute('aria-hidden', 'false');

      setTimeout(function () {
        (mode === 'upgrade' && isLoggedIn ? memberUpgradeCode : (isSignup ? siteSignupName : siteLoginName)).focus();
      }, 50);
    }

    function closeSiteAuth() {
      siteAuthModal.classList.remove('is-open');
      siteAuthModal.setAttribute('aria-hidden', 'true');
      clearSiteAuthInputs();
    }

    async function signInSiteUser(name, password, errorElement) {
      const usernameKey = normalizeUsername(name);
      let authSignInStarted = false;

      if (!name || !password) {
        errorElement.textContent = 'Please enter username and password.';
        return;
      }

      if (!firebaseReady) {
        errorElement.textContent = 'Firebase belum disambungkan.';
        return;
      }

      if (!usernameKey) {
        errorElement.textContent = 'Username can only contain letters, numbers or underscores.';
        return;
      }

      try {
        stopAuthRestoreListener();
        await ensureAuthSessionPersistence();
        const credential = await signInWithEmailAndPassword(auth, buildUserEmail(usernameKey), password);
        authSignInStarted = true;
        const userRef = doc(db, 'users', usernameKey);
        const userSnap = await getDoc(userRef);
        const profile = userSnap.exists() ? userSnap.data() : {
          uid: credential.user.uid,
          name,
          usernameKey,
          phone: '',
          email: credential.user.email,
          contactEmail: '',
          paAccess: true,
          inviteCode: buildInviteCode(usernameKey),
          invitedByCode: '',
          invitedByUsernameKey: ''
        };

        if (profile.deleted) {
          await signOut(auth);
          errorElement.textContent = 'This account has been removed by admin.';
          return;
        }

        const user = {
          uid: profile.uid || credential.user.uid,
          name: profile.name,
          usernameKey: profile.usernameKey,
          phone: profile.phone || '',
          email: profile.email || credential.user.email,
          contactEmail: profile.contactEmail || '',
          paAccess: profile.paAccess !== false,
          inviteCode: profile.inviteCode || buildInviteCode(profile.usernameKey || usernameKey),
          invitedByCode: profile.invitedByCode || '',
          invitedByUsernameKey: profile.invitedByUsernameKey || ''
        };

        saveCurrentUser(user);
        sessionStorage.setItem('azobssLoggedIn', '1');
        await recordLoginHistory(user);
        errorElement.textContent = '';
        closeSiteAuth();
        setLoggedIn(user, `Login successful. Welcome, ${user.name}.`);
      } catch (error) {
        if (authSignInStarted) {
          await cleanupPartialAuthSession();
        }

        errorElement.textContent = 'Username or password is incorrect. Please try again.';
      }
    }

    async function upgradeCurrentUserWithMemberCode() {
      const code = memberUpgradeCode.value.trim();

      if (!isLoggedIn || !currentUser) {
        memberUpgradeStatus.textContent = 'Please sign in before upgrading.';
        return;
      }

      if (isAdminUser(currentUser) || currentUser.paAccess !== false) {
        memberUpgradeStatus.textContent = 'This account already has Request PA access.';
        return;
      }

      if (code !== 'zx6186') {
        memberUpgradeStatus.textContent = 'Incorrect Member Code.';
        return;
      }

      if (!firebaseReady) {
        memberUpgradeStatus.textContent = 'Firebase belum disambungkan.';
        return;
      }

      try {
        memberUpgradeButton.disabled = true;
        memberUpgradeStatus.textContent = 'Sedang upgrade...';
        await setDoc(doc(db, 'users', currentUser.usernameKey), {
          paAccess: true,
          upgradedAt: serverTimestamp(),
          upgradedBy: 'member-code'
        }, { merge: true });

        const upgradedUser = {
          ...currentUser,
          paAccess: true
        };

        saveCurrentUser(upgradedUser);
        setLoggedIn(upgradedUser, `Upgrade successful. Welcome, ${upgradedUser.name}.`);
        memberUpgradeStatus.textContent = '';
      } catch (error) {
        memberUpgradeStatus.textContent = `Upgrade failed: ${error.code || error.message}`;
      } finally {
        memberUpgradeButton.disabled = false;
      }
    }

    async function createOrReactivateUserProfile(options) {
      const userRef = doc(db, 'users', options.usernameKey);
      const email = buildUserEmail(options.usernameKey);
      let credential;
      let existingData = null;
      let isReactivation = false;
      let isNewAuthUser = false;

      stopAuthRestoreListener();
      await ensureAuthSessionPersistence();

      try {
        credential = await createUserWithEmailAndPassword(auth, email, options.password);
        isNewAuthUser = true;
      } catch (error) {
        if (error.code !== 'auth/email-already-in-use') {
          throw error;
        }

        credential = await signInWithEmailAndPassword(auth, email, options.password);

        const existingSnapshot = await getDoc(userRef);
        existingData = existingSnapshot.exists() ? existingSnapshot.data() : null;

        if (existingData && !existingData.deleted) {
          await signOut(auth);
          const activeError = new Error('username-active');
          activeError.code = 'username-active';
          throw activeError;
        }

        isReactivation = true;
      }

      const cleanInvitedByCode = cleanInviteCode(options.inviteCode);
      const inviter = await resolveInviterByCode(cleanInvitedByCode, options.usernameKey);
      const userInviteCode = existingData && existingData.inviteCode ? existingData.inviteCode : buildInviteCode(options.usernameKey);
      const user = {
        uid: credential.user.uid,
        name: options.name,
        usernameKey: options.usernameKey,
        phone: options.phone,
        email,
        contactEmail: options.contactEmail,
        paAccess: options.paAccess,
        inviteCode: userInviteCode,
        invitedByCode: cleanInvitedByCode,
        invitedByUsernameKey: inviter ? inviter.usernameKey : ''
      };

      const profileData = {
        uid: user.uid,
        name: user.name,
        usernameKey: user.usernameKey,
        phone: user.phone,
        email: user.email,
        contactEmail: user.contactEmail,
        paAccess: user.paAccess,
        inviteCode: user.inviteCode,
        invitedByCode: user.invitedByCode,
        invitedByUsernameKey: user.invitedByUsernameKey,
        deleted: false,
        deletedAt: null,
        deletedBy: null,
        updatedAt: serverTimestamp()
      };

      if (isReactivation) {
        profileData.reactivatedAt = serverTimestamp();
        profileData.createdAt = existingData && existingData.createdAt ? existingData.createdAt : serverTimestamp();
      } else {
        profileData.createdAt = serverTimestamp();
      }

      try {
        await setDoc(userRef, profileData, { merge: true });
        await recordInviteProof(inviter, user, cleanInvitedByCode);
      } catch (error) {
        if (isNewAuthUser && credential && credential.user) {
          try {
            await deleteUser(credential.user);
          } catch (deleteError) {
            await cleanupPartialAuthSession();
          }
        } else {
          await cleanupPartialAuthSession();
        }

        throw error;
      }

      return user;
    }
    async function signUpSiteUser() {
      const name = siteSignupName.value.trim();
      const password = siteSignupPassword.value.trim();
      const phone = buildFullPhone(siteSignupCountrySearch.value, siteSignupPhone.value);
      const contactEmail = siteSignupEmail.value.trim();
      const inviteCode = cleanInviteCode(siteSignupInviteCode ? siteSignupInviteCode.value : getInitialInviteCode());
      const usernameKey = normalizeUsername(name);

      if (!name || !password || !phone || !contactEmail) {
        siteSignupError.textContent = 'Please enter username, password, phone number and email.';
        return;
      }

      if (!isValidEmail(contactEmail)) {
        siteSignupError.textContent = 'Please enter a valid email address.';
        return;
      }

      if (!firebaseReady) {
        siteSignupError.textContent = 'Firebase belum disambungkan.';
        return;
      }

      if (!usernameKey) {
        siteSignupError.textContent = 'Username can only contain letters, numbers or underscores.';
        return;
      }

      if (password.length < 6) {
        siteSignupError.textContent = 'Password mesti sekurang-kurangnya 6 aksara.';
        return;
      }

      try {
        const user = await createOrReactivateUserProfile({
          name,
          usernameKey,
          phone,
          contactEmail,
          inviteCode,
          password,
          paAccess: false
        });

        saveCurrentUser(user);
        sessionStorage.setItem('azobssLoggedIn', '1');
        await recordLoginHistory(user);
        siteSignupError.textContent = '';
        closeSiteAuth();
        setLoggedIn(user, `Signup successful. Welcome, ${user.name}.`);
      } catch (error) {
        if (error.code === 'username-active') {
          siteSignupError.textContent = 'This username is already registered. Please sign in.';
        } else if (error.code === 'auth/email-already-in-use') {
          siteSignupError.textContent = 'This username was deleted before, but Firebase Auth still exists. Use the previous password or choose another username.';
        } else if (error.code === 'auth/weak-password') {
          siteSignupError.textContent = 'Password is too short. Use at least 6 characters.';
        } else if (error.code === 'auth/operation-not-allowed') {
          siteSignupError.textContent = 'Email/Password belum diaktifkan dalam Firebase Authentication.';
        } else if (error.code === 'permission-denied') {
          siteSignupError.textContent = 'Firestore rules belum membenarkan simpan data user.';
        } else {
          siteSignupError.textContent = `Signup failed: ${error.code || error.message}`;
        }
      }
    }
    function setLoggedIn(user, toastMessage = '') {
      isLoggedIn = true;
      currentUser = user;
      loginForm.hidden = true;
      showSignupButton.hidden = true;
      signupFields.hidden = true;
      loginForm.style.display = 'none';
      requestCard.classList.add('is-authenticated');
      showSignupButton.style.display = 'none';
      signupFields.style.display = 'none';
      signupName.value = '';
      signupPhone.value = '';
      setCountryValue(signupCountrySearch, signupCountryButton, signupPhonePrefix, 'Malaysia +60');
      signupEmail.value = '';
      signupPassword.value = '';
      loginName.value = '';
      loginPassword.value = '';
      signupError.textContent = '';
      loginError.textContent = '';
      const hasPaAccess = isAdminUser(user) || user.paAccess !== false;
      requestCard.classList.toggle('has-pa-access', hasPaAccess);
      requestSection.classList.toggle('is-visible', hasPaAccess);
      heroRequestButton.classList.toggle('is-visible', hasPaAccess);
      paForm.hidden = !hasPaAccess;

      loginInfo.style.display = 'none';
      loginInfo.textContent = '';

      showSignedInUser(user);
      updateReceiptWhatsappLink(user);
      updateLuckyDrawPanel();
      authStateReady = true;
      startPresenceHeartbeat();
      startVisitorPresenceHeartbeat();
      updateVisitorPresence(true);

      if (isAdminUser(user)) {
        requestCard.classList.add('is-admin');
        signupForm.hidden = false;
        signupForm.style.display = 'grid';
        signupFields.hidden = false;
        signupFields.style.display = 'block';
        signupGateNotice.style.display = 'block';
        signupGateNotice.textContent = signupGateOpen
          ? 'Signup is open for 1 user only.'
          : 'Signup is not open yet. Click Open Signup Once to open registration.';
        loadRegisteredUsers();
        startLiveUsersListener();
        startGuestOnlineListener();
      } else {
        requestCard.classList.remove('is-admin');
        signupForm.hidden = false;
        signupForm.style.display = 'grid';
        signupFields.hidden = true;
        signupFields.style.display = 'none';
        signupGateNotice.style.display = 'none';
        signupGateNotice.textContent = '';
        stopLiveUsersListener();
        stopGuestOnlineListener();
      }

      if (hasPaAccess) {
        loadPurchaseRecords();
      }

      closeSiteAuth();

      if (toastMessage) {
        showAccessToast(toastMessage);
      }
    }


    siteSignInButton.addEventListener('click', function () {
      openSiteAuth('signin');
    });

    siteSignUpButton.addEventListener('click', function () {
      openSiteAuth('signup');
    });

    userUpgradeButton.addEventListener('click', function () {
      openSiteAuth('upgrade');
    });

    memberUpgradeButton.addEventListener('click', upgradeCurrentUserWithMemberCode);

    function handleHistoryPaginationClick(event) {
      const pageButton = event.target.closest('[data-history-page], [data-history-action]');

      if (!pageButton || pageButton.disabled) {
        return;
      }

      const historyType = pageButton.dataset.historyType;
      const action = pageButton.dataset.historyAction;
      const pageValue = Number(pageButton.dataset.historyPage);

      if (historyType === 'purchaseRecords') {
        const nextPage = action === 'previous' ? purchaseRecordsPage - 1 : action === 'next' ? purchaseRecordsPage + 1 : pageValue;
        renderPurchaseSummaries(getFilteredPurchaseSummaries(), nextPage);
        return;
      }

      if (historyType === 'userPaPurchases') {
        const nextPage = action === 'previous' ? userPaPurchasePage - 1 : action === 'next' ? userPaPurchasePage + 1 : pageValue;
        renderUserPaPurchases(getFilteredUserPaPurchases(), nextPage);
        return;
      }

      if (historyType === 'registeredUsers') {
        const nextPage = action === 'previous' ? registeredUsersPage - 1 : action === 'next' ? registeredUsersPage + 1 : pageValue;
        renderRegisteredUsers(getFilteredRegisteredUsers(), nextPage);
        return;
      }

      if (historyType === 'liveUsers') {
        const nextPage = action === 'previous' ? liveUsersPage - 1 : action === 'next' ? liveUsersPage + 1 : pageValue;
        renderLiveUsers(allLiveUsers, nextPage);
        return;
      }

      if (historyType === 'loginHistory') {
        const nextPage = action === 'previous' ? loginHistoryPage - 1 : action === 'next' ? loginHistoryPage + 1 : pageValue;
        renderLoginHistory(allLoginHistory, nextPage);
        return;
      }

      if (historyType === 'guestHistory') {
        const nextPage = action === 'previous' ? guestHistoryPage - 1 : action === 'next' ? guestHistoryPage + 1 : pageValue;
        renderGuestHistory(allGuestHistory, nextPage);
      }
    }

    [purchaseRecordsPagination, userPaPurchasePagination, registeredUsersPagination, liveUsersPagination, loginHistoryPagination, guestHistoryPagination].forEach(function (container) {
      if (container) {
        container.addEventListener('click', handleHistoryPaginationClick);
      }
    });

    memberUpgradeCode.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        upgradeCurrentUserWithMemberCode();
      }
    });

    siteAuthClose.addEventListener('click', closeSiteAuth);

    siteAuthModal.addEventListener('click', function (event) {
      if (event.target === siteAuthModal) {
        closeSiteAuth();
      }
    });

    switchToSiteSignup.addEventListener('click', function () {
      openSiteAuth('signup');
    });

    switchToSiteSignin.addEventListener('click', function () {
      openSiteAuth('signin');
    });

    siteSignInForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      setButtonLoading(siteSignInSubmitButton, true, 'Signing in...', 'Sign in');

      try {
        await signInSiteUser(siteLoginName.value.trim(), siteLoginPassword.value.trim(), siteLoginError);
      } finally {
        setButtonLoading(siteSignInSubmitButton, false, 'Signing in...', 'Sign in');
      }
    });

    siteSignUpForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      await signUpSiteUser();
    });
    unlockSignupButton.addEventListener('click', async function () {
      if (!firebaseReady) {
        signupGateNotice.style.display = 'block';
        signupGateNotice.textContent = 'Firebase belum disambungkan.';
        return;
      }

      try {
        signupGateNotice.style.display = 'block';
        signupGateNotice.textContent = 'Opening online signup...';
        await openSignupAccess();
      } catch (error) {
        signupGateNotice.style.display = 'block';
        signupGateNotice.textContent = `Failed to open online signup: ${error.code || error.message}`;
      }
    });

    showSignupButton.addEventListener('click', function () {
      signupFields.hidden = false;
      showSignupButton.hidden = true;
      signupFields.style.display = 'block';
      showSignupButton.style.display = 'none';
    });

    signupForm.addEventListener('submit', async function (event) {
      event.preventDefault();

      const name = signupName.value.trim();
      const phone = buildFullPhone(signupCountrySearch.value, signupPhone.value);
      const contactEmail = signupEmail.value.trim();
      const inviteCode = cleanInviteCode(signupInviteCode ? signupInviteCode.value : getInitialInviteCode());
      const password = signupPassword.value.trim();
      const usernameKey = normalizeUsername(name);

      if (signupFields.hidden) {
        signupFields.hidden = false;
        showSignupButton.hidden = true;
        signupFields.style.display = 'block';
        showSignupButton.style.display = 'none';
        return;
      }

      if (!name || !phone || !contactEmail || !password) {
        signupError.textContent = 'Please enter username, phone number, email and password.';
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
        signupError.textContent = 'Please enter a valid email address.';
        return;
      }

      if (!firebaseReady) {
        signupError.textContent = 'Firebase belum disambungkan. Masukkan firebaseConfig sebenar dalam index.html.';
        return;
      }

      if (!usernameKey) {
        signupError.textContent = 'Username can only contain letters, numbers or underscores.';
        return;
      }

      if (password.length < 6) {
        signupError.textContent = 'Password mesti sekurang-kurangnya 6 aksara.';
        return;
      }

      if (!signupGateOpen) {
        signupError.textContent = 'Signup has not been opened by admin.';
        return;
      }

      try {
        await claimSignupAccess(usernameKey);

        const user = await createOrReactivateUserProfile({
          name,
          usernameKey,
          phone,
          contactEmail,
          inviteCode,
          password,
          paAccess: true
        });

        saveCurrentUser(user);
        sessionStorage.setItem('azobssLoggedIn', '1');
        await recordLoginHistory(user);
        signupError.textContent = '';
        setLoggedIn(user, `Signup successful. Welcome, ${user.name}.`);
      } catch (error) {
        if (error.message === 'signup-gate-closed') {
          signupError.textContent = 'Signup has already been used by another user. Admin needs to reopen it.';
        } else if (error.code === 'username-active') {
          signupError.textContent = 'This username is already registered. Please sign in.';
        } else if (error.code === 'auth/email-already-in-use') {
          signupError.textContent = 'This username was deleted before, but Firebase Auth still exists. Use the previous password or ask admin to open a new username.';
        } else if (error.code === 'auth/weak-password') {
          signupError.textContent = 'Password is too short. Use at least 6 characters.';
        } else if (error.code === 'auth/operation-not-allowed') {
          signupError.textContent = 'Email/Password belum diaktifkan dalam Firebase Authentication.';
        } else if (error.code === 'permission-denied') {
          signupError.textContent = 'Firestore rules belum membenarkan simpan data user.';
        } else {
          signupError.textContent = `Signup failed: ${error.code || error.message}`;
        }
      }
    });

    loginForm.addEventListener('submit', async function (event) {
      event.preventDefault();

      const name = loginName.value.trim();
      const password = loginPassword.value.trim();
      const usernameKey = normalizeUsername(name);
      let authSignInStarted = false;

      if (!name || !password) {
        loginError.textContent = 'Please enter username and password.';
        return;
      }

      if (!firebaseReady) {
        loginError.textContent = 'Firebase belum disambungkan. Masukkan firebaseConfig sebenar dalam index.html.';
        return;
      }

      setButtonLoading(loginSubmitButton, true, 'Signing in...', 'Login');

      try {
        stopAuthRestoreListener();
        await ensureAuthSessionPersistence();
        const credential = await signInWithEmailAndPassword(auth, buildUserEmail(usernameKey), password);
        authSignInStarted = true;
        const userRef = doc(db, 'users', usernameKey);
        const userSnap = await getDoc(userRef);
        const profile = userSnap.exists() ? userSnap.data() : {
          uid: credential.user.uid,
          name,
          usernameKey,
          phone: '',
          email: credential.user.email,
          contactEmail: '',
          paAccess: true,
          inviteCode: buildInviteCode(usernameKey),
          invitedByCode: '',
          invitedByUsernameKey: ''
        };

        if (profile.deleted) {
          await signOut(auth);
          loginError.textContent = 'This account has been removed by admin.';
          return;
        }

        const user = {
          uid: profile.uid || credential.user.uid,
          name: profile.name,
          usernameKey: profile.usernameKey,
          phone: profile.phone || '',
          email: profile.email || credential.user.email,
          contactEmail: profile.contactEmail || '',
          paAccess: profile.paAccess !== false,
          inviteCode: profile.inviteCode || buildInviteCode(profile.usernameKey || usernameKey),
          invitedByCode: profile.invitedByCode || '',
          invitedByUsernameKey: profile.invitedByUsernameKey || ''
        };

        saveCurrentUser(user);
        loginError.textContent = '';
        sessionStorage.setItem('azobssLoggedIn', '1');
        await recordLoginHistory(user);
        setLoggedIn(user, `Login successful. Welcome, ${user.name}.`);
      } catch (error) {
        if (authSignInStarted) {
          await cleanupPartialAuthSession();
        }

        loginError.textContent = 'Username or password is incorrect. Please try again.';
      } finally {
        setButtonLoading(loginSubmitButton, false, 'Signing in...', 'Login');
      }
    });

    logoutButton.addEventListener('click', async function () {
      stopAuthRestoreListener();
      await updatePresence(false);
      stopPresenceHeartbeat();
      stopLiveUsersListener();
      stopGuestOnlineListener();
      allRegisteredUsers = [];
      isLoggedIn = false;
      currentUser = null;
      updateVisitorPresence(true);
      sessionStorage.removeItem('azobssLoggedIn');
      clearCurrentUser();

      if (auth) {
        await signOut(auth);
      }

      userMenu.style.display = 'none';
      userUpgradeButton.hidden = true;
      siteAuthActions.style.display = 'flex';
      updateReceiptWhatsappLink(null);
      updateLuckyDrawPanel();
      heroRequestButton.classList.remove('is-visible');
      signupForm.hidden = false;
      loginForm.hidden = false;
      paForm.hidden = true;
      adminPurchasePanel.style.display = 'none';
      registeredUsersPanel.style.display = 'none';
      setPurchaseRecordsVisible(true);
      purchaseRecordSearch.value = '';
      purchaseRecordSort.value = 'amountDesc';
      allPurchaseSummaries = [];
      purchaseRecordTools.hidden = true;
      registeredUserSearch.value = '';
      registeredUserSort.value = 'username';
      signupFields.hidden = true;
      showSignupButton.hidden = true;
      signupForm.style.display = 'grid';
      loginForm.style.display = 'grid';
      requestCard.classList.remove('is-authenticated');
      requestCard.classList.remove('is-admin');
      requestCard.classList.remove('has-pa-access');
      requestSection.classList.remove('is-visible');
      heroRequestButton.classList.remove('is-visible');
      signupFields.style.display = 'none';
      showSignupButton.style.display = 'none';
      signupName.value = '';
      signupPhone.value = '';
      setCountryValue(signupCountrySearch, signupCountryButton, signupPhonePrefix, 'Malaysia +60');
      signupEmail.value = '';
      signupPassword.value = '';
      loginName.value = '';
      loginPassword.value = '';
      signupError.textContent = '';
      loginError.textContent = '';
      paStatus.style.display = 'none';
      downloadTifButton.hidden = false;
      downloadTifButton.style.display = 'inline-block';
      downloadResultActions.hidden = true;
      downloadResultActions.style.display = 'none';
      pendingDownload = null;
      restoreSignupAccess();
      showAccessToast('Logout successful.');
    });

    window.addEventListener('beforeunload', function () {
      stopPresenceHeartbeat();
      updatePresence(false);
      updateVisitorPresence(false);
    });
    function clearRestoredSession() {
      authStateReady = true;
      clearCurrentUser();
      sessionStorage.removeItem('azobssLoggedIn');
      restoreSignupAccess();
      startVisitorPresenceHeartbeat();
    }

    async function rejectRestoredSession() {
      try {
        if (auth) {
          await signOut(auth);
        }
      } catch (error) {
        // Local session cleanup still needs to continue if Firebase signout fails.
      }

      clearRestoredSession();
    }

    async function initializeSavedSession() {
      const savedUser = getSavedUser();

      if (!savedUser || sessionStorage.getItem('azobssLoggedIn') !== '1') {
        authStateReady = true;
        restoreSignupAccess();
        startVisitorPresenceHeartbeat();
        return;
      }

      if (!firebaseReady || !auth) {
        authStateReady = true;
        setLoggedIn(savedUser);
        return;
      }

      await ensureAuthSessionPersistence();
      stopAuthRestoreListener();
      authRestoreUnsubscribe = onAuthStateChanged(auth, async function (firebaseUser) {
        stopAuthRestoreListener();

        if (!firebaseUser) {
          clearRestoredSession();
          return;
        }

        const expectedEmail = buildUserEmail(savedUser.usernameKey).toLowerCase();
        const activeEmail = (firebaseUser.email || '').toLowerCase();

        if (activeEmail !== expectedEmail) {
          await rejectRestoredSession();
          return;
        }

        try {
          const userSnap = await getDoc(doc(db, 'users', savedUser.usernameKey));

          if (!userSnap.exists()) {
            await rejectRestoredSession();
            return;
          }

          const profile = userSnap.data();

          if (profile.deleted) {
            await rejectRestoredSession();
            return;
          }

          const restoredUser = {
            uid: profile.uid || firebaseUser.uid,
            name: profile.name || savedUser.name || savedUser.usernameKey,
            usernameKey: profile.usernameKey || savedUser.usernameKey,
            phone: profile.phone || '',
            email: profile.email || firebaseUser.email || '',
            contactEmail: profile.contactEmail || '',
            paAccess: profile.paAccess !== false,
            inviteCode: profile.inviteCode || buildInviteCode(profile.usernameKey || savedUser.usernameKey),
            invitedByCode: profile.invitedByCode || '',
            invitedByUsernameKey: profile.invitedByUsernameKey || ''
          };

          saveCurrentUser(restoredUser);
          setLoggedIn(restoredUser);
        } catch (error) {
          await rejectRestoredSession();
        }
      }, function () {
        stopAuthRestoreListener();
        clearRestoredSession();
      });
    }

    initializeSavedSession();

    function removeRegistrationWhatsAppPrompt() {
      document.querySelectorAll('#signupForm .admin-whatsapp-link, #signupForm .register-title-row a[href*="alvo.chat"]').forEach(function (element) {
        element.remove();
      });
    }

    removeRegistrationWhatsAppPrompt();

    const serviceCards = document.querySelectorAll('.service-card');

    function toggleServiceCard(selectedCard) {
      const wasOpen = selectedCard.classList.contains('is-open');

      serviceCards.forEach(function (card) {
        card.classList.remove('is-open');
      });

      if (!wasOpen) {
        selectedCard.classList.add('is-open');
      } else {
        selectedCard.blur();
      }
    }

    serviceCards.forEach(function (card) {
      card.addEventListener('click', function () {
        toggleServiceCard(card);
      });

      card.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggleServiceCard(card);
        }
      });
    });

    const affiliateSearch = document.getElementById('affiliateSearch');
    const affiliateFilterButtons = document.querySelectorAll('[data-affiliate-filter]');
    const affiliateProductCards = document.querySelectorAll('.affiliate-product-card');
    const affiliateEmpty = document.getElementById('affiliateEmpty');
    let activeAffiliateFilter = 'all';

    function updateAffiliateProducts() {
      const query = (affiliateSearch && affiliateSearch.value ? affiliateSearch.value : '').trim().toLowerCase();
      let visibleCount = 0;

      affiliateProductCards.forEach(function (card) {
        const categories = (card.dataset.category || '').split(' ');
        const searchableText = `${card.textContent || ''} ${card.dataset.keywords || ''}`.toLowerCase();
        const matchesCategory = activeAffiliateFilter === 'all' || categories.includes(activeAffiliateFilter);
        const matchesSearch = !query || searchableText.includes(query);
        const shouldShow = matchesCategory && matchesSearch;

        card.hidden = !shouldShow;

        if (shouldShow) {
          visibleCount += 1;
        }
      });

      if (affiliateEmpty) {
        affiliateEmpty.hidden = visibleCount > 0;
      }
    }

    affiliateFilterButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        activeAffiliateFilter = button.dataset.affiliateFilter || 'all';

        affiliateFilterButtons.forEach(function (item) {
          item.classList.toggle('is-active', item === button);
        });

        updateAffiliateProducts();
      });
    });

    if (affiliateSearch) {
      affiliateSearch.addEventListener('input', updateAffiliateProducts);
    }

    updateAffiliateProducts();

    paNumber.addEventListener('input', updatePreview);
    negeri.addEventListener('change', updatePreview);

    refreshPurchaseButton.addEventListener('click', loadPurchaseRecords);
    togglePurchaseRecordsButton.addEventListener('click', function () {
      setPurchaseRecordsVisible(!purchaseRecordsVisible);
    });
    purchaseRecordSearch.addEventListener('input', function () { applyPurchaseRecordFilters(1); });
    purchaseRecordSort.addEventListener('change', function () { applyPurchaseRecordFilters(1); });
    if (userPaPurchaseSearch) {
      userPaPurchaseSearch.addEventListener('input', function () { applyUserPaPurchaseFilters(1); });
    }
    if (userPaPurchaseSort) {
      userPaPurchaseSort.addEventListener('change', function () { applyUserPaPurchaseFilters(1); });
    }
    purchaseSummaryList.addEventListener('click', function (event) {
      const adminDetailPageButton = event.target.closest('[data-admin-detail-page]');

      if (adminDetailPageButton && !adminDetailPageButton.disabled) {
        const usernameKey = adminDetailPageButton.dataset.adminDetailUser || '';
        const page = Number(adminDetailPageButton.dataset.adminDetailPage || 1);
        adminPurchaseDetailsPage.set(usernameKey, page);
        renderPurchaseSummaries(getFilteredPurchaseSummaries(), purchaseRecordsPage);
        return;
      }

      const detailButton = event.target.closest('[data-toggle-purchase-details]');

      if (detailButton) {
        const usernameKey = detailButton.dataset.togglePurchaseDetails || '';

        if (adminPurchaseDetailsOpen.has(usernameKey)) {
          adminPurchaseDetailsOpen.delete(usernameKey);
        } else {
          adminPurchaseDetailsOpen.add(usernameKey);
          if (!adminPurchaseDetailsPage.has(usernameKey)) {
            adminPurchaseDetailsPage.set(usernameKey, 1);
          }
        }

        renderPurchaseSummaries(getFilteredPurchaseSummaries(), purchaseRecordsPage);
        return;
      }

      const resetButton = event.target.closest('[data-reset-purchase]');

      if (!resetButton) {
        return;
      }

      resetPurchaseSummary(resetButton.dataset.resetPurchase);
    });

    refreshUsersButton.addEventListener('click', loadRegisteredUsers);
    registeredUserSearch.addEventListener('input', function () { applyRegisteredUserFilters(1); });
    registeredUserSort.addEventListener('change', function () { applyRegisteredUserFilters(1); });
    registeredUsersList.addEventListener('click', function (event) {
      const toggleButton = event.target.closest('[data-toggle-user-edit]');
      const saveButton = event.target.closest('[data-save-user]');
      const deleteButton = event.target.closest('[data-delete-user]');

      if (toggleButton) {
        const item = toggleButton.closest('.user-edit-item');
        const isOpening = item && !item.classList.contains('is-editing');

        if (item) {
          item.classList.toggle('is-editing', isOpening);
          toggleButton.textContent = isOpening ? 'Close' : 'Edit';
        }

        return;
      }

      if (saveButton) {
        saveRegisteredUserDetails(saveButton.dataset.saveUser, saveButton.closest('.user-edit-item'));
        return;
      }

      if (deleteButton) {
        deleteRegisteredUser(deleteButton.dataset.deleteUser);
      }
    });

    async function copyLuckyDrawInviteLink() {
      if (!currentUser || !currentUser.usernameKey) {
        openSiteAuth('signin');
        return;
      }

      const link = buildInviteUrl(currentUser);
      try {
        await navigator.clipboard.writeText(link);
        luckyDrawStatus.textContent = 'Invite link berjaya disalin. Share link ini untuk bukti invite.';
      } catch (error) {
        luckyDrawStatus.textContent = 'Copy gagal. Sila salin invite link secara manual.';
      }
    }

    function shareLuckyDrawWebsite() {
      if (!currentUser || !currentUser.usernameKey) {
        openSiteAuth('signin');
        return;
      }

      const inviteUrl = buildInviteUrl(currentUser);
      const inviteCode = currentUser.inviteCode || buildInviteCode(currentUser.usernameKey);
      const message = `Jom join website AZOBSS. Guna invite code saya: ${inviteCode} ${inviteUrl}`;
      localStorage.setItem(getLuckyDrawShareKey(currentUser.usernameKey), '1');
      updateLuckyDrawPanel();

      if (navigator.share) {
        navigator.share({ title: 'AZOBSS', text: message, url: inviteUrl }).catch(function () {});
      } else {
        window.open('https://wa.me/?text=' + encodeURIComponent(message), '_blank', 'noopener');
      }
    }

    async function joinLuckyDrawContest() {
      if (!currentUser || !currentUser.usernameKey) {
        openSiteAuth('signin');
        return;
      }

      if (localStorage.getItem(getLuckyDrawShareKey(currentUser.usernameKey)) !== '1') {
        luckyDrawStatus.textContent = 'Sila share website dahulu sebelum join cabutan bertuah.';
        return;
      }

      const monthKey = getLuckyDrawMonthKey();
      const entryId = `${monthKey}_${currentUser.usernameKey}`;
      const entryData = {
        monthKey,
        usernameKey: currentUser.usernameKey,
        uid: currentUser.uid || '',
        name: currentUser.name || currentUser.usernameKey,
        phone: currentUser.phone || '',
        contactEmail: currentUser.contactEmail || '',
        inviteCode: currentUser.inviteCode || buildInviteCode(currentUser.usernameKey),
        inviteUrl: buildInviteUrl(currentUser),
        sharedAtMs: Date.now(),
        joinedAtMs: Date.now(),
        joinedAt: serverTimestamp()
      };

      try {
        await setDoc(doc(db, 'luckyDrawEntries', entryId), entryData, { merge: true });
      } catch (error) {
        const localEntries = JSON.parse(localStorage.getItem('azobssLuckyDrawEntries') || '[]');
        localEntries.push({ ...entryData, joinedAt: Date.now() });
        localStorage.setItem('azobssLuckyDrawEntries', JSON.stringify(localEntries.slice(-100)));
      }

      localStorage.setItem(getLuckyDrawJoinKey(currentUser.usernameKey), '1');
      updateLuckyDrawPanel();
      luckyDrawStatus.textContent = 'Anda berjaya join cabutan bertuah bulan ini. Semoga berjaya!';
    }

    copyLuckyDrawInviteButton.addEventListener('click', copyLuckyDrawInviteLink);
    shareLuckyDrawButton.addEventListener('click', shareLuckyDrawWebsite);
    joinLuckyDrawButton.addEventListener('click', joinLuckyDrawContest);

    copyAccountButton.addEventListener('click', async function () {
      try {
        await navigator.clipboard.writeText(BANK_ACCOUNT_NUMBER);
        qrCopyStatus.textContent = `Account number copied: ${BANK_ACCOUNT_NUMBER}`;
      } catch (error) {
        qrCopyStatus.textContent = `Copy failed. Account number: ${BANK_ACCOUNT_NUMBER}`;
      }

      qrCopyStatus.style.display = 'block';

      setTimeout(function () {
        qrCopyStatus.style.display = 'none';
      }, 2500);
    });

    paForm.addEventListener('submit', async function (event) {
      event.preventDefault();

      if (!isAdminUser(currentUser) && currentUser && currentUser.paAccess === false) {
        paError.textContent = 'Standard accounts do not have Request PA / Info Lot access.';
        return;
      }

      const pdfUrl = buildPdfUrl();
      const paValue = cleanPaNumber(paNumber.value);
      const selectedNegeri = negeri.value;

      if (!isLoggedIn) {
        paError.textContent = 'Please log in before downloading PA.';
        return;
      }

      if (!pdfUrl) {
        paError.textContent = 'Please enter the PA number and select a state first.';
        return;
      }

      paError.textContent = '';
      paStatus.style.display = 'block';
      paStatus.textContent = 'Converting PA to PDF... please wait.';
      downloadTifButton.disabled = true;
      downloadTifButton.innerHTML = `
        <span class="download-pa-main">Converting PDF...</span>
        <span class="pdf-price-tag">RM5 per unit</span>
      `;

      try {
        const res = await fetch(pdfUrl, { cache: 'no-store' });

        if (!res.ok) {
          let message = 'PA not found / PA tiada dalam sistem';

          try {
            const errorData = await res.json();
            message = errorData.error || message;
          } catch (jsonError) {
            // PDF endpoint may return non-JSON errors. Keep the friendly message.
          }

          throw new Error(message);
        }

        const pdfBlob = await res.blob();

        if (!pdfBlob || !pdfBlob.size) {
          throw new Error('PDF kosong / failed convert.');
        }

        const blobUrl = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `PA${paValue}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();

        setTimeout(function () {
          URL.revokeObjectURL(blobUrl);
        }, 5000);

        pendingDownload = {
          paValue,
          selectedNegeri,
          url: pdfUrl
        };

        await recordPurchase(paValue, selectedNegeri, pdfUrl);

        paStatus.style.display = 'block';
        paStatus.textContent = 'PA downloaded successfully!';

        downloadResultActions.hidden = true;
        downloadResultActions.style.display = 'none';

        if (failedDownloadButton) {
          failedDownloadButton.style.display = 'none';
        }

      } catch (error) {
        paError.textContent = error.message || 'PA not found / PA tiada dalam sistem';
        paStatus.style.display = 'none';
      } finally {
        downloadTifButton.disabled = false;
        downloadTifButton.innerHTML = `
          <span class="download-pa-main">Download PA</span>
          <span class="pdf-price-tag">RM5 per unit</span>
        `;
      }
    });

    confirmDownloadButton.addEventListener('click', async function () {
      if (!pendingDownload) {
        paError.textContent = 'No download to confirm.';
        return;
      }

      try {
        confirmDownloadButton.disabled = true;
        await recordPurchase(pendingDownload.paValue, pendingDownload.selectedNegeri, pendingDownload.url);
        paStatus.style.display = 'none';
        paStatus.textContent = '';
        pendingDownload = null;
        downloadResultActions.hidden = true;
        downloadResultActions.style.display = 'none';
        downloadTifButton.hidden = false;
        downloadTifButton.style.display = 'inline-block';
      } catch (error) {
        paError.textContent = `Failed to save purchase record: ${error.code || error.message}`;
      } finally {
        confirmDownloadButton.disabled = false;
      }
    });

    failedDownloadButton.addEventListener('click', function () {
      pendingDownload = null;
      paStatus.style.display = 'none';
      paStatus.textContent = '';
      downloadResultActions.hidden = true;
      downloadResultActions.style.display = 'none';
      downloadTifButton.hidden = false;
      downloadTifButton.style.display = 'inline-block';
    });

    const liveVisitors = document.getElementById('liveVisitors');
    const totalVisits = document.getElementById('totalVisits');
    const trafficRef = firebaseReady ? doc(db, 'siteStats', 'traffic') : null;

    function getVisitorId() {
      let visitorId = sessionStorage.getItem('azobssVisitorId');

      if (!visitorId) {
        visitorId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        sessionStorage.setItem('azobssVisitorId', visitorId);
      }

      return visitorId;
    }

    async function updateTraffic() {
      try {
        const shouldCountVisit = !sessionStorage.getItem('azobssVisitCounted');

        if (!firebaseReady) {
          throw new Error('Firebase is not ready.');
        }

        if (shouldCountVisit) {
          await runTransaction(db, async function (transaction) {
            const trafficSnapshot = await transaction.get(trafficRef);
            const currentTotal = trafficSnapshot.exists() ? (trafficSnapshot.data().totalVisits || 0) : 0;

            transaction.set(trafficRef, {
              totalVisits: currentTotal + 1,
              lastVisitAt: serverTimestamp()
            }, { merge: true });
          });

          sessionStorage.setItem('azobssVisitCounted', '1');
        }

        const trafficSnapshot = await getDoc(trafficRef);
        const total = trafficSnapshot.exists() ? (trafficSnapshot.data().totalVisits || 0) : 0;

        liveVisitors.textContent = 'Online';
        totalVisits.textContent = total;
      } catch (error) {
        liveVisitors.textContent = 'Online';
        totalVisits.textContent = '0';
      }
    }

    updateTraffic();
