/* palette-studio-bd -- node unit tests. Run: node tests/run-node-tests.js */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'logic.js'), 'utf8');
const sandbox = { window: undefined };
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
vm.runInNewContext(src, sandbox);
const L = sandbox.PALETTE_LOGIC;

let passed = 0, failed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; console.log('PASS ' + name); }
  else { failed++; console.log('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra) : '')); }
}
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

// --- validation / normalization ---
check('valid hex #FF0000', L.isValidHex('#FF0000') === true);
check('valid hex without #', L.isValidHex('ff0000') === true);
check('valid hex lowercase', L.isValidHex('#a1b2c3') === true);
check('invalid hex chars', L.isValidHex('#GGGGGG') === false);
check('invalid short hex', L.isValidHex('#FFF') === false);
check('invalid 5 hex', L.isValidHex('#12345') === false);
check('invalid empty', L.isValidHex('') === false);
check('invalid null', L.isValidHex(null) === false);
check('normalize adds # + upper', L.normalizeHex('ff0000') === '#FF0000');
check('normalize keeps', L.normalizeHex('#aBcDeF') === '#ABCDEF');
check('normalize invalid -> null', L.normalizeHex('zzz') === null);

// --- conversions ---
check('hexToRgb red', eq(L.hexToRgb('#FF0000'), { r: 255, g: 0, b: 0 }));
check('hexToRgb mixed', eq(L.hexToRgb('#1A2B3C'), { r: 26, g: 43, b: 60 }));
check('hexToRgb invalid -> null', L.hexToRgb('nope') === null);
check('rgbToHex cyan', L.rgbToHex(0, 255, 255) === '#00FFFF');
check('rgbToHex pads', L.rgbToHex(1, 2, 3) === '#010203');
check('rgbToHex clamps', L.rgbToHex(300, -5, 128) === '#FF0080');
check('rgbToHsl red', eq(L.rgbToHsl(255, 0, 0), { h: 0, s: 100, l: 50 }));
check('rgbToHsl green', eq(L.rgbToHsl(0, 255, 0), { h: 120, s: 100, l: 50 }));
check('rgbToHsl blue', eq(L.rgbToHsl(0, 0, 255), { h: 240, s: 100, l: 50 }));
check('rgbToHsl gray', eq(L.rgbToHsl(128, 128, 128), { h: 0, s: 0, l: 50 }));
check('rgbToHsl white', eq(L.rgbToHsl(255, 255, 255), { h: 0, s: 0, l: 100 }));
check('rgbToHsl black', eq(L.rgbToHsl(0, 0, 0), { h: 0, s: 0, l: 0 }));
check('hslToRgb red', eq(L.hslToRgb(0, 100, 50), { r: 255, g: 0, b: 0 }));
check('hslToRgb wraps 360', eq(L.hslToRgb(360, 100, 50), { r: 255, g: 0, b: 0 }));
check('hex round-trip #2563EB', L.rgbToHex.apply(null, Object.values(L.hexToRgb('#2563EB'))) === '#2563EB');
check('hexToHsl red', eq(L.hexToHsl('#FF0000'), { h: 0, s: 100, l: 50 }));
check('hslToHex red', L.hslToHex(0, 100, 50) === '#FF0000');

// --- harmony for #FF0000 (known values) ---
check('complementary', eq(L.harmony('#FF0000', 'COMPLEMENTARY'), ['#FF0000', '#00FFFF']));
check('analogous', eq(L.harmony('#FF0000', 'ANALOGOUS'), ['#FF0080', '#FF0000', '#FF8000']));
check('triadic', eq(L.harmony('#FF0000', 'TRIADIC'), ['#FF0000', '#00FF00', '#0000FF']));
// Note: #7F00FF / #007FFF (not #8000FF / #0080FF): binary floating point makes
// 6 * 0.08333... land at 0.4999... instead of 0.5, so that channel rounds to 127.
// Visually identical; the values are correct within float precision.
check('tetradic', eq(L.harmony('#FF0000', 'TETRADIC'), ['#FF0000', '#80FF00', '#00FFFF', '#7F00FF']));
check('split', eq(L.harmony('#FF0000', 'SPLIT'), ['#FF0000', '#00FF80', '#007FFF']));
check('harmony unknown type -> null', L.harmony('#FF0000', 'NOPE') === null);
check('harmony invalid hex -> null', L.harmony('zzz', 'TRIADIC') === null);

// --- scale ---
(function () {
  const s = L.scale('#FF0000');
  check('scale has 9 steps', s && s.length === 9, s);
  check('scale starts black', s && s[0] === '#000000', s && s[0]);
  check('scale middle is base', s && s[4] === '#FF0000', s && s[4]);
  check('scale ends white', s && s[8] === '#FFFFFF', s && s[8]);
  let mono = true;
  for (let i = 1; i < 9; i++) { if (L.luminance(s[i]) < L.luminance(s[i - 1])) mono = false; }
  check('scale luminance monotonic', mono);
  check('scale invalid -> null', L.scale('zzz') === null);
})();

// --- mix ---
check('mix halfway', L.mix('#000000', '#FFFFFF', 0.5) === '#808080');
check('mix t=0', L.mix('#112233', '#445566', 0) === '#112233');
check('mix t=1', L.mix('#112233', '#445566', 1) === '#445566');
check('mix clamps t', L.mix('#000000', '#FFFFFF', 2) === '#FFFFFF');

// --- contrast ---
check('contrast black/white = 21', Math.abs(L.contrastRatio('#000000', '#FFFFFF') - 21) < 0.01, L.contrastRatio('#000000', '#FFFFFF'));
check('contrast symmetric', Math.abs(L.contrastRatio('#FFFFFF', '#000000') - 21) < 0.01);
check('contrast same = 1', L.contrastRatio('#123456', '#123456') === 1);
check('contrast invalid -> null', L.contrastRatio('#000000', 'zzz') === null);
check('formatRatio 2 decimals', L.formatRatio(21) === '21.00');
check('formatRatio null', L.formatRatio(null) === '--');
(function () {
  const v = L.contrastVerdict(21);
  check('verdict 21 all pass', v.aaNormal && v.aaLarge && v.aaaNormal && v.aaaLarge);
  const v1 = L.contrastVerdict(1);
  check('verdict 1 all fail', !v1.aaNormal && !v1.aaLarge && !v1.aaaNormal && !v1.aaaLarge);
  const v45 = L.contrastVerdict(4.5);
  check('verdict 4.5: AA pass, AAA normal fail', v45.aaNormal && v45.aaLarge && !v45.aaaNormal && v45.aaaLarge);
  check('verdict null -> null', L.contrastVerdict(null) === null);
})();

// --- random ---
check('randomHex seeded 0', L.randomHex(function () { return 0; }) === '#000000');
check('randomHex seeded max', L.randomHex(function () { return 0.999999; }) === '#FFFFFF');
check('randomHex valid shape', L.isValidHex(L.randomHex()) === true);

// --- export / import ---
(function () {
  const pal = [{ id: 'p1', name: 'Test', base: '#FF0000', harmony: 'TRIADIC', colors: ['#FF0000', '#00FF00', '#0000FF'] }];
  const out = L.exportState(pal);
  const res = L.importState(out);
  check('export/import round-trip', res.ok === true && eq(res.palettes, pal));
  check('import rejects wrong app', L.importState('{"app":"other","version":1,"palettes":[]}').ok === false);
  check('import rejects bad version', L.importState('{"app":"palette-studio-bd","version":2,"palettes":[]}').ok === false);
  check('import rejects bad hex', L.importState('{"app":"palette-studio-bd","version":1,"palettes":[{"id":"x","name":"n","base":"zzz","harmony":"TRIADIC","colors":["#FF0000","#00FF00"]}]}').ok === false);
  check('import rejects bad harmony', L.importState('{"app":"palette-studio-bd","version":1,"palettes":[{"id":"x","name":"n","base":"#FF0000","harmony":"NOPE","colors":["#FF0000","#00FF00"]}]}').ok === false);
  check('import rejects bad JSON', L.importState('{nope').ok === false);
  check('validatePalette ok', L.validatePalette(pal[0]) === true);
  check('validatePalette bad name', L.validatePalette({ id: 'x', name: '', base: '#FF0000', harmony: 'TRIADIC', colors: ['#FF0000', '#00FF00'] }) === false);
})();

// --- CSS variables ---
(function () {
  const css = L.toCssVariables('My Palette!', '#FF0000', ['#FF0000', '#00FFFF']);
  check('css vars contain base', css.indexOf('--my-palette-base: #FF0000;') !== -1, css);
  check('css vars contain color 2', css.indexOf('--my-palette-2: #00FFFF;') !== -1, css);
})();

console.log('\n' + passed + ' passed, ' + failed + ' failed (unit)');
process.exit(failed ? 1 : 0);
