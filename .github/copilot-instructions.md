# GitHub Copilot Custom Instructions for `hass-iopool-card`

## Project Context

- **Project Type:** Custom Lovelace card for [Home Assistant](https://www.home-assistant.io/), written in TypeScript with [Lit](https://lit.dev/).
- **Purpose:** Official monolithic card for the `hass-iopool` integration — displays all pool data and controls in a single Lovelace card (`custom:iopool-card`).
- **Language:** All code, comments, and documentation must be in **English**.
- **Distribution:** Pre-built JS bundle (`dist/iopool-card.js`) embedded in the `hass-iopool` Python integration; served as a static file at `/iopool/iopool-card.js`.

## Architecture

```
src/
├── iopool-card.ts              # Entry point — main LitElement (custom:iopool-card)
├── iopool-card-editor.ts       # Visual editor (GUI, auto-discovered by HA)
├── types.ts                    # TypeScript interfaces (IopoolCardConfig, EntityMap, etc.)
├── const.ts                    # Constants (CARD_VERSION, DEFAULT_THRESHOLDS, ENTITY_MAP)
├── styles.ts                   # Shared LitElement css`` styles
├── helpers/
│   ├── device.ts               # Resolve iopool devices, enumerate entities by device_id
│   ├── slug.ts                 # Client-side slugify_pool_name (mirrors Python impl)
│   ├── pool-name.ts            # Resolve display name (name_by_user → name → fallback)
│   ├── format.ts               # Duration, date, number formatting helpers
│   ├── thresholds.ts           # Threshold resolution (defaults + custom for temperature)
│   ├── zone.ts                 # valueToZone, zoneToColor, valueToFillPct
│   ├── debug.ts                # Debug logger (enabled when config.debug === true)
│   └── history.ts              # Wrapper around hass.callApi for temperature history
└── components/
    ├── liquid-gauge.ts         # Animated liquid gauge (SVG + requestAnimationFrame)
    ├── mode-selector.ts        # Filtration mode segmented selector
    ├── pump-control.ts         # Pump card with toggle
    ├── filtration-progress.ts  # Daily filtration progress bar
    ├── boost-selector.ts       # Boost selector + countdown
    ├── temperature-chart.ts    # Temperature chart with hover tooltip
    ├── header.ts               # Card title + badges
    └── warning-banner.ts       # Maintenance / opening / initialization banner
```

**Key patterns:**
- Entity resolution: enumerate `hass.entities` filtered by `device_id` — never hardcode entity IDs.
- Entity map cached in `setConfig()`, invalidated only if `device_id` changes — never recomputed in `set hass()` or `render()`.
- Pool name: `device.name_by_user ?? device.name ?? 'iopool'` — re-evaluated on every render.
- Icons: always `<ha-icon icon="mdi:xxx">` — no external icon libraries or SVG sprites.
- Charts: pure SVG — no Chart.js, D3, ApexCharts, or external chart libraries.
- Zero runtime deps beyond Lit (bundled into `dist/iopool-card.js`).

## Quick Start — Key Commands

```bash
# Install dependencies
npm ci

# Lint (ESLint 9 flat config + Prettier)
npm run lint

# Build (Rollup — outputs dist/iopool-card.js)
npm run build

# Tests (Vitest) — see .github/skills/testing-iopool-card/SKILL.md for full details
npm test

# Watch mode
npm run dev
```

## CI/CD

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `build.yml` | PR on `dev`, `beta`, `main` | Lint + build + test + upload artifact |
| `release.yaml` | push on `main`, `beta` | semantic-release + auto-PR to `hass-iopool` |
| `codeql.yaml` | weekly + push | CodeQL TypeScript/JS security scan |

**Branch strategy:** `dev` → development. `beta` → beta releases. `main` → stable releases. All PRs target `dev`.

## Mandatory Rules for Copilot Coding Agent

- All code, comments, and documentation in **English**.
- **After every `src/**/*.ts` change**, analyse the corresponding `*.test.ts` file and CREATE, UPDATE, or DELETE tests as needed (Vitest). Never skip this step.
- **TypeScript strict mode** is enabled — no `any` without a justification comment.
- **ESLint + Prettier**: run `npm run lint` before committing. Zero lint errors allowed.
- New components: follow `typescript-lovelace-card/SKILL.md`. Add a screenshot placeholder to `docs/assets/screenshots/` and register the doc page in `docs.json`.
- Commit/PR: follow `git-conventions/SKILL.md`. PR target branch is always `dev`.
- Use `context7` for Lit, TypeScript, Rollup, and Web Components documentation.
- Use [developers.home-assistant.io](https://developers.home-assistant.io) for HA Lovelace card API guidance.
- **Every question asked to the user MUST use `vscode_askQuestions`.** Never ask questions inline as plain text only. Always set `allowFreeformInput: true` (or leave it at its default) so the user can provide a custom answer alongside the proposed options.
