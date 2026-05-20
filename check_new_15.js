
(function () {
  function cleanPaValue(value) {
    return String(value || '')
      .trim()
      .toUpperCase()
      .replace(/^PA/i, '')
      .replace(/\.TIF$/i, '')
      .replace(/[^0-9]/g, '');
  }

  function buildJupemPaUrl() {
    var paInput = document.getElementById('paNumber');
    var negeriInput = document.getElementById('negeri');
    var number = cleanPaValue(paInput ? paInput.value : '');
    var negeri = negeriInput ? negeriInput.value : '';

    if (!number || !negeri) {
      return '';
    }

    return 'https://ebiz.jupem.gov.my/MuatTurunPembelian/MuatTurunPelanAkui?noPa=PA' + number + '.TIF&negeri=' + encodeURIComponent(negeri);
  }

  window.azobssDirectPaDownload = function (event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
    }

    var paError = document.getElementById('paError');
    var paStatus = document.getElementById('paStatus');
    var url = buildJupemPaUrl();

    if (!url) {
      if (paError) {
        paError.textContent = 'Please enter the PA number and select a state first.';
      }
      return false;
    }

    if (paError) {
      paError.textContent = '';
    }

    if (paStatus) {
      paStatus.style.display = 'block';
      paStatus.textContent = 'Opening JUPEM PA download...';
    }

    window.open(url, '_blank', 'noopener');
    return false;
  };

  function bindPaDownloadFallback() {
    var form = document.getElementById('paForm');
    var button = document.getElementById('downloadTifButton');

    if (form) {
      form.setAttribute('action', '');
      form.setAttribute('onsubmit', 'return azobssDirectPaDownload(event);');
      form.addEventListener('submit', window.azobssDirectPaDownload, true);
    }

    if (button) {
      button.setAttribute('type', 'button');
      button.setAttribute('onclick', 'return azobssDirectPaDownload(event);');
      button.addEventListener('click', window.azobssDirectPaDownload, true);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindPaDownloadFallback);
  } else {
    bindPaDownloadFallback();
  }
})();
