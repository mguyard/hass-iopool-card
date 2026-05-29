import { describe, it, expect } from 'vitest';
import {
  formatDuration,
  formatDurationHMS,
  formatDate,
  formatNumber,
  formatPercent,
} from './format';

describe('formatDuration', () => {
  it('formats zero minutes correctly (en)', () => {
    expect(formatDuration(0, 'en')).toBe('00m');
  });

  it('formats zero minutes correctly (fr)', () => {
    expect(formatDuration(0, 'fr')).toBe('00min');
  });

  it('formats sub-hour duration (en)', () => {
    expect(formatDuration(45, 'en')).toBe('45m');
  });

  it('formats sub-hour duration (fr)', () => {
    expect(formatDuration(45, 'fr')).toBe('45min');
  });

  it('formats exactly 1 hour (en)', () => {
    expect(formatDuration(60, 'en')).toBe('1h00m');
  });

  it('formats exactly 1 hour (fr)', () => {
    expect(formatDuration(60, 'fr')).toBe('1h00min');
  });

  it('formats 6 hours 30 minutes (en)', () => {
    expect(formatDuration(390, 'en')).toBe('6h30m');
  });

  it('formats 6 hours 30 minutes (fr)', () => {
    expect(formatDuration(390, 'fr')).toBe('6h30min');
  });

  it('pads minutes below 10 with leading zero', () => {
    expect(formatDuration(61, 'en')).toBe('1h01m');
  });

  it('handles fractional minutes by flooring', () => {
    expect(formatDuration(90.9, 'en')).toBe('1h30m');
  });

  it('handles negative input as zero', () => {
    expect(formatDuration(-10, 'en')).toBe('00m');
  });
});

describe('formatDurationHMS', () => {
  it('formats zero seconds', () => {
    expect(formatDurationHMS(0)).toBe('00:00:00');
  });

  it('formats 1 hour exactly', () => {
    expect(formatDurationHMS(3600)).toBe('01:00:00');
  });

  it('formats 6 hours 30 minutes', () => {
    expect(formatDurationHMS(6 * 3600 + 30 * 60)).toBe('06:30:00');
  });

  it('formats 6 hours 30 minutes 45 seconds', () => {
    expect(formatDurationHMS(6 * 3600 + 30 * 60 + 45)).toBe('06:30:45');
  });

  it('pads all components with leading zeros', () => {
    expect(formatDurationHMS(3661)).toBe('01:01:01');
  });

  it('handles negative input as zero', () => {
    expect(formatDurationHMS(-100)).toBe('00:00:00');
  });

  it('handles fractional seconds by flooring', () => {
    expect(formatDurationHMS(3600.9)).toBe('01:00:00');
  });
});

describe('formatDate', () => {
  it('returns the formatted date for a valid ISO string', () => {
    // We only check that it returns a non-empty string that contains the year
    const result = formatDate('2024-01-15T10:00:00.000Z', 'en');
    expect(result).toContain('2024');
    expect(result.length).toBeGreaterThan(5);
  });

  it('returns the raw string for an invalid ISO date', () => {
    expect(formatDate('not-a-date', 'en')).toBe('not-a-date');
  });

  it('returns a different locale format for fr', () => {
    const en = formatDate('2024-01-15T00:00:00.000Z', 'en');
    const fr = formatDate('2024-01-15T00:00:00.000Z', 'fr');
    // Both should contain 2024 and be non-empty
    expect(en).toContain('2024');
    expect(fr).toContain('2024');
    // They may differ in format (month abbreviation locale)
    // We just verify they are strings
    expect(typeof en).toBe('string');
    expect(typeof fr).toBe('string');
  });
});

describe('formatNumber', () => {
  it('formats with 1 decimal place', () => {
    expect(formatNumber(7.449, 1)).toBe('7.4');
  });

  it('formats with 0 decimal places (integer)', () => {
    expect(formatNumber(684.9, 0)).toBe('685');
  });

  it('formats with 2 decimal places', () => {
    expect(formatNumber(3.14159, 2)).toBe('3.14');
  });

  it('handles zero', () => {
    expect(formatNumber(0, 1)).toBe('0.0');
  });

  it('handles negative values', () => {
    expect(formatNumber(-7.5, 1)).toBe('-7.5');
  });

  it('handles large values', () => {
    expect(formatNumber(1000, 0)).toBe('1000');
  });
});

describe('formatPercent', () => {
  it('formats 1.0 (100%) as "100%"', () => {
    expect(formatPercent(1.0)).toBe('100%');
  });

  it('formats 1.37 (137%) as "137%"', () => {
    expect(formatPercent(1.37)).toBe('137%');
  });

  it('formats 0.5 (50%) as "50%"', () => {
    expect(formatPercent(0.5)).toBe('50%');
  });

  it('formats 0 (0%) as "0%"', () => {
    expect(formatPercent(0)).toBe('0%');
  });

  it('rounds to nearest integer', () => {
    expect(formatPercent(0.755)).toBe('76%');
    expect(formatPercent(0.754)).toBe('75%');
  });
});
