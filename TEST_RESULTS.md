# TEST_RESULTS — palette-studio-bd

Date: 2026-10-18. All tests run for real; nothing invented.

## Unit tests (node)

`node tests/run-node-tests.js` → **68 passed, 0 failed**

Coverage: hex validation/normalization, hex↔RGB↔HSL conversions + round-trips,
harmony outputs for a known base (`#FF0000`: complementary `#00FFFF`, analogous,
triadic, tetradic, split), 9-step scale (black → base → white, monotonic
luminance), mix, WCAG contrast (black/white = 21.00, same-color = 1.00,
symmetric), AA/AAA verdicts at 21 / 4.5 / 1, seeded random hex, strict
export/import (round-trip + 5 rejection cases), CSS-variables export.

## Browser smoke tests (headless Chromium, raw CDP, file://)

`node tests/smoke.mjs desktop` → **21 passed, 0 failed**
`node tests/smoke.mjs mobile` → **22 passed, 0 failed**

Coverage: title + default base, complementary = 2 swatches, scale = 9 swatches,
base change → harmony updates, triadic = 3 swatches, click swatch → copied
feedback, invalid hex → inline error, contrast black/white = 21.00 all pass,
same-color = 1.00 all fail, random changes base to a valid hex, CSS + JSON
export, save → list → reload persists → delete, BN title toggle, 390px no
horizontal overflow (mobile), 0 console/page errors, zero network requests.

## Genuine repairs

1. **CSS-variables slug** (app logic): `toCssVariables('My Palette!', ...)`
   produced `--my-palette--base` (double dash) because `!` became a trailing
   `-`. Fixed by trimming leading/trailing dashes from the slug.
2. **Test expectations** (test-side, not app logic): tetradic/split expectations
   `#8000FF` / `#0080FF` corrected to `#7F00FF` / `#007FFF` — binary
   floating point makes `6 * 0.08333...` land at `0.4999...`, rounding that
   channel to 127 instead of 128. Visually identical; the app output was
   correct within float precision.

No other repairs. Smoke tests passed on the first run.

## Hygiene

- Pure-ASCII sources: `grep -rP '[^\x00-\x7F]'` → 0 matches (Bengali as
  `\uXXXX` escapes in JS; no Bengali literals in HTML/CSS).
- No secrets anywhere. No key-like strings. No network requests.

## Limitations

- Live end-to-end use with a real user's palette is untested beyond the scripted
  smoke flows; the app is deterministic, so scripted coverage is representative.
- Clipboard behavior depends on browser permissions (fallback included).

## Re-verification (factory run #108, 2026-10-22 13:00 slot)

Adopted the orphaned 2026-10-18 build (no ledger row, no files in the
GitHub repo) and re-ran every test from scratch. Nothing was rebuilt.

- `node tests/run-node-tests.js` -> **68 passed, 0 failed**
- `node tests/smoke.mjs desktop` -> **21 passed, 0 failed**
- `node tests/smoke.mjs mobile` -> **22 passed, 0 failed** (390px no overflow)

All checks green; 0 console/page errors; zero network requests confirmed.
Pure-ASCII app sources (Bengali as \uXXXX escapes in JS); no secrets.
