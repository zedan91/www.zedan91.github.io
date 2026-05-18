// Extracted from index.html. Order preserved.

document.addEventListener('DOMContentLoaded', function(){
  function setupAffiliateShowMore(){
    document.querySelectorAll('.affiliate-product-card').forEach(function(card){
      if(card.dataset.showMoreReady === '1') return;

      const desc = card.querySelector('.affiliate-desc') || card.querySelector('p');
      if(!desc) return;

      card.dataset.showMoreReady = '1';

      setTimeout(function(){
        if(desc.scrollHeight <= 125) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'affiliate-show-more-btn';
        btn.textContent = 'Show More';

        btn.addEventListener('click', function(){
          const beforeTop = card.getBoundingClientRect().top;
          const expanded = card.classList.toggle('is-expanded');
          btn.textContent = expanded ? 'Hide' : 'Show More';

          // Bila tekan Hide, card mengecil dan browser boleh lompat ke bawah.
          // Ini kekalkan kedudukan card supaya view tak lari.
          requestAnimationFrame(function(){
            const afterTop = card.getBoundingClientRect().top;
            window.scrollBy({
              top: afterTop - beforeTop,
              left: 0,
              behavior: 'auto'
            });
          });
        });

        desc.insertAdjacentElement('afterend', btn);
      }, 50);
    });
  }

  setupAffiliateShowMore();

  const affiliateArea = document.getElementById('affiliateProducts') || document.body;
  const obs = new MutationObserver(function(){
    setupAffiliateShowMore();
  });
  obs.observe(affiliateArea, {childList:true, subtree:true});
});
