(function () {
  const KEY = 'azobss_shopee_json_downloaded_' + location.href.split('#')[0];

  function clean(v) {
    return String(v || '').replace(/\s+/g, ' ').trim();
  }

  function pick() {
    for (const selector of arguments) {
      try {
        const el = document.querySelector(selector);
        const value = el && (el.content || el.innerText || el.textContent || el.getAttribute('content'));
        if (value && clean(value)) return clean(value);
      } catch (e) {}
    }
    return '';
  }

  function findJsonTitle() {
    const scripts = [...document.scripts].map(s => s.textContent || '').filter(Boolean);
    const patterns = [
      /"name"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i,
      /"title"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i,
      /"itemName"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i,
      /"productName"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i
    ];
    for (const txt of scripts) {
      if (!/Shopee|product|item|name|title/i.test(txt)) continue;
      for (const re of patterns) {
        const m = txt.match(re);
        if (m && m[1]) {
          try { return JSON.parse('"' + m[1] + '"'); } catch (e) { return m[1]; }
        }
      }
    }
    return '';
  }

  function isBadTitle(title) {
    const t = clean(title).toLowerCase();
    if (!t || t.length < 8) return true;
    return (
      t === 'shopee' ||
      t.includes('free shipping across malaysia') ||
      t.includes('shopee malaysia') ||
      /^\d+$/.test(t)
    );
  }

  function extract() {
    let title = clean(
      pick(
        'meta[property="og:title"]',
        'meta[name="title"]',
        '[data-testid="pdp-product-title"]',
        '.product-briefing h1',
        'h1'
      ) || findJsonTitle() || document.title.replace(/\|.*$/,'')
    );

    const description = clean(pick('meta[property="og:description"]', 'meta[name="description"]'));
    const image = pick('meta[property="og:image"]', 'meta[name="twitter:image"]');

    if (isBadTitle(title)) {
      title = '';
    }

    return {
      source: 'azobss-shopee-extension',
      title,
      description,
      image,
      url: location.href,
      capturedAt: new Date().toISOString()
    };
  }

  function showBadge(text, good) {
    const old = document.getElementById('azobss-json-extractor-badge');
    if (old) old.remove();
    const div = document.createElement('div');
    div.id = 'azobss-json-extractor-badge';
    div.textContent = text;
    div.style.cssText = `position:fixed;z-index:2147483647;right:16px;bottom:16px;padding:12px 14px;border-radius:12px;background:${good ? '#16a34a' : '#dc2626'};color:white;font:600 14px Arial;box-shadow:0 10px 30px rgba(0,0,0,.35);`;
    document.documentElement.appendChild(div);
    setTimeout(() => div.remove(), 5500);
  }

  async function run() {
    if (sessionStorage.getItem(KEY)) return;
    // Wait for Shopee React page/metadata to settle.
    await new Promise(r => setTimeout(r, 4500));

    const data = extract();
    if (!data.title) {
      showBadge('AZOBSS: Shopee title tak dapat dibaca. Copy title manual.', false);
      return;
    }

    sessionStorage.setItem(KEY, '1');
    chrome.runtime.sendMessage({ type: 'AZOBSS_SHOPEE_JSON_DOWNLOAD', data }, (resp) => {
      showBadge(resp && resp.ok ? 'AZOBSS: JSON downloaded ✅' : 'AZOBSS: JSON download gagal', !!(resp && resp.ok));
    });
  }

  run();
})();
