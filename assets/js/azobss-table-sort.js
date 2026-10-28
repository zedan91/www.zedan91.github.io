(function () {
  'use strict';

  const collator = new Intl.Collator('en-MY', {
    numeric: true,
    sensitivity: 'base'
  });

  function compareValues(left, right) {
    if (typeof left === 'number' && typeof right === 'number') return left - right;
    return collator.compare(String(left ?? '').trim(), String(right ?? '').trim());
  }

  function create(options) {
    const root = options && options.root;
    const attribute = options && options.attribute;
    const onChange = options && options.onChange;
    if (!root || !attribute) return null;

    const buttons = Array.from(root.querySelectorAll(`[${attribute}]`));
    let key = '_sourceIndex';
    let direction = 'asc';

    function updateHeaders() {
      buttons.forEach((button) => {
        const active = button.getAttribute(attribute) === key;
        const header = button.closest('th');
        button.dataset.sortDirection = active ? direction : '';
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
        if (header) header.setAttribute('aria-sort', active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none');
      });
    }

    function sort(rows) {
      const multiplier = direction === 'desc' ? -1 : 1;
      return (Array.isArray(rows) ? rows.slice() : []).sort((left, right) => {
        const leftValue = key === '_sourceIndex' ? Number(left._sourceIndex || 0) : left[key];
        const rightValue = key === '_sourceIndex' ? Number(right._sourceIndex || 0) : right[key];
        const result = compareValues(leftValue, rightValue);
        if (result) return result * multiplier;
        return compareValues(Number(left._sourceIndex || 0), Number(right._sourceIndex || 0));
      });
    }

    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        const nextKey = button.getAttribute(attribute);
        if (!nextKey) return;
        if (key === nextKey) direction = direction === 'asc' ? 'desc' : 'asc';
        else {
          key = nextKey;
          direction = 'asc';
        }
        updateHeaders();
        if (typeof onChange === 'function') onChange();
      });
    });

    updateHeaders();
    return { sort, updateHeaders };
  }

  window.azobssTableSort = { create };
})();
