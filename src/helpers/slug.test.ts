import { describe, it, expect } from 'vitest';
import { slugifyPoolName } from './slug';

describe('slugifyPoolName', () => {
  it('lowercases plain ASCII names', () => {
    expect(slugifyPoolName('MyPool')).toBe('mypool');
  });

  it('replaces spaces with underscores', () => {
    expect(slugifyPoolName('My Pool')).toBe('my_pool');
  });

  it('collapses multiple spaces into a single underscore', () => {
    expect(slugifyPoolName('My  Pool')).toBe('my_pool');
  });

  it('strips leading and trailing underscores', () => {
    expect(slugifyPoolName(' Pool ')).toBe('pool');
    expect(slugifyPoolName('_pool_')).toBe('pool');
  });

  it('removes accented characters (é → e)', () => {
    expect(slugifyPoolName('Piscine été')).toBe('piscine_ete');
  });

  it('removes accented characters (à → a, ù → u)', () => {
    expect(slugifyPoolName('Là où')).toBe('la_ou');
  });

  it('handles cedilla (ç → c)', () => {
    expect(slugifyPoolName('Façade')).toBe('facade');
  });

  it('handles German umlauts (ü → u, ö → o, ä → a)', () => {
    // NFKD("Ü") decomposes to "U" (ASCII) + combining diaeresis (non-ASCII, stripped)
    // The base letter U is preserved — mirrors Python encode("ascii", "ignore") behaviour
    expect(slugifyPoolName('Über Pool')).toBe('uber_pool');
    expect(slugifyPoolName('schön')).toBe('schon');
    expect(slugifyPoolName('ärgern')).toBe('argern');
  });

  it('replaces hyphens with underscores', () => {
    expect(slugifyPoolName('my-pool')).toBe('my_pool');
  });

  it('replaces dots with underscores', () => {
    expect(slugifyPoolName('pool.v2')).toBe('pool_v2');
  });

  it('preserves numbers', () => {
    expect(slugifyPoolName('Pool 1')).toBe('pool_1');
    expect(slugifyPoolName('Pool2024')).toBe('pool2024');
  });

  it('handles a purely numeric name', () => {
    expect(slugifyPoolName('123')).toBe('123');
  });

  it('handles already-slugified input unchanged', () => {
    expect(slugifyPoolName('my_pool')).toBe('my_pool');
  });

  it('handles special characters (parentheses, slashes, etc.)', () => {
    expect(slugifyPoolName('Pool (main)')).toBe('pool_main');
    expect(slugifyPoolName('A/B pool')).toBe('a_b_pool');
  });

  it('returns empty string for an all-special-characters name', () => {
    expect(slugifyPoolName('---')).toBe('');
  });

  it('returns empty string for an empty input', () => {
    expect(slugifyPoolName('')).toBe('');
  });

  it('mirrors the Python implementation vector: "Ma Piscine d\'été"', () => {
    // Python: "Ma Piscine d'été" → "ma_piscine_d_ete"
    expect(slugifyPoolName("Ma Piscine d'été")).toBe('ma_piscine_d_ete');
  });

  it('mirrors the Python implementation vector: "Piscine Chauffée #2"', () => {
    // Python: "Piscine Chauffée #2" → "piscine_chauffee_2"
    expect(slugifyPoolName('Piscine Chauffée #2')).toBe('piscine_chauffee_2');
  });

  it('mirrors the Python implementation vector: "Pool"', () => {
    expect(slugifyPoolName('Pool')).toBe('pool');
  });

  it('handles Chinese/CJK characters (stripped entirely)', () => {
    // Non-ASCII characters that don't decompose to ASCII are removed
    const result = slugifyPoolName('Pool 泳池');
    expect(result).toBe('pool');
  });
});
