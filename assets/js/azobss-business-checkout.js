(function (global) {
  'use strict';

  const API = 'https://azobss-backend.onrender.com';
  const providers = { chip: 'CHIP', 'bank-transfer': 'DuitNow QR / Pindahan Bank', bank: 'ToyyibPay (Sandaran)', stripe: 'Stripe (Sandaran)' };
  const checkoutHosts = { chip: 'gate.chip-in.asia', stripe: 'checkout.stripe.com', bank: 'toyyibpay.com' };
  const make = (tag, text) => {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    return element;
  };
  const amount = sen => 'RM ' + (sen / 100).toFixed(2);

  async function request(path, options = {}) {
    const response = await fetch(API + path, { cache: 'no-store', signal: AbortSignal.timeout(18000), ...options });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw Error(result.error || 'Pembayaran tidak dapat disediakan. Cuba lagi.');
    return result;
  }

  function options() { return request('/api/site/checkout-options'); }

  function available(settings) {
    return Object.keys(providers).filter(key => key === 'bank-transfer' ? settings.bank : key === 'bank' ? settings.toyyibpay : settings[key]);
  }

  function redirect(value, provider) {
    const url = new URL(value);
    if (url.protocol !== 'https:' || (url.hostname !== checkoutHosts[provider] && !(provider === 'bank' && url.hostname === 'dev.toyyibpay.com')) || url.port || url.username || url.password) {
      throw Error('Pautan pembayaran tidak sah.');
    }
    location.assign(url.href);
  }

  function showBank(container, order, report) {
    const details = make('section');
    details.append(make('h4', 'DuitNow QR / Pindahan Bank'));
    const payee = make('p');
    payee.append(make('strong', order.bank.holder), document.createElement('br'), document.createTextNode(order.bank.bank + ' · ' + order.bank.account));
    const qr = make('img');
    if (order.bank.qrUrl === '/assets/images/azobss-enterprise-duitnow-qr.jpg') qr.src = order.bank.qrUrl;
    qr.alt = 'DuitNow QR AZOBSS ENTERPRISE';
    qr.width = 320;
    qr.style.position = 'absolute';
    qr.style.width = '161.295%';
    qr.style.setProperty('max-width','none','important');
    qr.style.left = '-31.175%';
    qr.style.top = '-48.494%';
    qr.style.height = 'auto';
    const qrLink = make('a');
    qrLink.href = qr.src;
    qrLink.target = '_blank';
    qrLink.rel = 'noopener';
    qrLink.style.cssText = 'display:block;width:min(100%,320px);aspect-ratio:1;position:relative;overflow:hidden;background:#fff';
    const crop = make('span');
    crop.style.cssText = 'position:absolute;inset:8.333%;overflow:hidden';
    crop.append(qr);
    qrLink.append(crop);
    details.append(payee, make('p', 'Amaun ' + amount(order.amountSen) + ' · Rujukan ' + order.reference), qrLink);
    details.append(make('p', 'Semak nama penerima dan amaun dalam aplikasi bank sebelum membuat bayaran.'));
    if (report) {
      const form = make('form');
      const label = make('label', 'Rujukan transaksi bank ');
      const input = make('input');
      input.required = true;
      input.maxLength = 120;
      input.autocomplete = 'off';
      label.append(input);
      const submit = make('button', 'Hantar untuk semakan');
      submit.type = 'submit';
      const status = make('p');
      status.setAttribute('role', 'status');
      form.append(label, submit, status);
      form.addEventListener('submit', async event => {
        event.preventDefault();
        submit.disabled = true;
        status.textContent = 'Menghantar…';
        try {
          await report(input.value.trim());
          input.disabled = true;
          status.textContent = 'Rujukan diterima. AZOBSS akan sahkan bayaran sebelum menghantar resit.';
        } catch (error) {
          submit.disabled = false;
          status.textContent = error.message;
        }
      });
      details.append(form);
    }
    container.replaceChildren(details);
    container.hidden = false;
  }

  async function digitalBankRequest(container, order) {
    showBank(container, order, reference => request('/api/site/bank-transfer/report', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order.orderId, reportToken: order.reportToken, reference })
    }));
  }

  async function mountInvoice(container, order, getAuth) {
    if (!container) return;
    const status = make('p', 'Memuatkan kaedah bayaran…');
    status.setAttribute('role', 'status');
    container.replaceChildren(status);
    try {
      const settings = await options();
      if (!container.isConnected) return;
      const methods = available(settings);
      status.textContent = methods.length ? '' : 'Kaedah bayaran belum tersedia.';
      for (const method of methods) {
        if (method === 'bank-transfer') {
          const panel = make('details');
          panel.append(make('summary', providers[method]));
          const details = make('div');
          panel.append(details);
          showBank(details, { bank:settings.bank, amountSen:Math.round(Number(order.confirmedTotal)*100), reference:order.invoiceNo });
          container.append(panel);
          continue;
        }
        const button = make('button', 'Bayar dengan ' + providers[method]);
        button.type = 'button';
        button.className = 'az-pc-shop-btn' + (method === 'chip' ? ' primary' : '');
        button.addEventListener('click', async () => {
          button.disabled = true;
          status.textContent = 'Menyediakan bayaran…';
          try {
            const response = await request('/api/pc-shop/orders/' + encodeURIComponent(order.orderId) + '/online-payment', {
              method:'POST', headers:{ ...await getAuth(), 'Content-Type':'application/json' },
              body:JSON.stringify({ provider:method === 'bank' ? 'toyyibpay' : method })
            });
            redirect(response.paymentUrl, method);
          } catch (error) {
            status.textContent = error.message;
            button.disabled = false;
          }
        });
        container.append(button);
      }
    } catch (error) {
      status.textContent = error.message;
    }
  }

  async function choose(title, createOrder, onOrder) {
    const methods = available(await options());
    if (!methods.length) throw Error('Kaedah bayaran belum tersedia.');
    const dialog = make('dialog');
    dialog.style.cssText = 'width:min(92vw,420px);max-height:85vh;padding:20px;border-radius:14px;border:1px solid #52667f;background:#101a2d;color:#f4f7ff;overflow:auto';
    const heading = make('h3', title);
    heading.id = 'azBusinessPaymentTitle';
    dialog.setAttribute('aria-labelledby', heading.id);
    const controls = make('div');
    controls.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
    const details = make('div');
    const status = make('p');
    status.setAttribute('role','status');
    const close = make('button','Tutup');
    close.type = 'button';
    close.addEventListener('click', () => dialog.close());
    for (const method of methods) {
      const button = make('button', providers[method]);
      button.type = 'button';
      button.className = 'btn';
      button.addEventListener('click', async () => {
        for (const item of controls.querySelectorAll('button')) item.disabled = true;
        status.textContent = 'Menyediakan pembayaran…';
        try {
          const order = await createOrder(method === 'bank' ? 'toyyibpay' : method);
          if (onOrder && await onOrder(order, method) === false) { dialog.close(); return; }
          if (method === 'bank-transfer') {
            status.textContent = '';
            await digitalBankRequest(details, order);
          } else redirect(order.paymentUrl, method);
        } catch (error) {
          status.textContent = error.message;
          for (const item of controls.querySelectorAll('button')) item.disabled = false;
        }
      });
      controls.append(button);
    }
    dialog.append(heading, controls, status, details, close);
    document.body.append(dialog);
    dialog.addEventListener('close', () => dialog.remove(), { once:true });
    dialog.showModal();
  }

  global.AZOBSSBusinessCheckout = { API, request, options, available, providers, redirect, showBank, digitalBankRequest, mountInvoice, choose };
})(window);
