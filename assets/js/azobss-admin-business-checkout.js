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
  const set = (provider, value) => { form.elements.namedItem(provider).checked = value === true; };
  const chipStatus = ready => ready ? 'CHIP sedia untuk digunakan.' : 'CHIP belum tersedia untuk checkout.';

  async function loadSettings() {
    const result = await call('/checkout-options');
    set('toyyibpay', result.backup.toyyibpay);
    set('stripe', result.backup.stripe);
    form.querySelector('fieldset').disabled = false;
    status.textContent = chipStatus(result.chip);
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const payload = Object.fromEntries(['toyyibpay', 'stripe'].map(key => [key, form.elements.namedItem(key).checked]));
    const fields = form.querySelector('fieldset');
    fields.disabled = true;
    status.textContent = 'Menyimpan…';
    try {
      const result = await call('/checkout-options', post(payload));
      set('toyyibpay', result.backup.toyyibpay);
      set('stripe', result.backup.stripe);
      status.textContent = 'Tetapan disimpan. ' + chipStatus(result.chip);
    } catch (error) {
      status.textContent = error.message;
    } finally {
      fields.disabled = false;
    }
  });

  async function loadTransfers() {
    transfers.textContent = 'Memuatkan…';
    try {
      const result = await call('/bank-transfer');
      transfers.replaceChildren();
      if (!result.orders.length) transfers.textContent = 'Tiada rujukan pindahan menunggu semakan.';
      for (const order of result.orders) {
        const item = make('div');
        const value = 'RM ' + (order.amountSen / 100).toFixed(2);
        const invoice = order.invoiceNo || order.orderId;
        item.append(make('p', invoice + ' · ' + order.productName + ' · ' + value + ' · ' + order.bankReference));
        const button = make('button', 'Sahkan wang diterima');
        button.className = 'btn green';
        button.type = 'button';
        button.addEventListener('click', async () => {
          if (!window.confirm('Sahkan ' + value + ' sudah dikreditkan ke akaun AZOBSS ENTERPRISE dengan rujukan ' + order.bankReference + '.')) return;
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
