import { describe, it, expect } from 'vitest';
import {
  getEntitiesForDevice,
  findEntityBySuffix,
  resolveEntities,
  getDeviceById,
  isIopoolDevice,
} from './device';
import type { HomeAssistant, EntityRegistryEntry, DeviceRegistryEntry } from '../types';

function buildMockHass(
  entities: Record<string, EntityRegistryEntry>,
  devices: Record<string, DeviceRegistryEntry>,
): HomeAssistant {
  return {
    language: 'en',
    states: {},
    entities,
    devices,
    callService: async () => {},
    callApi: async <T>() => ({}) as T,
  };
}

const DEVICE_ID = 'device-001';

const MOCK_ENTITIES: Record<string, EntityRegistryEntry> = {
  'sensor.iopool_mypool_iopool_mode': {
    entity_id: 'sensor.iopool_mypool_iopool_mode',
    device_id: DEVICE_ID,
    platform: 'iopool',
    unique_id: 'iopool_mypool_mode',
  },
  'sensor.iopool_mypool_temperature': {
    entity_id: 'sensor.iopool_mypool_temperature',
    device_id: DEVICE_ID,
    platform: 'iopool',
    unique_id: 'iopool_mypool_temperature',
  },
  'sensor.iopool_mypool_ph': {
    entity_id: 'sensor.iopool_mypool_ph',
    device_id: DEVICE_ID,
    platform: 'iopool',
    unique_id: 'iopool_mypool_ph',
  },
  'sensor.iopool_mypool_orp': {
    entity_id: 'sensor.iopool_mypool_orp',
    device_id: DEVICE_ID,
    platform: 'iopool',
    unique_id: 'iopool_mypool_orp',
  },
  'select.iopool_mypool_pool_mode': {
    entity_id: 'select.iopool_mypool_pool_mode',
    device_id: DEVICE_ID,
    platform: 'iopool',
    unique_id: 'iopool_mypool_pool_mode',
  },
  'select.iopool_mypool_boost_selector': {
    entity_id: 'select.iopool_mypool_boost_selector',
    device_id: DEVICE_ID,
    platform: 'iopool',
    unique_id: 'iopool_mypool_boost_selector',
  },
  'binary_sensor.iopool_mypool_action_required': {
    entity_id: 'binary_sensor.iopool_mypool_action_required',
    device_id: DEVICE_ID,
    platform: 'iopool',
    unique_id: 'iopool_mypool_action_required',
  },
  'binary_sensor.iopool_mypool_filtration': {
    entity_id: 'binary_sensor.iopool_mypool_filtration',
    device_id: DEVICE_ID,
    platform: 'iopool',
    unique_id: 'iopool_mypool_filtration',
  },
  'sensor.iopool_mypool_elapsed_filtration_duration': {
    entity_id: 'sensor.iopool_mypool_elapsed_filtration_duration',
    device_id: DEVICE_ID,
    platform: 'iopool',
    unique_id: 'iopool_mypool_elapsed_filtration_duration',
  },
  'sensor.iopool_mypool_filtration_recommendation': {
    entity_id: 'sensor.iopool_mypool_filtration_recommendation',
    device_id: DEVICE_ID,
    platform: 'iopool',
    unique_id: 'iopool_mypool_filtration_recommendation',
  },
  // Entity from a different device — must not be returned
  'sensor.other_device_temperature': {
    entity_id: 'sensor.other_device_temperature',
    device_id: 'device-other',
    platform: 'iopool',
    unique_id: 'other_temperature',
  },
};

const MOCK_DEVICES: Record<string, DeviceRegistryEntry> = {
  [DEVICE_ID]: {
    id: DEVICE_ID,
    name: 'My Pool',
    name_by_user: null,
    identifiers: [['iopool', 'pool-api-001']],
    manufacturer: 'iopool',
    model: 'EcO',
  },
};

describe('getEntitiesForDevice', () => {
  it('returns all entities belonging to the target device', () => {
    const hass = buildMockHass(MOCK_ENTITIES, MOCK_DEVICES);
    const result = getEntitiesForDevice(hass, DEVICE_ID);
    // 10 entities belong to DEVICE_ID (not the "other_device" one)
    expect(result).toHaveLength(10);
    for (const e of result) {
      expect(e.device_id).toBe(DEVICE_ID);
    }
  });

  it('returns empty array when device has no entities', () => {
    const hass = buildMockHass(MOCK_ENTITIES, MOCK_DEVICES);
    const result = getEntitiesForDevice(hass, 'non-existent-device');
    expect(result).toHaveLength(0);
  });

  it('returns empty array when hass.entities is empty', () => {
    const hass = buildMockHass({}, MOCK_DEVICES);
    const result = getEntitiesForDevice(hass, DEVICE_ID);
    expect(result).toHaveLength(0);
  });

  it('excludes entities from other devices', () => {
    const hass = buildMockHass(MOCK_ENTITIES, MOCK_DEVICES);
    const result = getEntitiesForDevice(hass, DEVICE_ID);
    const ids = result.map((e) => e.entity_id);
    expect(ids).not.toContain('sensor.other_device_temperature');
  });
});

describe('findEntityBySuffix', () => {
  const entities = Object.values(MOCK_ENTITIES).filter((e) => e.device_id === DEVICE_ID);

  it('finds a sensor entity by suffix regex', () => {
    const result = findEntityBySuffix(entities, 'sensor', /_temperature$/);
    expect(result).toBe('sensor.iopool_mypool_temperature');
  });

  it('finds a select entity by suffix regex', () => {
    const result = findEntityBySuffix(entities, 'select', /_pool_mode$/);
    expect(result).toBe('select.iopool_mypool_pool_mode');
  });

  it('finds a binary_sensor entity by suffix regex', () => {
    const result = findEntityBySuffix(entities, 'binary_sensor', /_action_required$/);
    expect(result).toBe('binary_sensor.iopool_mypool_action_required');
  });

  it('returns undefined when platform does not match', () => {
    // temperature is a sensor, not a select
    const result = findEntityBySuffix(entities, 'select', /_temperature$/);
    expect(result).toBeUndefined();
  });

  it('returns undefined when no entity matches the suffix', () => {
    const result = findEntityBySuffix(entities, 'sensor', /_nonexistent_suffix$/);
    expect(result).toBeUndefined();
  });

  it('returns undefined for empty entity list', () => {
    const result = findEntityBySuffix([], 'sensor', /_temperature$/);
    expect(result).toBeUndefined();
  });
});

describe('resolveEntities', () => {
  it('resolves all expected entities for a fully configured device', () => {
    const hass = buildMockHass(MOCK_ENTITIES, MOCK_DEVICES);
    const resolved = resolveEntities(hass, DEVICE_ID);

    expect(resolved.mode).toBe('sensor.iopool_mypool_iopool_mode');
    expect(resolved.temperature).toBe('sensor.iopool_mypool_temperature');
    expect(resolved.ph).toBe('sensor.iopool_mypool_ph');
    expect(resolved.orp).toBe('sensor.iopool_mypool_orp');
    expect(resolved.poolMode).toBe('select.iopool_mypool_pool_mode');
    expect(resolved.boostSelector).toBe('select.iopool_mypool_boost_selector');
    expect(resolved.actionRequired).toBe('binary_sensor.iopool_mypool_action_required');
    expect(resolved.filtration).toBe('binary_sensor.iopool_mypool_filtration');
    expect(resolved.elapsedFiltration).toBe('sensor.iopool_mypool_elapsed_filtration_duration');
    expect(resolved.filtrationRecommendation).toBe(
      'sensor.iopool_mypool_filtration_recommendation',
    );
  });

  it('returns empty object when device has no entities', () => {
    const hass = buildMockHass({}, MOCK_DEVICES);
    const resolved = resolveEntities(hass, DEVICE_ID);
    expect(Object.keys(resolved)).toHaveLength(0);
  });

  it('returns partial resolution when some entities are missing', () => {
    const partial: Record<string, EntityRegistryEntry> = {
      'sensor.iopool_mypool_temperature': MOCK_ENTITIES['sensor.iopool_mypool_temperature']!,
    };
    const hass = buildMockHass(partial, MOCK_DEVICES);
    const resolved = resolveEntities(hass, DEVICE_ID);

    expect(resolved.temperature).toBe('sensor.iopool_mypool_temperature');
    expect(resolved.ph).toBeUndefined();
    expect(resolved.mode).toBeUndefined();
  });
});

describe('getDeviceById', () => {
  it('returns the device when it exists', () => {
    const hass = buildMockHass(MOCK_ENTITIES, MOCK_DEVICES);
    const device = getDeviceById(hass, DEVICE_ID);
    expect(device).toBeDefined();
    expect(device?.name).toBe('My Pool');
  });

  it('returns undefined for a non-existent device_id', () => {
    const hass = buildMockHass(MOCK_ENTITIES, MOCK_DEVICES);
    const device = getDeviceById(hass, 'does-not-exist');
    expect(device).toBeUndefined();
  });
});

describe('isIopoolDevice', () => {
  it('returns true for a device with iopool identifier', () => {
    const device: DeviceRegistryEntry = {
      id: DEVICE_ID,
      name: 'My Pool',
      name_by_user: null,
      identifiers: [['iopool', 'pool-api-001']],
      manufacturer: 'iopool',
      model: 'EcO',
    };
    expect(isIopoolDevice(device)).toBe(true);
  });

  it('returns false for a device with no iopool identifier', () => {
    const device: DeviceRegistryEntry = {
      id: 'other-device',
      name: 'Other Device',
      name_by_user: null,
      identifiers: [['other_integration', 'device-001']],
      manufacturer: 'Other',
      model: 'Model X',
    };
    expect(isIopoolDevice(device)).toBe(false);
  });

  it('returns true when iopool is one of multiple identifiers', () => {
    const device: DeviceRegistryEntry = {
      id: 'multi-id-device',
      name: 'Multi',
      name_by_user: null,
      identifiers: [
        ['other_integration', 'xyz'],
        ['iopool', 'pool-abc'],
      ],
      manufacturer: 'iopool',
      model: 'EcO',
    };
    expect(isIopoolDevice(device)).toBe(true);
  });

  it('returns false for a device with empty identifiers', () => {
    const device: DeviceRegistryEntry = {
      id: 'empty-device',
      name: 'Empty',
      name_by_user: null,
      identifiers: [],
      manufacturer: null,
      model: null,
    };
    expect(isIopoolDevice(device)).toBe(false);
  });
});
