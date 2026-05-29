import type { TemperatureThresholds, IopoolCardConfig } from '../types';
import { DEFAULT_POOL_THRESHOLDS } from '../const';

/**
 * Validates that a TemperatureThresholds tuple is strictly increasing.
 * Returns true if t[0] < t[1] < t[2] < t[3].
 */
export function validateThresholds(thresholds: TemperatureThresholds): boolean {
  return (
    thresholds[0] < thresholds[1] && thresholds[1] < thresholds[2] && thresholds[2] < thresholds[3]
  );
}

/**
 * Resolves the effective temperature thresholds from the card config.
 * Returns the user-configured thresholds if they are valid (strictly increasing),
 * otherwise falls back to DEFAULT_POOL_THRESHOLDS.
 */
export function resolveThresholds(config: IopoolCardConfig): TemperatureThresholds {
  if (
    config.temperature_thresholds !== undefined &&
    validateThresholds(config.temperature_thresholds)
  ) {
    return config.temperature_thresholds;
  }
  return DEFAULT_POOL_THRESHOLDS;
}
