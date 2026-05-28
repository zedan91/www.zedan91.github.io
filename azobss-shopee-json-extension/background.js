chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'AZOBSS_SHOPEE_JSON_DOWNLOAD') return;

  const data = message.data || {};
  const title = String(data.title || 'shopee-product')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90) || 'shopee-product';

  const json = JSON.stringify(data, null, 2);
  const url = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);

  chrome.downloads.download({
    url,
    filename: `AZOBSS-Shopee-JSON/${title}.json`,
    saveAs: false
  }, (downloadId) => {
    sendResponse({ ok: !!downloadId, downloadId });
  });

  return true;
});
