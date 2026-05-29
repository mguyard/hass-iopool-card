import type { EntityMapEntry, EntityMapKey, TemperatureThresholds } from './types';

// IMPORTANT: __CARD_VERSION__ is replaced at build time by Rollup @rollup/plugin-replace
export const CARD_VERSION: string = '__CARD_VERSION__';
export const CARD_TYPE = 'iopool-card';
export const CARD_NAME = 'iopool Card';

// Default temperature thresholds [t0, t1, t2, t3] — pool preset (SPECIFICATIONS §6.3.1)
export const DEFAULT_POOL_THRESHOLDS: TemperatureThresholds = [15, 20.5, 29, 32];
// Spa preset — higher comfort range
export const DEFAULT_SPA_THRESHOLDS: TemperatureThresholds = [28, 32, 36, 38];

// Fixed pH thresholds [t0, t1, t2, t3] — not customizable in v1 (SPECIFICATIONS §6.3.1)
export const PH_THRESHOLDS: TemperatureThresholds = [6.8, 7.1, 7.7, 8.1];
// Fixed ORP thresholds [t0, t1, t2, t3] — not customizable in v1 (SPECIFICATIONS §6.3.1)
export const ORP_THRESHOLDS: TemperatureThresholds = [550, 650, 800, 1000];

// Default chart display period in hours
export const DEFAULT_CHART_PERIOD = 96;

// Entity map — maps logical roles to iopool integration entity suffixes (SPECIFICATIONS §5.6)
// EntityMapEntry.platform is the entity domain prefix (sensor, binary_sensor, select)
export const ENTITY_MAP: Record<EntityMapKey, EntityMapEntry> = {
  mode: { platform: 'sensor', suffixRegex: /_iopool_mode$/ },
  poolMode: { platform: 'select', suffixRegex: /_pool_mode$/ },
  boostSelector: { platform: 'select', suffixRegex: /_boost_selector$/ },
  actionRequired: { platform: 'binary_sensor', suffixRegex: /_action_required$/ },
  filtration: { platform: 'binary_sensor', suffixRegex: /_filtration$/ },
  elapsedFiltration: { platform: 'sensor', suffixRegex: /_elapsed_filtration_duration$/ },
  filtrationRecommendation: { platform: 'sensor', suffixRegex: /_filtration_recommendation$/ },
  temperature: { platform: 'sensor', suffixRegex: /_temperature$/ },
  ph: { platform: 'sensor', suffixRegex: /_ph$/ },
  orp: { platform: 'sensor', suffixRegex: /_orp$/ },
};

// Boost duration options (values as sent to / received from the iopool select entity)
export const BOOST_OPTIONS = ['None', '1H', '2H', '4H', '8H', '24H'] as const;
export type BoostOption = (typeof BOOST_OPTIONS)[number];

// Valid chart period values (in hours)
export const CHART_PERIODS = [24, 48, 96, 168] as const;
export type ChartPeriod = (typeof CHART_PERIODS)[number];

// iopool brand color palette (SPECIFICATIONS §7.1)
export const BRAND_COLORS = {
  primary: '#17817A',
  primaryDark: '#0f5d57',
  eco: '#43D1CD',
  sharing: '#4BCFFA',
  treatments: '#42BDAA',
  green: '#7ED321',
  orange: '#F5A623',
  red: '#D0021B',
} as const;
