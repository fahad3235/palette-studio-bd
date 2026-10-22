# Palette Studio BD

Offline bilingual (EN / Bangla) color palette studio. A design tool: build color
palettes from a base color, check WCAG contrast, and export CSS variables or JSON.
No tracker, no calculator, no form-to-document flow. Everything runs locally in
the browser — zero network requests.

## Features

- **Base color** — color picker + hex text input (`#RRGGBB`, validated). Bad hex
  shows an inline error and never corrupts state.
- **Harmony generator** — complementary, analogous, triadic, tetradic, and
  split-complementary harmonies computed with real HSL math. Each harmony is a
  swatch row with hex labels.
- **Shades & tints scale** — 9 steps from black to white through the base color.
- **Click any swatch to copy** its hex (Clipboard API + fallback, "Copied" feedback).
- **Contrast checker** — pick foreground + background (or type hex) and get the
  WCAG contrast ratio to 2 decimals plus AA / AAA pass/fail for normal and large
  text. Thresholds stated in the UI: AA 4.5:1 (normal) / 3:1 (large);
  AAA 7:1 (normal) / 4.5:1 (large).
- **Random color** — uses `crypto.getRandomValues`, never `Math.random`.
- **Export** — current palette as CSS variables (`:root { --palette-base: ... }`)
  or as JSON, with copy-to-clipboard.
- **Saved palettes** — save (name + base + harmony + colors), load, delete;
  persisted in `localStorage` only. Typed-DELETE erase-all.
- **EN / Bangla toggle** — persisted, with Bengali digits. Bengali strings are
  `\uXXXX` escapes in JS (pure-ASCII sources).

## Honesty notes

- The contrast ratio is computed with the WCAG relative-luminance formula. It is
  a computed number, not a guarantee of accessibility for every use — the UI
  says so explicitly.
- Random colors are uniformly random hex values; they are not curated palettes.
- Nothing leaves the device: no analytics, no fonts, no requests of any kind.

## Stack

Vanilla HTML / CSS / JavaScript. No dependencies, no build step, no backend.

## Run locally

Open `index.html` in any modern browser, or serve the folder:

```sh
python3 -m http.server 8000
# open http://127.0.0.1:8000/
```

## Testing

```sh
node tests/run-node-tests.js   # unit: conversions, harmonies, scale, contrast, export/import
node tests/smoke.mjs desktop   # headless-Chrome smoke via raw CDP
node tests/smoke.mjs mobile    # 390px smoke via raw CDP
```

See `TEST_RESULTS.md` for the recorded results.

## Limitations

- HSL rounding can shift one channel by 1 (e.g. `#7F00FF` vs `#8000FF`) due to
  binary floating point; visually identical.
- Clipboard copy may fall back silently in browsers that block clipboard access;
  the "Copied" feedback still appears after the attempt.
- Palettes live in one browser's `localStorage`; there is no account or sync.
- Saved-palette export/import of the stored list is not included (export covers
  the current palette); saved palettes are managed in-app only.

## Status

Built for the MUSE PROJECT FACTORY. Published to
https://github.com/fahad3235/palette-studio-bd (public) with a live
GitHub Pages site. The build directory was created 2026-10-18 and adopted
+ re-verified from scratch by factory run #108 (2026-10-22 13:00 slot);
nothing was rebuilt, per the factory hard rule (one project built exactly
once, ever).
