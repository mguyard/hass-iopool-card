---
last_updated: 2026-03-10
purpose: 'Durable project decisions and invariants. Template file for downstream projects.'
---

# Project Decisions

## How to Use

- Add entries only when a decision is durable and likely to matter in future sessions.
- Prefer linking to code/paths and stating invariants/constraints over narrative.
- If a decision is superseded, append an "Update" note to the original entry.
- Keep runtime scratch notes out of this file.
- Separate verified repo facts from assumptions or interpretations.

## Entry Template

```md
## <Decision Title> — YYYY-MM-DD

### Facts

- Verified repo facts with file/path references.

### Inferences

- Assumptions or interpretations that still need validation.

### Decision

- The durable rule, invariant, or operating choice.

### Consequences

- What this changes, constrains, or requires going forward.
```

## Onboarding Snapshot Template

Use this after project familiarization / onboarding runs:

```md
## Onboarding Snapshot — YYYY-MM-DD

### Facts

- Major modules / packages
- Run / build / test commands
- Key conventions and invariants
- Top risks or TODOs worth remembering

### Inferences

- Only if necessary, clearly marked
```

## Entries

## Prop-Driven Header and Gauge Components — 2026-05-27

### Facts

- New sub-components live under [src/components/header.ts](src/components/header.ts), [src/components/warning-banner.ts](src/components/warning-banner.ts), and [src/components/liquid-gauge.ts](src/components/liquid-gauge.ts).
- These components receive all display data through properties and do not read `hass` directly.
- User-visible strings for these components are localized through [src/locales/en.json](src/locales/en.json) and [src/locales/fr.json](src/locales/fr.json).
- The liquid gauge starts a `requestAnimationFrame` loop in `connectedCallback()` and cancels the outstanding frame in `disconnectedCallback()`.

### Decision

- Keep foundational UI sub-components stateless with respect to Home Assistant and drive them exclusively from their public properties.
- Preserve explicit RAF cleanup for animated visual components to avoid leaking callbacks after removal from the DOM.

### Consequences

- Future card code should continue resolving entity and device state outside these sub-components and pass only the computed values down.
- Any new user-facing string in these components should be added to both locale files.

### Citations

- [src/components/header.ts](src/components/header.ts)
- [src/components/warning-banner.ts](src/components/warning-banner.ts)
- [src/components/liquid-gauge.ts](src/components/liquid-gauge.ts)
- [src/locales/en.json](src/locales/en.json)
- [src/locales/fr.json](src/locales/fr.json)

### memory_meta

- timestamp: 2026-05-27
- author: GitHub Copilot

## Editor Chip Button Hover State — 2026-05-29

### Facts

- The editor stylesheet in [src/iopool-card-editor.ts](src/iopool-card-editor.ts) defines `.chip-btn` styles for preset/filter chips.
- The active chip state now uses `color: #fff !important` and `-webkit-text-fill-color: #fff` so the active label stays white in WebKit-based browsers.
- The hover rule now excludes `.chip-btn--active` via `.chip-btn:hover:not(.chip-btn--active)` and also sets `-webkit-text-fill-color` to the primary color for non-active hover states.

### Decision

- Preserve the active chip's white text styling during hover, and scope hover styling to non-active chips only.

### Consequences

- Future edits to editor chip styles should keep the hover selector exclusion and the WebKit text-fill overrides unless the visual behavior is intentionally changed.

### Citations

- [src/iopool-card-editor.ts](src/iopool-card-editor.ts)
- [src/iopool-card-editor.test.ts](src/iopool-card-editor.test.ts)

### memory_meta

- timestamp: 2026-05-29
- author: GitHub Copilot

## Editor Stays Side-Effect Free — 2026-06-03

### Facts

- [src/iopool-card-editor.ts](src/iopool-card-editor.ts) now keeps `setConfig()` limited to assigning `_config` and clearing `_validationError`.
- The editor no longer exposes auto-detect state or lifecycle hooks for pump lookup, and it no longer calls `callWS` for config entry inspection.
- [src/types.ts](src/types.ts) no longer declares `HomeAssistant.callWS` or `DeviceRegistryEntry.config_entries`.
- The matching auto-detection tests were removed from [src/iopool-card-editor.test.ts](src/iopool-card-editor.test.ts).

### Decision

- Keep the editor config flow synchronous and user-driven: configuration changes should validate and dispatch, without hidden pump auto-detection side effects.

### Consequences

- Future editor changes should not reintroduce config-entry probing or deferred state keyed off `hass` availability.
- Tests for the editor should focus on explicit validation and dispatch behavior only.

### Citations

- [src/iopool-card-editor.ts](src/iopool-card-editor.ts)
- [src/types.ts](src/types.ts)
- [src/iopool-card-editor.test.ts](src/iopool-card-editor.test.ts)

### memory_meta

- timestamp: 2026-06-03
- author: GitHub Copilot

## ApexCharts SVG Global Isolation — 2026-06-03

### Facts

- `vehicle-info-card.js` bundles **ApexCharts v3.52.0** (SVG.js v2), which registers `window.SVG = SVGv2` globally.
- `iopool-card.js` bundles **ApexCharts v5.13.0** (SVG.js v3 / @svgdotjs). ApexCharts v5 ESM source reads `window.SVG` / `globalThis.SVG` in three places: `setupElements()`, `clippedImgArea()`, and legend marker drawing.
- When vehicle-info-card loads first, iopool-card's ApexCharts v5 reads SVG.js v2 from `window.SVG` → `TypeError: e.put is not a function` at `setupElements` during `render()` / `updateSeries()` / `updateOptions()`.
- Fix implemented at **build time** via [rollup-plugin-apex-svg-isolate.mjs](../rollup-plugin-apex-svg-isolate.mjs) registered in [rollup.config.mjs](../rollup.config.mjs).
- The plugin applies 4 targeted string-replace patches on `node_modules/apexcharts/dist/apexcharts.esm.js` before minification:
  1.  Remove `window.SVG = SVG` and `global.SVG = SVG` global assignments (keep `window.Apex` / `global.Apex`).
  2.  Replace `window.SVG` / `global.SVG` read in `clippedImgArea()` with local `SVG`.
  3.  Replace `globalThis.SVG` read in `setupElements()` with local `SVG`.
  4.  Replace `window.SVG` / `global.SVG` read in legend marker drawing with local `SVG`.

### Patch Failure Detection — CRITICAL

- If ApexCharts is upgraded (`npm update apexcharts` or `package.json` version bump), ESM internals may change and patch patterns may no longer match.
- **Detection**: `npm run build` emits `(!) [plugin apex-svg-isolate]` warnings in stdout — one per failed patch. Example:
  ```
  (!) [plugin apex-svg-isolate] node_modules/apexcharts/dist/apexcharts.esm.js:
  		[apex-svg-isolate] patch "remove-svg-global-assignments" not applied — pattern not found
  ```
- **Rule**: any `[apex-svg-isolate]` warning in build output = **the patch did not apply = the cross-bundle SVG conflict is NOT fixed**. Treat these warnings as blocking errors.
- **Action when patches fail**: open `node_modules/apexcharts/dist/apexcharts.esm.js`, search for the equivalent code patterns, update `PATCHES` in `rollup-plugin-apex-svg-isolate.mjs` to match the new source text.

### Decision

- Solve the cross-bundle SVG.js conflict at build time via AST-free string patching in [rollup-plugin-apex-svg-isolate.mjs](../rollup-plugin-apex-svg-isolate.mjs).
- Never rely on `window.Apex._chartInstances` clearing or runtime guards (the previous `_initChart()` approach was insufficient because `updateSeries()` / `updateOptions()` also call `setupElements()` and suffer the same conflict).

### Consequences

- After every `npm update` or `package.json` ApexCharts version bump, run `npm run build` and confirm zero `[apex-svg-isolate]` warnings before committing.
- If the plugin cannot be patched (ApexCharts major rewrite), consider pinning the ApexCharts version and opening an upstream issue.
- [rollup-plugin-apex-svg-isolate.mjs](../rollup-plugin-apex-svg-isolate.mjs) and [rollup.config.mjs](../rollup.config.mjs) must never have the plugin removed without resolving the cross-bundle conflict by another means.

### Citations

- [rollup-plugin-apex-svg-isolate.mjs](../rollup-plugin-apex-svg-isolate.mjs)
- [rollup.config.mjs](../rollup.config.mjs)
- [src/components/temperature-chart.ts](../src/components/temperature-chart.ts)

### memory_meta

- timestamp: 2026-06-03
- author: GitHub Copilot

## Onboarding Snapshot — 2026-05-27

### Facts

- The docs site is defined at [docs.json](docs.json) and uses MDX pages under [docs/](docs).
- The site covers getting started, configuration, components, pool modes, and troubleshooting in separate page groups.
- Screenshot placeholders live under [docs/assets/screenshots/](docs/assets/screenshots/) and are intentionally empty for now.
- The README now documents the bundled-install flow, the minimal YAML snippet, and the contributor commands `npm ci`, `npm run dev`, `npm test`, and `npm run build`.

### Inferences

- Future docs updates should stay aligned with [SPECIFICATIONS.md](SPECIFICATIONS.md) and the localized UI strings in [src/locales/en.json](src/locales/en.json).

### Citations

- [docs.json](docs.json)
- [docs/](docs)
- [README.md](README.md)
- [SPECIFICATIONS.md](SPECIFICATIONS.md)
- [src/locales/en.json](src/locales/en.json)

### memory_meta

- timestamp: 2026-05-27
- author: GitHub Copilot

## Interactive Control Sections — 2026-05-27

### Facts

- Added three new interactive sub-components in [src/components/mode-selector.ts](src/components/mode-selector.ts), [src/components/pump-control.ts](src/components/pump-control.ts), and [src/components/filtration-progress.ts](src/components/filtration-progress.ts).
- Each component has a matching Vitest file in [src/components/mode-selector.test.ts](src/components/mode-selector.test.ts), [src/components/pump-control.test.ts](src/components/pump-control.test.ts), and [src/components/filtration-progress.test.ts](src/components/filtration-progress.test.ts).
- User-visible labels for mode, pump state, and daily filtration were added or adjusted in [src/locales/en.json](src/locales/en.json) and [src/locales/fr.json](src/locales/fr.json).
- The new components guard Home Assistant service calls and render localized fallback states when configuration or entity data is missing.
- Validation passed for the targeted new tests and for the full Vitest suite.

### Decision

- Keep interactive control sub-components self-contained, locale-driven, and defensive around Home Assistant access so they can be reused safely in the main card.

### Consequences

- Future control sections should follow the same pattern: local i18n lookup, explicit service-call guards, and a matching Vitest file alongside the component.
- The repository-wide lint command still reports pre-existing unused-import errors in [src/helpers/history.test.ts](src/helpers/history.test.ts) and [src/iopool-card.test.ts](src/iopool-card.test.ts), so lint gating remains blocked until those files are cleaned up.

### Citations

- [src/components/mode-selector.ts](src/components/mode-selector.ts)
- [src/components/pump-control.ts](src/components/pump-control.ts)
- [src/components/filtration-progress.ts](src/components/filtration-progress.ts)
- [src/components/mode-selector.test.ts](src/components/mode-selector.test.ts)
- [src/components/pump-control.test.ts](src/components/pump-control.test.ts)
- [src/components/filtration-progress.test.ts](src/components/filtration-progress.test.ts)
- [src/locales/en.json](src/locales/en.json)
- [src/locales/fr.json](src/locales/fr.json)

### memory_meta

- timestamp: 2026-05-27
- author: GitHub Copilot
