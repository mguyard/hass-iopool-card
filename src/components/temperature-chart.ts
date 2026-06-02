import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import ApexCharts from 'apexcharts';
import { fetchTemperatureHistory } from '../helpers/history';
import { DebugLogger } from '../helpers/debug';
import { valueToZone, zoneToColor } from '../helpers/zone';
import en from '../locales/en.json';
import fr from '../locales/fr.json';
import { sharedStyles } from '../styles';
import type { HomeAssistant, TemperatureThresholds, TemperaturePoint } from '../types';
import { CHART_PERIODS, DEFAULT_POOL_THRESHOLDS } from '../const';

// ─── Types ────────────────────────────────────────────────────────────────────

type ChartPeriod = (typeof CHART_PERIODS)[number];

/** Data point format expected by ApexCharts datetime x-axis. */
type SeriesPoint = { x: number; y: number };

/**
 * Matches ApexColorStop from apexcharts types.
 * Defined locally because ApexColorStop is not exported from the ApexCharts namespace.
 */
type ColorStop = { offset: number; color: string; opacity: number };

// ─── i18n ─────────────────────────────────────────────────────────────────────

const LOCALES: Record<string, Record<string, unknown>> = {
  en: en as Record<string, unknown>,
  fr: fr as Record<string, unknown>,
};

function t(language: string, key: string): string {
  const locale = LOCALES[language] ?? LOCALES['en'];
  const value = key.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[segment];
  }, locale);
  return typeof value === 'string' ? value : key;
}

const PERIOD_I18N_KEY: Record<number, string> = {
  24: 'chart.period_24h',
  48: 'chart.period_48h',
  96: 'chart.period_96h',
  168: 'chart.period_7d',
};

// ─── Component ────────────────────────────────────────────────────────────────

@customElement('iopool-temperature-chart')
export class IopoolTemperatureChart extends LitElement {
  @property() entityId?: string;

  @property({ attribute: false }) hass?: HomeAssistant;

  @property({ type: Number }) period: ChartPeriod = 96;

  @property() language: string = 'en';

  /**
   * Resolved temperature thresholds used to compute gradient colorStops.
   * Defaults to DEFAULT_POOL_THRESHOLDS when the parent does not pass this prop.
   */
  @property({ attribute: false }) thresholds: TemperatureThresholds = DEFAULT_POOL_THRESHOLDS;

  @state() private _seriesData: SeriesPoint[] = [];

  /**
   * Non-null while the user hovers a data point via ApexCharts mouse events.
   * When non-null, the current temperature display shows this value instead of the live hass state.
   */
  @state() private _hoveredPoint: SeriesPoint | null = null;

  @state() private _hoveredDotPos: { x: number; y: number } | null = null;

  private _chart: ApexCharts | null = null;

  /** Stale-response guard: incremented on every _loadData() call. */
  private _requestId = 0;

  /** Current axis Y bounds — updated on every _pushToChart() call. Used by the mouseMove handler. */
  private _currentYMin: number = 18;
  private _currentYMax: number = 34;

  private _logger = new DebugLogger(false);

  // ─── Stats (computed from _seriesData) ──────────────────────────────────────

  private get _stats(): {
    min: SeriesPoint | null;
    max: SeriesPoint | null;
    avg: number | null;
  } {
    if (this._seriesData.length === 0) return { min: null, max: null, avg: null };

    let minPoint = this._seriesData[0]!;
    let maxPoint = this._seriesData[0]!;
    let sum = 0;

    for (const p of this._seriesData) {
      if (p.y < minPoint.y) minPoint = p;
      if (p.y > maxPoint.y) maxPoint = p;
      sum += p.y;
    }

    return { min: minPoint, max: maxPoint, avg: sum / this._seriesData.length };
  }

  // ─── LitElement lifecycle ────────────────────────────────────────────────────

  protected override firstUpdated(): void {
    this._initChart();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this._initChart();
    void this._loadData();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._chart?.destroy();
    this._chart = null;
    this._hoveredPoint = null;
    this._hoveredDotPos = null;
  }

  override updated(changedProps: Map<string, unknown>): void {
    const shouldReload =
      changedProps.has('entityId') ||
      changedProps.has('period') ||
      // Only reload on the first hass assignment, not on every HA state update.
      (changedProps.has('hass') &&
        changedProps.get('hass') === undefined &&
        this.hass !== undefined);

    if (shouldReload) {
      void this._loadData();
    } else if (changedProps.has('thresholds') && this._chart) {
      const { yMin, yMax } = this._getYRange();
      void this._chart
        .updateOptions({
          fill: { gradient: { colorStops: this._computeColorStops(yMin, yMax) } },
        })
        .catch((err: unknown) => {
          this._logger.error('chart', 'updateOptions (thresholds) error:', err);
        });
    }
  }

  private async _loadData(): Promise<void> {
    if (!this.hass || !this.entityId) return;
    const requestId = ++this._requestId;
    try {
      const raw = await fetchTemperatureHistory(this.hass, this.entityId, this.period);
      if (requestId !== this._requestId) return; // stale response — discard
      this._seriesData = raw.map((p: TemperaturePoint) => ({
        x: new Date(p.timestamp).getTime(),
        y: p.value,
      }));
    } catch {
      if (requestId !== this._requestId) return;
      this._seriesData = [];
    }
    this._pushToChart();
  }

  // ─── Chart initialization ────────────────────────────────────────────────────

  /**
   * Creates and renders the ApexCharts instance into the shadow DOM container.
   * Called once from firstUpdated() after the shadow root is ready.
   * Must not be called again while a chart instance already exists.
   */
  private _initChart(): void {
    const container = this.shadowRoot?.querySelector<HTMLElement>('#apex-chart');
    if (!container || this._chart) return;
    this._chart = new ApexCharts(container, {
      ...this._buildChartOptions(),
      series: [{ name: 'Temperature', data: [] }],
    });
    void this._chart.render();
  }

  /**
   * Pushes the current _seriesData into the ApexCharts instance.
   * Updates both axis bounds (yMin/yMax), gradient colorStops, and series data.
   */
  private _pushToChart(): void {
    if (!this._chart) return;
    const { yMin, yMax } = this._getYRange();
    this._currentYMin = yMin;
    this._currentYMax = yMax;
    void this._chart
      .updateOptions(
        {
          fill: { gradient: { colorStops: this._computeColorStops(yMin, yMax) } },
          yaxis: {
            show: false,
            min: yMin,
            max: yMax,
          },
        },
        false,
        false,
      )
      .catch((err: unknown) => {
        this._logger.error('chart', 'updateOptions (push) error:', err);
      });
    void this._chart
      .updateSeries([{ name: 'Temperature', data: this._seriesData }])
      .catch((err: unknown) => {
        this._logger.error('chart', 'updateSeries error:', err);
      });
  }

  // ─── Y-range ─────────────────────────────────────────────────────────────────

  private _getYRange(): { yMin: number; yMax: number } {
    const values = this._seriesData.map((p) => p.y);
    if (values.length === 0) return { yMin: 18, yMax: 34 };
    const min = Math.min(...values);
    const max = Math.max(...values);
    return { yMin: min - 0.5, yMax: max + 0.5 };
  }

  // ─── Gradient colorStops ──────────────────────────────────────────────────────

  /**
   * Builds ApexCharts vertical gradient colorStops from temperature threshold zones.
   *
   * In ApexCharts vertical gradients: offset 0% = top of chart (yMax), offset 100% = bottom (yMin).
   * One stop per threshold boundary produces a smooth gradient line without visual duplication.
   */
  private _computeColorStops(yMin: number, yMax: number): ColorStop[] {
    const range = yMax - yMin;
    const getColor = (v: number): string => zoneToColor(valueToZone(v, this.thresholds));

    if (range < 0.01) {
      const color = getColor(yMin);
      return [
        { offset: 0, color, opacity: 1 },
        { offset: 100, color, opacity: 1 },
      ];
    }

    // offset 0% = top of chart (yMax), offset 100% = bottom of chart (yMin)
    const toOffset = (v: number): number =>
      Math.max(0, Math.min(100, (1 - (v - yMin) / range) * 100));

    const stops: ColorStop[] = [];
    stops.push({ offset: 0, color: getColor(yMax), opacity: 1 });

    // Transition band: ±0.5 °C around each threshold in temperature space.
    // This gives a 1 °C wide interpolation zone — wide enough to avoid the "kink" artifact
    // that occurs when two stops are at nearly identical offsets, yet narrow enough that
    // values 0.9 °C below a threshold already read as the correct lower zone color.
    const halfBand = 0.5; // °C
    const boundaries = [...this.thresholds].sort((a, b) => b - a);
    for (const threshold of boundaries) {
      if (threshold > yMin && threshold < yMax) {
        const tAbove = threshold + halfBand;
        const tBelow = threshold - halfBand;
        // Stop in the warmer zone (above threshold)
        stops.push({ offset: toOffset(tAbove), color: getColor(tAbove), opacity: 1 });
        // Stop in the cooler zone (below threshold)
        stops.push({ offset: toOffset(tBelow), color: getColor(tBelow), opacity: 1 });
      }
    }

    stops.push({ offset: 100, color: getColor(yMin), opacity: 1 });
    return stops.sort((a, b) => a.offset - b.offset);
  }

  // ─── Chart options ───────────────────────────────────────────────────────────

  private _buildChartOptions(): ApexCharts.ApexOptions {
    const { yMin, yMax } = this._getYRange();
    return {
      chart: {
        type: 'line',
        height: 95,
        width: '100%',
        toolbar: { show: false },
        zoom: { enabled: false },
        animations: { enabled: true, speed: 300 },
        background: 'transparent',
        fontFamily: 'inherit',
        sparkline: { enabled: true },
        events: {
          /**
           * mouseMove fires on every mouse movement over the SVG canvas — independent of tooltip.
           * Uses ApexCharts internal globals to compute the nearest data point from mouse X position.
           * Direct @state() assignment triggers Lit requestUpdate() automatically.
           */
          mouseMove: (event: MouseEvent, chartCtx: unknown) => {
            if (this._seriesData.length === 0) {
              if (this._hoveredPoint !== null) this._hoveredPoint = null;
              if (this._hoveredDotPos !== null) this._hoveredDotPos = null;
              return;
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const globals = (chartCtx as any)?.w?.globals as
              | {
                  translateX?: number;
                  translateY?: number;
                  gridWidth?: number;
                  gridHeight?: number;
                  minX?: number;
                  maxX?: number;
                }
              | undefined;

            if (
              !globals ||
              !globals.gridWidth ||
              globals.gridWidth <= 0 ||
              globals.minX === undefined ||
              globals.maxX === undefined ||
              globals.maxX === globals.minX
            ) {
              if (this._hoveredPoint !== null) this._hoveredPoint = null;
              if (this._hoveredDotPos !== null) this._hoveredDotPos = null;
              return;
            }

            const chartContainer = this.shadowRoot?.querySelector<HTMLElement>('#apex-chart');
            if (!chartContainer) {
              if (this._hoveredPoint !== null) this._hoveredPoint = null;
              if (this._hoveredDotPos !== null) this._hoveredDotPos = null;
              return;
            }

            const rect = chartContainer.getBoundingClientRect();
            const translateX = globals.translateX ?? 0;
            const translateY = globals.translateY ?? 0;
            const gridWidth = globals.gridWidth;
            const gridHeight = globals.gridHeight ?? 0;
            const minX = globals.minX;
            const maxX = globals.maxX;
            const yMin = this._currentYMin;
            const yMax = this._currentYMax;
            const yRange = yMax - yMin;

            // Mouse position relative to the chart plot area origin
            const mouseX = event.clientX - rect.left - translateX;
            const mouseY = event.clientY - rect.top - translateY;

            // Find nearest data point by 2D Euclidean pixel-space distance.
            // This allows hovering over outlier spikes by moving the cursor toward
            // the spike tip, rather than requiring exact X timestamp positioning.
            let nearestIdx = 0;
            let minDist2 = Infinity;
            for (let i = 0; i < this._seriesData.length; i++) {
              const p = this._seriesData[i]!;
              const px = ((p.x - minX) / (maxX - minX)) * gridWidth;
              const py = yRange > 0 ? (1 - (p.y - yMin) / yRange) * gridHeight : 0;
              const dx = mouseX - px;
              const dy = mouseY - py;
              const dist2 = dx * dx + dy * dy;
              if (dist2 < minDist2) {
                minDist2 = dist2;
                nearestIdx = i;
              }
            }

            const nearest = this._seriesData[nearestIdx];
            if (nearest) {
              if (this._hoveredPoint?.x !== nearest.x) {
                this._hoveredPoint = nearest;
              }
              // Compute dot pixel position using stored Y range (not globals.minY/maxY which may differ)
              const pixelX = translateX + ((nearest.x - minX) / (maxX - minX)) * gridWidth;
              const pixelY =
                yRange > 0
                  ? translateY + (1 - (nearest.y - yMin) / yRange) * gridHeight
                  : translateY;
              if (this._hoveredDotPos?.x !== pixelX || this._hoveredDotPos?.y !== pixelY) {
                this._hoveredDotPos = { x: pixelX, y: pixelY };
              }
            }
          },
          mouseLeave: () => {
            if (this._hoveredPoint !== null) this._hoveredPoint = null;
            if (this._hoveredDotPos !== null) this._hoveredDotPos = null;
          },
        },
      },
      xaxis: {
        type: 'datetime',
        axisBorder: { show: false },
        axisTicks: { show: false },
        crosshairs: { show: false },
        labels: { show: false },
        tooltip: { enabled: false },
      },
      yaxis: {
        show: false,
        min: yMin,
        max: yMax,
      },
      grid: {
        show: false,
      },
      // No permanent markers — custom hover dot rendered via Lit overlay
      markers: { size: 0 },
      // Native ApexCharts tooltip DISABLED — we display value/date in the card header ourselves.
      // tooltip: false avoids the Shadow DOM bug where ApexCharts injects the tooltip into
      // document.body and it appears at the wrong screen position outside the shadow root.
      tooltip: { enabled: false },
      dataLabels: { enabled: false },
      legend: { show: false },
      stroke: {
        curve: 'smooth',
        width: 6,
        lineCap: 'round',
      },
      fill: {
        type: 'gradient',
        gradient: {
          type: 'vertical',
          colorStops: this._computeColorStops(yMin, yMax),
        },
      },
    };
  }

  // ─── Formatting helpers ──────────────────────────────────────────────────────

  private _formatNum(value: number): string {
    return new Intl.NumberFormat(this.language, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value);
  }

  private _formatStatDate(timestampMs: number): string {
    const date = new Date(timestampMs);
    if (isNaN(date.getTime())) return '';
    const datePart = date.toLocaleDateString(this.language, { weekday: 'short', day: 'numeric' });
    const timePart = date.toLocaleTimeString(this.language, { hour: '2-digit', minute: '2-digit' });
    return `${datePart} · ${timePart}`;
  }

  /** Formats a data point timestamp as "jeu. 28 16:00" for display below the hovered temperature. */
  private _formatPointDate(timestampMs: number): string {
    const date = new Date(timestampMs);
    if (isNaN(date.getTime())) return '';
    const datePart = date.toLocaleDateString(this.language, { weekday: 'short', day: 'numeric' });
    const timePart = date.toLocaleTimeString(this.language, { hour: '2-digit', minute: '2-digit' });
    return `${datePart} ${timePart}`;
  }

  // ─── Period selector ─────────────────────────────────────────────────────────

  private _handlePeriodChange(period: ChartPeriod): void {
    if (this.period === period) return;
    this.period = period;
    this.dispatchEvent(
      new CustomEvent('period-change', { detail: period, bubbles: true, composed: true }),
    );
  }

  // ─── Styles ──────────────────────────────────────────────────────────────────

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }

      .temperature-chart {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 8px 16px 8px;
        border-radius: 18px;
        background: var(--iopool-surface);
        overflow: hidden;
      }

      .temperature-chart__header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 8px;
      }

      .temperature-chart__title {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--secondary-text-color);
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .temperature-chart__title ha-icon {
        --mdc-icon-size: 14px;
        color: var(--iopool-primary);
      }

      .temperature-chart__current {
        font-size: 26px;
        font-weight: 800;
        letter-spacing: -0.03em;
        margin-top: 2px;
        color: var(--primary-text-color);
      }

      .temperature-chart__current-unit {
        font-size: 13px;
        opacity: 0.65;
        font-weight: 600;
        margin-left: 2px;
      }

      .temperature-chart__point-date {
        font-size: 11px;
        color: var(--secondary-text-color);
        font-weight: 500;
        margin-top: 2px;
        letter-spacing: 0;
        min-height: 15px; /* reserve space to prevent layout shift */
      }

      .temperature-chart__period-toggle {
        display: flex;
        gap: 2px;
        background: var(--iopool-surface-strong);
        padding: 2px;
        border-radius: 8px;
        flex-shrink: 0;
      }

      .temperature-chart__period-btn {
        border: none;
        background: transparent;
        color: var(--secondary-text-color);
        font-size: 10px;
        font-weight: 700;
        padding: 4px 8px;
        border-radius: 6px;
        cursor: pointer;
        font-family: inherit;
        transition:
          background 0.15s,
          color 0.15s;
      }

      .temperature-chart__period-btn--active {
        background: var(--card-background-color, #fff);
        color: var(--iopool-primary);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      }

      /* ApexCharts container */
      .temperature-chart__apex-wrap {
        position: relative;
        height: 95px;
        margin: 0 -16px;
        overflow: hidden;
      }

      #apex-chart {
        width: 100%;
        height: 100%;
      }

      /* ApexCharts injects additional styles into document.head — toolbar/zoom are disabled via options */
      .apexcharts-toolbar {
        display: none !important;
      }

      .temperature-chart__hover-dot {
        position: absolute;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
        transform: translate(-50%, -50%);
        pointer-events: none;
        z-index: 10;
      }

      /* Stats row */
      .chart-stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 6px;
        padding-top: 10px;
        border-top: 1px solid var(--divider-color, var(--iopool-divider));
      }

      .stat {
        text-align: center;
      }

      .stat__label {
        font-size: 9px;
        color: var(--secondary-text-color);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        font-weight: 700;
      }

      .stat__value {
        font-size: 13px;
        font-weight: 800;
        margin-top: 2px;
        letter-spacing: -0.01em;
        color: var(--primary-text-color);
      }

      .stat__date {
        font-size: 9px;
        color: var(--secondary-text-color);
        font-weight: 500;
        margin-top: 1px;
      }
    `,
  ];

  // ─── Render ──────────────────────────────────────────────────────────────────

  override render() {
    // Current temperature: hovered point value (from ApexCharts events) or live hass.states value.
    const liveTemp =
      this.entityId && this.hass?.states[this.entityId]
        ? parseFloat(this.hass.states[this.entityId]!.state)
        : null;
    const displayTemp = this._hoveredPoint?.y ?? liveTemp;
    const displayTempStr =
      displayTemp !== null && !isNaN(displayTemp) ? this._formatNum(displayTemp) : '--';

    const stats = this._stats;
    const periodKey = PERIOD_I18N_KEY[this.period] ?? 'chart.period_96h';

    return html`
      <div class="temperature-chart">
        <!-- Header: title + current temperature + period toggle -->
        <div class="temperature-chart__header">
          <div>
            <div class="temperature-chart__title">
              <ha-icon icon="mdi:coolant-temperature"></ha-icon>
              ${t(this.language, 'chart.temperature')}
            </div>
            <div class="temperature-chart__current">
              ${displayTempStr}<span class="temperature-chart__current-unit">°C</span>
            </div>
            <!-- Point date shown only while hovering; empty slot keeps layout stable otherwise -->
            <div class="temperature-chart__point-date">
              ${this._hoveredPoint !== null ? this._formatPointDate(this._hoveredPoint.x) : nothing}
            </div>
          </div>

          <div class="temperature-chart__period-toggle">
            ${CHART_PERIODS.map(
              (p) => html`
                <button
                  class="temperature-chart__period-btn ${this.period === p
                    ? 'temperature-chart__period-btn--active'
                    : ''}"
                  data-period="${p}"
                  @click=${() => this._handlePeriodChange(p)}
                >
                  ${t(this.language, PERIOD_I18N_KEY[p] ?? '')}
                </button>
              `,
            )}
          </div>
        </div>

        <!-- ApexCharts container — chart instance is mounted here via firstUpdated() -->
        <div class="temperature-chart__apex-wrap">
          <div id="apex-chart"></div>
          ${this._hoveredPoint !== null && this._hoveredDotPos !== null
            ? html`<div
                class="temperature-chart__hover-dot"
                style="left:${this._hoveredDotPos.x}px;top:${this._hoveredDotPos
                  .y}px;background:${zoneToColor(
                  valueToZone(this._hoveredPoint.y, this.thresholds),
                )}"
              ></div>`
            : nothing}
        </div>

        <!-- Stats row: min / avg / max for the selected period -->
        <div class="chart-stats">
          <div class="stat">
            <div class="stat__label">${t(this.language, 'chart.min')}</div>
            <div class="stat__value">
              ${stats.min !== null ? `${this._formatNum(stats.min.y)}°C` : '--'}
            </div>
            <div class="stat__date">
              ${stats.min !== null ? this._formatStatDate(stats.min.x) : ''}
            </div>
          </div>

          <div class="stat">
            <div class="stat__label">${t(this.language, 'chart.avg')}</div>
            <div class="stat__value">
              ${stats.avg !== null ? `${this._formatNum(stats.avg)}°C` : '--'}
            </div>
            <div class="stat__date">${t(this.language, periodKey)}</div>
          </div>

          <div class="stat">
            <div class="stat__label">${t(this.language, 'chart.max')}</div>
            <div class="stat__value">
              ${stats.max !== null ? `${this._formatNum(stats.max.y)}°C` : '--'}
            </div>
            <div class="stat__date">
              ${stats.max !== null ? this._formatStatDate(stats.max.x) : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'iopool-temperature-chart': IopoolTemperatureChart;
  }
}
