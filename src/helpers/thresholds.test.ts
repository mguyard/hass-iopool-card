import { describe, it, expect } from 'vitest';
import { validateThresholds, resolveThresholds } from './thresholds';
import { DEFAULT_POOL_THRESHOLDS } from '../const';
import type { TemperatureThresholds, IopoolCardConfig } from '../types';

describe('validateThresholds', () => {
  it('returns true for strictly increasing thresholds', () => {
    const t: TemperatureThresholds = [15, 20.5, 29, 32];
    expect(validateThresholds(t)).toBe(true);
  });

  it('returns true for spa thresholds', () => {
    const t: TemperatureThresholds = [28, 32, 36, 38];
    expect(validateThresholds(t)).toBe(true);
  });

  it('returns false when first two values are equal', () => {
    const t: TemperatureThresholds = [15, 15, 29, 32];
    expect(validateThresholds(t)).toBe(false);
  });

  it('returns false when values are decreasing', () => {
    const t: TemperatureThresholds = [32, 29, 20, 15];
    expect(validateThresholds(t)).toBe(false);
  });

  it('returns false when middle pair is equal', () => {
    const t: TemperatureThresholds = [15, 20, 20, 32];
    expect(validateThresholds(t)).toBe(false);
  });

  it('returns false when last pair is equal', () => {
    const t: TemperatureThresholds = [15, 20, 29, 29];
    expect(validateThresholds(t)).toBe(false);
  });

  it('returns false when only first value is greater than second', () => {
    const t: TemperatureThresholds = [25, 20, 29, 32];
    expect(validateThresholds(t)).toBe(false);
  });

  it('returns false when only last transition is invalid', () => {
    const t: TemperatureThresholds = [15, 20, 32, 29];
    expect(validateThresholds(t)).toBe(false);
  });

  it('works with decimal thresholds', () => {
    const t: TemperatureThresholds = [6.8, 7.1, 7.7, 8.1];
    expect(validateThresholds(t)).toBe(true);
  });
});

describe('resolveThresholds', () => {
  function makeConfig(overrides?: Partial<IopoolCardConfig>): IopoolCardConfig {
    return { type: 'custom:iopool-card', device_id: 'abc', ...overrides };
  }

  it('returns DEFAULT_POOL_THRESHOLDS when no temperature_thresholds in config', () => {
    const config = makeConfig();
    expect(resolveThresholds(config)).toEqual(DEFAULT_POOL_THRESHOLDS);
  });

  it('returns the user-configured thresholds when valid', () => {
    const custom: TemperatureThresholds = [20, 25, 30, 35];
    const config = makeConfig({ temperature_thresholds: custom });
    expect(resolveThresholds(config)).toEqual(custom);
  });

  it('falls back to defaults when user thresholds are invalid (not increasing)', () => {
    const invalid: TemperatureThresholds = [30, 25, 20, 15];
    const config = makeConfig({ temperature_thresholds: invalid });
    expect(resolveThresholds(config)).toEqual(DEFAULT_POOL_THRESHOLDS);
  });

  it('falls back to defaults when user thresholds have equal values', () => {
    const invalid: TemperatureThresholds = [15, 20, 20, 32];
    const config = makeConfig({ temperature_thresholds: invalid });
    expect(resolveThresholds(config)).toEqual(DEFAULT_POOL_THRESHOLDS);
  });

  it('accepts spa thresholds as valid custom thresholds', () => {
    const spa: TemperatureThresholds = [28, 32, 36, 38];
    const config = makeConfig({ temperature_thresholds: spa });
    expect(resolveThresholds(config)).toEqual(spa);
  });

  it('returns the same reference as DEFAULT_POOL_THRESHOLDS when no override', () => {
    const config = makeConfig();
    expect(resolveThresholds(config)).toBe(DEFAULT_POOL_THRESHOLDS);
  });
});
