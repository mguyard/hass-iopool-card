import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HomeAssistant, TemperaturePoint } from '../types';

// vi.mock is hoisted, so this mock is active before any imports resolve
vi.mock('../helpers/history', () => ({
  fetchTemperatureHistory: vi.fn(),
}));

import './temperature-chart';
import { fetchTemperatureHistory } from '../helpers/history';

type TemperatureChartElement = HTMLElement & {
  updateComplete: Promise<boolean>;
  period?: number;
  hass?: HomeAssistant;
  entityId?: string;
};

function clearDom(): void {
  document.body.innerHTML = '';
}

beforeEach(() => {
  clearDom();
  vi.mocked(fetchTemperatureHistory).mockResolvedValue([]);
});

function createHass(overrides: Partial<HomeAssistant> = {}): HomeAssistant {
  return {
    language: 'en',
    states: {},
    entities: {},
    devices: {},
    callService: vi.fn(),
    callApi: vi.fn(),
    ...overrides,
  };
}

function createElement(overrides: Record<string, unknown> = {}): TemperatureChartElement {
  const element = document.createElement('iopool-temperature-chart');
  Object.assign(element, overrides);
  document.body.append(element);
  return element as TemperatureChartElement;
}

/** Flush all pending promises / microtasks (allows mocked async fns to resolve). */
async function flushAsync(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

// ─── Sample data ──────────────────────────────────────────────────────────────

function makeMockData(): TemperaturePoint[] {
  const base = Date.now() - 90 * 60 * 1000; // 90 min ago
  return [
    { timestamp: new Date(base).toISOString(), value: 24.0 },
    { timestamp: new Date(base + 30 * 60 * 1000).toISOString(), value: 25.5 },
    { timestamp: new Date(base + 60 * 60 * 1000).toISOString(), value: 26.8 },
    { timestamp: new Date(base + 90 * 60 * 1000).toISOString(), value: 26.2 },
  ];
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('iopool-temperature-chart', () => {
  it('renders all 4 period buttons (24h, 48h, 96h, 7d)', async () => {
    const element = createElement({ hass: createHass(), entityId: 'sensor.pool_temp' });
    await element.updateComplete;

    const buttons = element.shadowRoot?.querySelectorAll('.temperature-chart__period-btn');
    expect(buttons?.length).toBe(4);

    // Verify data-period attributes are present
    const periods = Array.from(buttons ?? []).map((b) => b.getAttribute('data-period'));
    expect(periods).toContain('24');
    expect(periods).toContain('48');
    expect(periods).toContain('96');
    expect(periods).toContain('168');
  });

  it('marks the active period button with the active class', async () => {
    const element = createElement({ hass: createHass(), entityId: 'sensor.pool_temp', period: 48 });
    await element.updateComplete;

    const activeBtn = element.shadowRoot?.querySelector('.temperature-chart__period-btn--active');
    expect(activeBtn?.getAttribute('data-period')).toBe('48');
  });

  it('calls fetchTemperatureHistory when entityId is set', async () => {
    createElement({ hass: createHass(), entityId: 'sensor.pool_temperature', period: 96 });
    await flushAsync();

    expect(vi.mocked(fetchTemperatureHistory)).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'en' }),
      'sensor.pool_temperature',
      96,
    );
  });

  it('calls fetchTemperatureHistory again when period changes', async () => {
    const element = createElement({ hass: createHass(), entityId: 'sensor.pool_temp', period: 96 });
    await element.updateComplete;
    await flushAsync();
    await element.updateComplete;

    const callsBefore = vi.mocked(fetchTemperatureHistory).mock.calls.length;

    // Change period
    element.period = 24;
    await element.updateComplete;
    await flushAsync();
    await element.updateComplete;

    expect(vi.mocked(fetchTemperatureHistory).mock.calls.length).toBeGreaterThan(callsBefore);
    const lastCall = vi.mocked(fetchTemperatureHistory).mock.lastCall;
    expect(lastCall?.[2]).toBe(24);
  });

  it('renders the SVG chart area when data is returned', async () => {
    vi.mocked(fetchTemperatureHistory).mockResolvedValue(makeMockData());

    const element = createElement({ hass: createHass(), entityId: 'sensor.pool_temp', period: 96 });
    await element.updateComplete;
    await flushAsync();
    await element.updateComplete;

    const svg = element.shadowRoot?.querySelector('svg.chart-svg');
    expect(svg).toBeTruthy();

    const areaPath = element.shadowRoot?.querySelector('.chart-area');
    const linePath = element.shadowRoot?.querySelector('.chart-line');
    expect(areaPath).toBeTruthy();
    expect(linePath).toBeTruthy();
  });

  it('renders gracefully (no crash) when data is empty', async () => {
    vi.mocked(fetchTemperatureHistory).mockResolvedValue([]);

    const element = createElement({ hass: createHass(), entityId: 'sensor.pool_temp' });
    await element.updateComplete;
    await flushAsync();
    await element.updateComplete;

    // SVG must still be present
    expect(element.shadowRoot?.querySelector('svg.chart-svg')).toBeTruthy();
    // No area/line paths (nothing to draw)
    expect(element.shadowRoot?.querySelector('.chart-area')).toBeNull();
    expect(element.shadowRoot?.querySelector('.chart-line')).toBeNull();
  });

  it('shows min, avg, max stats in the stats bar', async () => {
    vi.mocked(fetchTemperatureHistory).mockResolvedValue(makeMockData());

    const element = createElement({ hass: createHass(), entityId: 'sensor.pool_temp' });
    await element.updateComplete;
    await flushAsync();
    await element.updateComplete;

    const stats = element.shadowRoot?.querySelector('.chart-stats');
    expect(stats).toBeTruthy();

    // All three stat blocks present
    const statBlocks = stats?.querySelectorAll('.stat');
    expect(statBlocks?.length).toBe(3);

    // Values must NOT show placeholder dashes when data is loaded
    const statValues = Array.from(stats?.querySelectorAll('.stat__value') ?? []).map(
      (el) => el.textContent?.trim() ?? '',
    );
    expect(statValues.every((v) => v !== '--')).toBe(true);
  });

  it('shows "--" for min, avg, and max when data is empty', async () => {
    vi.mocked(fetchTemperatureHistory).mockResolvedValue([]);

    const element = createElement({ hass: createHass(), entityId: 'sensor.pool_temp' });
    await element.updateComplete;
    await flushAsync();
    await element.updateComplete;

    const statValues = Array.from(element.shadowRoot?.querySelectorAll('.stat__value') ?? []).map(
      (el) => el.textContent?.trim() ?? '',
    );

    // min and max show '--', avg shows '--'
    expect(statValues.filter((v) => v === '--').length).toBe(3);
  });

  it('dispatches a "period-change" CustomEvent when a period button is clicked', async () => {
    const element = createElement({ hass: createHass(), entityId: 'sensor.pool_temp', period: 96 });
    await element.updateComplete;

    const events: CustomEvent[] = [];
    element.addEventListener('period-change', (e) => events.push(e as CustomEvent));

    const btn24 = element.shadowRoot?.querySelector(
      '[data-period="24"]',
    ) as HTMLButtonElement | null;
    btn24?.click();

    await element.updateComplete;

    expect(events).toHaveLength(1);
    expect(events[0]!.detail).toBe(24);
  });

  it('handles a fetch error gracefully and shows empty chart', async () => {
    vi.mocked(fetchTemperatureHistory).mockRejectedValue(new Error('Network error'));

    const element = createElement({ hass: createHass(), entityId: 'sensor.pool_temp' });
    await element.updateComplete;
    await flushAsync();
    await element.updateComplete;

    // Must not throw; SVG must still render
    expect(element.shadowRoot?.querySelector('svg.chart-svg')).toBeTruthy();

    // Data should be treated as empty → stat values show '--'
    const statValues = Array.from(element.shadowRoot?.querySelectorAll('.stat__value') ?? []).map(
      (el) => el.textContent?.trim() ?? '',
    );
    expect(statValues.filter((v) => v === '--').length).toBe(3);
  });

  it('does not reload data when hass is updated after initial load', async () => {
    const hass = createHass();
    const element = createElement({ hass, entityId: 'sensor.pool_temp', period: 96 });
    await element.updateComplete;
    await flushAsync();
    await element.updateComplete;

    const callsAfterInit = vi.mocked(fetchTemperatureHistory).mock.calls.length;

    // Simulate hass update (e.g., a state changed in HA) — should NOT trigger reload
    element.hass = { ...hass };
    await element.updateComplete;
    await flushAsync();
    await element.updateComplete;

    expect(vi.mocked(fetchTemperatureHistory).mock.calls.length).toBe(callsAfterInit);
  });
});
