import type { HomeAssistant } from '../types';

/** Temperature units offered by Home Assistant for the `temperature` device class. */
export type TempUnit = '°C' | '°F' | 'K';

const VALID_UNITS: readonly string[] = ['°C', '°F', 'K'];

/**
 * Resolves the temperature display unit.
 *
 * Priority order:
 *   1. The entity's `unit_of_measurement` attribute — reflects a per-entity override,
 *      which takes precedence in Home Assistant over the global unit system.
 *   2. `hass.config.unit_system.temperature` — global unit system.
 *   3. '°C' — safety fallback.
 *
 * Always returns a valid unit, never `undefined`. The fallback to '°C' also covers
 * cases where `unit_of_measurement` is missing: unresolved entity, entity in an
 * `unavailable`/`unknown` state, render before the entity is added to the state
 * machine (HA startup), or a partial `hass` object (test/preview contexts). In all
 * of these the temperature value itself is `null`, so the unit only affects labels.
 */
export function getTemperatureUnit(hass?: HomeAssistant, entityId?: string): TempUnit {
  const attr = entityId
    ? (hass?.states[entityId]?.attributes?.['unit_of_measurement'] as string | undefined)
    : undefined;
  const candidate = attr ?? hass?.config?.unit_system?.temperature;
  return VALID_UNITS.includes(candidate ?? '') ? (candidate as TempUnit) : '°C';
}

/**
 * Degree scale factor, used to convert a temperature DELTA (band widths, axis
 * padding) — not an absolute value, hence no +32 offset here.
 *
 * One Fahrenheit degree is 5/9 of a Celsius degree: a 1 °C difference equals a
 * 1.8 °F difference. Kelvin has the same degree size as Celsius.
 */
export function degreeScale(unit: TempUnit): number {
  return unit === '°F' ? 1.8 : 1;
}
