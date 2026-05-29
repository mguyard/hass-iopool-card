import { describe, it, expect } from 'vitest';
import type {
  Zone,
  IopoolMode,
  PoolFilterMode,
  TemperatureThresholds,
  EntityRegistryEntry,
  DeviceRegistryEntry,
  HassEntity,
  HomeAssistant,
  IopoolCardConfig,
  ResolvedEntities,
  DisplayFlags,
  BoostStatus,
  TemperaturePoint,
} from './types';

describe('Zone type', () => {
  it('contains all expected zone values at runtime', () => {
    // Verifies that all zone string literals are valid at runtime
    const zones: Zone[] = ['red-low', 'yellow-low', 'ok', 'yellow-high', 'red-high', 'unknown'];
    expect(zones).toHaveLength(6);
    expect(zones).toContain('ok');
    expect(zones).toContain('unknown');
  });
});

describe('IopoolMode type', () => {
  it('contains all probe mode values', () => {
    const modes: IopoolMode[] = [
      'STANDARD',
      'OPENING',
      'ACTIVE_WINTER',
      'WINTER',
      'INITIALIZATION',
      'MAINTENANCE',
    ];
    expect(modes).toHaveLength(6);
  });
});

describe('PoolFilterMode type', () => {
  it('contains all filtration mode values', () => {
    const modes: PoolFilterMode[] = ['Standard', 'Active-Winter', 'Passive-Winter'];
    expect(modes).toHaveLength(3);
  });
});

describe('EntityRegistryEntry interface', () => {
  it('accepts a valid entity registry entry shape', () => {
    const entry: EntityRegistryEntry = {
      entity_id: 'sensor.iopool_mypool_temperature',
      device_id: 'abc123',
      platform: 'iopool',
      unique_id: 'iopool_mypool_temperature',
    };
    expect(entry.entity_id).toBe('sensor.iopool_mypool_temperature');
    expect(entry.device_id).toBe('abc123');
    expect(entry.platform).toBe('iopool');
  });

  it('allows null device_id for entities not attached to a device', () => {
    const entry: EntityRegistryEntry = {
      entity_id: 'sensor.standalone',
      device_id: null,
      platform: 'some_platform',
      unique_id: 'standalone_unique',
    };
    expect(entry.device_id).toBeNull();
  });
});

describe('DeviceRegistryEntry interface', () => {
  it('accepts a valid device entry shape', () => {
    const device: DeviceRegistryEntry = {
      id: 'device-id-001',
      name: 'My Pool',
      name_by_user: 'Swimming Pool',
      identifiers: [['iopool', 'pool-api-id']],
      manufacturer: 'iopool',
      model: 'EcO',
    };
    expect(device.id).toBe('device-id-001');
    expect(device.identifiers[0]).toEqual(['iopool', 'pool-api-id']);
  });

  it('allows null for name and name_by_user', () => {
    const device: DeviceRegistryEntry = {
      id: 'device-id-002',
      name: null,
      name_by_user: null,
      identifiers: [['iopool', 'pool-002']],
      manufacturer: null,
      model: null,
    };
    expect(device.name).toBeNull();
    expect(device.name_by_user).toBeNull();
  });
});

describe('HassEntity interface', () => {
  it('accepts a valid entity state shape', () => {
    const entity: HassEntity = {
      entity_id: 'sensor.iopool_mypool_temperature',
      state: '26.5',
      attributes: { unit_of_measurement: '°C', friendly_name: 'Pool Temperature' },
      last_changed: '2024-01-15T10:00:00.000Z',
      last_updated: '2024-01-15T10:00:00.000Z',
    };
    expect(entity.state).toBe('26.5');
    expect(entity.attributes['unit_of_measurement']).toBe('°C');
  });
});

describe('IopoolCardConfig interface', () => {
  it('accepts minimal required config', () => {
    const config: IopoolCardConfig = {
      type: 'custom:iopool-card',
      device_id: 'abc123',
    };
    expect(config.device_id).toBe('abc123');
    expect(config.pump_entity).toBeUndefined();
    expect(config.debug).toBeUndefined();
  });

  it('accepts full config with all optional fields', () => {
    const thresholds: TemperatureThresholds = [15, 20.5, 29, 32];
    const config: IopoolCardConfig = {
      type: 'custom:iopool-card',
      device_id: 'abc123',
      pump_entity: 'switch.pool_pump',
      show_chart: true,
      chart_period: 96,
      temperature_thresholds: thresholds,
      debug: true,
      section_actions: {
        temperature: { tap_action: { action: 'more-info' } },
        pump: { tap_action: { action: 'toggle' } },
      },
    };
    expect(config.temperature_thresholds).toEqual([15, 20.5, 29, 32]);
    expect(config.section_actions?.temperature?.tap_action?.action).toBe('more-info');
  });

  it('accepts valid chart_period values', () => {
    const periods: Array<24 | 48 | 96 | 168> = [24, 48, 96, 168];
    for (const period of periods) {
      const config: IopoolCardConfig = {
        type: 'custom:iopool-card',
        device_id: 'x',
        chart_period: period,
      };
      expect(config.chart_period).toBe(period);
    }
  });
});

describe('ResolvedEntities interface', () => {
  it('allows all optional fields', () => {
    const resolved: ResolvedEntities = {
      temperature: 'sensor.iopool_mypool_temperature',
      ph: 'sensor.iopool_mypool_ph',
    };
    expect(resolved.temperature).toBe('sensor.iopool_mypool_temperature');
    expect(resolved.mode).toBeUndefined();
  });
});

describe('DisplayFlags interface', () => {
  it('accepts a complete DisplayFlags object', () => {
    const flags: DisplayFlags = {
      showGauges: true,
      showChart: true,
      showActionBadge: true,
      showMode: true,
      showPump: false,
      showFiltration: true,
      showBoost: true,
      isGrayed: false,
      warningBanner: null,
    };
    expect(flags.showGauges).toBe(true);
    expect(flags.warningBanner).toBeNull();
  });

  it('allows maintenance and initialization banner values', () => {
    const maintenance: DisplayFlags['warningBanner'] = 'maintenance';
    const initialization: DisplayFlags['warningBanner'] = 'initialization';
    expect(maintenance).toBe('maintenance');
    expect(initialization).toBe('initialization');
  });
});

describe('BoostStatus interface', () => {
  it('accepts valid boost status shape', () => {
    const status: BoostStatus = {
      remainingMs: 3600000,
      totalMs: 7200000,
      pct: 50,
    };
    expect(status.pct).toBe(50);
  });
});

describe('TemperaturePoint interface', () => {
  it('accepts valid temperature point shape', () => {
    const point: TemperaturePoint = {
      timestamp: '2024-01-15T10:00:00.000Z',
      value: 26.5,
    };
    expect(point.timestamp).toMatch(/^\d{4}-/);
    expect(point.value).toBe(26.5);
  });
});

describe('HomeAssistant interface', () => {
  it('can be constructed as a minimal mock', () => {
    const mockHass: HomeAssistant = {
      language: 'en',
      states: {},
      entities: {},
      devices: {},
      callService: async () => {},
      callApi: async <T>() => ({}) as T,
    };
    expect(mockHass.language).toBe('en');
  });
});
