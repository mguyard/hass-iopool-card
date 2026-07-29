import { describe, it, expect } from 'vitest';
import { getTemperatureUnit, degreeScale } from './temperature';
import type { HomeAssistant } from '../types';

function makeHass(overrides?: Partial<HomeAssistant>): HomeAssistant {
  return {
    language: 'en',
    states: {},
    entities: {},
    devices: {},
    callService: async () => {},
    callApi: async () => ({}) as never,
    ...overrides,
  } as HomeAssistant;
}

describe('getTemperatureUnit', () => {
  it('returns the entity attribute unit when present', () => {
    const hass = makeHass({
      states: {
        'sensor.pool_temperature': {
          entity_id: 'sensor.pool_temperature',
          state: '82',
          attributes: { unit_of_measurement: '°F' },
        } as never,
      },
    });
    expect(getTemperatureUnit(hass, 'sensor.pool_temperature')).toBe('°F');
  });

  it('recognizes Kelvin as a valid entity attribute unit', () => {
    const hass = makeHass({
      states: {
        'sensor.pool_temperature': {
          entity_id: 'sensor.pool_temperature',
          state: '301',
          attributes: { unit_of_measurement: 'K' },
        } as never,
      },
    });
    expect(getTemperatureUnit(hass, 'sensor.pool_temperature')).toBe('K');
  });

  it('prioritizes the entity attribute over hass.config.unit_system.temperature', () => {
    const hass = makeHass({
      config: { unit_system: { temperature: '°C' } },
      states: {
        'sensor.pool_temperature': {
          entity_id: 'sensor.pool_temperature',
          state: '82',
          attributes: { unit_of_measurement: '°F' },
        } as never,
      },
    });
    expect(getTemperatureUnit(hass, 'sensor.pool_temperature')).toBe('°F');
  });

  it('falls back to hass.config.unit_system.temperature when the attribute is missing', () => {
    const hass = makeHass({
      config: { unit_system: { temperature: '°F' } },
      states: {
        'sensor.pool_temperature': {
          entity_id: 'sensor.pool_temperature',
          state: '82',
          attributes: {},
        } as never,
      },
    });
    expect(getTemperatureUnit(hass, 'sensor.pool_temperature')).toBe('°F');
  });

  it('falls back to °C when hass is undefined', () => {
    expect(getTemperatureUnit(undefined, 'sensor.pool_temperature')).toBe('°C');
  });

  it('falls back to °C when entityId is undefined', () => {
    const hass = makeHass();
    expect(getTemperatureUnit(hass, undefined)).toBe('°C');
  });

  it('falls back to °C when the entity is absent from states', () => {
    const hass = makeHass();
    expect(getTemperatureUnit(hass, 'sensor.missing')).toBe('°C');
  });

  it('falls back to °C when the unit is unknown', () => {
    const hass = makeHass({
      states: {
        'sensor.pool_temperature': {
          entity_id: 'sensor.pool_temperature',
          state: '82',
          attributes: { unit_of_measurement: '°R' },
        } as never,
      },
    });
    expect(getTemperatureUnit(hass, 'sensor.pool_temperature')).toBe('°C');
  });
});

describe('degreeScale', () => {
  it('returns 1 for °C', () => {
    expect(degreeScale('°C')).toBe(1);
  });

  it('returns 1.8 for °F', () => {
    expect(degreeScale('°F')).toBe(1.8);
  });

  it('returns 1 for K', () => {
    expect(degreeScale('K')).toBe(1);
  });
});
