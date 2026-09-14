/* NS Per: a navigable version of the author's representative-track diagram.
   Text and controls are HTML; only the stellar cartoons and connectors use SVG.
   Periods/times deliberately retain the rounding of the supplied diagram.
   API: const map = BinaryEvolutionMap.mount(element, onSelect);
        map.update({i: 0..6}, 'success'|'merger'|'detached'); map.destroy();
   BinaryEvolutionMap.update(state, branch) also targets the latest mounted map. */
(function (root) {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const mounted = new WeakMap();
  let serial = 0;
  let latest = null;
  const stages = [
    { i: 0, kind: 'initial', time: 't = 0', title: 'Initial binary', detail: '5.1 + 0.88 M☉', period: 'P = 1801 d' },
    { i: 1, kind: 'giant', time: '115 Myr', title: 'AGB giant overflows', period: 'P = 1256 d' },
    { i: 2, kind: 'envelope', time: '', title: 'Common envelope', detail: 'One envelope, two stars' },
    { i: 3, kind: 'survivor', time: 'α<sub>CE</sub> = 0.2', title: 'WD + K dwarf', period: 'P = 7.2 h' },
    { i: 5, kind: 'contact', time: '128 Myr', title: 'Roche-lobe overflow', period: 'P = 6.3 h' },
    { i: 6, kind: 'accreting', time: '209 Myr', title: 'Dwarf nova today', period: 'P = 6.2 h' }
  ];

  function cartoon(kind, prefix) {
    const circle = (x, y, r, fill, extra = '') =>
      `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${extra || 'stroke="currentColor" stroke-width="1.7"'}/>`;
    const warm = `url(#${prefix}-warm)`;
    const blue = `url(#${prefix}-blue)`;
    const red = `url(#${prefix}-red)`;
    const wd = `url(#${prefix}-wd)`;
    let shapes = '';
    if (kind === 'initial') shapes = circle(31, 42, 22, blue) + circle(91, 42, 10.5, warm);
    if (kind === 'giant') shapes =
      `<path d="M37 12 C55 18 69 28 85 38 L85 46 C69 57 55 64 37 72 Z" fill="${red}" stroke="currentColor" stroke-width="1.7"/>` +
      circle(35, 42, 30, red) + circle(35, 42, 4.3, '#833224', 'stroke="none"') + circle(96, 42, 10, warm);
    if (kind === 'envelope') shapes =
      '<ellipse cx="58" cy="42" rx="51" ry="36" fill="#eab2a5" fill-opacity=".43" stroke="#bc6656" stroke-width="1.4"/>' +
      '<ellipse cx="58" cy="42" rx="41" ry="25" fill="none" stroke="#bc6656" stroke-opacity=".23" stroke-width="1"/>' +
      circle(38, 42, 5.5, '#833224', 'stroke="none"') + circle(78, 42, 9.5, warm);
    if (kind === 'survivor') shapes = circle(32, 42, 9, wd) + circle(86, 42, 12, warm);
    if (kind === 'contact' || kind === 'accreting') shapes =
      `<path d="M79 34 Q57 36 39 40 L39 45 Q61 48 79 51 Z" fill="${warm}" stroke="currentColor" stroke-width="1.6"/>` +
      '<ellipse cx="27" cy="42" rx="19" ry="15" fill="#efc378" fill-opacity=".17" stroke="#c58a26" stroke-width="2.2"/>' +
      '<ellipse cx="27" cy="42" rx="14" ry="11" fill="none" stroke="#e4ac46" stroke-width=".9"/>' +
      circle(27, 42, 8.5, wd) + circle(89, 42, 14.5, warm) +
      '<circle cx="45" cy="40" r="2.3" fill="#f7d593"/>';
    if (kind === 'merger') shapes = circle(58, 42, 27, red);
    if (kind === 'detached') shapes = circle(27, 42, 9, wd) + circle(94, 42, 12, warm);
    return `<svg class="bem-cartoon" viewBox="0 0 116 84" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="${prefix}-warm" cx="35%" cy="28%" r="76%"><stop offset="0" stop-color="#f8cd69"/><stop offset=".65" stop-color="#e5a331"/><stop offset="1" stop-color="#c78820"/></radialGradient>
        <radialGradient id="${prefix}-blue" cx="34%" cy="28%" r="77%"><stop offset="0" stop-color="#edf2f6"/><stop offset=".7" stop-color="#c2d1df"/><stop offset="1" stop-color="#9bafc1"/></radialGradient>
        <radialGradient id="${prefix}-red" cx="35%" cy="26%" r="79%"><stop offset="0" stop-color="#e88569"/><stop offset=".64" stop-color="#cc5d43"/><stop offset="1" stop-color="#b84a34"/></radialGradient>
        <radialGradient id="${prefix}-wd" cx="34%" cy="28%" r="82%"><stop offset="0" stop-color="#fff"/><stop offset=".72" stop-color="#f7f7f4"/><stop offset="1" stop-color="#d6dadd"/></radialGradient>
      </defs>${shapes}</svg>`;
  }

  function mount(element, onSelect) {
    if (!element || typeof element.replaceChildren !== 'function') {
      throw new TypeError('BinaryEvolutionMap.mount requires a DOM element.');
    }
    if (mounted.has(element)) mounted.get(element).destroy();
    const doc = element.ownerDocument;
    const view = doc.defaultView || root;
    const id = `bem-${++serial}`;
    const section = doc.createElement('section');
    section.className = 'binary-evolution-map';
    section.setAttribute('aria-labelledby', `${id}-title`);
    section.innerHTML = `
      <div class="bem-head">
        <h3 id="${id}-title">One initial binary, three outcomes</h3>
        <p>NS Per · select a stage or an outcome to explore it</p>
      </div>
      <div class="bem-diagram">
        <svg class="bem-links" aria-hidden="true" focusable="false">
          <defs>
            <marker id="${id}-red-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M1 1 L7 4 L1 7 Z" fill="#a33c2d"/></marker>
            <marker id="${id}-grey-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M1 1 L7 4 L1 7 Z" fill="#756e62"/></marker>
          </defs><g class="bem-link-lines"></g>
        </svg>
        ${stages.map((stage, index) => `<button type="button" class="bem-stage bem-stage-${stage.i} bem-main" data-bem-stage="${stage.i}" data-bem-branch="success" style="--bem-column:${index + 1}" aria-label="${stage.title}, ${stage.time.replace(/<[^>]*>/g, '')}${stage.period ? ', ' + stage.period : ''}. Show this stage.">
          <span class="bem-time">${stage.time || '&nbsp;'}</span>
          <span class="bem-art">${cartoon(stage.kind, `${id}-${stage.kind}`)}</span>
          <span class="bem-title">${stage.title}</span>
          ${stage.detail ? `<span class="bem-detail">${stage.detail}</span>` : ''}
          ${stage.period ? `<span class="bem-period">${stage.period}</span>` : ''}
          <span class="bem-active-label" aria-hidden="true">Current stage</span>
        </button>`).join('')}
        <button type="button" class="bem-branch bem-merger" data-bem-stage="6" data-bem-branch="merger" aria-label="Choose the low-efficiency outcome: alpha CE less than or equal to 0.1, merger, no binary.">
          <span class="bem-efficiency">α<sub>CE</sub> ≤ 0.1</span>
          <span class="bem-art">${cartoon('merger', `${id}-merger`)}</span>
          <span class="bem-outcome"><span class="bem-title">Merger</span><span class="bem-detail">No binary</span></span>
          <span class="bem-active-label" aria-hidden="true">Current outcome</span>
        </button>
        <button type="button" class="bem-branch bem-detached" data-bem-stage="6" data-bem-branch="detached" aria-label="Choose the high-efficiency outcome: alpha CE greater than or equal to 0.35, period 16 to 75 hours, still detached at 209 million years.">
          <span class="bem-efficiency">α<sub>CE</sub> ≥ 0.35</span>
          <span class="bem-art">${cartoon('detached', `${id}-detached`)}</span>
          <span class="bem-outcome"><span class="bem-title">Still detached</span><span class="bem-period">P = 16–75 h</span><span class="bem-detail">At 209 Myr</span></span>
          <span class="bem-active-label" aria-hidden="true">Current outcome</span>
        </button>
        <button type="button" class="bem-tides" data-bem-stage="4" data-bem-branch="success" aria-label="Show 13 million years of detached evolution, dominated by tides in this model."><span>Tides · 13 Myr</span><span aria-hidden="true"> →</span></button>
      </div>
      <p class="bem-note">Representative initial binary: these discrete α<sub>CE</sub> trials are not universal efficiency thresholds. Diagram periods are rounded; today’s model is shown as 6.2 h, distinct from the observed 6.29500 ± 0.00050 h.</p>
    `;
    element.replaceChildren(section);
    const diagram = section.querySelector('.bem-diagram');
    const links = section.querySelector('.bem-links');
    const lines = section.querySelector('.bem-link-lines');
    const buttons = [...section.querySelectorAll('[data-bem-stage]')];
    const main = stages.map(stage => section.querySelector(`.bem-stage-${stage.i}`));
    const branchButtons = ['merger', 'detached'].map(branch => section.querySelector(`.bem-${branch}`));
    const tides = section.querySelector('.bem-tides');
    // Match the causal reading / keyboard order to the narrow-screen layout.
    branchButtons.forEach(button => diagram.insertBefore(button, main[3]));
    diagram.insertBefore(tides, main[4]);
    let activeBranch = 'success';
    let frame = null;
    let destroyed = false;
    let lastStateKey = '';

    function bounds(node, base, art = false) {
      const r = (art ? node.querySelector('.bem-art') : node).getBoundingClientRect();
      return { left: r.left - base.left, right: r.right - base.left, top: r.top - base.top, bottom: r.bottom - base.top, x: r.left - base.left + r.width / 2, y: r.top - base.top + r.height / 2 };
    }

    function drawLinks() {
      frame = null;
      if (destroyed) return;
      const base = diagram.getBoundingClientRect();
      if (base.width < 1 || base.height < 1) return;
      const vertical = view.getComputedStyle(diagram).getPropertyValue('--bem-vertical').trim() === '1';
      links.setAttribute('viewBox', `0 0 ${base.width} ${base.height}`);
      const nodes = main.map(node => bounds(node, base, true));
      const paths = [];
      function path(d, branch = 'success') {
        const p = doc.createElementNS(SVG_NS, 'path');
        p.setAttribute('d', d);
        p.setAttribute('class', branch === 'success' ? 'bem-link-main' : 'bem-link-alternative');
        p.setAttribute('marker-end', `url(#${id}-${branch === 'success' ? 'red' : 'grey'}-arrow)`);
        paths.push(p);
      }
      for (let j = 0; j < nodes.length - 1; j++) {
        const a = nodes[j], b = nodes[j + 1];
        if (vertical) {
          path(`M ${a.x} ${a.bottom + 3} L ${b.x} ${b.top - 4}`);
        } else {
          // Anchors follow the HTML art boxes, so the arrows never cross text.
          path(`M ${a.right + 2} ${a.y} L ${b.left - 3} ${b.y}`);
        }
      }
      const ce = nodes[2];
      branchButtons.forEach(button => {
        const b = bounds(button, base, true);
        if (vertical) {
          path(`M ${ce.x} ${ce.bottom + 5} L ${ce.x} ${b.y} L ${b.left - 6} ${b.y}`, 'alternative');
        } else {
          // Route the fork through the inter-column gutter. A diagonal from
          // the CE artwork would cut through its multi-line HTML caption.
          const ceButton = bounds(main[2], base);
          const wdButton = bounds(main[3], base);
          const gutterX = (ceButton.right + wdButton.left) / 2;
          const end = bounds(button, base);
          path(`M ${ce.right + 2} ${ce.y} L ${gutterX} ${ce.y} L ${gutterX} ${b.y} L ${end.left - 4} ${b.y}`, 'alternative');
        }
      });
      // The shared trunk remains red where a neutral alternative joins it.
      lines.replaceChildren(
        ...paths.filter(p => p.getAttribute('class') === 'bem-link-alternative'),
        ...paths.filter(p => p.getAttribute('class') === 'bem-link-main')
      );
    }

    function scheduleLinks() {
      if (destroyed || frame !== null) return;
      frame = view.requestAnimationFrame(drawLinks);
    }

    function select(event) {
      const button = event.target.closest('[data-bem-stage]');
      if (!button || !section.contains(button)) return;
      const stage = Number(button.dataset.bemStage);
      // Shared pre-CE nodes retain an explicitly selected alternative branch.
      const branch = stage <= 2 ? activeBranch : button.dataset.bemBranch;
      if (typeof onSelect === 'function') onSelect({ branch, stage });
    }

    function update(state, branch) {
      if (destroyed) return;
      const candidate = branch || (state && state.branch) || 'success';
      activeBranch = ['success', 'merger', 'detached'].includes(candidate) ? candidate : 'success';
      const raw = Number(state && state.i);
      const stage = Number.isFinite(raw) ? Math.max(0, Math.min(6, Math.floor(raw))) : 0;
      const key = `${stage}:${activeBranch}`;
      if (key === lastStateKey) return;
      lastStateKey = key;
      section.dataset.branch = activeBranch;
      section.dataset.stage = String(stage);
      buttons.forEach(button => {
        const index = Number(button.dataset.bemStage);
        const isAlternative = button.classList.contains('bem-branch');
        const current = isAlternative ? activeBranch === button.dataset.bemBranch && stage >= 3 :
          (stage <= 2 || activeBranch === 'success') && index === stage;
        button.classList.toggle('is-current', current);
        if (current) button.setAttribute('aria-current', 'step');
        else button.removeAttribute('aria-current');
      });
      // Detached evolution lies between the post-CE binary and Roche contact.
      main[3].classList.toggle('is-in-transit', activeBranch === 'success' && stage === 4);
      tides.classList.toggle('is-current', activeBranch === 'success' && stage === 4);
      scheduleLinks();
    }

    const observer = typeof view.ResizeObserver === 'function' ? new view.ResizeObserver(scheduleLinks) : null;
    if (observer) observer.observe(diagram);
    else view.addEventListener('resize', scheduleLinks);
    section.addEventListener('click', select);
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(scheduleLinks);
    const api = {
      update,
      destroy() {
        if (destroyed) return;
        destroyed = true;
        if (frame !== null) view.cancelAnimationFrame(frame);
        if (observer) observer.disconnect();
        else view.removeEventListener('resize', scheduleLinks);
        section.removeEventListener('click', select);
        section.remove();
        mounted.delete(element);
        if (latest === api) latest = null;
      }
    };
    mounted.set(element, api);
    latest = api;
    update({ i: 0 }, 'success');
    scheduleLinks();
    return api;
  }

  root.BinaryEvolutionMap = {
    mount,
    update(state, branch) { if (latest) latest.update(state, branch); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
