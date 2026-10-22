/* palette-studio-bd -- DOM app. Pure ASCII. State in localStorage only. */
(function () {
  'use strict';
  var L = window.PALETTE_LOGIC;
  var I18N = window.PALETTE_I18N;
  var KEY = 'palette-studio-bd:v1';

  var state = load();
  function defaults() {
    return { lang: 'en', base: '#2563EB', harmony: 'COMPLEMENTARY', saved: [] };
  }
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      var d = JSON.parse(raw);
      if (!d || typeof d !== 'object') return defaults();
      return {
        lang: d.lang === 'bn' ? 'bn' : 'en',
        base: L.isValidHex(d.base) ? L.normalizeHex(d.base) : '#2563EB',
        harmony: L.HARMONY_TYPES.indexOf(d.harmony) !== -1 ? d.harmony : 'COMPLEMENTARY',
        saved: Array.isArray(d.saved) ? d.saved.filter(function (p) { return L.validatePalette(p); }) : []
      };
    } catch (e) { return defaults(); }
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage full/blocked: keep in-memory */ }
  }
  function t() { return I18N.STR[state.lang]; }
  function digits(s) { return state.lang === 'bn' ? I18N.bnDigits(s) : String(s); }

  function $(id) { return document.getElementById(id); }
  function show(el, msg, cls) {
    el.textContent = msg;
    el.className = cls || 'ok';
    el.hidden = false;
  }
  function hide(el) { el.hidden = true; el.textContent = ''; }

  function textColorFor(hex) {
    var lum = L.luminance(hex);
    return lum !== null && lum > 0.4 ? '#111827' : '#FFFFFF';
  }
  function swatchBtn(hex) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.dataset.hex = hex;
    var chip = document.createElement('span');
    chip.className = 'chip';
    chip.style.display = 'block';
    chip.style.background = hex;
    var label = document.createElement('span');
    label.className = 'hex';
    label.textContent = hex;
    label.style.color = textColorFor(hex);
    b.appendChild(chip);
    b.appendChild(label);
    b.addEventListener('click', function () { copyText(hex, t().copied + ' ' + hex); });
    return b;
  }
  function copyText(text, msg) {
    function done() { show($('copyMsg'), msg, 'ok'); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    } else { fallbackCopy(text); done(); }
  }
  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (e) { /* clipboard unavailable: feedback still shown */ }
  }

  function renderI18n() {
    var s = t();
    $('appTitle').textContent = s.title;
    $('appSubtitle').textContent = s.subtitle;
    $('langBtn').textContent = s.langBtn;
    $('baseLabel').textContent = s.baseLabel;
    $('hexLabel').textContent = s.hexLabel;
    $('randomBtn').textContent = s.randomBtn;
    $('harmonyLabel').textContent = s.harmonyLabel;
    $('harmonyHint').textContent = s.harmonyHint;
    $('scaleLabel').textContent = s.scaleLabel;
    $('contrastLabel').textContent = s.contrastLabel;
    $('fgLabel').textContent = s.fgLabel;
    $('bgLabel').textContent = s.bgLabel;
    $('ratioLabel').textContent = s.ratioLabel;
    $('aaNormalLabel').textContent = s.aaNormal;
    $('aaLargeLabel').textContent = s.aaLarge;
    $('aaaNormalLabel').textContent = s.aaaNormal;
    $('aaaLargeLabel').textContent = s.aaaLarge;
    $('contrastNote').textContent = s.contrastNote;
    $('exportLabel').textContent = s.exportLabel;
    $('exportCssBtn').textContent = s.exportCss;
    $('exportJsonBtn').textContent = s.exportJson;
    $('copyExportBtn').textContent = s.copyExport;
    $('savedLabel').textContent = s.savedLabel;
    $('paletteNameLabel').textContent = s.paletteName;
    $('saveBtn').textContent = s.saveBtn;
    $('eraseLabel').textContent = s.eraseLabel;
    $('eraseHint').textContent = s.eraseHint;
    $('eraseBtn').textContent = s.eraseBtn;
    $('footerText').textContent = s.footer;
    // Harmony buttons
    var wrap = $('harmonyBtns');
    wrap.innerHTML = '';
    L.HARMONY_TYPES.forEach(function (type) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn secondary' + (state.harmony === type ? ' active' : '');
      b.dataset.harmony = type;
      b.textContent = s.harmony[type];
      b.addEventListener('click', function () { state.harmony = type; persist(); render(); });
      wrap.appendChild(b);
    });
  }

  function renderHarmony() {
    var row = $('harmonyRow');
    row.innerHTML = '';
    var colors = L.harmony(state.base, state.harmony) || [];
    colors.forEach(function (hex) { row.appendChild(swatchBtn(hex)); });
  }
  function renderScale() {
    var row = $('scaleRow');
    row.innerHTML = '';
    var colors = L.scale(state.base) || [];
    colors.forEach(function (hex) { row.appendChild(swatchBtn(hex)); });
  }
  function currentColors() {
    return L.harmony(state.base, state.harmony) || [];
  }
  function renderContrast() {
    var fg = $('fgHex').value;
    var bg = $('bgHex').value;
    var ratio = L.contrastRatio(fg, bg);
    $('contrastRatio').textContent = digits(L.formatRatio(ratio));
    var v = L.contrastVerdict(ratio);
    var s = t();
    function badge(id, ok) {
      var el = $(id);
      el.textContent = ok === null ? '--' : (ok ? s.pass : s.fail);
      el.className = 'badge' + (ok === null ? '' : (ok ? ' pass' : ' fail'));
    }
    if (!v) {
      badge('aaNormalBadge', null); badge('aaLargeBadge', null);
      badge('aaaNormalBadge', null); badge('aaaLargeBadge', null);
      show($('contrastError'), s.invalidHex, 'error');
    } else {
      hide($('contrastError'));
      badge('aaNormalBadge', v.aaNormal);
      badge('aaLargeBadge', v.aaLarge);
      badge('aaaNormalBadge', v.aaaNormal);
      badge('aaaLargeBadge', v.aaaLarge);
    }
  }
  function renderSaved() {
    var list = $('savedList');
    list.innerHTML = '';
    var s = t();
    $('savedEmpty').hidden = state.saved.length > 0;
    $('savedEmpty').textContent = s.savedEmpty;
    state.saved.forEach(function (p) {
      var li = document.createElement('li');
      var mini = document.createElement('span');
      mini.className = 'mini';
      p.colors.forEach(function (hex) {
        var i = document.createElement('i');
        i.style.background = hex;
        mini.appendChild(i);
      });
      var name = document.createElement('span');
      name.className = 'pname';
      name.textContent = p.name + ' (' + p.harmony.toLowerCase() + ')';
      var loadBtn = document.createElement('button');
      loadBtn.type = 'button';
      loadBtn.className = 'btn secondary';
      loadBtn.textContent = s.loadBtn;
      loadBtn.addEventListener('click', function () {
        state.base = p.base; state.harmony = p.harmony;
        persist(); syncBaseInputs(); render();
      });
      var delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn secondary';
      delBtn.textContent = s.deleteBtn;
      delBtn.addEventListener('click', function () {
        state.saved = state.saved.filter(function (x) { return x.id !== p.id; });
        persist(); renderSaved();
      });
      li.appendChild(mini); li.appendChild(name); li.appendChild(loadBtn); li.appendChild(delBtn);
      list.appendChild(li);
    });
  }
  function syncBaseInputs() {
    $('baseColor').value = state.base.toLowerCase();
    $('baseHex').value = state.base;
  }
  function render() {
    renderI18n();
    syncBaseInputs();
    renderHarmony();
    renderScale();
    renderContrast();
    renderSaved();
  }

  function setBase(hex) {
    var norm = L.normalizeHex(hex);
    if (!norm) { show($('baseError'), t().invalidHex, 'error'); return false; }
    hide($('baseError'));
    state.base = norm;
    persist();
    syncBaseInputs();
    renderHarmony();
    renderScale();
    return true;
  }
  function cryptoRng() {
    var a = new Uint32Array(1);
    window.crypto.getRandomValues(a);
    return a[0] / 4294967296;
  }

  function bind() {
    $('langBtn').addEventListener('click', function () {
      state.lang = state.lang === 'en' ? 'bn' : 'en';
      persist(); render();
    });
    $('baseColor').addEventListener('input', function () { setBase($('baseColor').value); });
    $('baseHex').addEventListener('change', function () { setBase($('baseHex').value); });
    $('randomBtn').addEventListener('click', function () {
      setBase(L.randomHex(cryptoRng));
    });
    function syncContrast(which) {
      var hexEl = $(which === 'fg' ? 'fgHex' : 'bgHex');
      var colorEl = $(which === 'fg' ? 'fgColor' : 'bgColor');
      var norm = L.normalizeHex(hexEl.value);
      if (norm) { colorEl.value = norm.toLowerCase(); hexEl.value = norm; }
      renderContrast();
    }
    $('fgColor').addEventListener('input', function () { $('fgHex').value = $('fgColor').value.toUpperCase(); renderContrast(); });
    $('bgColor').addEventListener('input', function () { $('bgHex').value = $('bgColor').value.toUpperCase(); renderContrast(); });
    $('fgHex').addEventListener('change', function () { syncContrast('fg'); });
    $('bgHex').addEventListener('change', function () { syncContrast('bg'); });
    $('exportCssBtn').addEventListener('click', function () {
      $('exportOut').value = L.toCssVariables('palette', state.base, currentColors());
    });
    $('exportJsonBtn').addEventListener('click', function () {
      $('exportOut').value = JSON.stringify({ app: 'palette-studio-bd', base: state.base, harmony: state.harmony, colors: currentColors() }, null, 2);
    });
    $('copyExportBtn').addEventListener('click', function () {
      copyText($('exportOut').value, t().copied);
    });
    $('saveBtn').addEventListener('click', function () {
      var name = $('paletteName').value.trim();
      if (!name) { show($('saveMsg'), t().nameRequired, 'error'); return; }
      hide($('saveMsg'));
      state.saved.push({
        id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: name.slice(0, 80),
        base: state.base,
        harmony: state.harmony,
        colors: currentColors()
      });
      $('paletteName').value = '';
      persist(); renderSaved();
    });
    $('eraseBtn').addEventListener('click', function () {
      if ($('eraseInput').value !== 'DELETE') { show($('eraseMsg'), t().eraseWrong, 'error'); return; }
      state.saved = [];
      $('eraseInput').value = '';
      persist(); renderSaved();
      show($('eraseMsg'), t().eraseDone, 'ok');
    });
  }

  bind();
  render();
})();
