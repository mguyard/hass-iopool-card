---
last_updated: 2026-03-10
purpose: "Durable project decisions and invariants. Template file for downstream projects."
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

