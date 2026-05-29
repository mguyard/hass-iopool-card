import type {
  HomeAssistant,
  EntityRegistryEntry,
  DeviceRegistryEntry,
  ResolvedEntities,
  EntityMapKey,
} from '../types';
import { ENTITY_MAP } from '../const';

/**
 * Returns all entity registry entries belonging to a given device_id.
 */
export function getEntitiesForDevice(hass: HomeAssistant, deviceId: string): EntityRegistryEntry[] {
  return Object.values(hass.entities).filter((e) => e.device_id === deviceId);
}

/**
 * Finds the entity_id matching a given domain prefix and suffix regex.
 * The `platform` parameter is the entity domain (e.g. "sensor", "binary_sensor", "select"),
 * NOT the integration platform.
 */
export function findEntityBySuffix(
  entities: EntityRegistryEntry[],
  platform: string,
  suffixRegex: RegExp,
): string | undefined {
  return entities.find(
    (e) => e.entity_id.startsWith(`${platform}.`) && suffixRegex.test(e.entity_id),
  )?.entity_id;
}

/**
 * Resolves the full entity_id map for a given device, using the ENTITY_MAP definitions.
 * Should be called once in setConfig() and cached — never in set hass() or render().
 */
export function resolveEntities(hass: HomeAssistant, deviceId: string): ResolvedEntities {
  const entities = getEntitiesForDevice(hass, deviceId);
  const resolved: ResolvedEntities = {};

  for (const key of Object.keys(ENTITY_MAP) as EntityMapKey[]) {
    const def = ENTITY_MAP[key];
    const entityId = findEntityBySuffix(entities, def.platform, def.suffixRegex);
    if (entityId !== undefined) {
      resolved[key] = entityId;
    }
  }

  return resolved;
}

/**
 * Returns the device registry entry for a given device_id, or undefined if not found.
 */
export function getDeviceById(
  hass: HomeAssistant,
  deviceId: string,
): DeviceRegistryEntry | undefined {
  return hass.devices[deviceId];
}

/**
 * Returns true if the device was registered by the iopool integration.
 * Checks for the "iopool" domain in the device identifiers array.
 */
export function isIopoolDevice(device: DeviceRegistryEntry): boolean {
  return device.identifiers.some(([domain]) => domain === 'iopool');
}
