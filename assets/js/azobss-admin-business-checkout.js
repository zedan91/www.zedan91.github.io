(function () {
  'use strict';
  const panel = document.getElementById('businessCheckoutSettings');
  if (!panel) return;

  const form = panel.querySelector('form');
  const status = panel.querySelector('[data-payment-settings-status]');
  const transfers = panel.querySelector('[data-transfer-list]');
  const api = 'https://azobss-backend.onrender.com/api/admin/site';
  const post = body => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const call = (path, options) => window.azAdminFetchJson(api + path, options);
  const make = (tag, visibleText) => {
    const element = document.createElement(tag);
    if (visibleText) element.textContent = visibleText;
    return element;
  };
  const backupMethods = ['toyyibpay','stripe','digitalBank'];
  const set = (provider, value) => { form.elements.namedItem(provider).checked = value === true; };
  const chipStatuses = {
    ready: 'CHIP live checkout is available.',
    disabled: 'CHIP live checkout is disabled in Render.',
    missing_credentials: 'The live CHIP API key or Brand ID is missing in Render.',
    provider_check_failed: 'Render could not verify the live CHIP connection.'
  };
  const testConfigurations = {
    configured: 'CHIP test credentials are set. Create a payment to test the connection.',
    missing_credentials: 'Set CHIP_TEST_API_KEY and CHIP_TEST_BRAND_ID in Render to run a test.',
    live_key_reused: 'Replace the test key with a key created in CHIP Test Mode.'
  };
  const chipStatus = result => chipStatuses[result.chipState] ||
    (result.chip ? 'CHIP live checkout is available.' : 'CHIP live checkout is currently unavailable.');

  const testCreate = panel.querySelector('[data-chip-test-create]');
  const testOpen = panel.querySelector('[data-chip-test-open]');
  const testCheck = panel.querySelector('[data-chip-test-check]');
  const testStatus = panel.querySelector('[data-chip-test-status]');
  const testStorageKey = 'azobss-admin-chip-test-id';
  let testId = new URLSearchParams(location.search).get('chipTest') || '';
  try { testId ||= sessionStorage.getItem(testStorageKey) || ''; } catch (_) {}
  testCheck.hidden = !testId;

  function updateTestStatus(result) {
    const label = {
      creating:'Preparing the test purchase.',
      pending:'Awaiting payment in CHIP Test Mode.',
      paid:'Test payment verified by CHIP.',
      expired:'The test payment link expired.',
      failed:'This test payment could not be created.'
    }[result.status] || 'Test status could not be read.';
    testStatus.textContent = label + ' ' + result.testId;
    if (['paid','expired','failed'].includes(result.status)) testOpen.hidden = true;
  }

  testCreate.addEventListener('click', async () => {
    testCreate.disabled = true;
    testCheck.disabled = true;
    testStatus.textContent = 'Creating CHIP test checkout…';
    try {
      const result = await call('/chip-test-payment', post({}));
      const url = new URL(result.paymentUrl);
      if (url.origin !== 'https://gate.chip-in.asia' || url.username || url.password) {
        throw Error('The CHIP test checkout link is invalid.');
      }
      testId = result.testId;
      try { sessionStorage.setItem(testStorageKey, testId); } catch (_) {}
      testOpen.href = url.href;
      testOpen.hidden = false;
      testCheck.hidden = false;
      updateTestStatus(result);
    } catch (error) {
      testStatus.textContent = error.message;
    } finally {
      testCreate.disabled = false;
      testCheck.disabled = false;
    }
  });

  testCheck.addEventListener('click', async () => {
    testCheck.disabled = true;
    testStatus.textContent = 'Checking CHIP test status…';
    try {
      updateTestStatus(await call('/chip-test-payment?testId=' + encodeURIComponent(testId)));
    } catch (error) {
      testStatus.textContent = error.message;
    } finally {
      testCheck.disabled = false;
    }
  });

  async function loadSettings() {
    const result = await call('/checkout-options');
    for (const method of backupMethods) set(method, result.backup[method]);
    form.querySelector('fieldset').disabled = false;
    status.textContent = chipStatus(result);
    if (!testId) testStatus.textContent = testConfigurations[result.chipTestConfiguration] || '';
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const payload = Object.fromEntries(backupMethods.map(key => [key, form.elements.namedItem(key).checked]));
    const fields = form.querySelector('fieldset');
    fields.disabled = true;
    status.textContent = 'Saving…';
    try {
      const result = await call('/checkout-options', post(payload));
      for (const method of backupMethods) set(method, result.backup[method]);
      status.textContent = 'Settings saved. ' + chipStatus(result);
    } catch (error) {
      status.textContent = error.message;
    } finally {
      fields.disabled = false;
    }
  });

  async function loadTransfers() {
    transfers.textContent = 'Loading…';
    try {
      const result = await call('/bank-transfer');
      transfers.replaceChildren();
      if (!result.orders.length) transfers.textContent = 'No bank transfers are awaiting review.';
      for (const order of result.orders) {
        const item = make('div');
        const value = 'RM ' + (order.amountSen / 100).toFixed(2);
        const invoice = order.invoiceNo || order.orderId;
        item.append(make('p', invoice + ' · ' + order.productName + ' · ' + value + ' · ' + order.bankReference));
        const button = make('button', 'Confirm payment received');
        button.className = 'btn green';
        button.type = 'button';
        button.addEventListener('click', async () => {
          if (!window.confirm('Confirm that ' + value + ' has been credited to the AZOBSS ENTERPRISE account with reference ' + order.bankReference + '.')) return;
          button.disabled = true;
          try {
            await call('/bank-transfer', post({ orderId: order.orderId, reference: order.bankReference, amountSen: order.amountSen }));
            await loadTransfers();
          } catch (error) {
            button.disabled = false;
            status.textContent = error.message;
          }
        });
        item.append(button);
        transfers.append(item);
      }
    } catch (error) {
      transfers.textContent = error.message;
    }
  }

  panel.querySelector('[data-load-payment-settings]').addEventListener('click', () => {
    loadSettings().catch(error => { status.textContent = error.message; });
  });
  panel.querySelector('[data-load-transfer-list]').addEventListener('click', loadTransfers);
})();
