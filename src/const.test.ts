import { describe, it, expect } from 'vitest';
import {
  CARD_VERSION,
  CARD_TYPE,
  CARD_NAME,
  DEFAULT_POOL_THRESHOLDS,
  DEFAULT_SPA_THRESHOLDS,
  PH_THRESHOLDS,
  ORP_THRESHOLDS,
  DEFAULT_CHART_PERIOD,
  ENTITY_MAP,
  BOOST_OPTIONS,
  CHART_PERIODS,
  BRAND_COLORS,
} from './const';

describe('CARD metadata', () => {
  it('CARD_TYPE is the correct custom element type', () => {
    expect(CARD_TYPE).toBe('iopool-card');
  });

  it('CARD_NAME has a human-readable value', () => {
    expect(CARD_NAME).toBe('iopool Card');
  });

  it('CARD_VERSION is a non-empty string', () => {
    // At test time the placeholder is not replaced — just verify it is a string
    expect(typeof CARD_VERSION).toBe('string');
    expect(CARD_VERSION.length).toBeGreaterThan(0);
  });
});

describe('DEFAULT_POOL_THRESHOLDS', () => {
  it('has exactly 4 values', () => {
    expect(DEFAULT_POOL_THRESHOLDS).toHaveLength(4);
  });

  it('is strictly increasing', () => {
    expect(DEFAULT_POOL_THRESHOLDS[0]).toBeLessThan(DEFAULT_POOL_THRESHOLDS[1]);
    expect(DEFAULT_POOL_THRESHOLDS[1]).toBeLessThan(DEFAULT_POOL_THRESHOLDS[2]);
    expect(DEFAULT_POOL_THRESHOLDS[2]).toBeLessThan(DEFAULT_POOL_THRESHOLDS[3]);
  });

  it('matches documented pool values [15, 20.5, 29, 32]', () => {
    expect(DEFAULT_POOL_THRESHOLDS).toEqual([15, 20.5, 29, 32]);
  });
});

describe('DEFAULT_SPA_THRESHOLDS', () => {
  it('has exactly 4 values and is strictly increasing', () => {
    expect(DEFAULT_SPA_THRESHOLDS).toHaveLength(4);
    expect(DEFAULT_SPA_THRESHOLDS[0]).toBeLessThan(DEFAULT_SPA_THRESHOLDS[1]);
    expect(DEFAULT_SPA_THRESHOLDS[1]).toBeLessThan(DEFAULT_SPA_THRESHOLDS[2]);
    expect(DEFAULT_SPA_THRESHOLDS[2]).toBeLessThan(DEFAULT_SPA_THRESHOLDS[3]);
  });

  it('has higher values than pool thresholds', () => {
    expect(DEFAULT_SPA_THRESHOLDS[0]).toBeGreaterThan(DEFAULT_POOL_THRESHOLDS[0]);
  });
});

describe('PH_THRESHOLDS', () => {
  it('is [6.8, 7.1, 7.7, 8.1]', () => {
    expect(PH_THRESHOLDS).toEqual([6.8, 7.1, 7.7, 8.1]);
  });

  it('is strictly increasing', () => {
    expect(PH_THRESHOLDS[0]).toBeLessThan(PH_THRESHOLDS[1]);
    expect(PH_THRESHOLDS[1]).toBeLessThan(PH_THRESHOLDS[2]);
    expect(PH_THRESHOLDS[2]).toBeLessThan(PH_THRESHOLDS[3]);
  });
});

describe('ORP_THRESHOLDS', () => {
  it('is [550, 650, 800, 1000]', () => {
    expect(ORP_THRESHOLDS).toEqual([550, 650, 800, 1000]);
  });

  it('is strictly increasing', () => {
    expect(ORP_THRESHOLDS[0]).toBeLessThan(ORP_THRESHOLDS[1]);
    expect(ORP_THRESHOLDS[1]).toBeLessThan(ORP_THRESHOLDS[2]);
    expect(ORP_THRESHOLDS[2]).toBeLessThan(ORP_THRESHOLDS[3]);
  });
});

describe('DEFAULT_CHART_PERIOD', () => {
  it('is 24 hours', () => {
    expect(DEFAULT_CHART_PERIOD).toBe(24);
  });
});

describe('ENTITY_MAP', () => {
  it('contains all required entity keys', () => {
    const expectedKeys = [
      'mode',
      'poolMode',
      'boostSelector',
      'actionRequired',
      'filtration',
      'elapsedFiltration',
      'filtrationRecommendation',
      'temperature',
      'ph',
      'orp',
    ];
    for (const key of expectedKeys) {
      expect(ENTITY_MAP).toHaveProperty(key);
    }
  });

  it('each entry has a platform string and a suffixRegex', () => {
    for (const [key, entry] of Object.entries(ENTITY_MAP)) {
      expect(typeof entry.platform, `${key}.platform`).toBe('string');
      expect(entry.suffixRegex, `${key}.suffixRegex`).toBeInstanceOf(RegExp);
    }
  });

  it('mode uses sensor platform with _iopool_mode$ suffix', () => {
    expect(ENTITY_MAP.mode.platform).toBe('sensor');
    expect(ENTITY_MAP.mode.suffixRegex.test('sensor.iopool_mypool_iopool_mode')).toBe(true);
    expect(ENTITY_MAP.mode.suffixRegex.test('sensor.iopool_mypool_temperature')).toBe(false);
  });

  it('poolMode uses select platform with _pool_mode$ suffix', () => {
    expect(ENTITY_MAP.poolMode.platform).toBe('select');
    expect(ENTITY_MAP.poolMode.suffixRegex.test('select.iopool_mypool_pool_mode')).toBe(true);
  });

  it('actionRequired uses binary_sensor platform', () => {
    expect(ENTITY_MAP.actionRequired.platform).toBe('binary_sensor');
    expect(
      ENTITY_MAP.actionRequired.suffixRegex.test('binary_sensor.iopool_mypool_action_required'),
    ).toBe(true);
  });

  it('temperature regex does not match other sensor suffixes', () => {
    expect(ENTITY_MAP.temperature.suffixRegex.test('sensor.iopool_mypool_temperature')).toBe(true);
    expect(ENTITY_MAP.temperature.suffixRegex.test('sensor.iopool_mypool_ph')).toBe(false);
    expect(
      ENTITY_MAP.temperature.suffixRegex.test('sensor.iopool_mypool_elapsed_filtration_duration'),
    ).toBe(false);
  });
});

describe('BOOST_OPTIONS', () => {
  it('contains expected boost duration values', () => {
    expect(BOOST_OPTIONS).toContain('None');
    expect(BOOST_OPTIONS).toContain('1H');
    expect(BOOST_OPTIONS).toContain('24H');
    expect(BOOST_OPTIONS).toHaveLength(6);
  });
});

describe('CHART_PERIODS', () => {
  it('contains [24, 48, 96, 168]', () => {
    expect(CHART_PERIODS).toEqual([24, 48, 96, 168]);
  });
});

describe('BRAND_COLORS', () => {
  it('primary color is iopool teal', () => {
    expect(BRAND_COLORS.primary).toBe('#17817A');
  });

  it('all color values are valid hex strings', () => {
    for (const [name, color] of Object.entries(BRAND_COLORS)) {
      expect(color, `${name} should be a hex color`).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
