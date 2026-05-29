import type { HomeAssistant, TemperaturePoint } from '../types';

// Raw point format returned by the HA history API (minimal_response mode)
interface RawHistoryPoint {
  last_changed: string;
  state: string;
}

/**
 * Fetches temperature history from the Home Assistant history API.
 *
 * Uses minimal_response + no_attributes to reduce payload size (SPECIFICATIONS §6.11).
 * Returns an empty array on any error (network, parse, API error) — callers should
 * display a graceful fallback rather than crashing.
 *
 * @param hass      HomeAssistant instance
 * @param entityId  Entity to fetch history for (e.g. sensor.iopool_mypool_temperature)
 * @param hours     Number of hours of history to fetch
 */
export async function fetchTemperatureHistory(
  hass: HomeAssistant,
  entityId: string,
  hours: number,
): Promise<TemperaturePoint[]> {
  try {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - hours * 3600 * 1000);

    const url =
      `history/period/${startTime.toISOString()}` +
      `?filter_entity_id=${encodeURIComponent(entityId)}` +
      `&end_time=${encodeURIComponent(endTime.toISOString())}` +
      `&minimal_response&no_attributes`;

    // The HA history API returns RawHistoryPoint[][] — one array per entity
    const result = await hass.callApi<RawHistoryPoint[][]>('GET', url);

    if (!Array.isArray(result) || result.length === 0) {
      return [];
    }

    const firstSeries = result[0];
    if (!firstSeries) {
      return [];
    }

    return firstSeries
      .map((p) => ({
        timestamp: p.last_changed,
        value: parseFloat(p.state),
      }))
      .filter((p) => !isNaN(p.value));
  } catch {
    // Return empty array on any API or network error
    return [];
  }
}
