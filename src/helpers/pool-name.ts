import type { DeviceRegistryEntry } from '../types';

/**
 * Resolves the display name for a pool device.
 *
 * Resolution order (SPECIFICATIONS §5.5):
 * 1. device.name_by_user (user-defined override) — trimmed, non-empty
 * 2. device.name (default integration name) — trimmed, non-empty
 * 3. fallback (default: 'iopool')
 *
 * Call on every render so device renames are reflected immediately.
 */
export function resolvePoolName(device: DeviceRegistryEntry, fallback = 'iopool'): string {
  if (device.name_by_user !== null && device.name_by_user.trim() !== '') {
    return device.name_by_user.trim();
  }
  if (device.name !== null && device.name.trim() !== '') {
    return device.name.trim();
  }
  return fallback;
}
