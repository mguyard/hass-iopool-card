import { describe, it, expect } from 'vitest';
import { resolvePoolName } from './pool-name';
import type { DeviceRegistryEntry } from '../types';

function makeDevice(name: string | null, name_by_user: string | null): DeviceRegistryEntry {
  return {
    id: 'device-001',
    name,
    name_by_user,
    identifiers: [['iopool', 'pool-001']],
    manufacturer: 'iopool',
    model: 'EcO',
  };
}

describe('resolvePoolName', () => {
  it('returns name_by_user when set (highest priority)', () => {
    const device = makeDevice('My Pool', 'Swimming Pool');
    expect(resolvePoolName(device)).toBe('Swimming Pool');
  });

  it('trims name_by_user', () => {
    const device = makeDevice('My Pool', '  Trimmed Name  ');
    expect(resolvePoolName(device)).toBe('Trimmed Name');
  });

  it('falls back to name when name_by_user is null', () => {
    const device = makeDevice('My Pool', null);
    expect(resolvePoolName(device)).toBe('My Pool');
  });

  it('falls back to name when name_by_user is empty string', () => {
    const device = makeDevice('My Pool', '');
    expect(resolvePoolName(device)).toBe('My Pool');
  });

  it('falls back to name when name_by_user is whitespace only', () => {
    const device = makeDevice('My Pool', '   ');
    expect(resolvePoolName(device)).toBe('My Pool');
  });

  it('trims name', () => {
    const device = makeDevice('  Pool Name  ', null);
    expect(resolvePoolName(device)).toBe('Pool Name');
  });

  it('returns default fallback when both name and name_by_user are null', () => {
    const device = makeDevice(null, null);
    expect(resolvePoolName(device)).toBe('iopool');
  });

  it('returns default fallback when name is empty and name_by_user is null', () => {
    const device = makeDevice('', null);
    expect(resolvePoolName(device)).toBe('iopool');
  });

  it('returns default fallback when name is whitespace only and name_by_user is null', () => {
    const device = makeDevice('   ', null);
    expect(resolvePoolName(device)).toBe('iopool');
  });

  it('accepts a custom fallback string', () => {
    const device = makeDevice(null, null);
    expect(resolvePoolName(device, 'Custom Default')).toBe('Custom Default');
  });

  it('prefers name_by_user over name with custom fallback', () => {
    const device = makeDevice('Device Name', 'User Name');
    expect(resolvePoolName(device, 'Fallback')).toBe('User Name');
  });
});
