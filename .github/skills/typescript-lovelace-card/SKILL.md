---
name: typescript-lovelace-card
description: Architecture, LitElement patterns, entity resolution, and conventions for the hass-iopool-card Lovelace card.
user-invocable: false
---

# Skill: TypeScript — Lovelace Card (hass-iopool-card)

Use this skill for any implementation, review, or debugging task in the `src/` codebase.

---

## 1. Project Stack

- **Language**: TypeScript 6.x, `strict` mode enabled — no `any` without a justification comment
- **Framework**: Lit 3.x (LitElement + `html`/`css` template literals)
- **Bundler**: Rollup 4.x — outputs `dist/iopool-card.js`, IIFE format, ES2022 target
- **Linter**: ESLint 9.x flat config + `@typescript-eslint` v8.x + Prettier 3.x
- **Tests**: Vitest — see `../testing-iopool-card/SKILL.md`
- **Target size**: < 100 KB minified, < 30 KB gzipped
- **Runtime deps**: Lit + ApexCharts 5.13.0 (bundled into the output file). No other runtime deps.

---

## 2. Module Map

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
│   ├── thresholds.ts           # Threshold resolution (defaults + user custom for temperature)
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

---

## 3. Lovelace Card API Lifecycle

### 3.1 Required Interface

```typescript
// Config is set once via setConfig() — rebuild entity cache here
setConfig(config: IopoolCardConfig): void {
  this._config = config;
  this._resolveEntities(); // cache entity map from device_id
}

// hass is updated on every state change — trigger re-render only
set hass(hass: HomeAssistant) {
  this._hass = hass;
  this.requestUpdate();
}

// Required for card sizing in Lovelace layout
getCardSize(): number { return 8; }

// Required for visual editor auto-discovery
static getConfigElement(): HTMLElement {
  return document.createElement('iopool-card-editor');
}

// Returns default config shown in the card picker preview
static getStubConfig(): IopoolCardConfig {
  return { type: 'custom:iopool-card', device_id: '' };
}
```

### 3.2 Card Registration

```typescript
// At the bottom of iopool-card.ts — after class definition:
customElements.define('iopool-card', IopoolCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'iopool-card',
  name: 'iopool Card',
  description: 'Official iopool — full management of a connected pool',
  preview: true,
  documentationURL: 'https://github.com/mguyard/hass-iopool-card',
});
```

### 3.3 Version announcement

```typescript
// In iopool-card.ts — executed once at module load:
import { CARD_VERSION } from './const';

console.info(
  `%c iopool-card %c v${CARD_VERSION} `,
  'color: white; background: #17817A; font-weight: 700; padding: 2px 6px; border-radius: 3px 0 0 3px;',
  'color: #17817A; background: white; font-weight: 700; padding: 2px 6px; border-radius: 0 3px 3px 0; border: 1px solid #17817A;',
);
```

---

## 4. Entity Resolution (Core Pattern)

### 4.1 Entity map (`const.ts`)

```typescript
export const ENTITY_MAP = {
  mode:                     { platform: 'sensor',       suffixRegex: /_iopool_mode$/ },
  poolMode:                 { platform: 'select',        suffixRegex: /_pool_mode$/ },
  boostSelector:            { platform: 'select',        suffixRegex: /_boost_selector$/ },
  actionRequired:           { platform: 'binary_sensor', suffixRegex: /_action_required$/ },
  filtration:               { platform: 'binary_sensor', suffixRegex: /_filtration$/ },
  elapsedFiltration:        { platform: 'sensor',        suffixRegex: /_elapsed_filtration_duration$/ },
  filtrationRecommendation: { platform: 'sensor',        suffixRegex: /_filtration_recommendation$/ },
  temperature:              { platform: 'sensor',        suffixRegex: /_temperature$/ },
  ph:                       { platform: 'sensor',        suffixRegex: /_ph$/ },
  orp:                      { platform: 'sensor',        suffixRegex: /_orp$/ },
} as const;
```

### 4.2 Resolution strategy (Strategy B — enumerate by device_id)

```typescript
function getEntitiesForDevice(hass: HomeAssistant, deviceId: string): EntityRegistryEntry[] {
  return Object.values(hass.entities || {}).filter(e => e.device_id === deviceId);
}

function findEntityBySuffix(
  entities: EntityRegistryEntry[],
  platform: string,
  suffixRegex: RegExp,
): string | undefined {
  return entities.find(
    e => e.entity_id.startsWith(`${platform}.`) && suffixRegex.test(e.entity_id)
  )?.entity_id;
}
```

### 4.3 Caching rule

- Compute the entity map **once** in `setConfig()`.
- Invalidate only when `device_id` changes.
- **Never** recompute in `set hass()` or `render()`.
- Never hardcode entity IDs — always use `ENTITY_MAP` + device-based resolution.

---

## 5. Pool Display Name

```typescript
// helpers/pool-name.ts
function resolvePoolName(hass: HomeAssistant, deviceId: string, fallback = 'iopool'): string {
  const device = hass.devices?.[deviceId];
  if (!device) return fallback;
  if (device.name_by_user?.trim()) return device.name_by_user.trim();
  if (device.name?.trim()) return device.name.trim();
  return fallback;
}
```

Call on **every render** — reflects device renames immediately without card reconfiguration.

---

## 6. Probe Mode Visibility Rules

| Probe mode | `pool_mode` | Sections shown | Sections hidden |
|---|---|---|---|
| `STANDARD` | `Standard` | All | — |
| `STANDARD` | `Active-Winter` | All except boost | Boost |
| `ACTIVE_WINTER` | any | Mode, pool mode | Gauges, chart, boost, action_required |
| `WINTER` | any | Mode, filtration mode | All others |
| `MAINTENANCE` | any | All (grayed) | — (+ warning banner) |
| `INITIALIZATION` | any | All (grayed) | — (+ warning banner) |

---

## 7. CSS and Theming

- Use **HA CSS variables** for semantic tokens: `--primary-color`, `--card-background-color`, `--primary-text-color`, etc.
- Light/dark theme is inherited automatically — never hardcode colors directly.
- All styles go in `styles.ts` as `css\`...\`` template literals — no external stylesheets.
- Use `:host` for card-level layout and `part` attributes for theme overrides when needed.

### 7.1 iopool Brand Color Convention

All iopool brand colors are defined as CSS custom properties in `styles.ts` under `:host`. **Always** reference them with a fallback hex value:

```css
/* ✅ Correct — direct use with fallback */
color: var(--iopool-red, #d0021b);
background: var(--iopool-green, #7ed321);

/* ✅ Correct — tinted variation using color-mix */
background: color-mix(in srgb, var(--iopool-primary, #17817a) 10%, transparent);
box-shadow: 0 4px 10px color-mix(in srgb, var(--iopool-orange, #f5a623) 25%, transparent);
color: color-mix(in srgb, var(--iopool-red, #d0021b) 50%, black);

/* ❌ Wrong — hardcoded RGBA derived from brand color */
background: rgba(208, 2, 27, 0.25);

/* ❌ Wrong — var without fallback */
color: var(--iopool-green);
```

Available iopool variables and their fallbacks:
| Variable | Fallback | Usage |
|---|---|---|
| `--iopool-primary` | `#17817a` | Brand teal — main accent |
| `--iopool-primary-dark` | `#0f5d57` | Darker teal — gradients |
| `--iopool-green` | `#7ed321` | OK / active states |
| `--iopool-orange` | `#f5a623` | Warning states |
| `--iopool-red` | `#d0021b` | Error / bad states |
| `--iopool-neutral` | `#94a39e` | Neutral gray — off/muted states |
| `--iopool-eco` | `#43d1cd` | ECO mode accent |
| `--iopool-sharing` | `#4bcffa` | Sharing mode accent |
| `--iopool-treatments` | `#42bdaa` | Treatments accent |
| `--iopool-gauge-bg` | `#eaf4f2` | Gauge background |
| `--iopool-gauge-bg-dark` | `#1a2625` | Gauge background (dark) |
| `--iopool-surface` | `rgba(23,129,122,0.04)` | Subtle surface tint |
| `--iopool-surface-strong` | `rgba(23,129,122,0.08)` | Strong surface tint |
| `--iopool-divider` | `rgba(23,129,122,0.12)` | Dividers |

**Exemptions** — do NOT apply this rule to:
- Pure utility shadows: `rgba(0,0,0,...)`, `rgba(255,255,255,...)` — these are not brand colors
- `console.info()` style strings — CSS custom properties do not work in browser console styling; use the hardcoded hex values there (see §3.3)

---

## 8. Localization

Locale files live in `src/locales/en.json` and `src/locales/fr.json`.

```typescript
// Pattern for locale lookup
import en from './locales/en.json';
import fr from './locales/fr.json';

const LOCALES: Record<string, typeof en> = { en, fr };

export function t(lang: string, key: string): string {
  const locale = LOCALES[lang] ?? LOCALES['en'];
  return (locale as Record<string, string>)[key] ?? key;
}
```

**Always** add keys to both `en.json` and `fr.json` when adding user-visible strings. Never leave a key missing in one locale.

---

## 9. Debug Mode

When `config.debug === true`:
1. Log entity resolution details at load time.
2. Log state updates with entity values on each `set hass()`.
3. Display a `DEBUG` badge in the card header.

```typescript
// helpers/debug.ts
export function debugLog(enabled: boolean, ...args: unknown[]): void {
  if (enabled) console.debug('[iopool-card]', ...args);
}
```

Debug mode is **YAML-only** (`debug: true` in card config). It must **not** appear in the visual editor.

---

## 10. Version and Release

`src/const.ts` contains:

```typescript
export const CARD_VERSION = "0.0.0-dev"; // Replaced at release time by semantic-release-replace-plugin
```

Do **not** change `CARD_VERSION` manually — it is managed by `semantic-release-replace-plugin` at release time.

---

## 11. Commit and PR Conventions

See `../git-conventions/SKILL.md` for the full convention.

Relevant scopes for this project:
- `card` (main card entry), `editor` (visual editor), `gauge` (liquid-gauge), `chart` (temperature-chart)
- `mode-selector`, `pump`, `filtration`, `boost`, `header`, `banner`
- `helpers` (any helper module), `i18n` (localization), `styles`, `const`, `types`
- `build` (Rollup config), `deps` (dependency bumps), `ci` (GitHub Actions workflows), `docs`

---

## 12. Review Checklist

For any code review in `src/`:

1. No `any` type without a justification comment.
2. All user-visible strings present in **both** `en.json` and `fr.json`.
3. No hardcoded entity IDs — always `ENTITY_MAP` + device-based resolution.
4. No hardcoded colors — all iopool brand colors use `var(--iopool-*, #hexfallback)` pattern; tinted/mixed variations use `color-mix(in srgb, var(--iopool-*) X%, transparent)`. Exemptions: pure black/white utility shadows and `console.info()` style strings (see §7.1).
5. Entity map computed in `setConfig()`, never in `set hass()` or `render()`.
6. Debug output only via `debugLog()` — no raw `console.log` in production paths.
7. No external icon fonts or SVG sprites — `<ha-icon icon="mdi:xxx">` only.
8. Temperature chart uses bundled ApexCharts 5.13.0 only; no Chart.js, D3, other chart libraries, CDN usage, or `window.ApexCharts` global.
9. Bundle size: after `npm run build`, `dist/iopool-card.js` must remain < 100 KB minified.
10. TypeScript strict mode: no implicit `undefined` or `null` access without a guard.
11. New Lit component: `@customElement` decorator + `customElements.define` at bottom.
12. Section actions: always use `section_actions` config, never a global `tap_action`.
