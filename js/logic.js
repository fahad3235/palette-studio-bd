/* palette-studio-bd -- pure color logic (no DOM).
   Hex <-> RGB <-> HSL, harmony generation, black-to-white scale,
   WCAG contrast ratio, random colors, saved-palette export/import.
   All math is deterministic and testable. No network. */
(function (global) {
  'use strict';

  var HEX_RE = /^#?[0-9a-fA-F]{6}$/;
  var HARMONY_TYPES = ['COMPLEMENTARY', 'ANALOGOUS', 'TRIADIC', 'TETRADIC', 'SPLIT'];

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function round(v) { return Math.round(v); }

  /* ---------- validation / normalization ---------- */
  function isValidHex(s) {
    return typeof s === 'string' && HEX_RE.test(s.trim());
  }
  function normalizeHex(s) {
    if (!isValidHex(s)) return null;
    var h = s.trim().replace(/^#/, '').toUpperCase();
    return '#' + h;
  }

  /* ---------- conversions ---------- */
  function hexToRgb(hex) {
    var h = normalizeHex(hex);
    if (!h) return null;
    return {
      r: parseInt(h.slice(1, 3), 16),
      g: parseInt(h.slice(3, 5), 16),
      b: parseInt(h.slice(5, 7), 16)
    };
  }
  function rgbToHex(r, g, b) {
    function two(v) {
      var s = clamp(round(v), 0, 255).toString(16).toUpperCase();
      return s.length === 1 ? '0' + s : s;
    }
    return '#' + two(r) + two(g) + two(b);
  }
  function rgbToHsl(r, g, b) {
    var rn = r / 255, gn = g / 255, bn = b / 255;
    var max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    var h = 0, s = 0, l = (max + min) / 2;
    var d = max - min;
    if (d !== 0) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0));
      else if (max === gn) h = (bn - rn) / d + 2;
      else h = (rn - gn) / d + 4;
      h *= 60;
    }
    return { h: round(((h % 360) + 360) % 360), s: round(s * 100), l: round(l * 100) };
  }
  function hslToRgb(h, s, l) {
    var hn = (((h % 360) + 360) % 360) / 360;
    var sn = clamp(s, 0, 100) / 100;
    var ln = clamp(l, 0, 100) / 100;
    var r, g, b;
    if (sn === 0) {
      r = g = b = ln;
    } else {
      var q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
      var p = 2 * ln - q;
      var hue2rgb = function (t) {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      r = hue2rgb(hn + 1 / 3);
      g = hue2rgb(hn);
      b = hue2rgb(hn - 1 / 3);
    }
    return { r: round(r * 255), g: round(g * 255), b: round(b * 255) };
  }
  function hexToHsl(hex) {
    var rgb = hexToRgb(hex);
    if (!rgb) return null;
    return rgbToHsl(rgb.r, rgb.g, rgb.b);
  }
  function hslToHex(h, s, l) {
    var rgb = hslToRgb(h, s, l);
    return rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  /* ---------- harmony ---------- */
  var HARMONY_SHIFTS = {
    COMPLEMENTARY: [0, 180],
    ANALOGOUS: [-30, 0, 30],
    TRIADIC: [0, 120, 240],
    TETRADIC: [0, 90, 180, 270],
    SPLIT: [0, 150, 210]
  };
  function harmony(baseHex, type) {
    var hsl = hexToHsl(baseHex);
    if (!hsl || HARMONY_SHIFTS[type] === undefined) return null;
    return HARMONY_SHIFTS[type].map(function (shift) {
      return hslToHex(hsl.h + shift, hsl.s, hsl.l);
    });
  }

  /* ---------- mixing + black-to-white scale ---------- */
  function mix(hex1, hex2, t) {
    var a = hexToRgb(hex1), b = hexToRgb(hex2);
    if (!a || !b) return null;
    var k = clamp(t, 0, 1);
    return rgbToHex(
      a.r + (b.r - a.r) * k,
      a.g + (b.g - a.g) * k,
      a.b + (b.b - a.b) * k
    );
  }
  function scale(baseHex) {
    if (!isValidHex(baseHex)) return null;
    var base = normalizeHex(baseHex);
    var out = [];
    for (var i = 0; i < 9; i++) {
      var t = i / 8;
      if (t < 0.5) out.push(mix('#000000', base, t * 2));
      else out.push(mix(base, '#FFFFFF', (t - 0.5) * 2));
    }
    return out;
  }

  /* ---------- WCAG contrast ---------- */
  function luminance(hex) {
    var rgb = hexToRgb(hex);
    if (!rgb) return null;
    function chan(v) {
      var c = v / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
    return 0.2126 * chan(rgb.r) + 0.7152 * chan(rgb.g) + 0.0722 * chan(rgb.b);
  }
  function contrastRatio(hex1, hex2) {
    var l1 = luminance(hex1), l2 = luminance(hex2);
    if (l1 === null || l2 === null) return null;
    var hi = Math.max(l1, l2), lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  }
  function formatRatio(ratio) {
    if (ratio === null || typeof ratio !== 'number' || isNaN(ratio)) return '--';
    return ratio.toFixed(2);
  }
  function contrastVerdict(ratio) {
    if (ratio === null) return null;
    return {
      aaNormal: ratio >= 4.5,
      aaLarge: ratio >= 3,
      aaaNormal: ratio >= 7,
      aaaLarge: ratio >= 4.5
    };
  }

  /* ---------- random ---------- */
  function randomHex(rng) {
    var rand = rng || Math.random;
    var digits = '0123456789ABCDEF';
    var out = '#';
    for (var i = 0; i < 6; i++) {
      out += digits[Math.floor(rand() * 16)];
    }
    return out;
  }

  /* ---------- saved-palette export / import (strict) ---------- */
  function validatePalette(p) {
    if (!p || typeof p !== 'object') return false;
    if (typeof p.id !== 'string' || !p.id) return false;
    if (typeof p.name !== 'string' || !p.name.trim() || p.name.length > 80) return false;
    if (!isValidHex(p.base)) return false;
    if (HARMONY_TYPES.indexOf(p.harmony) === -1) return false;
    if (!Array.isArray(p.colors) || p.colors.length < 2 || p.colors.length > 5) return false;
    for (var i = 0; i < p.colors.length; i++) {
      if (!isValidHex(p.colors[i])) return false;
    }
    return true;
  }
  function exportState(palettes) {
    return JSON.stringify({ app: 'palette-studio-bd', version: 1, palettes: palettes }, null, 2);
  }
  function importState(text) {
    var data;
    try { data = JSON.parse(text); } catch (e) { return { ok: false, error: 'Not valid JSON.' }; }
    if (!data || data.app !== 'palette-studio-bd' || data.version !== 1 || !Array.isArray(data.palettes)) {
      return { ok: false, error: 'Not a palette-studio-bd export (app/version/palettes mismatch).' };
    }
    for (var i = 0; i < data.palettes.length; i++) {
      if (!validatePalette(data.palettes[i])) {
        return { ok: false, error: 'Palette #' + (i + 1) + ' is invalid.' };
      }
    }
    return { ok: true, palettes: data.palettes };
  }

  /* ---------- CSS variables export ---------- */
  function toCssVariables(name, baseHex, colors) {
    var safe = String(name || 'palette').replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase().replace(/^-+|-+$/g, '') || 'palette';
    var lines = [':root {'];
    lines.push('  --' + safe + '-base: ' + normalizeHex(baseHex) + ';');
    colors.forEach(function (c, i) {
      lines.push('  --' + safe + '-' + (i + 1) + ': ' + normalizeHex(c) + ';');
    });
    lines.push('}');
    return lines.join('\n');
  }

  global.PALETTE_LOGIC = {
    HARMONY_TYPES: HARMONY_TYPES,
    isValidHex: isValidHex, normalizeHex: normalizeHex,
    hexToRgb: hexToRgb, rgbToHex: rgbToHex,
    rgbToHsl: rgbToHsl, hslToRgb: hslToRgb,
    hexToHsl: hexToHsl, hslToHex: hslToHex,
    harmony: harmony, mix: mix, scale: scale,
    luminance: luminance, contrastRatio: contrastRatio,
    formatRatio: formatRatio, contrastVerdict: contrastVerdict,
    randomHex: randomHex,
    validatePalette: validatePalette, exportState: exportState, importState: importState,
    toCssVariables: toCssVariables
  };
})(typeof window !== 'undefined' ? window : globalThis);
