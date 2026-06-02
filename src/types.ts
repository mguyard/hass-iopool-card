// Probe mode (values from sensor.iopool_{slug}_iopool_mode)
export type IopoolMode =
  | 'STANDARD'
  | 'OPENING'
  | 'ACTIVE_WINTER'
  | 'WINTER'
  | 'INITIALIZATION'
  | 'MAINTENANCE';

// Pool filtration mode (values from select.iopool_{slug}_pool_mode)
export type PoolFilterMode = 'Standard' | 'Active-Winter' | 'Passive-Winter';

// Zone type for gauge display (5 zones + unknown for unavailable state)
export type Zone = 'red-low' | 'yellow-low' | 'ok' | 'yellow-high' | 'red-high' | 'unknown';

// Temperature thresholds: 4 transition values defining 5 zones [t0, t1, t2, t3]
// where t0 < t1 < t2 < t3 and zones are: <t0 red, t0-t1 yellow-low, t1-t2 ok, t2-t3 yellow-high, >t3 red
export type TemperatureThresholds = [number, number, number, number];

// HA entity registry entry (minimal interface — no custom-card-helpers dependency)
export interface EntityRegistryEntry {
  entity_id: string;
  device_id: string | null;
  // The integration platform that registered this entity (e.g. "iopool")
  platform: string;
  unique_id: string;
}

// HA device registry entry
export interface DeviceRegistryEntry {
  id: string;
  name: string | null;
  name_by_user: string | null;
  // e.g. [["iopool", "pool-api-id"]]
  identifiers: [string, string][];
  manufacturer: string | null;
  model: string | null;
}

// HA entity state (hass.states[entity_id])
export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
}

// Minimal HomeAssistant interface (avoids dependency on custom-card-helpers)
export interface HomeAssistant {
  language: string;
  locale?: { language: string };
  themes?: { darkMode: boolean };
  states: Record<string, HassEntity>;
  entities: Record<string, EntityRegistryEntry>;
  devices: Record<string, DeviceRegistryEntry>;
  callService(
    domain: string,
    service: string,
    serviceData?: Record<string, unknown>,
  ): Promise<void>;
  callApi<T>(
    method: 'GET' | 'POST',
    path: string,
    parameters?: Record<string, unknown>,
  ): Promise<T>;
}

// Action types (HA standard Lovelace action)
export type ActionType = 'more-info' | 'navigate' | 'url' | 'call-service' | 'toggle' | 'none';

export interface ActionConfig {
  action: ActionType;
  navigation_path?: string;
  url_path?: string;
  service?: string;
  service_data?: Record<string, unknown>;
}

export interface SectionActions {
  tap_action?: ActionConfig;
}

// Main card YAML configuration
export interface IopoolCardConfig {
  type: string;
  device_id: string;
  pump_entity?: string;
  show_chart?: boolean;
  chart_period?: 24 | 48 | 96 | 168;
  temperature_thresholds?: TemperatureThresholds;
  // YAML-only — not exposed in the visual editor (see SPECIFICATIONS §11)
  debug?: boolean;
  section_actions?: {
    temperature?: SectionActions;
    ph?: SectionActions;
    orp?: SectionActions;
    mode?: SectionActions;
    pump?: SectionActions;
    filtration?: SectionActions;
    boost?: SectionActions;
    chart?: SectionActions;
  };
}

// Entity map entry definition
export interface EntityMapEntry {
  // Domain prefix of the entity_id (e.g. "sensor", "binary_sensor", "select")
  platform: string;
  suffixRegex: RegExp;
}

// Keys matching the iopool integration entities (SPECIFICATIONS §5.6)
export type EntityMapKey =
  | 'mode'
  | 'poolMode'
  | 'boostSelector'
  | 'actionRequired'
  | 'filtration'
  | 'elapsedFiltration'
  | 'filtrationRecommendation'
  | 'temperature'
  | 'ph'
  | 'orp';

// Resolved entity_id map for a given device
export interface ResolvedEntities {
  mode?: string;
  poolMode?: string;
  boostSelector?: string;
  actionRequired?: string;
  filtration?: string;
  elapsedFiltration?: string;
  filtrationRecommendation?: string;
  temperature?: string;
  ph?: string;
  orp?: string;
}

// Computed display flags (derived from probe mode + config)
export interface DisplayFlags {
  showTempGauge: boolean;
  showPhGauge: boolean;
  showOrpGauge: boolean;
  maintenanceSensors: Array<'temperature' | 'ph' | 'orp'>;
  showChart: boolean;
  showActionBadge: boolean;
  showMode: boolean;
  showPump: boolean;
  showFiltration: boolean;
  showBoost: boolean;
  isGrayed: boolean;
  warningBanner: 'maintenance' | 'initialization' | 'opening' | null;
  tempGaugeGrayed: boolean;
  phGaugeGrayed: boolean;
  orpGaugeGrayed: boolean;
  chartGrayed: boolean;
}

// Boost countdown status
export interface BoostStatus {
  remainingMs: number;
  totalMs: number;
  pct: number; // 0–100, percentage of remaining time
}

// Temperature chart data point
export interface TemperaturePoint {
  timestamp: string; // ISO 8601 string
  value: number;
}
