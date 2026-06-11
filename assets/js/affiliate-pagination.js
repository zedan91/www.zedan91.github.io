/* AFFILIATE CATEGORY + PAGINATION FINAL FIX */
(function(){
  const PER_PAGE = 4;
  let currentPage = 1;
  let showAllMode = false;
  let hideAllMode = false;

  function clean(text){
    return String(text || '').trim().toLowerCase();
  }

  function getCards(){
    return Array.from(document.querySelectorAll('.affiliate-product-card'));
  }

  function getPager(){
    return document.getElementById('affiliatePagination') || document.querySelector('.affiliate-pagination');
  }

  function getSearch(){
    return document.getElementById('affiliateCategorySearch') || document.querySelector('.affiliate-category-search');
  }

  function getActiveFilter(){
    const active = document.querySelector('.affiliate-category-card.is-active');
    return clean(active ? active.dataset.filter : 'all') || 'all';
  }

  function getFilteredCards(){
    const filter = getActiveFilter();
    const search = getSearch();
    const query = clean(search ? search.value : '');

    return getCards().filter(card => {
      const category = clean(card.dataset.category || card.getAttribute('data-category') || '');
      const text = clean(card.innerText);

      const matchCategory = filter === 'all' || category === filter;
      const matchSearch = !query || text.includes(query) || category.includes(query);

      return matchCategory && matchSearch;
    });
  }

  function showCard(card){
    card.hidden = false;
    card.style.display = '';
  }

  function hideCard(card){
    card.hidden = true;
    card.style.display = 'none';
  }

  function makeButton(text, action, disabled, active, extraClass){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'affiliate-page-btn' + (active ? ' active' : '') + (extraClass ? ' ' + extraClass : '');
    btn.textContent = text;
    btn.disabled = !!disabled;

    btn.addEventListener('click', function(){
      if(action === 'showall'){
        hideAllMode = false;
        showAllMode = true;
        currentPage = 1;
        renderAffiliateProducts();
        return;
      }

      if(action === 'hideall'){
        showAllMode = false;
        hideAllMode = true;

        getCards().forEach(hideCard);
        renderPagination(Math.max(1, Math.ceil(getFilteredCards().length / PER_PAGE)));

        const affiliateSection = document.querySelector('.affiliate-section') || document.getElementById('affiliate') || document.querySelector('.affiliate-category-panel');
        if(affiliateSection){
          affiliateSection.scrollIntoView({behavior:'smooth', block:'start'});
        }
        return;
      }

      if(action === 'goback'){
        const panel = document.querySelector('.affiliate-category-panel');
        if(panel){
          panel.scrollIntoView({behavior:'smooth', block:'start'});
        }
        return;
      }

      hideAllMode = false;
      showAllMode = false;
      currentPage = action;
      renderAffiliateProducts();
    });

    return btn;
  }

  function renderPagination(totalPages){
    const pager = getPager();
    if(!pager) return;

    totalPages = Math.max(1, totalPages || 1);
    if(currentPage > totalPages) currentPage = totalPages;
    if(currentPage < 1) currentPage = 1;

    pager.innerHTML = '';

    pager.appendChild(makeButton('<<', Math.max(1, currentPage - 1), currentPage === 1));
    pager.appendChild(makeButton('Previous', Math.max(1, currentPage - 1), currentPage === 1));

    for(let i = 1; i <= totalPages; i++){
      pager.appendChild(makeButton(String(i), i, false, i === currentPage));
    }

    pager.appendChild(makeButton('Next', Math.min(totalPages, currentPage + 1), currentPage === totalPages));
    pager.appendChild(makeButton('>>', Math.min(totalPages, currentPage + 1), currentPage === totalPages));

    const bottom = document.createElement('div');
    bottom.className = 'affiliate-bottom-actions';
    bottom.appendChild(makeButton('Show All', 'showall'));
    bottom.appendChild(makeButton('Hide All', 'hideall'));
    bottom.appendChild(makeButton('Go Back to Categories', 'goback', false, false, 'affiliate-back-btn'));
    pager.appendChild(bottom);
  }

  function renderAffiliateProducts(){
    const cards = getCards();
    const filtered = getFilteredCards();
    const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));

    cards.forEach(hideCard);

    if(!hideAllMode){
      const visible = showAllMode
        ? filtered
        : filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

      visible.forEach(showCard);
    }

    renderPagination(totalPages);
  }

  function bindAffiliateCategories(){
    const buttons = Array.from(document.querySelectorAll('.affiliate-category-card'));
    const search = getSearch();

    buttons.forEach(btn => {
      if(btn.dataset.azobssFinalBound === '1') return;
      btn.dataset.azobssFinalBound = '1';

      btn.addEventListener('click', function(e){
        e.preventDefault();

        buttons.forEach(b => b.classList.remove('is-active'));
        this.classList.add('is-active');

        currentPage = 1;
        showAllMode = false;
        hideAllMode = false;

        renderAffiliateProducts();
      }, true);
    });

    if(search && search.dataset.azobssFinalSearchBound !== '1'){
      search.dataset.azobssFinalSearchBound = '1';

      search.addEventListener('input', function(){
        currentPage = 1;
        showAllMode = false;
        hideAllMode = false;
        renderAffiliateProducts();
      });
    }
  }

  function initAffiliateFinal(){
    bindAffiliateCategories();
    renderAffiliateProducts();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initAffiliateFinal);
  }else{
    initAffiliateFinal();
  }

  document.addEventListener('azobssAffiliateUpdated', function(){
    setTimeout(initAffiliateFinal, 80);
  });

  window.azobssRefreshAffiliateProducts = initAffiliateFinal;
})();
