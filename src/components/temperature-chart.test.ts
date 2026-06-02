import { beforeEach, describe, expect, it, vi } from 'vitest';
import ApexCharts from 'apexcharts';
import type { HomeAssistant, TemperaturePoint } from '../types';

// vi.mock is hoisted, so this mock is active before any imports resolve
vi.mock('../helpers/history', () => ({
  fetchTemperatureHistory: vi.fn(),
}));

/**
 * Mock ApexCharts — jsdom lacks SVG browser APIs (getTotalLength, etc.).
 * The mock exposes the chart event callbacks so tests can simulate mouseMove/mouseLeave.
 */
vi.mock('apexcharts', () => {
  const MockApexCharts = vi.fn().mockImplementation((_el: unknown, options: unknown) => {
    // Store the options so tests can extract chart event callbacks.
    (MockApexCharts as unknown as { _lastOptions: unknown })._lastOptions = options;
    return {
      render: vi.fn().mockResolvedValue(undefined),
      updateSeries: vi.fn().mockResolvedValue(undefined),
      updateOptions: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn(),
    };
  });
  (MockApexCharts as unknown as { _lastOptions: unknown })._lastOptions = null;
  return { default: MockApexCharts };
});

import './temperature-chart';
import { fetchTemperatureHistory } from '../helpers/history';

type TemperatureChartElement = HTMLElement & {
  updateComplete: Promise<boolean>;
  period?: number;
  hass?: HomeAssistant;
  entityId?: string;
  _hoveredPoint: { x: number; y: number } | null;
  _hoveredDotPos: { x: number; y: number } | null;
  _seriesData: { x: number; y: number }[];
};

type MockApexChartsType = ReturnType<typeof vi.fn> & {
  _lastOptions: {
    chart?: {
      events?: {
        mouseMove?: (event: MouseEvent, chartCtx: unknown, config: unknown) => void;
        mouseLeave?: () => void;
      };
    };
  };
};

type MockInstance = {
  render: ReturnType<typeof vi.fn>;
  updateSeries: ReturnType<typeof vi.fn>;
  updateOptions: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
};

function clearDom(): void {
  document.body.innerHTML = '';
}

beforeEach(() => {
  clearDom();
  vi.mocked(fetchTemperatureHistory).mockResolvedValue([]);
  vi.mocked(ApexCharts).mockClear();
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
  return element as unknown as TemperatureChartElement;
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
  it('creates the ApexCharts instance and calls render on mount', async () => {
    const element = createElement({ hass: createHass(), entityId: 'sensor.pool_temp' });
    await element.updateComplete;
    await flushAsync();

    const MockAC = vi.mocked(ApexCharts);
    expect(MockAC).toHaveBeenCalledTimes(1);
    const instance = MockAC.mock.results[0]?.value as MockInstance;
    expect(instance.render).toHaveBeenCalled();
  });

  it('calls updateSeries after data loads', async () => {
    vi.mocked(fetchTemperatureHistory).mockResolvedValue(makeMockData());
    const element = createElement({ hass: createHass(), entityId: 'sensor.pool_temp' });
    await element.updateComplete;
    await flushAsync();
    await element.updateComplete;

    const instance = vi.mocked(ApexCharts).mock.results[0]?.value as MockInstance;
    expect(instance.updateSeries).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'Temperature', data: expect.any(Array) }),
    ]);
  });

  it('destroys the ApexCharts instance when element is removed', async () => {
    const element = createElement({ hass: createHass(), entityId: 'sensor.pool_temp' });
    await element.updateComplete;
    await flushAsync();

    const instance = vi.mocked(ApexCharts).mock.results[0]?.value as MockInstance;
    element.remove();
    expect(instance.destroy).toHaveBeenCalled();
  });

  it('shows hovered point temperature when _hoveredPoint is set directly', async () => {
    const hass = createHass({
      states: {
        'sensor.pool_temp': {
          entity_id: 'sensor.pool_temp',
          state: '22.5',
          attributes: {},
          last_changed: new Date().toISOString(),
          last_updated: new Date().toISOString(),
        },
      },
    });
    const element = createElement({ hass, entityId: 'sensor.pool_temp' });
    await element.updateComplete;
    await flushAsync();
    await element.updateComplete;

    expect(element.shadowRoot?.textContent).toContain('22.5');
    expect(element._hoveredPoint).toBeNull();

    const pointTimestamp = Date.now() - 3600_000;
    element._hoveredPoint = { x: pointTimestamp, y: 24.0 };
    await element.updateComplete;

    expect(element.shadowRoot?.textContent).toContain('24.0');
    const pointDate = element.shadowRoot?.querySelector('.temperature-chart__point-date');
    expect(pointDate?.textContent?.trim()).not.toBe('');

    element._hoveredPoint = null;
    await element.updateComplete;

    expect(element.shadowRoot?.textContent).toContain('22.5');
    const pointDateAfter = element.shadowRoot?.querySelector('.temperature-chart__point-date');
    expect(pointDateAfter?.textContent?.trim()).toBe('');
  });

  it('mouseMove event callback finds nearest point from mouse X position', async () => {
    vi.mocked(fetchTemperatureHistory).mockResolvedValue(makeMockData());
    const element = createElement({ hass: createHass(), entityId: 'sensor.pool_temp' });
    await element.updateComplete;
    await flushAsync();
    await element.updateComplete;

    const MockAC = vi.mocked(ApexCharts) as unknown as MockApexChartsType;
    const events = MockAC._lastOptions?.chart?.events;
    expect(events?.mouseMove).toBeDefined();

    // jsdom: getBoundingClientRect() returns left=0, so mouseX = clientX - translateX
    // Set clientX=5, translateX=0, gridWidth=200, spanning the full series time range
    const seriesData = element._seriesData;
    expect(seriesData.length).toBeGreaterThan(0);

    const mockChartCtx = {
      w: {
        globals: {
          translateX: 0,
          translateY: 0,
          gridWidth: 200,
          gridHeight: 100,
          minX: seriesData[0]!.x,
          maxX: seriesData[seriesData.length - 1]!.x,
        },
      },
    };

    // clientX=5 → mouseX=5 → xFraction=0.025 → nearest = index 0 in 2D pixel space
    const mockEvent = { clientX: 5, clientY: 50 } as MouseEvent;
    events?.mouseMove?.(mockEvent, mockChartCtx, {});
    await element.updateComplete;

    expect(element._hoveredPoint).not.toBeNull();
    expect(element._hoveredPoint?.y).toBeCloseTo(24.0); // first data point value

    // _hoveredDotPos should also be set (pixel position computed from stored Y range)
    expect(element._hoveredDotPos).not.toBeNull();
  });

  it('mouseLeave event callback clears _hoveredPoint', async () => {
    vi.mocked(fetchTemperatureHistory).mockResolvedValue(makeMockData());
    const element = createElement({ hass: createHass(), entityId: 'sensor.pool_temp' });
    await element.updateComplete;
    await flushAsync();
    await element.updateComplete;

    element._hoveredPoint = { x: Date.now(), y: 25.0 };
    element._hoveredDotPos = { x: 50, y: 30 };
    await element.updateComplete;

    const MockAC = vi.mocked(ApexCharts) as unknown as MockApexChartsType;
    const events = MockAC._lastOptions?.chart?.events;
    events?.mouseLeave?.();
    await element.updateComplete;

    expect(element._hoveredPoint).toBeNull();
    expect(element._hoveredDotPos).toBeNull();
  });

  it('renders 4 period buttons', async () => {
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

  it('renders the ApexCharts container when data is returned', async () => {
    vi.mocked(fetchTemperatureHistory).mockResolvedValue(makeMockData());

    const element = createElement({ hass: createHass(), entityId: 'sensor.pool_temp', period: 96 });
    await element.updateComplete;
    await flushAsync();
    await element.updateComplete;

    // The ApexCharts container div must be present in the shadow DOM.
    const apexWrap = element.shadowRoot?.querySelector('.temperature-chart__apex-wrap');
    expect(apexWrap).toBeTruthy();

    const apexContainer = element.shadowRoot?.querySelector('#apex-chart');
    expect(apexContainer).toBeTruthy();
  });

  it('renders gracefully (no crash) when data is empty', async () => {
    vi.mocked(fetchTemperatureHistory).mockResolvedValue([]);

    const element = createElement({ hass: createHass(), entityId: 'sensor.pool_temp' });
    await element.updateComplete;
    await flushAsync();
    await element.updateComplete;

    // The ApexCharts container must still be present even with no data.
    expect(element.shadowRoot?.querySelector('#apex-chart')).toBeTruthy();
    expect(element.shadowRoot?.querySelector('.temperature-chart__apex-wrap')).toBeTruthy();
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

    // Must not throw; ApexCharts container must still be present.
    expect(element.shadowRoot?.querySelector('#apex-chart')).toBeTruthy();

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

  it('tooltip is disabled in chart options (no native ApexCharts tooltip)', async () => {
    const element = createElement({ hass: createHass(), entityId: 'sensor.pool_temp' });
    await element.updateComplete;

    const opts = vi.mocked(ApexCharts).mock.calls[0]?.[1] as Record<string, unknown>;
    const tooltip = opts?.tooltip as Record<string, unknown> | undefined;
    expect(tooltip?.enabled).toBe(false);
  });

  it('renders the hover dot element when _hoveredPoint and _hoveredDotPos are set', async () => {
    vi.mocked(fetchTemperatureHistory).mockResolvedValue(makeMockData());
    const element = createElement({ hass: createHass(), entityId: 'sensor.pool_temp' });
    await element.updateComplete;
    await flushAsync();
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector('.temperature-chart__hover-dot')).toBeNull();

    element._hoveredPoint = { x: Date.now(), y: 25.0 };
    element._hoveredDotPos = { x: 50, y: 30 };
    await element.updateComplete;

    const dot = element.shadowRoot?.querySelector('.temperature-chart__hover-dot');
    expect(dot).not.toBeNull();
    const style = (dot as HTMLElement).style;
    expect(style.left).toBe('50px');
    expect(style.top).toBe('30px');

    element._hoveredPoint = null;
    element._hoveredDotPos = null;
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector('.temperature-chart__hover-dot')).toBeNull();
  });
});
