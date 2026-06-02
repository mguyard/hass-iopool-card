import { describe, it, expect } from 'vitest';
import { valueToZone, zoneToColor, valueToFillPct, phToZone, orpToZone } from './zone';
import type { TemperatureThresholds } from '../types';

// Standard pool thresholds used across tests
const POOL_THRESHOLDS: TemperatureThresholds = [15, 20.5, 29, 32];

describe('valueToZone', () => {
  it('returns red-low for values below first threshold', () => {
    expect(valueToZone(0, POOL_THRESHOLDS)).toBe('red-low');
    expect(valueToZone(14.9, POOL_THRESHOLDS)).toBe('red-low');
  });

  it('returns yellow-low at exactly the first threshold', () => {
    expect(valueToZone(15, POOL_THRESHOLDS)).toBe('yellow-low');
  });

  it('returns yellow-low between first and second threshold', () => {
    expect(valueToZone(18, POOL_THRESHOLDS)).toBe('yellow-low');
    expect(valueToZone(20.4, POOL_THRESHOLDS)).toBe('yellow-low');
  });

  it('returns ok at exactly the second threshold', () => {
    expect(valueToZone(20.5, POOL_THRESHOLDS)).toBe('ok');
  });

  it('returns ok in the nominal range', () => {
    expect(valueToZone(24, POOL_THRESHOLDS)).toBe('ok');
    expect(valueToZone(28.9, POOL_THRESHOLDS)).toBe('ok');
  });

  it('returns yellow-high at exactly the third threshold', () => {
    expect(valueToZone(29, POOL_THRESHOLDS)).toBe('yellow-high');
  });

  it('returns yellow-high between third and fourth threshold', () => {
    expect(valueToZone(30, POOL_THRESHOLDS)).toBe('yellow-high');
    expect(valueToZone(31.9, POOL_THRESHOLDS)).toBe('yellow-high');
  });

  it('returns red-high at and above the fourth threshold', () => {
    expect(valueToZone(32, POOL_THRESHOLDS)).toBe('red-high');
    expect(valueToZone(40, POOL_THRESHOLDS)).toBe('red-high');
  });

  it('works with pH thresholds [6.8, 7.1, 7.7, 8.1]', () => {
    const pH: TemperatureThresholds = [6.8, 7.1, 7.7, 8.1];
    expect(valueToZone(6.5, pH)).toBe('red-low');
    expect(valueToZone(7.0, pH)).toBe('yellow-low');
    expect(valueToZone(7.4, pH)).toBe('ok');
    expect(valueToZone(7.9, pH)).toBe('yellow-high');
    expect(valueToZone(8.5, pH)).toBe('red-high');
  });
});

describe('zoneToColor', () => {
  it('returns red color for red-low', () => {
    expect(zoneToColor('red-low')).toBe('var(--iopool-red, #d0021b)');
  });

  it('returns red color for red-high', () => {
    expect(zoneToColor('red-high')).toBe('var(--iopool-red, #d0021b)');
  });

  it('returns orange color for yellow-low', () => {
    expect(zoneToColor('yellow-low')).toBe('var(--iopool-orange, #f5a623)');
  });

  it('returns orange color for yellow-high', () => {
    expect(zoneToColor('yellow-high')).toBe('var(--iopool-orange, #f5a623)');
  });

  it('returns green color for ok zone', () => {
    expect(zoneToColor('ok')).toBe('var(--iopool-green, #7ed321)');
  });

  it('returns gray color for unknown zone', () => {
    expect(zoneToColor('unknown')).toBe('var(--iopool-neutral, #94a39e)');
  });

  it('red-low and red-high have the same color', () => {
    expect(zoneToColor('red-low')).toBe(zoneToColor('red-high'));
  });

  it('yellow-low and yellow-high have the same color', () => {
    expect(zoneToColor('yellow-low')).toBe(zoneToColor('yellow-high'));
  });
});

describe('valueToFillPct', () => {
  // With POOL_THRESHOLDS [15, 20.5, 29, 32]:
  // range = 32 - 15 = 17, margin = 17 * 0.25 = 4.25
  // visualMin = 15 - 4.25 = 10.75, visualMax = 32 + 4.25 = 36.25

  it('returns 0% for values at or below visualMin', () => {
    expect(valueToFillPct(0, POOL_THRESHOLDS)).toBe(0);
    expect(valueToFillPct(10.75, POOL_THRESHOLDS)).toBe(0);
  });

  it('returns 100% for values at or above visualMax', () => {
    expect(valueToFillPct(100, POOL_THRESHOLDS)).toBe(100);
    expect(valueToFillPct(36.25, POOL_THRESHOLDS)).toBe(100);
  });

  it('returns a percentage strictly between 0 and 100 for values in range', () => {
    const pct = valueToFillPct(24, POOL_THRESHOLDS);
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThan(100);
  });

  it('higher values yield higher fill percentages', () => {
    const low = valueToFillPct(16, POOL_THRESHOLDS);
    const mid = valueToFillPct(24, POOL_THRESHOLDS);
    const high = valueToFillPct(31, POOL_THRESHOLDS);
    expect(low).toBeLessThan(mid);
    expect(mid).toBeLessThan(high);
  });

  it('returns a value near 50% for the midpoint of the range', () => {
    // midpoint between t0 (15) and t3 (32) = 23.5
    // visualMin=10.75, visualMax=36.25 → midpoint ≈ 23.5 → pct ≈ 50%
    const pct = valueToFillPct(23.5, POOL_THRESHOLDS);
    expect(pct).toBeCloseTo(50, 0);
  });
});

describe('phToZone', () => {
  // Fixed pH thresholds: [6.8, 7.1, 7.7, 8.1]

  it('returns red-low for acidic pH below 6.8', () => {
    expect(phToZone(6.5)).toBe('red-low');
    expect(phToZone(5.0)).toBe('red-low');
  });

  it('returns yellow-low for pH between 6.8 and 7.1', () => {
    expect(phToZone(6.9)).toBe('yellow-low');
    expect(phToZone(7.0)).toBe('yellow-low');
  });

  it('returns ok for ideal pH range (7.1–7.7)', () => {
    expect(phToZone(7.1)).toBe('ok');
    expect(phToZone(7.4)).toBe('ok');
    expect(phToZone(7.69)).toBe('ok');
  });

  it('returns yellow-high for slightly alkaline pH (7.7–8.1)', () => {
    expect(phToZone(7.7)).toBe('yellow-high');
    expect(phToZone(7.9)).toBe('yellow-high');
  });

  it('returns red-high for very alkaline pH above 8.1', () => {
    expect(phToZone(8.1)).toBe('red-high');
    expect(phToZone(9.0)).toBe('red-high');
  });
});

describe('orpToZone', () => {
  // Fixed ORP thresholds: [550, 650, 800, 1000]

  it('returns red-low for ORP below 550 mV', () => {
    expect(orpToZone(400)).toBe('red-low');
    expect(orpToZone(549)).toBe('red-low');
  });

  it('returns yellow-low for ORP between 550 and 650 mV', () => {
    expect(orpToZone(550)).toBe('yellow-low');
    expect(orpToZone(620)).toBe('yellow-low');
  });

  it('returns ok for ORP in the ideal range (650–800 mV)', () => {
    expect(orpToZone(650)).toBe('ok');
    expect(orpToZone(720)).toBe('ok');
    expect(orpToZone(799)).toBe('ok');
  });

  it('returns yellow-high for ORP between 800 and 1000 mV', () => {
    expect(orpToZone(800)).toBe('yellow-high');
    expect(orpToZone(900)).toBe('yellow-high');
  });

  it('returns red-high for ORP above 1000 mV', () => {
    expect(orpToZone(1000)).toBe('red-high');
    expect(orpToZone(1200)).toBe('red-high');
  });
});
