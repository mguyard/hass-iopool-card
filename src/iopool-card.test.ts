import { describe, it, expect, vi } from 'vitest';
import type {
  HomeAssistant,
  IopoolCardConfig,
  ResolvedEntities,
  DisplayFlags,
  HassEntity,
} from './types';
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

  it('sets chart_period to 96 when not provided', () => {
    const card = new IopoolCard();
    card.setConfig(VALID_CONFIG);
    expect(getConfig(card).chart_period).toBe(96);
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

  it('does not throw when mode is MAINTENANCE (isGrayed path)', () => {
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
    expect(flags.showGauges).toBe(false);
    expect(flags.showChart).toBe(false);
    expect(flags.showMode).toBe(false);
    expect(flags.showPump).toBe(false);
    expect(flags.showFiltration).toBe(false);
    expect(flags.showBoost).toBe(false);
    expect(flags.isGrayed).toBe(false);
    expect(flags.warningBanner).toBeNull();
  });

  it('returns warningBanner=maintenance when iopool mode is MAINTENANCE', () => {
    const card = new IopoolCard();
    card.setConfig(VALID_CONFIG);
    const modeId = 'sensor.iopool_test_iopool_mode';
    setPrivateEntities(card, { mode: modeId });
    setPrivateHass(
      card,
      buildMockHass({ states: { [modeId]: makeHassState(modeId, 'MAINTENANCE') } }),
    );
    expect(getFlags(card).warningBanner).toBe('maintenance');
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

  it('returns isGrayed=true for MAINTENANCE mode', () => {
    const card = new IopoolCard();
    card.setConfig(VALID_CONFIG);
    const modeId = 'sensor.iopool_test_iopool_mode';
    setPrivateEntities(card, { mode: modeId });
    setPrivateHass(
      card,
      buildMockHass({ states: { [modeId]: makeHassState(modeId, 'MAINTENANCE') } }),
    );
    expect(getFlags(card).isGrayed).toBe(true);
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

  it('returns showGauges=false in ACTIVE_WINTER mode', () => {
    const card = new IopoolCard();
    card.setConfig(VALID_CONFIG);
    const modeId = 'sensor.iopool_test_iopool_mode';
    setPrivateEntities(card, { mode: modeId });
    setPrivateHass(
      card,
      buildMockHass({ states: { [modeId]: makeHassState(modeId, 'ACTIVE_WINTER') } }),
    );
    expect(getFlags(card).showGauges).toBe(false);
  });

  it('returns showGauges=false in WINTER (passive) mode', () => {
    const card = new IopoolCard();
    card.setConfig(VALID_CONFIG);
    const modeId = 'sensor.iopool_test_iopool_mode';
    setPrivateEntities(card, { mode: modeId });
    setPrivateHass(card, buildMockHass({ states: { [modeId]: makeHassState(modeId, 'WINTER') } }));
    expect(getFlags(card).showGauges).toBe(false);
  });

  it('returns showGauges=true in STANDARD mode', () => {
    const card = new IopoolCard();
    card.setConfig(VALID_CONFIG);
    const modeId = 'sensor.iopool_test_iopool_mode';
    setPrivateEntities(card, { mode: modeId });
    setPrivateHass(
      card,
      buildMockHass({ states: { [modeId]: makeHassState(modeId, 'STANDARD') } }),
    );
    expect(getFlags(card).showGauges).toBe(true);
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
