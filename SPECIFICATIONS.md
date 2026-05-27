# Specification — `hass-iopool-card`

> **Official Lovelace card for the Home Assistant `hass-iopool` integration**
> Document version: 2.0
> Author: Marc Guyard ([@mguyard](https://github.com/mguyard))
> Date: 2026-05-27
> Audience: implementation by an LLM-assisted developer (Sonnet via GitHub Copilot or equivalent)

---

## Table of contents

1. [Context and objectives](#1-context-and-objectives)
2. [Scope](#2-scope)
3. [Architecture and distribution](#3-architecture-and-distribution)
4. [Technical stack](#4-technical-stack)
5. [Data model — iopool entities](#5-data-model--iopool-entities)
6. [Functional specification](#6-functional-specification)
7. [Visual and UX specification](#7-visual-and-ux-specification)
8. [Visual editor (GUI editor)](#8-visual-editor-gui-editor)
9. [Internationalization](#9-internationalization)
10. [States and error handling](#10-states-and-error-handling)
11. [Debug mode (YAML-only)](#11-debug-mode-yaml-only)
12. [Performance and HA best practices](#12-performance-and-ha-best-practices)
13. [Documentation site](#13-documentation-site)
14. [Tests and validation criteria](#14-tests-and-validation-criteria)
15. [Distribution and release](#15-distribution-and-release)
16. [Roadmap v2](#16-roadmap-v2)
17. [Appendices](#17-appendices)

---

## 1. Context and objectives

### 1.1 Context

The `hass-iopool` integration (https://github.com/mguyard/hass-iopool) exposes data and controls from an iopool EcO sensor (a connected pool probe) inside Home Assistant. For each configured pool it creates a standardized set of entities (sensors, binary_sensors, switches, selects), documented at https://docs.page/mguyard/hass-iopool/integration/entities.

Today, end users must manually compose a Lovelace card using external custom cards (`button-card`, `mushroom`, `mini-graph-card`, `pool-monitor-card`, `timer-bar-card`, etc.) with hundreds of lines of YAML to obtain a satisfactory display.

### 1.2 Objective

Create **a native, official Lovelace card** distributed with the `hass-iopool` integration, that:

- Displays **all** useful information of an iopool pool in a single, monolithic card.
- Lets the user **act** on the pool (change filtration mode, turn the pump on/off, trigger a boost).
- **Automatically adapts** to the integration configuration (filtration enabled or not, pump switch present or not, current filtration mode).
- Is **fully configurable via the Lovelace visual editor**, with no YAML editing required (except for the optional debug mode — see §11).
- Follows the **iopool brand guidelines** while respecting Home Assistant conventions.
- Reacts to entity state changes in **real time**.

### 1.3 Target audience

Users of the `hass-iopool` integration. One card instance corresponds to **one pool**. The card targets a standard Lovelace dashboard, accessible through both the web browser and the Home Assistant Companion mobile app (iOS/Android).

---

## 2. Scope

### 2.1 Included in v1

- Lovelace card `iopool-card` (custom type: `custom:iopool-card`).
- Embedded visual editor (auto-discovered by HA when editing a dashboard).
- Distribution embedded in the Python `hass-iopool` integration (served through `register_static_path`).
- Standalone repository `hass-iopool-card` for sources, builds, releases.
- Light/dark theme support through HA CSS variables.
- French and English localization.
- Customizable temperature thresholds (notably useful for spas).
- Per-section action configuration (`tap_action` / `hold_action` / `double_tap_action`).
- Period selector for the temperature chart.
- Interactive tooltip on the chart.
- YAML-only debug mode (see §11).

### 2.2 Excluded from v1 (see [Roadmap v2](#16-roadmap-v2))

- Multi-pool support in a single card instance — one instance equals one pool, even in future versions.
- Heat pump (PaC) controls — planned for v2.
- Customization of pH and ORP thresholds — fixed values in v1.
- Standalone HACS publication of the card (v1 is served via the integration only) — no plan to change this.
- Integrated weather (out of scope for the iopool integration).

---

## 3. Architecture and distribution

### 3.1 Distribution model — embedded in the integration

The card is distributed **embedded within the `hass-iopool` Python integration**, modeled after `ha-bambulab` / `ha-bambulab-cards`:

- **Repository `mguyard/hass-iopool`** (existing Python integration) — receives a subfolder `custom_components/iopool/frontend/` containing the **pre-built JS bundle** of the card.
- **Repository `mguyard/hass-iopool-card`** (new) — holds the TypeScript sources, build pipeline, tests, and card-specific issues.

When the integration starts, `__init__.py`:
1. Registers an HTTP static path serving the bundled JS at `/iopool/iopool-card.js`.
2. Automatically registers the resource for Lovelace via `add_extra_js_url`.

Once the user installs the integration through HACS, the card is immediately available in the Lovelace card picker, **without any additional install step**.

### 3.2 Integration-side changes (OUT OF SCOPE for this project — provided as reference only)

> **IMPORTANT**: the modifications below MUST be applied manually to `mguyard/hass-iopool` and are NOT part of the `hass-iopool-card` project. The card developer should not attempt to modify the integration repo. This section is provided so the user can apply the changes themselves.

#### 3.2.1 File: `custom_components/iopool/const.py`

Add the following constants:

```python
# Frontend card distribution
CARD_URL = "/iopool/iopool-card.js"
CARD_FILENAME = "iopool-card.js"
CARD_SUBPATH = "frontend"  # subfolder under custom_components/iopool/
```

#### 3.2.2 File: `custom_components/iopool/__init__.py`

In `async_setup_entry`, add the card registration. Recommended placement: after all platforms are forwarded, before returning `True`.

```python
from pathlib import Path
from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from .const import CARD_URL, CARD_FILENAME, CARD_SUBPATH

_FRONTEND_REGISTERED = False  # module-level guard to avoid double registration

async def _async_register_frontend(hass: HomeAssistant) -> None:
    """Register the iopool-card JS bundle as a static resource and frontend script."""
    global _FRONTEND_REGISTERED
    if _FRONTEND_REGISTERED:
        return

    integration_dir = Path(__file__).parent
    card_file = integration_dir / CARD_SUBPATH / CARD_FILENAME

    if not card_file.is_file():
        _LOGGER.warning(
            "iopool-card frontend bundle not found at %s — the card will not be available",
            card_file,
        )
        return

    await hass.http.async_register_static_paths([
        StaticPathConfig(CARD_URL, str(card_file), cache_headers=False),
    ])
    add_extra_js_url(hass, CARD_URL)
    _FRONTEND_REGISTERED = True
    _LOGGER.info("iopool-card frontend registered at %s", CARD_URL)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    # ... existing setup code ...
    await _async_register_frontend(hass)
    return True
```

#### 3.2.3 Folder to create

```
custom_components/iopool/frontend/iopool-card.js   # to be populated by CI from hass-iopool-card releases
```

A `.gitkeep` may be used initially; the actual bundle will be PR'd in by the card repo CI (see §3.4).

#### 3.2.4 File: `manifest.json`

No change required — the card is internal to the integration.

#### 3.2.5 File: `hacs.json`

No change required — HACS only sees the integration, the card is bundled inside it.

### 3.3 Structure of the `hass-iopool-card` repository

```
hass-iopool-card/
├── src/
│   ├── iopool-card.ts              # Entry point, main LitElement
│   ├── iopool-card-editor.ts       # Visual editor (GUI)
│   ├── types.ts                    # TypeScript interfaces
│   ├── const.ts                    # Constants (CARD_VERSION injected at build time, DEFAULT_THRESHOLDS, etc.)
│   ├── styles.ts                   # Shared LitElement css`` styles
│   ├── helpers/
│   │   ├── device.ts               # Resolve iopool devices, list pool devices, derive entity ids from device
│   │   ├── slug.ts                 # Reproduce the Python slugify_pool_name behaviour client-side
│   │   ├── pool-name.ts            # Resolve display name from device (name_by_user → name)
│   │   ├── format.ts               # Duration, date, number formatting helpers
│   │   ├── thresholds.ts           # Threshold resolution (defaults + custom for temperature)
│   │   ├── zone.ts                 # valueToZone, zoneToColor, valueToFillPct
│   │   ├── debug.ts                # Debug logger (see §11)
│   │   └── history.ts              # Wrapper around hass.callApi for history
│   ├── components/
│   │   ├── liquid-gauge.ts         # Animated liquid gauge (SVG + requestAnimationFrame)
│   │   ├── mode-selector.ts        # Filtration mode segmented selector
│   │   ├── pump-control.ts         # Pump card with toggle
│   │   ├── filtration-progress.ts  # Daily filtration progress bar
│   │   ├── boost-selector.ts       # Boost selector + countdown
│   │   ├── temperature-chart.ts    # Temperature chart with hover tooltip
│   │   ├── header.ts               # Title + badges
│   │   └── warning-banner.ts       # Maintenance / opening / initialization banner
│   └── locales/
│       ├── en.json
│       └── fr.json
├── dist/                            # Generated bundle (gitignored locally, committed on release)
│   └── iopool-card.js
├── rollup.config.mjs
├── tsconfig.json
├── package.json
├── .releaserc                       # semantic-release configuration
├── .github/
│   └── workflows/
│       ├── build.yml               # Build on PR
│       └── release.yaml            # semantic-release + auto-PR to hass-iopool
├── README.md
└── LICENSE
```

### 3.4 Release workflow (semantic-release + automatic PR to `hass-iopool`)

Releases on `hass-iopool-card` must:

1. Use **semantic-release** with conventional commits (same convention as `hass-iopool` — see [reference workflow](https://raw.githubusercontent.com/mguyard/hass-iopool/refs/heads/main/.github/workflows/release.yaml)).
2. Build the bundle (`npm run build`).
3. Inject the new version into the bundle at build time (see §15.1).
4. Create a GitHub Release attaching `dist/iopool-card.js`.
5. **Automatically open a PR on `mguyard/hass-iopool`** that:
   - Updates `custom_components/iopool/frontend/iopool-card.js` with the new bundle.
   - Updates a `frontend/VERSION` file (or similar) with the new version.
   - Uses a PR title `chore(card): bump iopool-card to vX.Y.Z` (conventional commits compatible).
   - Tags the PR with `card-update`.
6. The PR is **mandatory** (not optional) — every release of `hass-iopool-card` triggers it.

#### 3.4.1 Suggested `release.yaml` for `hass-iopool-card`

```yaml
---
name: Release

on:
  push:
    branches:
      - main
      - beta

permissions:
  contents: write
  issues: write
  pull-requests: write

jobs:
  release:
    name: Release
    runs-on: ubuntu-latest
    environment:
      name: Semver
    steps:
      - name: Checkout
        uses: actions/checkout@v6
        with:
          persist-credentials: false
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v5
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Install semantic-release
        run: |
          npm install -g semantic-release \
            @semantic-release/github \
            @semantic-release/commit-analyzer \
            @semantic-release/git \
            @semantic-release/release-notes-generator \
            @semantic-release/changelog \
            @semantic-release/exec \
            semantic-release-replace-plugin

      - name: Release
        id: semantic
        env:
          GH_TOKEN: ${{ secrets.GH_TOKEN }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: npx semantic-release

      - name: Show version
        if: steps.semantic.outputs.new_release_published == 'true'
        run: |
          echo "Released version: ${{ steps.semantic.outputs.new_release_version }}"

      - name: Trigger PR to hass-iopool
        if: steps.semantic.outputs.new_release_published == 'true'
        env:
          GH_TOKEN: ${{ secrets.PAT_HASS_IOPOOL }}  # Personal Access Token with write access to hass-iopool
          NEW_VERSION: ${{ steps.semantic.outputs.new_release_version }}
        run: |
          # Clone hass-iopool
          git clone https://x-access-token:${GH_TOKEN}@github.com/mguyard/hass-iopool.git iopool-repo
          cd iopool-repo
          BRANCH="chore/card-update-v${NEW_VERSION}"
          git checkout -b "${BRANCH}"

          # Copy the new bundle
          mkdir -p custom_components/iopool/frontend
          cp ../dist/iopool-card.js custom_components/iopool/frontend/iopool-card.js
          echo "${NEW_VERSION}" > custom_components/iopool/frontend/VERSION

          # Commit
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add custom_components/iopool/frontend/
          git commit -m "chore(card): bump iopool-card to v${NEW_VERSION}"
          git push origin "${BRANCH}"

          # Open the PR
          gh pr create \
            --title "chore(card): bump iopool-card to v${NEW_VERSION}" \
            --body "Automated PR from hass-iopool-card release v${NEW_VERSION}." \
            --label "card-update" \
            --base main \
            --head "${BRANCH}"
```

#### 3.4.2 `.releaserc` (semantic-release configuration)

```json
{
  "branches": [
    "main",
    { "name": "beta", "prerelease": true }
  ],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    [
      "semantic-release-replace-plugin",
      {
        "replacements": [
          {
            "files": ["src/const.ts"],
            "from": "export const CARD_VERSION = .*;",
            "to": "export const CARD_VERSION = \"${nextRelease.version}\";",
            "results": [{ "file": "src/const.ts", "hasChanged": true, "numMatches": 1, "numReplacements": 1 }],
            "countMatches": true
          }
        ]
      }
    ],
    [
      "@semantic-release/exec",
      {
        "prepareCmd": "npm run build"
      }
    ],
    [
      "@semantic-release/git",
      {
        "assets": ["CHANGELOG.md", "src/const.ts", "dist/iopool-card.js", "package.json"],
        "message": "chore(release): ${nextRelease.version}\n\n${nextRelease.notes}"
      }
    ],
    [
      "@semantic-release/github",
      {
        "assets": [
          { "path": "dist/iopool-card.js", "label": "iopool-card.js" }
        ]
      }
    ]
  ]
}
```

---

## 4. Technical stack

### 4.1 Versions (latest stable as of 2026-05-27)

The card targets the **latest stable Home Assistant** version and ships only with that constraint — we explicitly prefer modern stack over legacy compatibility.

| Tool | Version | Notes |
|---|---|---|
| **Home Assistant** | **>= 2026.5.x** | Minimum supported version — declared in HACS metadata |
| Node.js | 22 LTS | Used in CI |
| TypeScript | 6.x (latest stable) | `strict` mode enabled |
| Lit | 3.3.x (latest stable) | Import as `lit` from npm |
| Rollup | 4.x (latest stable) | Bundler |
| `@rollup/plugin-typescript` | latest | Or `rollup-plugin-typescript2` if needed |
| `@rollup/plugin-node-resolve` | latest | |
| `@rollup/plugin-commonjs` | latest | |
| `@rollup/plugin-terser` | latest | Minification |
| ESLint | 9.x with `@typescript-eslint` v8.x | Flat config |
| Prettier | 3.x | |
| semantic-release | latest | + plugins listed in §3.4 |

**The implementer must verify these versions are still current at implementation time** and pick the latest stable releases. The principle is: support only HA `>= 2026.5.x` with the latest compatible stack.

### 4.2 Target output

- **Single bundle** `iopool-card.js`, format IIFE, target ES2022.
- **Target size**: < 100 KB minified, < 30 KB gzipped.
- **Browsers**: Chrome/Edge/Safari/Firefox (latest 2 versions), iOS Safari 16+, Android Chrome 110+.

### 4.3 Runtime dependencies

**Zero runtime dependencies** outside of `lit`, which is itself loaded as part of the bundle. All icons use `<ha-icon icon="mdi:xxx">` — the native HA component, no external MDI font, no SVG sprite. Charts are pure native SVG with no library (no Chart.js, ApexCharts, D3, etc.).

### 4.4 Card metadata registration

The card must register with Home Assistant via `customElements.define` and `window.customCards.push`:

```typescript
window.customCards = window.customCards || [];
window.customCards.push({
  type: "iopool-card",
  name: "iopool Card",
  description: "Official iopool — full management of a connected pool",
  preview: true,
  documentationURL: "https://github.com/mguyard/hass-iopool-card"
});
```

### 4.5 Minimum HA version declaration

In `hass-iopool` (integration side, applied by the user manually):

```json
{
  "homeassistant": "2026.5.0"
}
```
(in `hacs.json`, key `homeassistant`)

---

## 5. Data model — iopool entities

### 5.1 Pool naming convention

All iopool entities follow the convention defined in [`entity.py`](https://github.com/mguyard/hass-iopool/blob/main/custom_components/iopool/entity.py):

```
{platform}.iopool_{slug}_{suffix}
```

Where `{slug}` is the slugified pool name and `{suffix}` identifies the entity.

#### 5.1.1 Slugification function (reference)

The Python function is:

```python
import re
import unicodedata

def slugify_pool_name(name: str) -> str:
    """Convert a pool name to a valid entity ID slug.

    Normalizes accented characters, lowercases, and replaces any sequence
    of non-alphanumeric characters with a single underscore.
    """
    # Normalize accented characters via NFKD: à→a, é→e, ç→c, etc.
    nfkd = unicodedata.normalize("NFKD", name)
    ascii_name = nfkd.encode("ascii", "ignore").decode("ascii")
    # Replace any sequence of non [a-z0-9] chars with a single underscore
    slugged = re.sub(r"[^a-z0-9]+", "_", ascii_name.lower())
    return slugged.strip("_")
```

The card **does not** need to slugify (it does not create entities — it reads existing ones). However, it must understand the convention to map a known device to its derived entity IDs (see §5.4).

### 5.2 Card configuration — primary reference

The card takes a **device** as its primary configuration input (not an entity). The user selects an `iopool` device through the visual editor. The device picker must be **filtered to show only devices belonging to the `iopool` integration** (`integration: "iopool"`).

**Why a device?** All iopool entities for a given pool are attached to a single HA device. The device has:
- A stable `id` (`device_id`), independent of renaming.
- A `name` and an optional user-set `name_by_user`.
- An `identifiers` set including a domain-specific identifier.

From the device, the card derives:
- The pool display name (see §5.5).
- The list of entities associated to the device — by iterating `hass.entities` and filtering on `device_id`.

### 5.3 Card YAML configuration

```yaml
type: custom:iopool-card
device_id: 0a1b2c3d4e5f6a7b8c9d0e1f...   # REQUIRED — iopool device id
pump_entity: switch.pool_switch          # OPTIONAL — pump switch (any switch entity)
show_chart: true                          # OPTIONAL — default true
chart_period: 96                          # OPTIONAL — hours, default 96, values: 24|48|96|168
temperature_thresholds:                   # OPTIONAL — see §6.3.1, defaults to pool values
  - 15      # zone red-low ends (below = red)
  - 20.5    # zone yellow-low ends, green starts
  - 29      # green ends, yellow-high starts
  - 32      # yellow-high ends, red-high starts
debug: false                              # OPTIONAL, YAML-only — see §11
section_actions:                          # OPTIONAL — per-section action overrides
  temperature:
    tap_action: { action: more-info }
  ph:
    tap_action: { action: more-info }
  orp:
    tap_action: { action: more-info }
  pump:
    tap_action: { action: toggle }
  mode:
    tap_action: { action: more-info }
  filtration:
    tap_action: { action: more-info }
  boost:
    tap_action: { action: more-info }
```

> **Note**: there is **no top-level `tap_action` / `hold_action` / `double_tap_action`**. A single card represents a single pool — a global tap action does not have a meaningful target. Only `section_actions` is supported (per-section overrides). See §6.1.

### 5.4 Resolving entities from a device

The card derives the iopool entity IDs from the device, with **two complementary strategies**:

#### Strategy A — Identifier-based slug extraction (preferred)

The device has identifiers of the form `(DOMAIN, pool_id)` where `DOMAIN = "iopool"` and `pool_id` is the iopool API pool identifier. However, **entity IDs use the slugified pool name, not the pool_id**. So we cannot directly derive entity IDs from the identifier.

#### Strategy B — Enumerate entities by device_id (recommended)

Use `hass.entities` registry to find all entities attached to the device:

```typescript
function getEntitiesForDevice(hass: HomeAssistant, deviceId: string): EntityRegistryEntry[] {
  const allEntries = Object.values(hass.entities || {}) as EntityRegistryEntry[];
  return allEntries.filter(e => e.device_id === deviceId);
}

function findEntityBySuffix(entities: EntityRegistryEntry[], platform: string, suffixRegex: RegExp): string | undefined {
  const match = entities.find(e =>
    e.entity_id.startsWith(`${platform}.`) && suffixRegex.test(e.entity_id)
  );
  return match?.entity_id;
}
```

The card maintains a map of expected entities (suffix → role):

```typescript
const ENTITY_MAP: Record = {
  mode: { platform: 'sensor', suffixRegex: /_iopool_mode$/ },
  poolMode: { platform: 'select', suffixRegex: /_pool_mode$/ },
  boostSelector: { platform: 'select', suffixRegex: /_boost_selector$/ },
  actionRequired: { platform: 'binary_sensor', suffixRegex: /_action_required$/ },
  filtration: { platform: 'binary_sensor', suffixRegex: /_filtration$/ },
  elapsedFiltration: { platform: 'sensor', suffixRegex: /_elapsed_filtration_duration$/ },
  filtrationRecommendation: { platform: 'sensor', suffixRegex: /_filtration_recommendation$/ },
  temperature: { platform: 'sensor', suffixRegex: /_temperature$/ },
  ph: { platform: 'sensor', suffixRegex: /_ph$/ },
  orp: { platform: 'sensor', suffixRegex: /_orp$/ },
};
```

#### Caching

The mapping `device_id → resolved_entity_ids` is computed once per `setConfig` and cached. It is only re-computed if:
- The user changes the `device_id` in the config.
- A signal from HA suggests the registry has changed (e.g., `entity_registry_updated` event — optional refinement).

### 5.5 Pool display name resolution

The card title shows the **personalized pool name** as defined when the user configured the integration. Resolution order:

```typescript
function resolvePoolName(hass: HomeAssistant, deviceId: string, fallback = 'iopool'): string {
  const device = hass.devices?.[deviceId];
  if (!device) return fallback;
  // 1. User-set name takes precedence
  if (device.name_by_user && device.name_by_user.trim()) return device.name_by_user.trim();
  // 2. Default device name
  if (device.name && device.name.trim()) return device.name.trim();
  // 3. Fallback
  return fallback;
}
```

This resolution is called on **every render**. When the user renames the device in HA's UI, the card title reflects the change immediately on the next state update.

### 5.6 Iopool entities reference table

| Entity role | Suffix pattern | Platform | Description |
|---|---|---|---|
| Probe mode | `_iopool_mode` | sensor | Values: `STANDARD`, `OPENING`, `ACTIVE_WINTER`, `WINTER`, `INITIALIZATION`, `MAINTENANCE` |
| Filtration mode (select) | `_pool_mode` | select | Options: `Standard`, `Active-Winter`, `Passive-Winter` |
| Boost selector | `_boost_selector` | select | Options: `None`, `1H`, `2H`, `4H`, `8H`, `24H`. Attributes: `boost_start_time`, `boost_end_time` |
| Action required | `_action_required` | binary_sensor | `on` / `off` |
| Filtration active | `_filtration` | binary_sensor | `on` / `off`. Attribute: `filtration_duration_minutes` (target duration in minutes) |
| Elapsed filtration | `_elapsed_filtration_duration` | sensor | Hours (float) |
| iopool recommendation | `_filtration_recommendation` | sensor | Minutes (integer) |
| Temperature | `_temperature` | sensor | °C (float) |
| pH | `_ph` | sensor | float |
| ORP | `_orp` | sensor | mV (float) |

### 5.7 Pump switch entity

The pump switch is **not part of the iopool integration's device** — it is a separate `switch` entity configured by the user (in their HA setup or in the iopool integration's options). The card requests it as a separate optional config field `pump_entity`.

---

## 6. Functional specification

### 6.1 Configuration semantics

#### 6.1.1 No top-level tap actions

Because a card instance maps to a single iopool device, a global "tap on card" action would have no meaningful target. Therefore the card **does not** expose top-level `tap_action`, `hold_action`, or `double_tap_action`. Only `section_actions` is supported (per-section overrides).

#### 6.1.2 Default actions per section

If `section_actions.<section>` is not provided, the following defaults apply:

| Section | Default `tap_action` | Default `hold_action` | Default `double_tap_action` |
|---|---|---|---|
| `temperature` | `more-info` (on the temperature sensor) | `none` | `none` |
| `ph` | `more-info` (on the pH sensor) | `none` | `none` |
| `orp` | `more-info` (on the ORP sensor) | `none` | `none` |
| `mode` | `more-info` (on the pool_mode select) | `none` | `none` |
| `pump` | `toggle` (on the pump switch) | `more-info` | `none` |
| `filtration` | `more-info` (on the filtration binary_sensor) | `none` | `none` |
| `boost` | `more-info` (on the boost selector) | `none` | `none` |

These defaults are applied at render time; the user only overrides what they want different.

The action handler should delegate to HA's standard `ActionHandler` (`@material/mwc-` or LitElement equivalent), supporting actions: `more-info`, `toggle`, `call-service`, `navigate`, `url`, `none`.

### 6.2 Conditional section display (CRITICAL)

Display depends on the **probe mode** (`sensor.iopool_{slug}_iopool_mode`) AND the **filtration mode** (`select.iopool_{slug}_pool_mode`).

#### Decision table

| Probe mode | Section | Visible? | Notes |
|---|---|---|---|
| `STANDARD` / `OPENING` | Header (title + badges) | ✅ | Mode badge + action_required badge |
| `STANDARD` / `OPENING` | Gauges (Temp/pH/ORP) | ✅ | |
| `STANDARD` / `OPENING` | Mode selector | ✅ | |
| `STANDARD` / `OPENING` | Pump | ✅ if `pump_entity` configured | |
| `STANDARD` / `OPENING` | Daily filtration | ✅ if filtration entity exists | |
| `STANDARD` / `OPENING` | Boost | ✅ if pool_mode = `Standard` | Hidden in `Active-Winter` |
| `STANDARD` / `OPENING` | Temperature chart | ✅ if `show_chart: true` | |
| `ACTIVE_WINTER` | Header | ✅ | `action_required` badge hidden |
| `ACTIVE_WINTER` | Gauges | ❌ | Probe out of water |
| `ACTIVE_WINTER` | Mode selector | ✅ | |
| `ACTIVE_WINTER` | Pump | ✅ if `pump_entity` configured | |
| `ACTIVE_WINTER` | Daily filtration | ✅ | |
| `ACTIVE_WINTER` | Boost | ❌ | |
| `ACTIVE_WINTER` | Temperature chart | ❌ | |
| `WINTER` (passive) | Header | ✅ | `action_required` badge hidden |
| `WINTER` (passive) | Gauges | ❌ | |
| `WINTER` (passive) | Mode selector | ✅ | |
| `WINTER` (passive) | Pump | ❌ | Passive wintering = pump off, no display |
| `WINTER` (passive) | Daily filtration | ❌ | |
| `WINTER` (passive) | Boost | ❌ | |
| `WINTER` (passive) | Temperature chart | ❌ | |
| `MAINTENANCE` | ALL | ✅ but GRAYED OUT | Warning banner "data may be outdated" |
| `INITIALIZATION` | ALL | ✅ but GRAYED OUT | Warning banner "initialization in progress" |

#### Implementation

```typescript
type IopoolMode = 'STANDARD' | 'OPENING' | 'ACTIVE_WINTER' | 'WINTER' | 'INITIALIZATION' | 'MAINTENANCE';
type PoolMode = 'Standard' | 'Active-Winter' | 'Passive-Winter';

interface DisplayFlags {
  showGauges: boolean;
  showChart: boolean;
  showActionBadge: boolean;
  showMode: boolean;            // always true
  showPump: boolean;
  showFiltration: boolean;
  showBoost: boolean;
  isGrayed: boolean;
  warningBanner: 'maintenance' | 'initialization' | null;
}

function computeDisplay(
  iopoolMode: IopoolMode,
  poolMode: PoolMode,
  hasPumpEntity: boolean,
  hasFiltrationEntity: boolean,
  showChartConfig: boolean,
): DisplayFlags {
  const isStandard = iopoolMode === 'STANDARD' || iopoolMode === 'OPENING';
  const isActiveWinter = iopoolMode === 'ACTIVE_WINTER';
  const isPassiveWinter = iopoolMode === 'WINTER';
  const isMaintenance = iopoolMode === 'MAINTENANCE';
  const isInitialization = iopoolMode === 'INITIALIZATION';
  const isGrayed = isMaintenance || isInitialization;

  return {
    showGauges: isStandard || isGrayed,
    showChart: (isStandard || isGrayed) && showChartConfig,
    showActionBadge: isStandard || isGrayed,
    showMode: true,
    showPump: hasPumpEntity && !isPassiveWinter,
    showFiltration: hasFiltrationEntity && !isPassiveWinter,
    showBoost: isStandard && poolMode === 'Standard',
    isGrayed,
    warningBanner: isMaintenance ? 'maintenance' : (isInitialization ? 'initialization' : null),
  };
}
```

### 6.3 Gauge logic (Temperature / pH / ORP)

Each gauge computes:
1. The **fill percentage** of the liquid (0 to 100%).
2. The **zone color** (green / orange / red) based on thresholds.

#### 6.3.1 Threshold convention (CORRECTED)

Each measure uses **4 transition values** that delimit 5 zones (red-low / yellow-low / green / yellow-high / red-high). The user specifies the 4 transitions directly.

| Measure | Default thresholds (4 transitions) | Zones |
|---|---|---|
| **Temperature** | `[15, 20.5, 29, 32]` | <15 red, 15-20.5 yellow, 20.5-29 green, 29-32 yellow, >32 red |
| **pH** (fixed) | `[6.8, 7.1, 7.7, 8.1]` | <6.8 red, 6.8-7.1 yellow, 7.1-7.7 green, 7.7-8.1 yellow, >8.1 red |
| **ORP** (fixed) | `[550, 650, 800, 1000]` | <550 red, 550-650 yellow, 650-800 green, 800-1000 yellow, >1000 red |

Only **temperature thresholds** are customizable through the editor. pH and ORP are fixed at the values above in v1.

#### Zone calculation

```typescript
type Zone = 'red-low' | 'yellow-low' | 'green' | 'yellow-high' | 'red-high';

/** thresholds is an array of 4 transition values, strictly increasing */
function valueToZone(value: number, thresholds: [number, number, number, number]): Zone {
  if (value < thresholds[0]) return 'red-low';
  if (value < thresholds[1]) return 'yellow-low';
  if (value < thresholds[2]) return 'green';
  if (value < thresholds[3]) return 'yellow-high';
  return 'red-high';
}

function zoneToColor(zone: Zone): 'green' | 'orange' | 'red' {
  if (zone === 'green') return 'green';
  if (zone === 'red-low' || zone === 'red-high') return 'red';
  return 'orange';
}
```

#### Fill percentage calculation

The fill percentage represents the value within the **full visual range** of the gauge. The visual range extends slightly beyond the outer transitions to give visual margin for "out of range" values.

```typescript
function valueToFillPct(value: number, thresholds: [number, number, number, number]): number {
  // Visual scale: from (t0 - margin) to (t3 + margin)
  const t0 = thresholds[0];
  const t3 = thresholds[3];
  const range = t3 - t0;
  const margin = range * 0.25;                // 25% margin on each side
  const visualMin = t0 - margin;
  const visualMax = t3 + margin;
  const pct = ((value - visualMin) / (visualMax - visualMin)) * 100;
  return Math.max(0, Math.min(100, pct));
}
```

This way, a "perfect" value (centered in the green zone) fills the gauge around 50%, and extreme values fill near 0% or 100%.

### 6.4 Per-zone status label

Above the gauge value, a small tag indicates the status:

| Zone | Label (FR / EN) |
|---|---|
| `red-low` | `Trop bas` / `Too low` |
| `yellow-low` | `Bas` / `Low` |
| `green` | `Idéal` / `Ideal` |
| `yellow-high` | `Élevé` / `High` |
| `red-high` | `Trop élevé` / `Too high` |

### 6.5 Daily filtration

#### Data sources
- `sensor.iopool_{slug}_elapsed_filtration_duration`: hours (float)
- `binary_sensor.iopool_{slug}_filtration`: attribute `filtration_duration_minutes` = target in minutes
- `sensor.iopool_{slug}_filtration_recommendation`: minutes (integer)

#### Display
- Title: "Daily filtration" + icon `mdi:filter-variant`.
- Percentage achieved: `(elapsed_hours * 60 / target_minutes) * 100`, integer.
- Progress bar:
  - Width = percentage capped at 100% visually.
  - If > 100%, the bar stays full and the percentage is shown in **green** (positive overshoot).
- Sub-text:
  - Left: `"Done {HH:mm:ss} · target {HH:mm:ss}"`.
  - Right: `"iopool: {HH:mm:ss}"` (recommendation).

#### Duration formatting

```typescript
function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
```

### 6.6 Boost

#### Data sources
- `select.iopool_{slug}_boost_selector`: current value (`None`, `1H`, `2H`, `4H`, `8H`, `24H`).
- Attributes:
  - `boost_start_time` (ISO datetime)
  - `boost_end_time` (ISO datetime)

#### Display
- Title: "Boost" + icon `mdi:plus-box-multiple`.
- If active (value != `None`), to the right of title: `"Active · {remaining} left"`.
- 6 buttons in `repeat(6, 1fr)` grid:
  - First (None): icon `mdi:timer-off-outline`.
  - Others: text `1h`, `2h`, `4h`, `8h`, `24h`.
- Active button: iopool teal gradient + subtle shadow.
- Inactive buttons: light background, border, hover turns teal.
- Below buttons: countdown bar (visible only when boost is active).

#### Countdown logic

```typescript
interface BoostStatus {
  remainingMs: number;
  totalMs: number;
  pct: number;  // 0–100, percentage of remaining time
}

function getBoostRemaining(state: HassEntity): BoostStatus | null {
  if (!state || state.state === 'None' || state.state === 'unavailable') return null;
  const startStr = state.attributes.boost_start_time;
  const endStr = state.attributes.boost_end_time;
  if (!startStr || !endStr) return null;
  const start = new Date(startStr).getTime();
  const end = new Date(endStr).getTime();
  if (!isFinite(start) || !isFinite(end)) return null;
  const now = Date.now();
  const totalMs = end - start;
  const remainingMs = Math.max(0, end - now);
  const pct = totalMs > 0 ? (remainingMs / totalMs) * 100 : 0;
  return { remainingMs, totalMs, pct };
}
```

The countdown must refresh **once per second** (`setInterval(1000)`) while the card is visible. Stop the interval in `disconnectedCallback`.

#### Actions
- Tap on any button except None → `hass.callService('select', 'select_option', { entity_id, option: '<value>' })`.
- Tap on None → `hass.callService('select', 'select_option', { entity_id, option: 'None' })` (stops the boost).

### 6.7 Pump

#### Data source
- The user-configured `pump_entity` (a `switch` entity).

#### Display
- Card with icon:
  - ON: `mdi:water-pump`
  - OFF: `mdi:water-pump-off`
- Colored state:
  - ON: subtle green gradient + 25% green border.
  - OFF: subtle red gradient + 25% red border.
- Toggle switch on the right (interactive).
- Tap on the card (anywhere outside the toggle) → configured action (default: `toggle`).

### 6.8 Filtration mode selector

#### Data source
- `select.iopool_{slug}_pool_mode`: current value.

#### Display
- Left icon (changes with mode):
  - `Standard` → `mdi:white-balance-sunny`
  - `Active-Winter` → `mdi:sun-snowflake-variant`
  - `Passive-Winter` → `mdi:snowflake`
- Label "Filtration mode" + translated value.
- Right: 3 segmented buttons (one per mode) with the same icons.
- Tap on a segment → `hass.callService('select', 'select_option', { entity_id, option: '<value>' })`.

### 6.9 Probe mode badge (header)

#### Data source
- `sensor.iopool_{slug}_iopool_mode`.

#### Display
- Badge in top-right of header.
- Icon:
  - `STANDARD` / `OPENING` → `mdi:pool`
  - `ACTIVE_WINTER` / `WINTER` → `mdi:snowflake`
  - `INITIALIZATION` → `mdi:cog-sync`
  - `MAINTENANCE` → `mdi:wrench`
- Text: translated mode.
- Background: subtle iopool teal.

### 6.10 Action required badge (header)

#### Data source
- `binary_sensor.iopool_{slug}_action_required`.

#### Display
- Badge below the mode badge.
- State `off`:
  - Icon `mdi:emoticon-cool-outline`.
  - Text "All good" / "Tout va bien".
  - Green color.
- State `on`:
  - Icon `mdi:alert-circle`.
  - Text "Action required" / "Action requise".
  - Orange/warn color.

### 6.11 Temperature chart

#### Data sources
- `sensor.iopool_{slug}_temperature`.
- HA history API: `/api/history/period/{start_time}`.

#### Behaviour
- 4 period selector buttons: `24h` / `48h` / `96h` / `7d`.
- On mount: fetch history for the current period.
- On period change: re-fetch.
- Live update: on each state change of the temperature entity, append the new point to the chart without a full re-fetch.

#### Native SVG rendering
- Y-axis: 4 graduations (temperature in °C, range adapted to data).
- X-axis: 5 graduations (dates/hours based on period).
- Smoothed line (Bézier curve).
- Gradient area below the curve (iopool teal, fading to transparent).
- On hover/touch: vertical line + dot + tooltip with precise value and date/time.

#### Stats under the chart
- **Min**: value + date/time of the extremum.
- **Avg**: average over the period.
- **Max**: value + date/time of the extremum.

#### History fetching

```typescript
interface HistoryPoint {
  timestamp: number;
  value: number;
}

async function fetchHistory(
  hass: HomeAssistant,
  entityId: string,
  periodHours: number,
  abortSignal?: AbortSignal,
): Promise {
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - periodHours * 3600 * 1000);

  const url = `history/period/${startTime.toISOString()}` +
    `?filter_entity_id=${encodeURIComponent(entityId)}` +
    `&end_time=${encodeURIComponent(endTime.toISOString())}` +
    `&minimal_response&no_attributes`;

  const result = await hass.callApi('GET', url);
  if (!result || !result[0]) return [];

  return result[0]
    .map(p => ({
      timestamp: new Date(p.last_changed).getTime(),
      value: parseFloat(p.state),
    }))
    .filter(p => !isNaN(p.value));
}
```

**Best practice**: use `minimal_response` and `no_attributes` to reduce payload. Downsample to ~500 points max for rendering performance.

---

## 7. Visual and UX specification

### 7.1 iopool brand colors

| Name | HEX | Usage |
|---|---|---|
| Primary | `#17817A` | Main accents, active buttons, gradients |
| Primary Dark | `#0f5d57` | Gradient endpoints |
| EcO | `#43D1CD` | Variation |
| Sharing (blue) | `#4BCFFA` | Button gradient + accents |
| Treatments | `#42BDAA` | Variation, chart line |
| Green | `#7ED321` | OK status, green liquid |
| Orange | `#F5A623` | Attention status, orange liquid |
| Red | `#D0021B` | Critical status, red liquid |
| BG light | `#F4F8F7` | Light background, secondary surfaces |

#### Brand gradients

- **Button**: `linear-gradient(135deg, #51AFE7 0%, #62D2C6 100%)`
- **Main**: `linear-gradient(180deg, #42BDAA 0%, #2C7C70 100%)`

### 7.2 Typography

The card uses **only the HA-provided font**:

```css
:host {
  font-family: var(--primary-font-family, system-ui, sans-serif);
}
```

**No external font** (no Montserrat, no Google Fonts). This avoids external dependencies and ensures the card matches the user's overall HA theme.

Type scale:
- h1 (pool title): 22px / 800
- Section titles: 13px / 700
- Uppercase labels: 10–11px / 700
- Main gauge values: 26px / 800
- Body: 12–14px / 500–600

### 7.3 CSS variables

The card uses **HA CSS variables in priority** for theme integration, and adds custom variables for iopool-specific colors:

```css
:host {
  /* HA-inherited variables */
  --primary-text-color: var(--primary-text-color);
  --secondary-text-color: var(--secondary-text-color);
  --card-background-color: var(--card-background-color);
  --divider-color: var(--divider-color);
  --primary-color: var(--primary-color);
  --error-color: var(--error-color);
  --warning-color: var(--warning-color);
  --success-color: var(--success-color);

  /* iopool brand variables */
  --iopool-primary: #17817A;
  --iopool-primary-dark: #0f5d57;
  --iopool-eco: #43D1CD;
  --iopool-sharing: #4BCFFA;
  --iopool-treatments: #42BDAA;
  --iopool-green: #7ED321;
  --iopool-orange: #F5A623;
  --iopool-red: #D0021B;
  --iopool-grad-button: linear-gradient(135deg, #51AFE7 0%, #62D2C6 100%);
  --iopool-grad-main: linear-gradient(180deg, #42BDAA 0%, #2C7C70 100%);
  --iopool-gauge-bg: #EAF4F2;
  --iopool-gauge-bg-dark: #1a2625;
}
```

### 7.4 Spacing and radii

- Main card radius: `28px`
- Inner section radius: `18px`
- Button radius: `9–12px`
- Card padding: `20–24px`
- Section gap: `10px`

### 7.5 Section ordering

1. **Header** (always): title + subtitle + badges (mode + action_required)
2. **Warning banner** (conditional: maintenance / initialization)
3. **Gauges** (Temp/pH/ORP, 3 equal columns)
4. **Mode selector**
5. **Pump** (conditional)
6. **Daily filtration** (conditional)
7. **Boost** (conditional)
8. **Temperature chart** (conditional)

### 7.6 Liquid Gauge component — technical detail

The liquid gauge is the signature visual element. Implementation:

```typescript
@customElement('iopool-liquid-gauge')
class IopoolLiquidGauge extends LitElement {
  @property() value!: number;
  @property() unit!: string;
  @property() label!: string;
  @property() target!: number;
  @property() thresholds!: [number, number, number, number];
  @property() unavailable = false;

  @state() private _fillPct = 0;
  @state() private _color: 'green' | 'orange' | 'red' = 'green';
  @state() private _zone: Zone = 'green';
  private _animationId?: number;
  private _startTime = performance.now();

  protected updated(changed: PropertyValues) {
    if (changed.has('value') || changed.has('thresholds')) {
      this._zone = valueToZone(this.value, this.thresholds);
      this._color = zoneToColor(this._zone);
      this._fillPct = valueToFillPct(this.value, this.thresholds);
    }
  }

  connectedCallback() {
    super.connectedCallback();
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this._startAnimation();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._animationId) cancelAnimationFrame(this._animationId);
  }

  private _startAnimation = () => {
    const t = performance.now() - this._startTime;
    const breathing = Math.sin(t * 0.0005) * 0.4;
    const effectiveFill = this._fillPct + breathing;
    const backD = this._buildWavePath(t, effectiveFill, 1.5, 0, 0.7);
    const frontD = this._buildWavePath(t * 1.3, effectiveFill, 2.5, Math.PI / 2, 1.0);
    const back = this.renderRoot.querySelector('.wave-back');
    const front = this.renderRoot.querySelector('.wave-front');
    if (back) back.setAttribute('d', backD);
    if (front) front.setAttribute('d', frontD);
    this._animationId = requestAnimationFrame(this._startAnimation);
  };

  private _buildWavePath(
    timeMs: number, fillPct: number, amplitude: number,
    phaseShift: number, wavelengthFactor: number,
  ): string {
    const VIEW_W = 100, VIEW_H = 100;
    const baseY = VIEW_H - fillPct;
    const segments = 30;
    const phase = (timeMs * 0.0008 * wavelengthFactor) + phaseShift;
    const wavelength = 1.4 * wavelengthFactor;
    let d = '';
    for (let i = 0; i <= segments; i++) {
      const x = (i / segments) * VIEW_W;
      const y = baseY + Math.sin((x / VIEW_W) * Math.PI * 2 * wavelength + phase) * amplitude;
      d += i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    d += ` L ${VIEW_W} ${VIEW_H} L 0 ${VIEW_H} Z`;
    return d;
  }
}
```

When `unavailable === true`, the gauge shows "—", liquid at 0%, no animation.

### 7.7 Dark mode detection

Use HA's exposed `hass.themes.darkMode` (boolean). Fall back to media query if not present:

```typescript
function isDarkMode(hass: HomeAssistant): boolean {
  if (typeof hass.themes?.darkMode === 'boolean') return hass.themes.darkMode;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}
```

Liquid colors are JS-defined to avoid harsh contrast in light theme:

```typescript
const LIQUID_COLORS_LIGHT = {
  green:  { stop1: '#9EE040', stop2: '#6BB81B' },
  orange: { stop1: '#FFC25C', stop2: '#E89010' },
  red:    { stop1: '#FF6B6B', stop2: '#B8011A' },
};
const LIQUID_COLORS_DARK = {
  green:  { stop1: '#5CA80F', stop2: '#3A7708' },
  orange: { stop1: '#C77808', stop2: '#8E5605' },
  red:    { stop1: '#A8001F', stop2: '#6B0014' },
};
```

### 7.8 Mobile-first

The card must remain usable at 380px width:
- No horizontal scrolling.
- Touch targets >= 32×32px.
- Min font size 11px on secondary labels.
- Touch events on the chart.

### 7.9 Icons summary

| Element | MDI icon |
|---|---|
| Probe mode `STANDARD`/`OPENING` | `mdi:pool` |
| Probe mode `WINTER`/`ACTIVE_WINTER` | `mdi:snowflake` |
| Probe mode `MAINTENANCE` | `mdi:wrench` |
| Probe mode `INITIALIZATION` | `mdi:cog-sync` |
| Filtration `Standard` | `mdi:white-balance-sunny` |
| Filtration `Active-Winter` | `mdi:sun-snowflake-variant` |
| Filtration `Passive-Winter` | `mdi:snowflake` |
| Pump ON | `mdi:water-pump` |
| Pump OFF | `mdi:water-pump-off` |
| Daily filtration | `mdi:filter-variant` |
| Boost | `mdi:plus-box-multiple` |
| Boost None / Stop | `mdi:timer-off-outline` |
| Action OK | `mdi:emoticon-cool-outline` |
| Action required ON | `mdi:alert-circle` |
| Temperature (chart) | `mdi:thermometer` |
| pH | `mdi:flask-outline` |
| ORP | `mdi:test-tube` |

All rendered via `<ha-icon icon="mdi:xxx">` (native HA component).

---

## 8. Visual editor (GUI editor)

### 8.1 Principle

```typescript
static getConfigElement(): HTMLElement {
  return document.createElement('iopool-card-editor');
}
```

The editor is a second LitElement using HA-native components: `ha-form`, `ha-device-picker`, `ha-entity-picker`, `ha-selector`.

### 8.2 `ha-form` schema-based approach

```typescript
const SCHEMA = [
  {
    name: 'device_id',
    required: true,
    selector: {
      device: {
        // Filter to show only iopool devices
        filter: { integration: 'iopool' },
      },
    },
  },
  {
    name: 'pump_entity',
    selector: { entity: { domain: 'switch' } },
  },
  {
    name: 'show_chart',
    default: true,
    selector: { boolean: {} },
  },
  {
    name: 'chart_period',
    default: 96,
    selector: {
      select: {
        options: [
          { value: 24, label: '24 hours' },
          { value: 48, label: '48 hours' },
          { value: 96, label: '96 hours' },
          { value: 168, label: '7 days' },
        ],
      },
    },
  },
  // Temperature thresholds: 4 individual number fields, see §8.4
  // Section actions: nested expandable selectors, see §8.5
];
```

### 8.3 Editor sections

#### "Configuration"
- **Device** (`ha-device-picker`, filter `integration: iopool`) — required.
- **Pump entity** (`ha-entity-picker`, `domain: switch`) — optional.

#### "Display"
- **Show chart** (boolean, default true).
- **Chart period** (select: 24h / 48h / 96h / 7d, default 96).

#### "Temperature thresholds"
- 4 numeric fields with labels: `Red-low / Yellow-low end`, `Yellow-low / Green start`, `Green / Yellow-high end`, `Yellow-high / Red-high start`.
- Validation: strictly increasing.
- Button "Pool default" → resets to `[15, 20.5, 29, 32]`.
- Button "Spa preset" → suggests `[28, 32, 36, 38]` (to be confirmed by user; the value is editable).

#### "Custom actions" (collapsible)
For each section, a `ui_action` selector with the section's defaults pre-populated:
- temperature, ph, orp, mode, pump, filtration, boost

### 8.4 Validation and error messages

Display errors when:
- No device selected.
- Selected device is not an iopool device (should not happen with the filter, but defensive check).
- Required entities cannot be resolved from the device (the integration is misconfigured).
- Temperature thresholds are not strictly increasing.

### 8.5 `setConfig` on the main card

```typescript
setConfig(config: IopoolCardConfig): void {
  if (!config.device_id) {
    throw new Error('iopool-card: device_id is required');
  }
  if (config.temperature_thresholds) {
    const t = config.temperature_thresholds;
    if (t.length !== 4 || !t.every((v, i) => i === 0 || v > t[i - 1])) {
      throw new Error('iopool-card: temperature_thresholds must be 4 strictly increasing values');
    }
  }
  this._config = { ...DEFAULT_CONFIG, ...config };
}
```

---

## 9. Internationalization

### 9.1 Supported languages (v1)

- French (`fr`)
- English (`en`)

### 9.2 Translation files

`src/locales/en.json`:

```json
{
  "card": {
    "subtitle": "Pool management",
    "default_name": "Pool"
  },
  "header": {
    "all_good": "All good",
    "action_required": "Action required"
  },
  "iopool_mode": {
    "STANDARD": "Standard",
    "OPENING": "Opening",
    "ACTIVE_WINTER": "Active wintering",
    "WINTER": "Passive wintering",
    "INITIALIZATION": "Initialization",
    "MAINTENANCE": "Maintenance"
  },
  "pool_mode": {
    "Standard": "Standard",
    "Active-Winter": "Active wintering",
    "Passive-Winter": "Passive wintering"
  },
  "sections": {
    "mode_filtration": "Filtration mode",
    "pump": "Pool pump",
    "filtration_daily": "Daily filtration",
    "boost": "Boost",
    "temperature_chart": "Temperature"
  },
  "measures": {
    "temperature": "Temperature",
    "ph": "pH",
    "orp": "ORP",
    "target": "Target {value}"
  },
  "status": {
    "too_low": "Too low",
    "low": "Low",
    "ideal": "Ideal",
    "high": "High",
    "too_high": "Too high",
    "unavailable": "Unavail.",
    "stats_min": "Min",
    "stats_avg": "Avg",
    "stats_max": "Max"
  },
  "pump": {
    "on": "On",
    "off": "Off"
  },
  "filtration": {
    "completed": "Done {time} · target {target}",
    "recommendation": "iopool: {time}"
  },
  "boost": {
    "active": "Active · {remaining} left",
    "stop": "Stop"
  },
  "warnings": {
    "maintenance": "Maintenance mode · data may be outdated",
    "initialization": "Initialization in progress · data may be incomplete"
  },
  "chart": {
    "period_24h": "24h",
    "period_48h": "48h",
    "period_96h": "96h",
    "period_7d": "7d",
    "today": "today",
    "yesterday": "yesterday"
  },
  "editor": {
    "device_id": "iopool device",
    "device_id_helper": "Select the iopool pool device",
    "pump_entity": "Pump entity (optional)",
    "show_chart": "Show temperature chart",
    "chart_period": "Chart period",
    "temperature_thresholds": "Temperature thresholds",
    "threshold_t0": "Red-low / Yellow-low end",
    "threshold_t1": "Yellow-low / Green start",
    "threshold_t2": "Green / Yellow-high end",
    "threshold_t3": "Yellow-high / Red-high start",
    "preset_pool": "Pool preset",
    "preset_spa": "Spa preset",
    "section_actions": "Custom actions",
    "tap_action": "Tap action",
    "hold_action": "Hold action",
    "double_tap_action": "Double tap action"
  },
  "errors": {
    "device_required": "Please select a device",
    "device_not_iopool": "The selected device is not an iopool device",
    "entities_missing": "Required iopool entities could not be found for this device",
    "thresholds_order": "Thresholds must be strictly increasing"
  }
}
```

`src/locales/fr.json`: same structure with French strings (`"Pool management"` → `"Gestion de votre bassin"`, etc.).

### 9.3 Translation helper

```typescript
import enLocale from './locales/en.json';
import frLocale from './locales/fr.json';

const LOCALES: Record = { en: enLocale, fr: frLocale };

export class TranslationHelper {
  private _data: any;

  constructor(hass: HomeAssistant) {
    const lang = (hass.locale?.language || hass.language || 'en').split('-')[0];
    this._data = LOCALES[lang] ?? LOCALES.en;
  }

  t(key: string, params?: Record): string {
    const keys = key.split('.');
    let value: any = this._data;
    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) return key;
    }
    if (typeof value !== 'string') return key;
    if (params) {
      return value.replace(/\{(\w+)\}/g, (_, p) => String(params[p] ?? ''));
    }
    return value;
  }
}
```

### 9.4 Commands vs display

**Entity values stay in English** (the integration sends/receives English values). Only display is translated:
- Display: `t('iopool_mode.' + entity.state)`
- Service call: `hass.callService('select', 'select_option', { entity_id, option: 'Active-Winter' })` — English value.

---

## 10. States and error handling

### 10.1 `unavailable` / `unknown` states

```typescript
function isEntityUsable(state: HassEntity | undefined): boolean {
  return state !== undefined &&
         state.state !== 'unavailable' &&
         state.state !== 'unknown' &&
         state.state !== 'None';
}
```

#### Behaviour per case

| Case | Display |
|---|---|
| Single measure (e.g. pH) unavailable | Value "—", liquid at 0%, "Unavail." tag in red, other gauges normal |
| All measures unavailable | Gauge block in "skeleton" mode with "Probe disconnected" message |
| Probe mode entity unavailable | Card-wide degraded mode: header with "—" and "iopool data unavailable" message |
| `pump_entity` unavailable | Pump section shown with "—" state and disabled toggle |
| Filtration binary_sensor unavailable | Daily filtration section hidden |

### 10.2 Configuration errors

`setConfig` throws clear errors that HA displays in the UI:

```typescript
throw new Error('iopool-card: device_id is required');
```

### 10.3 Bootstrap robustness

The card may be instantiated **before** all iopool entities are available (at HA boot). The component MUST:
- Never crash if an entity doesn't exist yet.
- Display skeleton loaders or "—" until data arrives.
- Re-render automatically when `hass` is updated.

---

## 11. Debug mode (YAML-only)

### 11.1 Goal

Provide an opt-in debug mode that produces verbose console output to help diagnose issues — during development AND when users report bugs. **Available only via YAML** (`debug: true`), not exposed in the visual editor.

### 11.2 Configuration

```yaml
type: custom:iopool-card
device_id: ...
debug: true   # Default: false
```

### 11.3 Debug logger

```typescript
// src/helpers/debug.ts
const PREFIX = '[iopool-card]';
const STYLE_INFO  = 'color: #17817A; font-weight: 700;';
const STYLE_WARN  = 'color: #F5A623; font-weight: 700;';
const STYLE_ERROR = 'color: #D0021B; font-weight: 700;';
const STYLE_DEBUG = 'color: #4BCFFA; font-weight: 700;';

export class DebugLogger {
  private _enabled: boolean;

  constructor(enabled: boolean) {
    this._enabled = enabled;
  }

  setEnabled(enabled: boolean) { this._enabled = enabled; }

  debug(group: string, message: string, ...data: unknown[]): void {
    if (!this._enabled) return;
    console.log(`%c${PREFIX} [${group}] ${message}`, STYLE_DEBUG, ...data);
  }

  info(group: string, message: string, ...data: unknown[]): void {
    if (!this._enabled) return;
    console.info(`%c${PREFIX} [${group}] ${message}`, STYLE_INFO, ...data);
  }

  warn(group: string, message: string, ...data: unknown[]): void {
    // Warnings are always shown
    console.warn(`%c${PREFIX} [${group}] ${message}`, STYLE_WARN, ...data);
  }

  error(group: string, message: string, ...data: unknown[]): void {
    // Errors are always shown
    console.error(`%c${PREFIX} [${group}] ${message}`, STYLE_ERROR, ...data);
  }

  group(name: string, fn: () => void): void {
    if (!this._enabled) { fn(); return; }
    console.groupCollapsed(`%c${PREFIX} ${name}`, STYLE_DEBUG);
    try { fn(); } finally { console.groupEnd(); }
  }

  timeStart(label: string): void {
    if (!this._enabled) return;
    console.time(`${PREFIX} ${label}`);
  }

  timeEnd(label: string): void {
    if (!this._enabled) return;
    console.timeEnd(`${PREFIX} ${label}`);
  }
}
```

### 11.4 What to log in debug mode

| Group | Events to log |
|---|---|
| `lifecycle` | `setConfig`, `connectedCallback`, `disconnectedCallback`, `firstUpdated` |
| `config` | Resolved config (after defaults applied), pump_entity present/absent, thresholds |
| `device` | Device resolution, resolved entities map, missing entities |
| `pool-name` | Resolution chain (which strategy returned the name) |
| `hass-update` | hass setter called, which watched entities changed, was a re-render triggered |
| `display` | Computed `DisplayFlags`, which sections will be rendered |
| `gauge` | For each gauge: value, zone, color, fillPct |
| `boost` | Boost state, remaining time, countdown tick (throttled: 1 log every 10s) |
| `history` | Chart history fetch: period, entity, start/end, point count, duration (`timeStart`/`timeEnd`) |
| `action` | User actions: which button was tapped, which service was called |
| `i18n` | Detected language, missing translation keys |
| `theme` | Detected darkMode value |

### 11.5 Integration with the card

```typescript
class IopoolCard extends LitElement {
  private _logger = new DebugLogger(false);

  setConfig(config: IopoolCardConfig): void {
    // ... validation ...
    this._logger.setEnabled(config.debug === true);
    this._logger.info('lifecycle', 'setConfig', config);
  }

  set hass(hass: HomeAssistant) {
    const changed = this._detectChanges(hass);
    if (changed.length > 0) {
      this._logger.debug('hass-update', `${changed.length} watched entities changed`, changed);
      this.requestUpdate();
    }
    this._hass = hass;
  }

  // ... etc.
}
```

### 11.6 Banner in the card

When `debug: true`, display a small "DEBUG" badge in the card header so the user sees the mode is on (avoids forgotten debug mode in production).

---

## 12. Performance and HA best practices

### 12.1 `set hass(hass)` pattern

HA updates cards by reassigning the `hass` property. To avoid re-rendering on every (frequent) update:

```typescript
private _hass!: HomeAssistant;

set hass(hass: HomeAssistant) {
  const oldHass = this._hass;
  this._hass = hass;
  if (!oldHass) { this.requestUpdate(); return; }

  const watched = this._getWatchedEntities();
  for (const entityId of watched) {
    if (oldHass.states[entityId] !== hass.states[entityId]) {
      this._logger.debug('hass-update', `entity changed: ${entityId}`);
      this.requestUpdate();
      return;
    }
  }
  // Also re-render if the watched device changed
  const oldDevice = oldHass.devices?.[this._config.device_id];
  const newDevice = hass.devices?.[this._config.device_id];
  if (oldDevice !== newDevice) {
    this.requestUpdate();
  }
}

get hass(): HomeAssistant { return this._hass; }

private _getWatchedEntities(): string[] {
  return [
    ...Object.values(this._resolvedEntities),
    ...(this._config.pump_entity ? [this._config.pump_entity] : []),
  ];
}
```

### 12.2 `getCardSize`

```typescript
getCardSize(): number {
  let size = 1; // header
  const flags = this._lastDisplayFlags;
  if (!flags) return 8;
  if (flags.showGauges) size += 3;
  size += 1; // mode
  if (flags.showPump) size += 1;
  if (flags.showFiltration) size += 1;
  if (flags.showBoost) size += 1;
  if (flags.showChart) size += 3;
  return size;
}
```

### 12.3 `getStubConfig`

```typescript
static getStubConfig(hass: HomeAssistant): IopoolCardConfig {
  // Auto-detect an iopool device
  const devices = Object.values(hass.devices || {}) as DeviceRegistryEntry[];
  const iopoolDevice = devices.find(d =>
    d.identifiers?.some((id: [string, string]) => id[0] === 'iopool')
  );
  return {
    type: 'custom:iopool-card',
    device_id: iopoolDevice?.id ?? '',
  };
}
```

### 12.4 Conditional animations

- `requestAnimationFrame` for waves — automatically paused when the tab is in background.
- No animations if `prefers-reduced-motion: reduce`.
- All `setInterval`, `requestAnimationFrame`, listeners cleaned up in `disconnectedCallback`.
- Pending fetches aborted via `AbortController` on unmount.

### 12.5 No errors / warnings in console

In production mode (`debug: false`), the card must produce zero errors or warnings during normal use.

### 12.6 No memory leaks

- All timers and animation frames cancelled in `disconnectedCallback`.
- Event listeners removed.
- AbortController triggered on pending fetches.

---

## 13. Documentation site

### 13.1 Approach

Documentation follows the same approach as `hass-iopool`: a `docs.page` site driven by `docs.json` and Markdown files in `docs/`.

References:
- https://github.com/mguyard/hass-iopool/blob/main/docs.json
- https://github.com/mguyard/hass-iopool/tree/main/docs

### 13.2 Suggested `docs.json` for `hass-iopool-card`

```json
{
  "name": "hass-iopool-card",
  "description": "Official Lovelace card for the iopool integration",
  "favicon": "/assets/favicon.png",
  "logo": {
    "light": "/assets/logo-light.svg",
    "dark": "/assets/logo-dark.svg"
  },
  "theme": "teal",
  "anchors": [
    {
      "title": "GitHub",
      "icon": "github",
      "link": "https://github.com/mguyard/hass-iopool-card"
    },
    {
      "title": "Integration",
      "icon": "puzzle-piece",
      "link": "https://github.com/mguyard/hass-iopool"
    }
  ],
  "sidebar": [
    {
      "group": "Getting started",
      "pages": [
        "introduction",
        "installation",
        "first-card"
      ]
    },
    {
      "group": "Configuration",
      "pages": [
        "configuration/overview",
        "configuration/device",
        "configuration/pump",
        "configuration/thresholds",
        "configuration/chart",
        "configuration/actions"
      ]
    },
    {
      "group": "Visual modes",
      "pages": [
        "modes/standard",
        "modes/active-winter",
        "modes/passive-winter",
        "modes/maintenance"
      ]
    },
    {
      "group": "Troubleshooting",
      "pages": [
        "troubleshooting/debug-mode",
        "troubleshooting/common-issues"
      ]
    }
  ]
}
```

### 13.3 Page list and content

#### `docs/introduction.mdx`
- What is `hass-iopool-card`.
- Screenshots: light mode, dark mode (placeholders for now).
- Compatibility (HA >= 2026.5).

#### `docs/installation.mdx`
- "The card is installed automatically with the `hass-iopool` integration. No additional install required."
- Cache clearing in case of trouble (Ctrl+F5 or Settings > Apps > Application).
- HA version check.

#### `docs/first-card.mdx`
- Step-by-step: open dashboard, edit, add card, find "iopool Card" in the picker.
- Device selection screenshot (placeholder).
- Confirm and save.

#### `docs/configuration/overview.mdx`
- All available options table.
- Minimal vs full YAML example.

#### `docs/configuration/device.mdx`
- How to select the device.
- Device renaming reflected on card (no card edit needed).

#### `docs/configuration/pump.mdx`
- Selecting a pump switch entity.
- Visual on/off display.
- Default tap action.

#### `docs/configuration/thresholds.mdx`
- Pool defaults.
- How to customize for a spa (with the recommended `[28, 32, 36, 38]` preset).
- Note about pH/ORP being fixed.
- Spa screenshot (placeholder).

#### `docs/configuration/chart.mdx`
- Periods available, default 96h.
- Hover behavior.
- Live updates.

#### `docs/configuration/actions.mdx`
- Per-section `tap_action` / `hold_action` / `double_tap_action`.
- Examples: more-info, toggle, call-service.
- YAML examples.

#### `docs/modes/*.mdx`
- For each iopool probe mode: what's shown, what's hidden, why.
- Screenshot per mode (placeholder).

#### `docs/troubleshooting/debug-mode.mdx`
- How to enable: `debug: true` in YAML.
- What gets logged.
- Screenshot of console output (placeholder).
- How to share logs in a GitHub issue.

#### `docs/troubleshooting/common-issues.mdx`
- "Card not appearing in picker" → cache, HA version.
- "Title shows 'iopool'" → name_by_user not set on device.
- "Pump section not showing" → `pump_entity` not configured.
- "Chart empty" → `show_chart` disabled, or temperature sensor unavailable.

### 13.4 Placeholder convention

All screenshots use placeholders in `docs/assets/screenshots/`:
- `placeholder-card-standard-light.png`
- `placeholder-card-standard-dark.png`
- `placeholder-card-active-winter.png`
- `placeholder-card-passive-winter.png`
- `placeholder-card-maintenance.png`
- `placeholder-editor-device-picker.png`
- `placeholder-editor-thresholds.png`
- `placeholder-debug-console.png`
- etc.

Each placeholder is a simple labeled image (e.g. 800×600 with "PLACEHOLDER: card-standard-light"). The user (Marc) will replace them with real screenshots before public release.

The docs build (e.g. CI on docs branch) must succeed even with placeholders.

---

## 14. Tests and validation criteria

### 14.1 Mandatory manual tests

#### Configurations
- [ ] With `pump_entity` configured
- [ ] Without `pump_entity` configured
- [ ] `show_chart: true` and `show_chart: false`
- [ ] Custom temperature thresholds (spa: `[28, 32, 36, 38]`)
- [ ] `debug: true` produces verbose console output and the DEBUG badge

#### Probe modes
- [ ] `STANDARD` + pool_mode `Standard` → all sections visible
- [ ] `STANDARD` + pool_mode `Active-Winter` → boost hidden
- [ ] `ACTIVE_WINTER` → gauges, chart, boost, action_required hidden
- [ ] `WINTER` (passive) → only mode + filtration mode visible
- [ ] `MAINTENANCE` → everything visible but grayed + banner
- [ ] `INITIALIZATION` → everything visible but grayed + banner

#### States
- [ ] pH in red-low (e.g. 6.4) → red low liquid, "Too low" tag, action_required badge
- [ ] Temperature in high-orange → high orange liquid, "High" tag
- [ ] Boost active 2h → button active, countdown visible, "Active · Xh Ymin left" info
- [ ] Pump off → red card, `mdi:water-pump-off` icon
- [ ] pH entity `unavailable` → "—" value, "Unavail." tag

#### Themes
- [ ] HA default light theme
- [ ] HA default dark theme
- [ ] User custom theme (verify CSS variable inheritance)

#### Reactivity
- [ ] Rename the device in `Settings > Devices` → card title updates immediately
- [ ] Change mode via external script → card reflects change
- [ ] Update thresholds in editor → live preview

#### Mobile
- [ ] iOS Safari (iPhone) rendering
- [ ] Android Chrome rendering
- [ ] Touch on chart → tooltip shown
- [ ] No horizontal scroll at 380px width

#### Performance
- [ ] Dashboard with 5 iopool-card instances → no slowdown
- [ ] Zero console errors/warnings in normal use
- [ ] Final bundle < 100 KB minified

### 14.2 Automated tests (recommended)

- Vitest unit tests for helpers (`extractSlug`, `valueToZone`, `valueToFillPct`, `formatDuration`, `resolvePoolName`, `getBoostRemaining`).
- LitElement integration tests with `@open-wc/testing` for the main rendering paths.

---

## 15. Distribution and release

### 15.1 Versioning and version injection

Semantic Versioning (`MAJOR.MINOR.PATCH`), driven by semantic-release (conventional commits).

The version is exposed in the bundle via a constant in `src/const.ts`:

```typescript
// src/const.ts
export const CARD_VERSION = "0.0.0-dev";  // Replaced at release time by semantic-release-replace-plugin
```

And displayed in the console at card load:

```typescript
// In iopool-card.ts entry point
import { CARD_VERSION } from './const';

console.info(
  `%c iopool-card %c v${CARD_VERSION} `,
  'color: white; background: #17817A; font-weight: 700; padding: 2px 6px; border-radius: 3px 0 0 3px;',
  'color: #17817A; background: white; font-weight: 700; padding: 2px 6px; border-radius: 0 3px 3px 0; border: 1px solid #17817A;',
);
```

`semantic-release-replace-plugin` updates the constant at release time (see `.releaserc` in §3.4.2), so each release ships with the correct version baked in.

### 15.2 GitHub Actions — build (on PR)

`.github/workflows/build.yml`:
- Setup Node.js 22
- `npm ci`
- `npm run lint`
- `npm run build`
- Upload artifact

### 15.3 GitHub Actions — release

See §3.4.1 — the workflow handles semantic-release AND opens a PR to `hass-iopool`.

### 15.4 README of the `hass-iopool-card` repo

At minimum:
- Description
- Link to `hass-iopool`
- Screenshots (light + dark, different states) — placeholders initially
- Installation: "This card is installed automatically with the `hass-iopool` integration. No manual installation required."
- "Development" section for contributors
- License (same as integration: ISC or MIT — to be confirmed by Marc)

---

## 16. Roadmap v2

To be planned but NOT implemented in v1:

### 16.1 Heat pump (PaC) support

- Optional display of heat pump state (`switch` + `climate` + `sensor.pool_heatpump_state` + `sensor.pool_heatpump_alarm`).
- Dedicated section with icons `mdi:radiator` / `mdi:radiator-off`.
- States: ON / OFF / Heating / Alarm.
- On/off toggle.

### 16.2 pH and ORP threshold customization

If users request it.

### 16.3 Advanced chart via ApexCharts

If strong demand, integrate as an option (with optional dependency on `apexcharts-card`).

### 16.4 More languages

ES, DE, IT, NL.

### 16.5 Items explicitly NOT planned

- Multi-pool in a single card instance (one card = one pool, always).
- Standalone HACS publication of the card (the card is by design tied to the integration).

---

## 17. Appendices

### 17.1 iopool probe mode values

Values of `sensor.iopool_{slug}_iopool_mode`:

| Value | Meaning |
|---|---|
| `STANDARD` | Normal mode, probe in water |
| `OPENING` | Season opening |
| `ACTIVE_WINTER` | Active wintering (probe out, filtration may run) |
| `WINTER` | Passive wintering (probe out, no filtration) |
| `INITIALIZATION` | Probe initialization |
| `MAINTENANCE` | Maintenance (data may be outdated) |

### 17.2 `pool_mode` select options

| Value | Meaning |
|---|---|
| `Standard` | Auto filtration based on temperature |
| `Active-Winter` | Filtration in active wintering |
| `Passive-Winter` | No filtration (probe out, pool covered) |

### 17.3 `boost_selector` options

| Value | Duration |
|---|---|
| `None` | No boost (default state) |
| `1H` | 1 hour |
| `2H` | 2 hours |
| `4H` | 4 hours |
| `8H` | 8 hours |
| `24H` | 24 hours |

### 17.4 Example YAML configurations

#### Minimal
```yaml
type: custom:iopool-card
device_id: 0a1b2c3d4e5f6a7b8c9d0e1f
```

#### Full (pool)
```yaml
type: custom:iopool-card
device_id: 0a1b2c3d4e5f6a7b8c9d0e1f
pump_entity: switch.pool_switch
show_chart: true
chart_period: 96
temperature_thresholds: [15, 20.5, 29, 32]
```

#### Spa
```yaml
type: custom:iopool-card
device_id: 1f2e3d4c5b6a7b8c9d0e1f2a
pump_entity: switch.spa_pump
show_chart: true
chart_period: 24
temperature_thresholds: [28, 32, 36, 38]
section_actions:
  temperature:
    tap_action: { action: more-info }
```

#### Debug
```yaml
type: custom:iopool-card
device_id: 0a1b2c3d4e5f6a7b8c9d0e1f
debug: true
```

### 17.5 Visual mockup reference

The interactive HTML mockup `iopool-card-liquid-v5.html` defines:
- Exact geometry of elements
- Wave animation parameters (`requestAnimationFrame` settings)
- Chart hover behaviour
- Transitions between states (mode, state)

The TypeScript implementation must faithfully reproduce this mockup, **using native HA components** (`ha-icon`, `ha-form`, `ha-device-picker`, etc.) for interactive elements.

### 17.6 Useful links

- Integration: https://github.com/mguyard/hass-iopool
- Entities docs: https://docs.page/mguyard/hass-iopool/integration/entities
- `entity.py` reference: https://github.com/mguyard/hass-iopool/blob/main/custom_components/iopool/entity.py
- Embedded card reference: https://github.com/greghesp/ha-bambulab + https://github.com/greghesp/ha-bambulab-cards
- Lit (LitElement) 3.x: https://lit.dev/
- HA Custom Cards: https://developers.home-assistant.io/docs/frontend/custom-ui/custom-card/
- MDI icons: https://pictogrammers.com/library/mdi/
- semantic-release: https://semantic-release.gitbook.io/
- Reference workflow (hass-iopool): https://raw.githubusercontent.com/mguyard/hass-iopool/refs/heads/main/.github/workflows/release.yaml

---

**End of specification — v2.0**