/* SHARED AFFILIATE JSON LOADER
   Put affiliate-products.json in the same folder as index.html.
   Edit JSON + git push = update for all visitors/devices.
*/
(function(){
  function esc(text){
    return String(text || '').replace(/[&<>"']/g, c => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
    }[c]));
  }

  function productHTML(p){
    return `
      <article class="affiliate-product-card" data-affiliate-id="${esc(p.id)}" data-category="${esc(p.category || '')}">
        <div class="affiliate-card-admin-actions">
          <button class="edit" type="button" data-affiliate-edit="${esc(p.id)}">Edit</button>
          <button class="delete" type="button" data-affiliate-delete="${esc(p.id)}">Delete</button>
        </div>
        <div class="affiliate-product-top">
          <div class="affiliate-product-icon">${esc(p.icon || 'AZ')}</div>
          <span class="affiliate-badge">${esc(p.badge || 'Affiliate')}</span>
        </div>
        <h3>${esc(p.title)}</h3>
        <p>${esc(p.desc)}</p>
        <div class="affiliate-product-meta">${esc(p.meta || '')}</div>
        <a class="btn blue" href="${esc(p.link || '#')}" target="_blank" rel="noopener">View on Shopee</a>
      </article>`;
  }

  async function loadAffiliateJSON(){
    const wrap = document.querySelector('.affiliate-products');
    if(!wrap) return;

    try{
      const res = await fetch('affiliate-products.json?ts=' + Date.now(), {cache:'no-store'});
      if(!res.ok) return;

      const products = await res.json();
      if(!Array.isArray(products)) return;

      wrap.innerHTML = products.map(productHTML).join('');

      try{
        localStorage.setItem('azobss_affiliate_products_v4', JSON.stringify(products));
      }catch(e){}

      document.dispatchEvent(new CustomEvent('azobssAffiliateUpdated'));
    }catch(e){}
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', loadAffiliateJSON);
  }else{
    loadAffiliateJSON();
  }
})();
