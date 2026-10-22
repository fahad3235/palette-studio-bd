/* palette-studio-bd - headless-Chrome smoke test via raw CDP.
   Run: node tests/smoke.mjs [desktop|mobile]
   Uses /opt/meta-chromium/chrome + Node global WebSocket. No deps. */
import { spawn, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODE = process.argv[2] || 'desktop';
const WIDTH = MODE === 'mobile' ? 390 : 1280;
const PORT = MODE === 'mobile' ? 9232 : 9231;
const DIR = path.resolve(__dirname, '..');
const URL = 'file://' + DIR + '/index.html';

let passed = 0, failed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; console.log('PASS ' + name); }
  else { failed++; console.log('FAIL ' + name + (extra ? ' :: ' + extra : '')); }
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

class CDP {
  constructor(wsUrl) { this.ws = new WebSocket(wsUrl); this.id = 0; this.pending = new Map(); this.events = []; }
  async open() {
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = rej; });
    this.ws.onmessage = (m) => {
      const d = JSON.parse(m.data);
      if (d.id && this.pending.has(d.id)) {
        const { resolve, reject } = this.pending.get(d.id);
        this.pending.delete(d.id);
        d.error ? reject(new Error(JSON.stringify(d.error))) : resolve(d.result);
      } else this.events.push(d);
    };
  }
  send(method, params) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  async evalExpr(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('eval exception: ' + JSON.stringify(r.exceptionDetails));
    return r.result.value;
  }
  close() { try { this.ws.close(); } catch (e) {} }
}

const BN_TITLE = '\u09aa\u09cd\u09af\u09be\u09b2\u09c7\u099f';

(async () => {
  const userDir = '/tmp/ps-chrome-' + MODE;
  execSync('rm -rf ' + userDir);
  const chrome = spawn('/opt/meta-chromium/chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--no-proxy-server',
    '--window-size=' + WIDTH + ',900',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + userDir, 'about:blank'
  ], { stdio: 'ignore' });
  let cdp = null;
  try {
    let targets = null;
    for (let i = 0; i < 50 && !targets; i++) {
      await sleep(200);
      try {
        const res = await fetch('http://127.0.0.1:' + PORT + '/json/list');
        const list = await res.json();
        targets = list.filter(t => t.type === 'page');
      } catch (e) { /* not up yet */ }
    }
    if (!targets || !targets.length) throw new Error('no page target');
    cdp = new CDP(targets[0].webSocketDebuggerUrl);
    await cdp.open();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Network.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: 900, deviceScaleFactor: 1, mobile: MODE === 'mobile' });
    await cdp.send('Page.navigate', { url: URL });
    await sleep(1500);

    const errors = cdp.events.filter(e =>
      (e.method === 'Log.entryAdded' && e.params && e.params.entry && e.params.entry.level === 'error') ||
      e.method === 'Runtime.exceptionThrown');
    check('0 console/page errors', errors.length === 0, JSON.stringify(errors.slice(0, 2)));

    // 1. Initial render: default base + complementary (2 swatches) + 9-step scale
    let v = await cdp.evalExpr(`({title: document.getElementById('appTitle').textContent, base: document.getElementById('baseHex').value, harm: document.querySelectorAll('#harmonyRow .swatch').length, scale: document.querySelectorAll('#scaleRow .swatch').length, ratio: document.getElementById('contrastRatio').textContent})`);
    check('title renders', v.title === 'Palette Studio BD', v.title);
    check('default base #2563EB', v.base === '#2563EB', v.base);
    check('complementary = 2 swatches', v.harm === 2, String(v.harm));
    check('scale = 9 swatches', v.scale === 9, String(v.scale));
    check('initial ratio shown', v.ratio !== '--', v.ratio);

    // 2. Set base #FF0000 -> complementary second swatch #00FFFF
    await cdp.evalExpr(`(function(){ var el = document.getElementById('baseHex'); el.value = '#FF0000'; el.dispatchEvent(new Event('change', {bubbles:true})); return document.querySelectorAll('#harmonyRow .swatch').length; })()`);
    await sleep(200);
    v = await cdp.evalExpr(`Array.from(document.querySelectorAll('#harmonyRow .swatch')).map(function(s){ return s.dataset.hex; })`);
    check('red complementary row', JSON.stringify(v) === JSON.stringify(['#FF0000', '#00FFFF']), JSON.stringify(v));

    // 3. Triadic -> 3 swatches, first is base
    await cdp.evalExpr(`document.querySelector('[data-harmony="TRIADIC"]').click()`);
    await sleep(200);
    v = await cdp.evalExpr(`Array.from(document.querySelectorAll('#harmonyRow .swatch')).map(function(s){ return s.dataset.hex; })`);
    check('triadic = 3 swatches', v.length === 3 && v[0] === '#FF0000', JSON.stringify(v));

    // 4. Click a swatch -> copy feedback appears
    await cdp.evalExpr(`document.querySelector('#harmonyRow .swatch').click()`);
    await sleep(300);
    v = await cdp.evalExpr(`document.getElementById('copyMsg').textContent`);
    check('click swatch -> copied feedback', v.indexOf('Copied') === 0 || v.indexOf('\u0995\u09aa\u09bf') === 0, v);

    // 5. Invalid hex -> inline error, base unchanged
    await cdp.evalExpr(`(function(){ var el = document.getElementById('baseHex'); el.value = '#ZZZ'; el.dispatchEvent(new Event('change', {bubbles:true})); return {err: document.getElementById('baseError').textContent, base: document.getElementById('baseHex').value}; })()`);
    await sleep(200);
    v = await cdp.evalExpr(`({err: document.getElementById('baseError').textContent, base: document.getElementById('baseHex').value})`);
    check('invalid hex shows error', v.err.indexOf('Invalid hex') === 0, v.err);
    await cdp.evalExpr(`(function(){ var el = document.getElementById('baseHex'); el.value = '#FF0000'; el.dispatchEvent(new Event('change', {bubbles:true})); })()`);
    await sleep(200);

    // 6. Contrast: black on white -> 21.00, all pass
    await cdp.evalExpr(`(function(){
      var fg = document.getElementById('fgHex'); fg.value = '#000000'; fg.dispatchEvent(new Event('change', {bubbles:true}));
      var bg = document.getElementById('bgHex'); bg.value = '#FFFFFF'; bg.dispatchEvent(new Event('change', {bubbles:true}));
      return document.getElementById('contrastRatio').textContent;
    })()`);
    await sleep(200);
    v = await cdp.evalExpr(`({ratio: document.getElementById('contrastRatio').textContent, aa: document.getElementById('aaNormalBadge').textContent, aaa: document.getElementById('aaaNormalBadge').textContent})`);
    check('black/white ratio 21.00', v.ratio === '21.00', v.ratio);
    check('black/white AA + AAA pass', v.aa === 'Pass' && v.aaa === 'Pass', JSON.stringify(v));

    // 7. Contrast: same color -> 1.00, all fail
    await cdp.evalExpr(`(function(){
      var fg = document.getElementById('fgHex'); fg.value = '#123456'; fg.dispatchEvent(new Event('change', {bubbles:true}));
      var bg = document.getElementById('bgHex'); bg.value = '#123456'; bg.dispatchEvent(new Event('change', {bubbles:true}));
      return document.getElementById('contrastRatio').textContent;
    })()`);
    await sleep(200);
    v = await cdp.evalExpr(`({ratio: document.getElementById('contrastRatio').textContent, aa: document.getElementById('aaNormalBadge').textContent})`);
    check('same color ratio 1.00 + fail', v.ratio === '1.00' && v.aa === 'Fail', JSON.stringify(v));

    // 8. Random button changes base to a valid hex
    const before = await cdp.evalExpr(`document.getElementById('baseHex').value`);
    await cdp.evalExpr(`document.getElementById('randomBtn').click()`);
    await sleep(200);
    v = await cdp.evalExpr(`document.getElementById('baseHex').value`);
    check('random changes base to valid hex', v !== before && /^#[0-9A-F]{6}$/.test(v), before + ' -> ' + v);

    // 9. Export CSS contains variables
    await cdp.evalExpr(`document.getElementById('exportCssBtn').click()`);
    await sleep(200);
    v = await cdp.evalExpr(`document.getElementById('exportOut').value`);
    check('export CSS has vars', v.indexOf(':root') === 0 && v.indexOf('--palette-base:') !== -1, v.slice(0, 80));
    await cdp.evalExpr(`document.getElementById('exportJsonBtn').click()`);
    await sleep(200);
    v = await cdp.evalExpr(`document.getElementById('exportOut').value`);
    check('export JSON parses + has colors', (function(){ try { var j = JSON.parse(v); return j.app === 'palette-studio-bd' && Array.isArray(j.colors); } catch(e){ return false; } })(), v.slice(0, 80));

    // 10. Save palette -> list shows 1; reload persists; delete removes
    await cdp.evalExpr(`(function(){ document.getElementById('paletteName').value = 'Test Palette'; document.getElementById('saveBtn').click(); return document.querySelectorAll('#savedList li').length; })()`);
    await sleep(200);
    v = await cdp.evalExpr(`document.querySelectorAll('#savedList li').length`);
    check('save -> 1 saved', v === 1, String(v));
    await cdp.evalExpr(`location.reload()`);
    await sleep(1500);
    v = await cdp.evalExpr(`document.querySelectorAll('#savedList li').length`);
    check('saved persists after reload', v === 1, String(v));
    await cdp.evalExpr(`document.querySelector('#savedList li .btn.secondary:last-child').click()`);
    await sleep(200);
    v = await cdp.evalExpr(`document.querySelectorAll('#savedList li').length`);
    check('delete removes saved', v === 0, String(v));

    // 11. BN toggle: title Bengali
    await cdp.evalExpr(`document.getElementById('langBtn').click()`);
    await sleep(200);
    v = await cdp.evalExpr(`document.getElementById('appTitle').textContent`);
    check('BN title renders', v.indexOf(BN_TITLE) === 0, v);
    await cdp.evalExpr(`document.getElementById('langBtn').click()`);
    await sleep(200);

    // 12. 390px overflow (mobile only)
    if (MODE === 'mobile') {
      const overflow = await cdp.evalExpr(`document.documentElement.scrollWidth <= 390`);
      check('390px no horizontal overflow', overflow === true, 'scrollWidth=' + await cdp.evalExpr(`document.documentElement.scrollWidth`));
    }

    // 13. Zero network requests
    const reqs = cdp.events.filter(e => e.method === 'Network.requestWillBeSent' && e.params && e.params.request && !e.params.request.url.startsWith('file://') && !e.params.request.url.startsWith('data:'));
    check('zero network requests', reqs.length === 0, JSON.stringify(reqs.slice(0, 1)));
  } catch (e) {
    failed++;
    console.log('FAIL harness :: ' + (e && e.stack || e));
  } finally {
    if (cdp) cdp.close();
    chrome.kill();
  }
  console.log('\n' + passed + ' passed, ' + failed + ' failed (' + MODE + ')');
  process.exit(failed ? 1 : 0);
})();
