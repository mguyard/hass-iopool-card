---
name: testing-iopool-card
description: Project-specific test setup for hass-iopool-card — directory structure, test tiers, devcontainer detection, running Vitest, and shared patterns.
user-invocable: false
---

# Testing — hass-iopool-card Project Setup

Use this skill for any task that requires running, writing, or understanding tests in the `src/` codebase.

For generic testing principles (behavior-based, determinism, unit vs integration strategy), see `../testing-qa/SKILL.md`.

---

## 1. Directory Structure

Tests live alongside source files:

```
src/
├── helpers/
│   ├── format.ts
│   ├── format.test.ts         # Unit tests — pure helper, no HA dependency
│   ├── zone.ts
│   ├── zone.test.ts           # Unit tests — pure helper, no HA dependency
│   ├── slug.ts
│   ├── slug.test.ts
│   ├── pool-name.ts
│   ├── pool-name.test.ts
│   ├── thresholds.ts
│   └── thresholds.test.ts
├── components/
│   ├── liquid-gauge.ts
│   ├── liquid-gauge.test.ts   # Integration tests — LitElement + @open-wc/testing
│   ├── mode-selector.ts
│   ├── mode-selector.test.ts
│   └── ...
├── iopool-card.ts
└── iopool-card.test.ts        # Card-level integration tests
```

---

## 2. Test Tiers

| Tier | Scope | HA dependency | Run where |
|------|-------|--------------|-----------|
| Tier 1 | Pure helpers (`format`, `zone`, `slug`, `pool-name`, `thresholds`) | None | Anywhere with Node.js 22 |
| Tier 2 | LitElement components with mock `hass` (`@open-wc/testing`) | No (mock object) | Anywhere with Node.js 22 |
| Tier 3 | Manual E2E requiring a real running HA instance | Yes | HA devcontainer only |

**Tier 1 and Tier 2** are fully automated (Vitest) and run in CI without any devcontainer.

**Tier 3** is manual verification only — see SPECIFICATIONS.md §14.1.

---

## 3. Running Tests

### Step 1 — Detect environment

```bash
test -d /workspaces && echo "inside devcontainer" || echo "outside devcontainer"
```

### Step 2a — Tier 1 and Tier 2 (Vitest — any environment)

```bash
# Run all tests once (CI mode)
npm test

# Watch mode for development
npm run test:watch

# With coverage report
npm run test:coverage
```

### Step 2b — Inside devcontainer (Tier 3 — manual E2E with HA)

Tier 3 tests require a running HA instance accessible in the devcontainer. These are **manual only** — not automated by Vitest.

Access HA at the configured URL inside the devcontainer and follow SPECIFICATIONS.md §14.1 for the manual test checklist.

### Step 3 — Parse output

After Vitest runs, capture the summary line:

```
✓ 42 tests passed (3.2s)
```

Or with failures:

```
✗ 1 failed, 41 passed (3.1s)
```

Use this output to fill the `Tests:` line in the commit body.

---

## 4. Writing Tests

### Tier 1 — Pure helper unit test

```typescript
// src/helpers/zone.test.ts
import { describe, it, expect } from 'vitest';
import { valueToZone, valueToFillPct } from './zone';

describe('valueToZone', () => {
  it('returns red-low below minimum threshold', () => {
    expect(valueToZone(6.0, [6.5, 7.0, 7.8, 8.2])).toBe('red-low');
  });

  it('returns green in the nominal range', () => {
    expect(valueToZone(7.2, [6.5, 7.0, 7.8, 8.2])).toBe('green');
  });

  it('returns red-high above maximum threshold', () => {
    expect(valueToZone(8.5, [6.5, 7.0, 7.8, 8.2])).toBe('red-high');
  });
});
```

### Tier 2 — LitElement integration test with mock hass

```typescript
// src/components/liquid-gauge.test.ts
import { fixture, expect } from '@open-wc/testing';
import { html } from 'lit';
import './liquid-gauge';

describe('LiquidGauge', () => {
  it('renders without errors', async () => {
    const el = await fixture(
      html`<liquid-gauge .value=${7.2} .thresholds=${[6.5, 7.0, 7.8, 8.2]}></liquid-gauge>`
    );
    expect(el.shadowRoot).to.exist;
  });

  it('reflects correct fill zone class', async () => {
    const el = await fixture(
      html`<liquid-gauge .value=${6.0} .thresholds=${[6.5, 7.0, 7.8, 8.2]}></liquid-gauge>`
    );
    // Implementation-specific assertion
    expect(el).to.exist;
  });
});
```

### Mock hass object

```typescript
// src/tests/mocks.ts — shared mock for all Tier 2 tests
import { vi } from 'vitest';

export const mockHass = {
  states: {},
  entities: {},
  devices: {},
  language: 'en',
  config: { unit_system: { temperature: '°C' } },
  callService: vi.fn(),
  callApi: vi.fn(),
  themes: { darkMode: false },
};
```

---

## 5. Test Requirements Per Change

| Changed file | Tests required |
|---|---|
| `src/helpers/*.ts` | `src/helpers/*.test.ts` — Tier 1 |
| `src/components/*.ts` | `src/components/*.test.ts` — Tier 2 |
| `src/iopool-card.ts` | `src/iopool-card.test.ts` — Tier 2 |
| `src/iopool-card-editor.ts` | `src/iopool-card-editor.test.ts` — Tier 2 |
| `src/const.ts`, `src/types.ts` | Update all affected tests |

**After every `src/**/*.ts` change**, analyse the corresponding test file and CREATE, UPDATE, or DELETE tests as needed. Never skip this step.

---

## 6. Vitest Configuration Reference

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
    },
  },
});
```

---

## 7. CI Integration

Tests run automatically via `.github/workflows/build.yml` on every PR:

```yaml
- name: Test
  run: npm test
```

The gate **must pass at 100%** before any PR can be merged. Fix all failures before opening a PR.
