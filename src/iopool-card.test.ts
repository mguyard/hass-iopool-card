import { describe, it, expect, vi } from 'vitest';
import type {
  HomeAssistant,
  IopoolCardConfig,
  ResolvedEntities,
  DisplayFlags,
  HassEntity,
} from './types';

// Mock ApexCharts — jsdom lacks SVG browser APIs (ResizeObserver, getTotalLength, etc.).
// Without this mock, iopool-temperature-chart rendered inside iopool-card would throw
// unhandled rejections when the real ApexCharts tries to call new ResizeObserver().
vi.mock('apexcharts', () => {
  const MockApexCharts = vi.fn().mockImplementation(() => ({
    render: vi.fn().mockResolvedValue(undefined),
    updateSeries: vi.fn().mockResolvedValue(undefined),
    updateOptions: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
  }));
  return { default: MockApexCharts };
});

// Import triggers custom element registration and window.customCards population.
import { IopoolCard } from './iopool-card';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildMockHass(overrides: Partial<HomeAssistant> = {}): HomeAssistant {
  return {
    language: 'en',
    states: {},
    entities: {},
    devices: {},
    callService: vi.fn().mockResolvedValue(undefined),
    callApi: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

const VALID_CONFIG: IopoolCardConfig = {
  type: 'custom:iopool-card',
  device_id: 'device-abc123',
};

// ---------------------------------------------------------------------------
// setConfig — validation
// ---------------------------------------------------------------------------

describe('IopoolCard.setConfig — validation', () => {
  it('throws when device_id is empty', () => {
    const card = new IopoolCard();
    expect(() => card.setConfig({ type: 'custom:iopool-card', device_id: '' })).toThrow(
      'device_id is required',
    );
  });

  it('throws when chart_period is not one of the allowed values', () => {
    const card = new IopoolCard();
    expect(() =>
      card.setConfig({
        ...VALID_CONFIG,
        // Intentionally invalid value — cast via unknown to bypass TS type check in test.
        chart_period: 72 as unknown as 24 | 48 | 96 | 168,
      }),
    ).toThrow('chart_period');
  });

  it('throws when temperature_thresholds are not strictly ascending', () => {
    const card = new IopoolCard();
    expect(() =>
      card.setConfig({
        ...VALID_CONFIG,
        temperature_thresholds: [20, 15, 29, 32],
      }),
    ).toThrow('temperature_thresholds');
  });

  it('throws when temperature_thresholds have equal adjacent values', () => {
    const card = new IopoolCard();
    expect(() =>
      card.setConfig({
        ...VALID_CONFIG,
        temperature_thresholds: [15, 15, 29, 32],
      }),
    ).toThrow('temperature_thresholds');
  });

  it('throws when pump_entity does not start with switch.', () => {
    const card = new IopoolCard();
    expect(() =>
      card.setConfig({
        ...VALID_CONFIG,
        pump_entity: 'light.my_pump',
      }),
    ).toThrow('pump_entity must be a switch entity');
  });

  it('does not throw for a valid config with all optional fields', () => {
    const card = new IopoolCard();
    expect(() =>
      card.setConfig({
        ...VALID_CONFIG,
        pump_entity: 'switch.pool_pump',
        show_chart: false,
        chart_period: 48,
        temperature_thresholds: [15, 20, 28, 32],
        debug: true,
      }),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// setConfig — defaults
// ---------------------------------------------------------------------------

describe('IopoolCard.setConfig — defaults', () => {
  // Helper to read private _config via type assertion (test-only access).
  function getConfig(card: IopoolCard): IopoolCardConfig {
    return (card as unknown as { _config: IopoolCardConfig })._config;
  }

  it('sets show_chart to true when not provided', () => {
    const card = new IopoolCard();
    card.setConfig(VALID_CONFIG);
    expect(getConfig(card).show_chart).toBe(true);
  });

  it('sets chart_period to 24 when not provided', () => {
    const card = new IopoolCard();
    card.setConfig(VALID_CONFIG);
    expect(getConfig(card).chart_period).toBe(24);
  });

  it('sets debug to false when not provided', () => {
    const card = new IopoolCard();
    card.setConfig(VALID_CONFIG);
    expect(getConfig(card).debug).toBe(false);
  });

  it('preserves user-supplied values over defaults', () => {
    const card = new IopoolCard();
    card.setConfig({
      ...VALID_CONFIG,
      show_chart: false,
      chart_period: 24,
      debug: true,
    });
    const cfg = getConfig(card);
    expect(cfg.show_chart).toBe(false);
    expect(cfg.chart_period).toBe(24);
    expect(cfg.debug).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Entity resolution
// ---------------------------------------------------------------------------

describe('IopoolCard — entity resolution', () => {
  it('resolves entities when hass is set after setConfig', () => {
    const card = new IopoolCard();
    card.setConfig(VALID_CONFIG);

    const mockHass = buildMockHass({
      entities: {
        'sensor.iopool_mypool_temperature': {
          entity_id: 'sensor.iopool_mypool_temperature',
          device_id: 'device-abc123',
          platform: 'iopool',
          unique_id: 'iopool_mypool_temperature',
        },
      },
    });

    card.hass = mockHass;

    const entities = (card as unknown as { _entities: unknown })._entities;
    expect(entities).toBeDefined();
  });

  it('resolves entities exactly once when hass is set twice with the same device_id', () => {
    const card = new IopoolCard();
    card.setConfig(VALID_CONFIG);

    // Spy BEFORE the first hass assignment so we can count all calls.
    const spy = vi.spyOn(card as unknown as { _resolveEntities: () => void }, '_resolveEntities');

    const mockHass = buildMockHass();
    card.hass = mockHass; // First assignment → resolves entities (device_id changed)

    // Update hass reference with same device_id — must NOT re-resolve.
    card.hass = { ...mockHass };

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('re-resolves entities when device_id changes in setConfig', () => {
    const card = new IopoolCard();
    card.setConfig(VALID_CONFIG);

    const mockHass = buildMockHass();
    card.hass = mockHass; // First resolution

    const spy = vi.spyOn(card as unknown as { _resolveEntities: () => void }, '_resolveEntities');

    // Change device_id — should trigger re-resolution because hass is already set.
    card.setConfig({ ...VALID_CONFIG, device_id: 'device-new-999' });
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// getCardSize
// ---------------------------------------------------------------------------

describe('IopoolCard.getCardSize', () => {
  it('returns 8', () => {
    const card = new IopoolCard();
    expect(card.getCardSize()).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// getStubConfig
// ---------------------------------------------------------------------------

describe('IopoolCard.getStubConfig', () => {
  it('returns an object with type custom:iopool-card', () => {
    const mockHass = buildMockHass();
    const cfg = IopoolCard.getStubConfig(mockHass);
    expect(cfg.type).toBe('custom:iopool-card');
  });

  it('returns empty device_id when no iopool device is found', () => {
    const mockHass = buildMockHass();
    const cfg = IopoolCard.getStubConfig(mockHass);
    expect(cfg.device_id).toBe('');
  });

  it('returns the first iopool device_id when found', () => {
    const mockHass = buildMockHass({
      devices: {
        'device-xyz': {
          id: 'device-xyz',
          name: 'My Pool',
          name_by_user: null,
          identifiers: [['iopool', 'pool-api-id']],
          manufacturer: 'iopool',
          model: 'EcO',
        },
      },
    });
    const cfg = IopoolCard.getStubConfig(mockHass);
    expect(cfg.device_id).toBe('device-xyz');
  });
});

// ---------------------------------------------------------------------------
// window.customCards registration
// ---------------------------------------------------------------------------

describe('window.customCards', () => {
  it('is defined after module import', () => {
    expect(window.customCards).toBeDefined();
  });

  it('contains an entry with type iopool-card', () => {
    const entry = window.customCards?.find((c) => c.type === 'iopool-card');
    expect(entry).toBeDefined();
  });

  it('registers the correct name', () => {
    const entry = window.customCards?.find((c) => c.type === 'iopool-card');
    expect(entry?.name).toBe('iopool Card');
  });

  it('marks preview as true', () => {
    const entry = window.customCards?.find((c) => c.type === 'iopool-card');
    expect(entry?.preview).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// render
// ---------------------------------------------------------------------------

describe('IopoolCard.render', () => {
  it('does not throw when config is not set', () => {
    const card = new IopoolCard();
    // render is protected — access via type assertion for testing purposes only.
    expect(() => (card as unknown as { render: () => unknown }).render()).not.toThrow();
  });

  it('_config is undefined on a fresh instance', () => {
    const card = new IopoolCard();
    const config = (card as unknown as { _config: unknown })._config;
    expect(config).toBeUndefined();
  });

  it('does not throw when config and hass are both set', () => {
    const card = new IopoolCard();
    card.setConfig(VALID_CONFIG);
    card.hass = buildMockHass();
    expect(() => (card as unknown as { render: () => unknown }).render()).not.toThrow();
  });

  it('does not throw when mode is MAINTENANCE', () => {
    const card = new IopoolCard();
    card.setConfig(VALID_CONFIG);
    const modeEntityId = 'sensor.iopool_test_iopool_mode';
    const hass = buildMockHass({
      states: {
        [modeEntityId]: {
          entity_id: modeEntityId,
          state: 'MAINTENANCE',
          attributes: {},
          last_changed: '',
          last_updated: '',
        },
      },
    });
    // Inject resolved entities directly so _displayFlags reads the mode entity.
    (card as unknown as Record<string, unknown>)._entities = {
      mode: modeEntityId,
    } satisfies ResolvedEntities;
    card.hass = hass;
    expect(() => (card as unknown as { render: () => unknown }).render()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// _displayFlags getter
// ---------------------------------------------------------------------------

// Helpers for direct private-field access (test-only pattern).
function getFlags(card: IopoolCard): DisplayFlags {
  return (card as unknown as { _displayFlags: DisplayFlags })._displayFlags;
}

function setPrivateEntities(card: IopoolCard, entities: ResolvedEntities): void {
  (card as unknown as Record<string, unknown>)._entities = entities;
}

function setPrivateHass(card: IopoolCard, hass: HomeAssistant): void {
  (card as unknown as Record<string, unknown>)._hass = hass;
}

function makeHassState(
  entityId: string,
  state: string,
  attributes: Record<string, unknown> = {},
): HassEntity {
  return { entity_id: entityId, state, attributes, last_changed: '', last_updated: '' };
}

describe('IopoolCard._displayFlags', () => {
  it('returns all-false flags when neither hass nor config is set', () => {
    const card = new IopoolCard();
    const flags = getFlags(card);
    expect(flags.showTempGauge).toBe(false);
    expect(flags.showPhGauge).toBe(false);
    expect(flags.showOrpGauge).toBe(false);
    expect(flags.maintenanceSensors).toEqual([]);
    expect(flags.showChart).toBe(false);
    expect(flags.showMode).toBe(false);
    expect(flags.showPump).toBe(false);
    expect(flags.showFiltration).toBe(false);
    expect(flags.showBoost).toBe(false);
    expect(flags.isGrayed).toBe(false);
    expect(flags.warningBanner).toBeNull();
    expect(flags.tempGaugeGrayed).toBe(false);
    expect(flags.phGaugeGrayed).toBe(false);
    expect(flags.orpGaugeGrayed).toBe(false);
    expect(flags.chartGrayed).toBe(false);
  });

  it('returns warningBanner=initialization when iopool mode is INITIALIZATION', () => {
    const card = new IopoolCard();
    card.setConfig(VALID_CONFIG);
    const modeId = 'sensor.iopool_test_iopool_mode';
    setPrivateEntities(card, { mode: modeId });
    setPrivateHass(
      card,
      buildMockHass({ states: { [modeId]: makeHassState(modeId, 'INITIALIZATION') } }),
    );
    expect(getFlags(card).warningBanner).toBe('initialization');
  });

  it('returns isGrayed=true for INITIALIZATION mode', () => {
    const card = new IopoolCard();
    card.setConfig(VALID_CONFIG);
    const modeId = 'sensor.iopool_test_iopool_mode';
    setPrivateEntities(card, { mode: modeId });
    setPrivateHass(
      card,
      buildMockHass({ states: { [modeId]: makeHassState(modeId, 'INITIALIZATION') } }),
    );
    expect(getFlags(card).isGrayed).toBe(true);
  });

  it('returns showTempGauge/showPhGauge/showOrpGauge=false in ACTIVE_WINTER mode', () => {
    const card = new IopoolCard();
    card.setConfig(VALID_CONFIG);
    const modeId = 'sensor.iopool_test_iopool_mode';
    setPrivateEntities(card, { mode: modeId });
    setPrivateHass(
      card,
      buildMockHass({ states: { [modeId]: makeHassState(modeId, 'ACTIVE_WINTER') } }),
    );
    expect(getFlags(card).showTempGauge).toBe(false);
    expect(getFlags(card).showPhGauge).toBe(false);
    expect(getFlags(card).showOrpGauge).toBe(false);
  });

  it('returns showTempGauge/showPhGauge/showOrpGauge=false in WINTER (passive) mode', () => {
    const card = new IopoolCard();
    card.setConfig(VALID_CONFIG);
    const modeId = 'sensor.iopool_test_iopool_mode';
    setPrivateEntities(card, { mode: modeId });
    setPrivateHass(card, buildMockHass({ states: { [modeId]: makeHassState(modeId, 'WINTER') } }));
    expect(getFlags(card).showTempGauge).toBe(false);
    expect(getFlags(card).showPhGauge).toBe(false);
    expect(getFlags(card).showOrpGauge).toBe(false);
  });

  it('returns showTempGauge/showPhGauge/showOrpGauge=true in STANDARD mode', () => {
    const card = new IopoolCard();
    card.setConfig(VALID_CONFIG);
    const modeId = 'sensor.iopool_test_iopool_mode';
    setPrivateEntities(card, { mode: modeId });
    setPrivateHass(
      card,
      buildMockHass({ states: { [modeId]: makeHassState(modeId, 'STANDARD') } }),
    );
    expect(getFlags(card).showTempGauge).toBe(true);
    expect(getFlags(card).showPhGauge).toBe(true);
    expect(getFlags(card).showOrpGauge).toBe(true);
  });

  describe('IopoolCard._displayFlags — per-sensor maintenance', () => {
    it('returns maintenanceSensors=[] when no sensor has measure_mode maintenance', () => {
      const card = new IopoolCard();
      card.setConfig(VALID_CONFIG);
      const modeId = 'sensor.iopool_test_iopool_mode';
      const tempId = 'sensor.iopool_test_temperature';
      setPrivateEntities(card, { mode: modeId, temperature: tempId });
      setPrivateHass(
        card,
        buildMockHass({
          states: {
            [modeId]: makeHassState(modeId, 'STANDARD'),
            [tempId]: makeHassState(tempId, '28.5', { measure_mode: 'manual' }),
          },
        }),
      );
      expect(getFlags(card).maintenanceSensors).toEqual([]);
    });

    it('returns warningBanner=maintenance and maintenanceSensors=[temperature] when temperature measure_mode is maintenance', () => {
      const card = new IopoolCard();
      card.setConfig(VALID_CONFIG);
      const modeId = 'sensor.iopool_test_iopool_mode';
      const tempId = 'sensor.iopool_test_temperature';
      setPrivateEntities(card, { mode: modeId, temperature: tempId });
      setPrivateHass(
        card,
        buildMockHass({
          states: {
            [modeId]: makeHassState(modeId, 'STANDARD'),
            [tempId]: makeHassState(tempId, '28.5', { measure_mode: 'maintenance' }),
          },
        }),
      );
      const flags = getFlags(card);
      expect(flags.warningBanner).toBe('maintenance');
      expect(flags.maintenanceSensors).toEqual(['temperature']);
    });

    it('returns tempGaugeGrayed=true and chartGrayed=true when temperature is in maintenance', () => {
      const card = new IopoolCard();
      card.setConfig(VALID_CONFIG);
      const modeId = 'sensor.iopool_test_iopool_mode';
      const tempId = 'sensor.iopool_test_temperature';
      setPrivateEntities(card, { mode: modeId, temperature: tempId });
      setPrivateHass(
        card,
        buildMockHass({
          states: {
            [modeId]: makeHassState(modeId, 'STANDARD'),
            [tempId]: makeHassState(tempId, '28.5', { measure_mode: 'maintenance' }),
          },
        }),
      );
      const flags = getFlags(card);
      expect(flags.showTempGauge).toBe(true); // shown but grayed
      expect(flags.tempGaugeGrayed).toBe(true);
      expect(flags.showChart).toBe(true); // shown but grayed
      expect(flags.chartGrayed).toBe(true);
    });

    it('returns phGaugeGrayed=true and orpGaugeGrayed=true when pH and ORP are in maintenance', () => {
      const card = new IopoolCard();
      card.setConfig(VALID_CONFIG);
      const modeId = 'sensor.iopool_test_iopool_mode';
      const phId = 'sensor.iopool_test_ph';
      const orpId = 'sensor.iopool_test_orp';
      setPrivateEntities(card, { mode: modeId, ph: phId, orp: orpId });
      setPrivateHass(
        card,
        buildMockHass({
          states: {
            [modeId]: makeHassState(modeId, 'STANDARD'),
            [phId]: makeHassState(phId, '7.2', { measure_mode: 'maintenance' }),
            [orpId]: makeHassState(orpId, '700', { measure_mode: 'maintenance' }),
          },
        }),
      );
      const flags = getFlags(card);
      expect(flags.phGaugeGrayed).toBe(true);
      expect(flags.orpGaugeGrayed).toBe(true);
      expect(flags.showPhGauge).toBe(true); // shown but grayed
      expect(flags.showOrpGauge).toBe(true); // shown but grayed
      expect(flags.tempGaugeGrayed).toBe(false);
      expect(flags.maintenanceSensors).toEqual(['ph', 'orp']);
    });

    it('returns showChart=true when only pH is in maintenance (temperature not in maintenance)', () => {
      const card = new IopoolCard();
      card.setConfig(VALID_CONFIG);
      const modeId = 'sensor.iopool_test_iopool_mode';
      const phId = 'sensor.iopool_test_ph';
      setPrivateEntities(card, { mode: modeId, ph: phId });
      setPrivateHass(
        card,
        buildMockHass({
          states: {
            [modeId]: makeHassState(modeId, 'STANDARD'),
            [phId]: makeHassState(phId, '7.2', { measure_mode: 'maintenance' }),
          },
        }),
      );
      expect(getFlags(card).showChart).toBe(true);
    });

    it('INITIALIZATION takes priority: gauge not hidden by maintenance, isGrayed=true, warningBanner=initialization', () => {
      const card = new IopoolCard();
      card.setConfig(VALID_CONFIG);
      const modeId = 'sensor.iopool_test_iopool_mode';
      const tempId = 'sensor.iopool_test_temperature';
      setPrivateEntities(card, { mode: modeId, temperature: tempId });
      setPrivateHass(
        card,
        buildMockHass({
          states: {
            [modeId]: makeHassState(modeId, 'INITIALIZATION'),
            [tempId]: makeHassState(tempId, '28.5', { measure_mode: 'maintenance' }),
          },
        }),
      );
      const flags = getFlags(card);
      expect(flags.isGrayed).toBe(true);
      expect(flags.warningBanner).toBe('initialization');
      expect(flags.maintenanceSensors).toEqual([]);
      // Temperature gauge still shown (grayed, not hidden)
      expect(flags.showTempGauge).toBe(true);
    });

    it('isGrayed=false when only measure_mode is maintenance (not INITIALIZATION)', () => {
      const card = new IopoolCard();
      card.setConfig(VALID_CONFIG);
      const modeId = 'sensor.iopool_test_iopool_mode';
      const tempId = 'sensor.iopool_test_temperature';
      setPrivateEntities(card, { mode: modeId, temperature: tempId });
      setPrivateHass(
        card,
        buildMockHass({
          states: {
            [modeId]: makeHassState(modeId, 'STANDARD'),
            [tempId]: makeHassState(tempId, '28.5', { measure_mode: 'maintenance' }),
          },
        }),
      );
      expect(getFlags(card).isGrayed).toBe(false);
    });
  });

  describe('IopoolCard._displayFlags — OPENING mode', () => {
    it('returns isGrayed=true for OPENING mode', () => {
      const card = new IopoolCard();
      card.setConfig(VALID_CONFIG);
      const modeId = 'sensor.iopool_test_iopool_mode';
      setPrivateEntities(card, { mode: modeId });
      setPrivateHass(
        card,
        buildMockHass({ states: { [modeId]: makeHassState(modeId, 'OPENING') } }),
      );
      expect(getFlags(card).isGrayed).toBe(true);
    });

    it('returns warningBanner=opening for OPENING mode', () => {
      const card = new IopoolCard();
      card.setConfig(VALID_CONFIG);
      const modeId = 'sensor.iopool_test_iopool_mode';
      setPrivateEntities(card, { mode: modeId });
      setPrivateHass(
        card,
        buildMockHass({ states: { [modeId]: makeHassState(modeId, 'OPENING') } }),
      );
      expect(getFlags(card).warningBanner).toBe('opening');
    });

    it('returns showTempGauge/showPhGauge/showOrpGauge=true for OPENING (grayed, not hidden)', () => {
      const card = new IopoolCard();
      card.setConfig(VALID_CONFIG);
      const modeId = 'sensor.iopool_test_iopool_mode';
      setPrivateEntities(card, { mode: modeId });
      setPrivateHass(
        card,
        buildMockHass({ states: { [modeId]: makeHassState(modeId, 'OPENING') } }),
      );
      const flags = getFlags(card);
      expect(flags.showTempGauge).toBe(true);
      expect(flags.showPhGauge).toBe(true);
      expect(flags.showOrpGauge).toBe(true);
      expect(flags.tempGaugeGrayed).toBe(true);
      expect(flags.phGaugeGrayed).toBe(true);
      expect(flags.orpGaugeGrayed).toBe(true);
    });

    it('returns showBoost=false for OPENING mode', () => {
      const card = new IopoolCard();
      card.setConfig(VALID_CONFIG);
      const modeId = 'sensor.iopool_test_iopool_mode';
      setPrivateEntities(card, { mode: modeId });
      setPrivateHass(
        card,
        buildMockHass({ states: { [modeId]: makeHassState(modeId, 'OPENING') } }),
      );
      expect(getFlags(card).showBoost).toBe(false);
    });
  });

  it('returns showFiltration=true when mode is ACTIVE_WINTER (filtration runs during active winter)', () => {
    const card = new IopoolCard();
    card.setConfig(VALID_CONFIG);
    const modeId = 'sensor.iopool_test_iopool_mode';
    const filtId = 'binary_sensor.iopool_test_filtration';
    setPrivateEntities(card, { mode: modeId, filtration: filtId });
    setPrivateHass(
      card,
      buildMockHass({
        states: {
          [modeId]: makeHassState(modeId, 'ACTIVE_WINTER'),
          [filtId]: makeHassState(filtId, 'off'),
        },
      }),
    );
    expect(getFlags(card).showFiltration).toBe(true);
  });

  it('returns showFiltration=false when mode is WINTER (passive)', () => {
    const card = new IopoolCard();
    card.setConfig(VALID_CONFIG);
    const modeId = 'sensor.iopool_test_iopool_mode';
    const filtId = 'binary_sensor.iopool_test_filtration';
    setPrivateEntities(card, { mode: modeId, filtration: filtId });
    setPrivateHass(
      card,
      buildMockHass({
        states: {
          [modeId]: makeHassState(modeId, 'WINTER'),
          [filtId]: makeHassState(filtId, 'off'),
        },
      }),
    );
    expect(getFlags(card).showFiltration).toBe(false);
  });

  it('returns showFiltration=true in STANDARD mode when filtration entity exists', () => {
    const card = new IopoolCard();
    card.setConfig(VALID_CONFIG);
    const modeId = 'sensor.iopool_test_iopool_mode';
    const filtId = 'binary_sensor.iopool_test_filtration';
    setPrivateEntities(card, { mode: modeId, filtration: filtId });
    setPrivateHass(
      card,
      buildMockHass({
        states: {
          [modeId]: makeHassState(modeId, 'STANDARD'),
          [filtId]: makeHassState(filtId, 'off'),
        },
      }),
    );
    expect(getFlags(card).showFiltration).toBe(true);
  });

  it('returns showBoost=false when mode is MAINTENANCE', () => {
    const card = new IopoolCard();
    card.setConfig(VALID_CONFIG);
    const modeId = 'sensor.iopool_test_iopool_mode';
    setPrivateEntities(card, { mode: modeId });
    setPrivateHass(
      card,
      buildMockHass({ states: { [modeId]: makeHassState(modeId, 'MAINTENANCE') } }),
    );
    expect(getFlags(card).showBoost).toBe(false);
  });

  it('returns showPump=false when mode is WINTER (passive)', () => {
    const card = new IopoolCard();
    card.setConfig({ ...VALID_CONFIG, pump_entity: 'switch.pool_pump' });
    const modeId = 'sensor.iopool_test_iopool_mode';
    setPrivateEntities(card, { mode: modeId });
    setPrivateHass(
      card,
      buildMockHass({
        states: {
          [modeId]: makeHassState(modeId, 'WINTER'),
          'switch.pool_pump': makeHassState('switch.pool_pump', 'off'),
        },
      }),
    );
    expect(getFlags(card).showPump).toBe(false);
  });

  it('returns showChart=false when show_chart is false in config', () => {
    const card = new IopoolCard();
    card.setConfig({ ...VALID_CONFIG, show_chart: false });
    const modeId = 'sensor.iopool_test_iopool_mode';
    setPrivateEntities(card, { mode: modeId });
    setPrivateHass(
      card,
      buildMockHass({ states: { [modeId]: makeHassState(modeId, 'STANDARD') } }),
    );
    expect(getFlags(card).showChart).toBe(false);
  });

  it('returns showChart=true by default (show_chart not set)', () => {
    const card = new IopoolCard();
    card.setConfig(VALID_CONFIG);
    const modeId = 'sensor.iopool_test_iopool_mode';
    setPrivateEntities(card, { mode: modeId });
    setPrivateHass(
      card,
      buildMockHass({ states: { [modeId]: makeHassState(modeId, 'STANDARD') } }),
    );
    expect(getFlags(card).showChart).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// _handlePeriodChange
// ---------------------------------------------------------------------------

describe('IopoolCard._handlePeriodChange', () => {
  function callPeriodChange(card: IopoolCard, period: number): void {
    const handler = (
      card as unknown as { _handlePeriodChange: (ev: CustomEvent) => void }
    )._handlePeriodChange.bind(card);
    handler(new CustomEvent('period-change', { detail: period }));
  }

  it('updates chart_period in _config when called with a valid period', () => {
    const card = new IopoolCard();
    card.setConfig(VALID_CONFIG);
    callPeriodChange(card, 48);
    const config = (card as unknown as { _config: IopoolCardConfig })._config;
    expect(config.chart_period).toBe(48);
  });

  it('preserves all other config fields when updating chart_period', () => {
    const card = new IopoolCard();
    card.setConfig({ ...VALID_CONFIG, show_chart: true, debug: true });
    callPeriodChange(card, 168);
    const config = (card as unknown as { _config: IopoolCardConfig })._config;
    expect(config.chart_period).toBe(168);
    expect(config.show_chart).toBe(true);
    expect(config.debug).toBe(true);
    expect(config.device_id).toBe(VALID_CONFIG.device_id);
  });

  it('does nothing when _config is not set', () => {
    const card = new IopoolCard();
    // Should not throw when config is not set.
    expect(() => callPeriodChange(card, 24)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// _getDefaultAction
// ---------------------------------------------------------------------------

describe('IopoolCard._getDefaultAction', () => {
  function getDefaultAction(card: IopoolCard, section: string): { action: string } {
    return (
      card as unknown as { _getDefaultAction: (s: string) => { action: string } }
    )._getDefaultAction(section);
  }

  it('returns more-info for temperature', () => {
    const card = new IopoolCard();
    expect(getDefaultAction(card, 'temperature').action).toBe('more-info');
  });

  it('returns more-info for ph', () => {
    const card = new IopoolCard();
    expect(getDefaultAction(card, 'ph').action).toBe('more-info');
  });

  it('returns more-info for orp', () => {
    const card = new IopoolCard();
    expect(getDefaultAction(card, 'orp').action).toBe('more-info');
  });

  it('returns more-info for pump (not toggle)', () => {
    const card = new IopoolCard();
    expect(getDefaultAction(card, 'pump').action).toBe('more-info');
  });

  it('returns more-info for filtration', () => {
    const card = new IopoolCard();
    expect(getDefaultAction(card, 'filtration').action).toBe('more-info');
  });

  it('returns none for mode', () => {
    const card = new IopoolCard();
    expect(getDefaultAction(card, 'mode').action).toBe('none');
  });

  it('returns none for boost', () => {
    const card = new IopoolCard();
    expect(getDefaultAction(card, 'boost').action).toBe('none');
  });

  it('returns none for chart', () => {
    const card = new IopoolCard();
    expect(getDefaultAction(card, 'chart').action).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// Gauge @click → _handleAction
// ---------------------------------------------------------------------------

describe('IopoolCard — gauge click → _handleAction', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  function mountCard(): HTMLElement & { updateComplete: Promise<boolean> } {
    const element = document.createElement('iopool-card');
    document.body.append(element);
    return element as HTMLElement & { updateComplete: Promise<boolean> };
  }

  function buildStandardHass(): HomeAssistant {
    const modeId = 'sensor.iopool_test_iopool_mode';
    return buildMockHass({
      states: { [modeId]: makeHassState(modeId, 'STANDARD') },
    });
  }

  it('calls _handleAction("temperature", "tap") when the temperature gauge is clicked', async () => {
    const element = mountCard();
    const card = element as unknown as IopoolCard;
    card.setConfig(VALID_CONFIG);
    card.hass = buildStandardHass();
    (card as unknown as Record<string, unknown>)._entities = {
      mode: 'sensor.iopool_test_iopool_mode',
    };
    await element.updateComplete;

    const spy = vi.spyOn(
      card as unknown as { _handleAction: (...args: unknown[]) => void },
      '_handleAction',
    );
    const gauges = element.shadowRoot?.querySelectorAll('iopool-liquid-gauge');
    gauges?.[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    expect(spy).toHaveBeenCalledWith('temperature', 'tap');
  });

  it('calls _handleAction("ph", "tap") when the pH gauge is clicked', async () => {
    const element = mountCard();
    const card = element as unknown as IopoolCard;
    card.setConfig(VALID_CONFIG);
    card.hass = buildStandardHass();
    (card as unknown as Record<string, unknown>)._entities = {
      mode: 'sensor.iopool_test_iopool_mode',
    };
    await element.updateComplete;

    const spy = vi.spyOn(
      card as unknown as { _handleAction: (...args: unknown[]) => void },
      '_handleAction',
    );
    const gauges = element.shadowRoot?.querySelectorAll('iopool-liquid-gauge');
    gauges?.[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    expect(spy).toHaveBeenCalledWith('ph', 'tap');
  });

  it('calls _handleAction("orp", "tap") when the ORP gauge is clicked', async () => {
    const element = mountCard();
    const card = element as unknown as IopoolCard;
    card.setConfig(VALID_CONFIG);
    card.hass = buildStandardHass();
    (card as unknown as Record<string, unknown>)._entities = {
      mode: 'sensor.iopool_test_iopool_mode',
    };
    await element.updateComplete;

    const spy = vi.spyOn(
      card as unknown as { _handleAction: (...args: unknown[]) => void },
      '_handleAction',
    );
    const gauges = element.shadowRoot?.querySelectorAll('iopool-liquid-gauge');
    gauges?.[2]?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    expect(spy).toHaveBeenCalledWith('orp', 'tap');
  });
});

// ---------------------------------------------------------------------------
// pump-panel events → _handleAction
// ---------------------------------------------------------------------------

describe('IopoolCard — pump-panel events → _handleAction', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  function mountCard(): HTMLElement & { updateComplete: Promise<boolean> } {
    const element = document.createElement('iopool-card');
    document.body.append(element);
    return element as HTMLElement & { updateComplete: Promise<boolean> };
  }

  function buildPumpHass(): HomeAssistant {
    const modeId = 'sensor.iopool_test_iopool_mode';
    return buildMockHass({
      states: {
        [modeId]: makeHassState(modeId, 'STANDARD'),
        'switch.pool_pump': makeHassState('switch.pool_pump', 'off'),
      },
    });
  }

  it('calls _handleAction("pump", "tap") when pump-icon-tap fires from pump-panel', async () => {
    const element = mountCard();
    const card = element as unknown as IopoolCard;
    card.setConfig({ ...VALID_CONFIG, pump_entity: 'switch.pool_pump' });
    card.hass = buildPumpHass();
    (card as unknown as Record<string, unknown>)._entities = {
      mode: 'sensor.iopool_test_iopool_mode',
    };
    await element.updateComplete;

    const spy = vi.spyOn(
      card as unknown as { _handleAction: (...args: unknown[]) => void },
      '_handleAction',
    );
    const pumpPanel = element.shadowRoot?.querySelector('iopool-pump-panel');
    pumpPanel?.dispatchEvent(new CustomEvent('pump-icon-tap', { bubbles: true, composed: true }));
    expect(spy).toHaveBeenCalledWith('pump', 'tap');
  });

  it('calls _handleAction("filtration", "tap") when filtration-tap fires from pump-panel', async () => {
    const element = mountCard();
    const card = element as unknown as IopoolCard;
    card.setConfig({ ...VALID_CONFIG, pump_entity: 'switch.pool_pump' });
    card.hass = buildPumpHass();
    (card as unknown as Record<string, unknown>)._entities = {
      mode: 'sensor.iopool_test_iopool_mode',
    };
    await element.updateComplete;

    const spy = vi.spyOn(
      card as unknown as { _handleAction: (...args: unknown[]) => void },
      '_handleAction',
    );
    const pumpPanel = element.shadowRoot?.querySelector('iopool-pump-panel');
    pumpPanel?.dispatchEvent(new CustomEvent('filtration-tap', { bubbles: true, composed: true }));
    expect(spy).toHaveBeenCalledWith('filtration', 'tap');
  });
});
