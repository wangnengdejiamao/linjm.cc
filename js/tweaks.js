/* =================================================================
   Appearance tweaks — three expressive, feel-reshaping controls that
   re-tokenize the whole site (every surface, line, ink and accent is a
   CSS variable, so one panel restyles everything at once):
     · Mood     — full palette / atmosphere  (Observatory · Deep space · Noir)
     · Accent   — the single signature hue    (5 curated swatches)
     · Density  — spatial rhythm & breathing  (Compact · Comfortable · Spacious)
   State persists in localStorage; a tiny inline <head> bootstrap re-applies
   the cached CSS before first paint so there is no flash.
   ================================================================= */
(function () {
  var KEY = 'linjm-tweaks', CSS_KEY = 'linjm-tweak-css';

  var MOODS = {
    observatory: { label: 'Observatory',
      bg:'#14110b', bg2:'#100e09', s:'#1d190f', s2:'#252013', s3:'#2f2817',
      line:'#352e1d', lineS:'#473d27', ink:'#efe7d4', inkSoft:'#b4a98e', inkDim:'#857a61',
      well:'#0c0a06', glow:'rgba(224,151,90,.07)' },
    deepspace: { label: 'Deep space',
      bg:'#0b0e16', bg2:'#080a11', s:'#12161f', s2:'#171c28', s3:'#1f2533',
      line:'#222a3a', lineS:'#313c52', ink:'#e6ebf5', inkSoft:'#9fadc6', inkDim:'#6b7790',
      well:'#070910', glow:'rgba(86,180,233,.07)' },
    noir: { label: 'Noir',
      bg:'#121212', bg2:'#0d0d0d', s:'#1a1a1a', s2:'#222222', s3:'#2c2c2c',
      line:'#2a2a2a', lineS:'#3a3a3a', ink:'#ededed', inkSoft:'#b0b0b0', inkDim:'#7a7a7a',
      well:'#080808', glow:'rgba(255,255,255,.035)' },
  };
  var ACCENTS = {
    amber:  ['#e0975a', '#eeb079', '#bf7733'],
    coral:  ['#e0726f', '#ec918f', '#c1514e'],
    cyan:   ['#4cc6d8', '#74d6e4', '#2f9aab'],
    violet: ['#b08ce0', '#c6a8ec', '#8d63c4'],
    green:  ['#4fc28a', '#74d2a4', '#2f9c69'],
  };
  var ACC_ORDER = ['amber', 'coral', 'cyan', 'violet', 'green'];
  var DENS = {
    compact:     { label: 'Compact',     base:'15px', sec:'clamp(2rem,5vw,3.5rem)',  hero:'clamp(2.6rem,6vw,4.5rem)', head:'1.8rem', card:'1.35rem', gap:'.7rem' },
    comfortable: { label: 'Comfortable', base:'16px', sec:'clamp(3rem,7vw,5.5rem)',  hero:'clamp(3.5rem,9vw,7rem)',   head:'2.6rem', card:'1.7rem',  gap:'1rem' },
    spacious:    { label: 'Spacious',    base:'17px', sec:'clamp(4rem,9vw,7.5rem)',  hero:'clamp(4.6rem,11vw,8.5rem)',head:'3.3rem', card:'2.1rem',  gap:'1.35rem' },
  };
  var DEFAULTS = { mood: 'observatory', accent: 'amber', density: 'comfortable' };

  function load() {
    try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY) || '{}')); }
    catch (e) { return Object.assign({}, DEFAULTS); }
  }
  function save(st) {
    try { localStorage.setItem(KEY, JSON.stringify(st)); localStorage.setItem(CSS_KEY, buildCSS(st)); }
    catch (e) {}
  }

  function buildCSS(st) {
    var m = MOODS[st.mood] || MOODS.observatory;
    var a = ACCENTS[st.accent] || ACCENTS.amber;
    var d = DENS[st.density] || DENS.comfortable;
    var c = ':root{'
      + '--bg:' + m.bg + ';--bg-2:' + m.bg2 + ';--surface:' + m.s + ';--surface-2:' + m.s2 + ';--surface-3:' + m.s3 + ';'
      + '--line:' + m.line + ';--line-strong:' + m.lineS + ';--ink:' + m.ink + ';--ink-soft:' + m.inkSoft + ';--ink-dim:' + m.inkDim + ';'
      + '--well:' + m.well + ';--accent:' + a[0] + ';--accent-soft:' + a[1] + ';--accent-deep:' + a[2] + ';}';
    c += 'body{background-image:radial-gradient(1100px 620px at 78% -8%,' + m.glow + ',transparent 60%);font-size:' + d.base + ';}';
    c += '.section{padding-top:' + d.sec + ';padding-bottom:' + d.sec + ';}';
    c += '.hero{padding-top:' + d.hero + ';}';
    c += '.section-head{margin-bottom:' + d.head + ';}';
    c += '.card,.skill{padding:' + d.card + ';}';
    c += '.cards,.skills-grid{gap:' + d.gap + ';}';
    return c;
  }

  function apply(st) {
    var el = document.getElementById('tweak-overrides');
    if (!el) { el = document.createElement('style'); el.id = 'tweak-overrides'; document.head.appendChild(el); }
    el.textContent = buildCSS(st);
    // let any canvas visualisation re-fit to its (possibly) resized container
    try { window.dispatchEvent(new Event('resize')); } catch (e) {}
  }

  var state = load();
  apply(state);  // ensure live even if the inline bootstrap was skipped

  // ---------------- panel UI ----------------
  function el(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }

  var launch = el('button', 'tweak-launch');
  launch.setAttribute('aria-haspopup', 'dialog');
  launch.setAttribute('aria-expanded', 'false');
  launch.setAttribute('aria-label', 'Appearance settings');
  launch.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true">'
    + '<line x1="4" y1="8" x2="20" y2="8"></line><circle cx="10" cy="8" r="2.5" fill="var(--surface)"></circle>'
    + '<line x1="4" y1="16" x2="20" y2="16"></line><circle cx="16" cy="16" r="2.5" fill="var(--surface)"></circle></svg>'
    + '<span class="tw-txt">Appearance</span>';

  var panel = el('div', 'tweak-panel');
  panel.id = 'tweakPanel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Appearance settings');
  panel.hidden = true;

  var head = el('div', 'tweak-head',
    '<h4>Appearance</h4><span class="tw-sub">retheme</span>');
  var close = el('button', 'tweak-close', '\u00d7');
  close.setAttribute('aria-label', 'Close');
  panel.appendChild(head); panel.appendChild(close);

  // Mood
  var gMood = el('div', 'tweak-group');
  gMood.appendChild(el('span', 'tweak-lab', 'Mood'));
  var segMood = el('div', 'tweak-seg');
  ['observatory', 'deepspace', 'noir'].forEach(function (k) {
    var b = el('button', null, MOODS[k].label); b.dataset.mood = k;
    b.addEventListener('click', function () { set('mood', k); });
    segMood.appendChild(b);
  });
  gMood.appendChild(segMood); panel.appendChild(gMood);

  // Accent
  var gAcc = el('div', 'tweak-group');
  gAcc.appendChild(el('span', 'tweak-lab', 'Accent'));
  var sws = el('div', 'tweak-sws');
  ACC_ORDER.forEach(function (k) {
    var b = el('button', 'tweak-sw'); b.dataset.accent = k;
    b.style.color = ACCENTS[k][0];
    b.setAttribute('aria-label', k);
    b.addEventListener('click', function () { set('accent', k); });
    sws.appendChild(b);
  });
  gAcc.appendChild(sws); panel.appendChild(gAcc);

  // Density
  var gDen = el('div', 'tweak-group');
  gDen.appendChild(el('span', 'tweak-lab', 'Density'));
  var segDen = el('div', 'tweak-seg');
  ['compact', 'comfortable', 'spacious'].forEach(function (k) {
    var b = el('button', null, DENS[k].label); b.dataset.density = k;
    b.addEventListener('click', function () { set('density', k); });
    segDen.appendChild(b);
  });
  gDen.appendChild(segDen); panel.appendChild(gDen);

  // Footer
  var foot = el('div', 'tweak-foot');
  var stateLab = el('span', 'tw-state', '');
  var reset = el('button', 'tweak-reset', 'Reset');
  reset.addEventListener('click', function () { state = Object.assign({}, DEFAULTS); commit(); });
  foot.appendChild(stateLab); foot.appendChild(reset);
  panel.appendChild(foot);

  document.body.appendChild(launch);
  document.body.appendChild(panel);

  function set(key, val) { state[key] = val; commit(); }
  function commit() { apply(state); save(state); render(); }

  function render() {
    segMood.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.mood === state.mood)); });
    sws.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.accent === state.accent)); });
    segDen.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.density === state.density)); });
    stateLab.textContent = MOODS[state.mood].label + ' · ' + state.accent + ' · ' + DENS[state.density].label;
  }
  render();

  // open / close
  function open() { panel.hidden = false; launch.setAttribute('aria-expanded', 'true'); document.addEventListener('mousedown', outside); document.addEventListener('keydown', onKey); }
  function shut() { panel.hidden = true; launch.setAttribute('aria-expanded', 'false'); document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', onKey); }
  function outside(e) { if (!panel.contains(e.target) && !launch.contains(e.target)) shut(); }
  function onKey(e) { if (e.key === 'Escape') shut(); }
  launch.addEventListener('click', function () { panel.hidden ? open() : shut(); });
  close.addEventListener('click', shut);
})();
