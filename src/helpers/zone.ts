import type { Zone, TemperatureThresholds } from '../types';
import { PH_THRESHOLDS, ORP_THRESHOLDS } from '../const';

/**
 * Maps a numeric value to one of 5 zones based on 4 threshold transition values.
 * Thresholds: [t0, t1, t2, t3] — strictly increasing.
 * Zones: <t0 → red-low, t0–t1 → yellow-low, t1–t2 → ok, t2–t3 → yellow-high, ≥t3 → red-high
 */
export function valueToZone(value: number, thresholds: TemperatureThresholds): Zone {
  if (value < thresholds[0]) return 'red-low';
  if (value < thresholds[1]) return 'yellow-low';
  if (value < thresholds[2]) return 'ok';
  if (value < thresholds[3]) return 'yellow-high';
  return 'red-high';
}

/**
 * Returns the CSS color string for a given zone.
 * Colors are chosen for light-mode prototype; liquid colors use gradient overrides (see SPECIFICATIONS §7.7).
 */
export function zoneToColor(zone: Zone): string {
  switch (zone) {
    case 'red-low':
    case 'red-high':
      return '#e74c3c';
    case 'yellow-low':
    case 'yellow-high':
      return '#f39c12';
    case 'ok':
      return '#7ED321';
    default:
      // 'unknown' — unavailable/loading state
      return '#9e9e9e';
  }
}

/**
 * Computes the fill percentage (0–100) of a liquid gauge for a given value.
 *
 * The visual scale extends 25% beyond the outer thresholds on each side to provide
 * visual margin for out-of-range values (SPECIFICATIONS §6.3.1).
 */
export function valueToFillPct(value: number, thresholds: TemperatureThresholds): number {
  const t0 = thresholds[0];
  const t3 = thresholds[3];
  const range = t3 - t0;
  const margin = range * 0.25;
  const visualMin = t0 - margin;
  const visualMax = t3 + margin;
  const pct = ((value - visualMin) / (visualMax - visualMin)) * 100;
  return Math.max(0, Math.min(100, pct));
}

/**
 * Maps a pH value to a zone using fixed thresholds (SPECIFICATIONS §6.3.1).
 * Fixed: [6.8, 7.1, 7.7, 8.1]
 */
export function phToZone(value: number): Zone {
  return valueToZone(value, PH_THRESHOLDS);
}

/**
 * Maps an ORP value (mV) to a zone using fixed thresholds (SPECIFICATIONS §6.3.1).
 * Fixed: [550, 650, 800, 1000]
 */
export function orpToZone(value: number): Zone {
  return valueToZone(value, ORP_THRESHOLDS);
}
