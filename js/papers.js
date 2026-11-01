/* Progressive enhancement for manuscript-backed figures. No model/API calls. */
(() => {
  'use strict';
  const dataNode = document.getElementById('paper-results-data');
  if (!dataNode) return;
  const data = JSON.parse(dataNode.textContent);
  document.documentElement.classList.add('has-js');

  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n).toFixed(2);
  const refSelect = document.getElementById('refsel-cohort');
  const refBars = document.getElementById('refsel-bars');
  const refNote = document.getElementById('refsel-chart-note');
  function renderRefsel() {
    const cohort = data.refsel[refSelect.value];
    const nodes = cohort.rows.map(row => {
      const item = make('div', 'bar-row');
      const label = make('div', 'bar-label', row.label);
      if (row.detail) label.append(make('small', '', row.detail));
      const track = make('div', 'bar-track');
      track.setAttribute('aria-hidden', 'true');
      const fill = make('div', 'bar-fill ' + row.kind);
      fill.style.width = `${row.f1 * 100}%`;
      track.append(fill);
      item.append(label, track, make('div', 'bar-value', row.f1.toFixed(3)));
      return item;
    });
    refBars.replaceChildren(...nodes);
    refBars.setAttribute('aria-label', cohort.label + ': macro F1 from 0 to 1');
    refNote.textContent = cohort.note;
    document.getElementById('refsel-result-status').textContent = cohort.label + '. ' + cohort.note;
  }
  refSelect.addEventListener('change', renderRefsel);

  const targetRange = document.getElementById('target-count');
  function renderTargets() {
    const n = Number(targetRange.value);
    document.getElementById('target-count-value').value = n;
    const confidence = (99 / n).toFixed(1);
    const cells = Array.from({length: n}, (_, i) => {
      const cell = make('div', 'target-cell', 'Target ' + String.fromCharCode(65 + i));
      cell.append(make('strong', '', confidence + '%'), make('span', '', 'confidence'));
      return cell;
    });
    document.getElementById('ambiguity-targets').replaceChildren(...cells);
    document.getElementById('ambiguity-result').textContent =
      `${n} indistinguishable target${n === 1 ? '' : 's'}: each receives ${confidence}% confidence when the estimated probability of some reference is 99%. The conditional selection ceiling is ${(100 / n).toFixed(1)}%.`;
  }
  targetRange.addEventListener('input', renderTargets);

  const modelSelect = document.getElementById('burr-model');
  function renderBurr() {
    const model = data.burr.models[modelSelect.value];
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 720 360');
    svg.setAttribute('class', 'delta-chart');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-labelledby', 'delta-title delta-desc');
    function s(tag, attrs, text) {
      const e = document.createElementNS(ns, tag);
      for (const [key, value] of Object.entries(attrs)) e.setAttribute(key, value);
      if (text !== undefined) e.textContent = text;
      svg.append(e);
      return e;
    }
    s('title', {id: 'delta-title'}, model.label + ': per-table minus whole-schema F1');
    s('desc', {id: 'delta-desc'}, 'Eight database means, three runs each. Left is worse with per-table generation; right is better. Exact values appear below the chart.');
    const x = v => 420 + v * 1200;
    for (const v of [-.2, -.1, 0, .1, .2]) {
      s('line', {x1: x(v), x2: x(v), y1: 28, y2: 318, class: v === 0 ? 'zero-line' : 'grid-line'});
      s('text', {x: x(v), y: 347, 'text-anchor': 'middle', class: 'axis-label'}, signed(v));
    }
    model.rows.forEach((row, i) => {
      const y = 44 + i * 37;
      s('text', {x: 0, y: y + 5}, row.database);
      s('text', {x: 113, y: y + 5, class: 'axis-label'}, row.tables + ' tables');
      const bar = s('rect', {x: Math.min(x(0), x(row.delta)), y: y - 9, width: Math.max(2, Math.abs(row.delta) * 1200), height: 18, rx: 2, class: row.delta < 0 ? 'negative' : 'positive'});
      const title = document.createElementNS(ns, 'title');
      title.textContent = row.database + ': ' + signed(row.delta) + ' three-way F1';
      bar.append(title);
      s('text', {x: row.delta < 0 ? x(row.delta) - 9 : x(row.delta) + 10, y: y + 5, 'text-anchor': row.delta < 0 ? 'end' : 'start', class: 'delta-value'}, signed(row.delta));
    });
    const compact = make('div', 'delta-mobile');
    const scale = make('div', 'chart-scale');
    const ticks = make('div', 'ticks');
    ['−0.20', '0', '+0.20'].forEach(value => ticks.append(make('span', '', value)));
    scale.append(make('span', '', 'DATABASE'), ticks, make('span', '', 'ΔF1'));
    compact.append(scale);
    model.rows.forEach(row => {
      const item = make('div', 'bar-row');
      const label = make('div', 'bar-label', row.database);
      label.append(make('small', '', row.tables + ' tables'));
      const track = make('div', 'delta-track');
      track.setAttribute('aria-hidden', 'true');
      const bar = make('div', 'delta-fill' + (row.delta < 0 ? ' negative' : ''));
      bar.style.width = Math.max(0.6, Math.abs(row.delta) * 250) + '%';
      bar.style.left = (row.delta < 0 ? 50 + row.delta * 250 : 50) + '%';
      track.append(bar);
      item.append(label, track, make('div', 'bar-value', signed(row.delta)));
      compact.append(item);
    });
    document.getElementById('burr-delta-chart').replaceChildren(svg, compact);
    const tbody = document.getElementById('burr-table-body');
    tbody.replaceChildren(...model.rows.map(row => {
      const tr = make('tr');
      const th = make('th', '', row.database + ' (' + row.tables + ')');
      th.scope = 'row';
      tr.append(th, make('td', '', row.whole.map(v => v.toFixed(2)).join(' / ')), make('td', '', row.perTable.map(v => v.toFixed(2)).join(' / ')), make('td', '', signed(row.delta)));
      return tr;
    }));
    document.getElementById('burr-table-caption').textContent = model.label + ' · class / relation / attribute F1. Published rounded values from Table II.';
    document.getElementById('burr-delta-summary').textContent =
      `${model.label}: eight-database mean ΔF1 ${signed(model.meanDelta)}; 95% bootstrap CI [${signed(model.ci[0])}, ${signed(model.ci[1])}]. All three models’ intervals include zero. Non-significance does not establish equivalence.`;
    document.getElementById('burr-result-status').textContent = model.label + ' selected. Mean change ' + signed(model.meanDelta) + ' F1.';
  }
  modelSelect.addEventListener('change', renderBurr);

  const dialog = document.getElementById('figure-lightbox');
  let lastFigureLink;
  if (dialog && typeof dialog.showModal === 'function') {
    document.querySelectorAll('a[data-figure]').forEach(link => {
      link.addEventListener('click', event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        lastFigureLink = link;
        const figure = link.closest('figure');
        const image = document.getElementById('lightbox-image');
        image.src = link.href;
        image.alt = link.querySelector('img').alt;
        document.getElementById('lightbox-caption').textContent = figure.querySelector('figcaption').textContent;
        document.getElementById('lightbox-original').href = link.href;
        dialog.showModal();
      });
    });
    document.getElementById('lightbox-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => lastFigureLink?.focus({preventScroll: true}));
  }

  if ('IntersectionObserver' in window) {
    const links = document.querySelectorAll('.reading-nav a');
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        links.forEach(link => {
          if (link.hash === '#' + entry.target.id) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      });
    }, {rootMargin: '-110px 0px -60% 0px', threshold: 0});
    document.querySelectorAll('section[data-reader-section]').forEach(section => observer.observe(section));
  }
})();
