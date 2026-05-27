import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchTemperatureHistory } from './history';
import type { HomeAssistant } from '../types';

function buildMockHass(callApiImpl: HomeAssistant['callApi']): HomeAssistant {
  return {
    language: 'en',
    states: {},
    entities: {},
    devices: {},
    callService: async () => {},
    callApi: callApiImpl,
  };
}

describe('fetchTemperatureHistory', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed TemperaturePoint array on success', async () => {
    const rawData = [
      [
        { last_changed: '2024-01-15T08:00:00.000Z', state: '24.5' },
        { last_changed: '2024-01-15T09:00:00.000Z', state: '25.0' },
        { last_changed: '2024-01-15T10:00:00.000Z', state: '25.5' },
      ],
    ];
    const hass = buildMockHass(async () => rawData as never);

    const result = await fetchTemperatureHistory(hass, 'sensor.pool_temperature', 24);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ timestamp: '2024-01-15T08:00:00.000Z', value: 24.5 });
    expect(result[1]).toEqual({ timestamp: '2024-01-15T09:00:00.000Z', value: 25.0 });
    expect(result[2]).toEqual({ timestamp: '2024-01-15T10:00:00.000Z', value: 25.5 });
  });

  it('filters out non-numeric states (unavailable, unknown)', async () => {
    const rawData = [
      [
        { last_changed: '2024-01-15T08:00:00.000Z', state: 'unavailable' },
        { last_changed: '2024-01-15T09:00:00.000Z', state: '25.0' },
        { last_changed: '2024-01-15T10:00:00.000Z', state: 'unknown' },
        { last_changed: '2024-01-15T11:00:00.000Z', state: '26.0' },
      ],
    ];
    const hass = buildMockHass(async () => rawData as never);

    const result = await fetchTemperatureHistory(hass, 'sensor.pool_temperature', 24);

    expect(result).toHaveLength(2);
    expect(result[0]?.value).toBe(25.0);
    expect(result[1]?.value).toBe(26.0);
  });

  it('returns empty array when API returns null', async () => {
    const hass = buildMockHass(async () => null as never);
    const result = await fetchTemperatureHistory(hass, 'sensor.pool_temperature', 24);
    expect(result).toEqual([]);
  });

  it('returns empty array when API returns an empty array', async () => {
    const hass = buildMockHass(async () => [] as never);
    const result = await fetchTemperatureHistory(hass, 'sensor.pool_temperature', 24);
    expect(result).toEqual([]);
  });

  it('returns empty array when the first series is empty', async () => {
    const hass = buildMockHass(async () => [[]] as never);
    const result = await fetchTemperatureHistory(hass, 'sensor.pool_temperature', 24);
    expect(result).toEqual([]);
  });

  it('returns empty array when API throws an error', async () => {
    const hass = buildMockHass(async () => {
      throw new Error('Network error');
    });
    const result = await fetchTemperatureHistory(hass, 'sensor.pool_temperature', 24);
    expect(result).toEqual([]);
  });

  it('calls callApi with the correct path containing the entity_id', async () => {
    const callApi = vi.fn().mockResolvedValue([[]]);
    const hass = buildMockHass(callApi as HomeAssistant['callApi']);

    await fetchTemperatureHistory(hass, 'sensor.iopool_mypool_temperature', 48);

    expect(callApi).toHaveBeenCalledOnce();
    const [method, path] = callApi.mock.calls[0] as [string, string];
    expect(method).toBe('GET');
    expect(path).toContain('sensor.iopool_mypool_temperature');
    expect(path).toContain('minimal_response');
    expect(path).toContain('no_attributes');
  });

  it('calls callApi with the correct period for 96 hours', async () => {
    const callApi = vi.fn().mockResolvedValue([[]]);
    const hass = buildMockHass(callApi as HomeAssistant['callApi']);

    const before = Date.now();
    await fetchTemperatureHistory(hass, 'sensor.pool_temperature', 96);
    const after = Date.now();

    const [, path] = callApi.mock.calls[0] as [string, string];

    // Extract start time from path (history/period/<isoString>)
    const match = /history\/period\/([^?]+)/.exec(path);
    expect(match).not.toBeNull();
    const startTime = new Date(decodeURIComponent(match![1]!)).getTime();

    // Start time should be ~96 hours before now
    const expectedStart = before - 96 * 3600 * 1000;
    expect(startTime).toBeGreaterThanOrEqual(expectedStart - 5000);
    expect(startTime).toBeLessThanOrEqual(after);
  });

  it('handles a single point in the series', async () => {
    const rawData = [[{ last_changed: '2024-01-15T12:00:00.000Z', state: '27.3' }]];
    const hass = buildMockHass(async () => rawData as never);

    const result = await fetchTemperatureHistory(hass, 'sensor.pool_temperature', 24);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ timestamp: '2024-01-15T12:00:00.000Z', value: 27.3 });
  });

  it('returns empty array when all states are non-numeric', async () => {
    const rawData = [
      [
        { last_changed: '2024-01-15T08:00:00.000Z', state: 'unavailable' },
        { last_changed: '2024-01-15T09:00:00.000Z', state: 'unknown' },
      ],
    ];
    const hass = buildMockHass(async () => rawData as never);

    const result = await fetchTemperatureHistory(hass, 'sensor.pool_temperature', 24);
    expect(result).toEqual([]);
  });
});
