import { LitElement, css, html, nothing, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { fetchTemperatureHistory } from '../helpers/history';
import en from '../locales/en.json';
import fr from '../locales/fr.json';
import { sharedStyles } from '../styles';
import type { HomeAssistant, TemperaturePoint } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const LOCALES: Record<string, Record<string, unknown>> = {
  en: en as Record<string, unknown>,
  fr: fr as Record<string, unknown>,
};

function t(language: string, key: string): string {
  const locale = LOCALES[language] ?? LOCALES.en;
  const value = key.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object') {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, locale);
  return typeof value === 'string' ? value : key;
}

// SVG coordinate system constants
const SVG_W = 400;
const SVG_H = 130;
const MARGIN_L = 30; // left — Y-axis labels
const MARGIN_R = 4;
const MARGIN_T = 12; // top padding
const MARGIN_B = 22; // bottom — X-axis labels
const CX1 = MARGIN_L; // chart area left x
const CX2 = SVG_W - MARGIN_R; // chart area right x
const CY1 = MARGIN_T; // chart area top y
const CY2 = SVG_H - MARGIN_B; // chart area bottom y

// Valid period values in hours
const CHART_PERIOD_VALUES = [24, 48, 96, 168] as const;
type ChartPeriod = (typeof CHART_PERIOD_VALUES)[number];

const PERIOD_I18N_KEY: Record<number, string> = {
  24: 'chart.period_24h',
  48: 'chart.period_48h',
  96: 'chart.period_96h',
  168: 'chart.period_7d',
};

// ─── Pure SVG path helpers ────────────────────────────────────────────────────

/**
 * Generates a smooth cubic-bezier SVG path through the given points.
 * Uses mid-point control handles for a natural curve.
 */
function smoothLinePath(pts: Array<[number, number]>): string {
  if (pts.length === 0) return '';
  const firstPoint = pts[0];
  if (!firstPoint) return '';
  if (pts.length === 1) return `M${firstPoint[0].toFixed(1)},${firstPoint[1].toFixed(1)}`;

  let d = `M${firstPoint[0].toFixed(1)},${firstPoint[1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const previousPoint = pts[i - 1];
    const currentPoint = pts[i];
    if (!previousPoint || !currentPoint) {
      continue;
    }
    const [x0, y0] = previousPoint;
    const [x1, y1] = currentPoint;
    const cpx = ((x0 + x1) / 2).toFixed(1);
    d += ` C${cpx},${y0.toFixed(1)} ${cpx},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  return d;
}

/**
 * Generates a closed area path that fills below the smooth line to the given yBottom.
 */
function smoothAreaPath(pts: Array<[number, number]>, yBottom: number): string {
  if (pts.length < 2) return '';
  const line = smoothLinePath(pts);
  const last = pts[pts.length - 1];
  const first = pts[0];
  if (!first || !last) return '';
  return `${line} L${last[0].toFixed(1)},${yBottom} L${first[0].toFixed(1)},${yBottom}Z`;
}

// ─── Component ────────────────────────────────────────────────────────────────

@customElement('iopool-temperature-chart')
export class IopoolTemperatureChart extends LitElement {
  @property() entityId?: string;

  @property({ attribute: false }) hass?: HomeAssistant;

  @property({ type: Number }) period: ChartPeriod = 96;

  @property() language: string = 'en';

  @state() private _data: TemperaturePoint[] = [];

  @state() private _hoverX: number | null = null;

  @state() private _tooltip: { value: number; timestamp: string } | null = null;

  // Unique gradient ID per instance to avoid conflicts when multiple cards are on one page
  private readonly _gradientId = `iopool-chart-grad-${Math.random().toString(36).slice(2, 9)}`;

  override updated(changedProps: Map<string, unknown>): void {
    const shouldReload =
      changedProps.has('entityId') ||
      changedProps.has('period') ||
      // Load on first hass assignment only; don't reload on every hass update
      (changedProps.has('hass') &&
        changedProps.get('hass') === undefined &&
        this.hass !== undefined);

    if (shouldReload) {
      void this._loadData();
    }
  }

  private async _loadData(): Promise<void> {
    if (!this.hass || !this.entityId) return;
    try {
      this._data = await fetchTemperatureHistory(this.hass, this.entityId, this.period);
    } catch {
      this._data = [];
    }
    this.requestUpdate();
  }

  // ─── Data → SVG coordinate mapping ─────────────────────────────────────────

  private _computeSvgPoints(): Array<[number, number]> {
    if (this._data.length === 0) return [];

    const times = this._data.map((p) => new Date(p.timestamp).getTime());
    const values = this._data.map((p) => p.value);

    const tMin = Math.min(...times);
    const tMax = Math.max(...times);
    const vMin = Math.min(...values);
    const vMax = Math.max(...values);

    if (tMin === tMax) {
      // Single timestamp — plot all at center x
      const midY = (CY1 + CY2) / 2;
      return this._data.map(() => [(CX1 + CX2) / 2, midY]);
    }

    const vRange = vMax - vMin;
    const vPad = vRange > 0 ? vRange * 0.1 : 1; // 10% padding, min 1°
    const vEffMin = vMin - vPad;
    const vEffMax = vMax + vPad;
    const vEffRange = vEffMax - vEffMin;

    return this._data.map((p, i) => {
      const time = times[i] ?? tMin;
      const x = CX1 + ((time - tMin) / (tMax - tMin)) * (CX2 - CX1);
      const y = CY2 - ((p.value - vEffMin) / vEffRange) * (CY2 - CY1);
      return [x, y] as [number, number];
    });
  }

  // ─── Y-axis ticks ──────────────────────────────────────────────────────────

  private _yAxisTicks(): Array<{ y: number; label: string }> {
    if (this._data.length === 0) return [];

    const values = this._data.map((p) => p.value);
    const vMin = Math.min(...values);
    const vMax = Math.max(...values);
    const vRange = vMax - vMin;
    const vPad = vRange > 0 ? vRange * 0.1 : 1;
    const vEffMin = vMin - vPad;
    const vEffMax = vMax + vPad;
    const vEffRange = vEffMax - vEffMin;

    const count = 4;
    return Array.from({ length: count }, (_, i) => {
      const t = i / (count - 1); // 0 = bottom, 1 = top
      const val = vEffMin + t * vEffRange;
      const y = CY2 - t * (CY2 - CY1);
      return { y: parseFloat(y.toFixed(1)), label: `${Math.round(val)}°` };
    });
  }

  // ─── X-axis ticks ──────────────────────────────────────────────────────────

  private _xAxisTicks(): Array<{ x: number; label: string }> {
    if (this._data.length === 0) return [];

    const times = this._data.map((p) => new Date(p.timestamp).getTime());
    const tMin = Math.min(...times);
    const tMax = Math.max(...times);
    if (tMin === tMax) return [];

    const count = 5;
    return Array.from({ length: count }, (_, i) => {
      const tFrac = i / (count - 1);
      const ts = tMin + tFrac * (tMax - tMin);
      const x = CX1 + tFrac * (CX2 - CX1);
      const date = new Date(ts);
      const label = date.toLocaleDateString(this.language, { weekday: 'short', day: 'numeric' });
      return { x: parseFloat(x.toFixed(1)), label };
    });
  }

  // ─── Stats ─────────────────────────────────────────────────────────────────

  private _computeStats(): {
    min: TemperaturePoint | null;
    max: TemperaturePoint | null;
    avg: number | null;
  } {
    if (this._data.length === 0) return { min: null, max: null, avg: null };

    let minPoint = this._data[0]!;
    let maxPoint = this._data[0]!;
    let sum = 0;

    for (const p of this._data) {
      if (p.value < minPoint.value) minPoint = p;
      if (p.value > maxPoint.value) maxPoint = p;
      sum += p.value;
    }

    return { min: minPoint, max: maxPoint, avg: sum / this._data.length };
  }

  // ─── Formatting helpers ────────────────────────────────────────────────────

  private _formatNum(value: number): string {
    return new Intl.NumberFormat(this.language, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value);
  }

  private _formatStatDate(isoString: string): string {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const datePart = date.toLocaleDateString(this.language, { weekday: 'short', day: 'numeric' });
    const timePart = date.toLocaleTimeString(this.language, { hour: '2-digit', minute: '2-digit' });
    return `${datePart} · ${timePart}`;
  }

  private _formatTooltipDate(isoString: string): string {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const datePart = date.toLocaleDateString(this.language, { weekday: 'short', day: 'numeric' });
    const timePart = date.toLocaleTimeString(this.language, { hour: '2-digit', minute: '2-digit' });
    return `${datePart} · ${timePart}`;
  }

  // ─── Period selector ───────────────────────────────────────────────────────

  private _handlePeriodChange(period: ChartPeriod): void {
    if (this.period === period) return;
    this.period = period;
    this.dispatchEvent(
      new CustomEvent('period-change', { detail: period, bubbles: true, composed: true }),
    );
  }

  // ─── Hover interaction ────────────────────────────────────────────────────

  private _handleMouseMove(e: MouseEvent): void {
    const svg = this.shadowRoot?.querySelector('.chart-svg');
    if (!svg || !this._data.length) return;
    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const index = Math.round(x * (this._data.length - 1));
    const point = this._data[Math.max(0, Math.min(index, this._data.length - 1))];
    if (!point) return;
    this._tooltip = { value: point.value, timestamp: point.timestamp };
    this._hoverX = x;
    this.requestUpdate();
  }

  private _handleMouseLeave(): void {
    this._tooltip = null;
    this._hoverX = null;
    this.requestUpdate();
  }

  private _handleTouchStart(e: TouchEvent): void {
    const touch = e.touches[0];
    if (!touch) return;
    this._applyHover(touch.clientX);
  }

  private _handleTouchMove(e: TouchEvent): void {
    const touch = e.touches[0];
    if (!touch) return;
    e.preventDefault(); // prevent page scroll while scrubbing chart
    this._applyHover(touch.clientX);
  }

  private _applyHover(clientX: number): void {
    const svg = this.shadowRoot?.querySelector('.chart-svg');
    if (!svg || !this._data.length) return;
    const rect = svg.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const index = Math.round(x * (this._data.length - 1));
    const point = this._data[Math.max(0, Math.min(index, this._data.length - 1))];
    if (!point) return;
    this._tooltip = { value: point.value, timestamp: point.timestamp };
    this._hoverX = x;
    this.requestUpdate();
  }

  // ─── Hover dot coords ─────────────────────────────────────────────────────

  private _getHoverDotCoords(): [number, number] | null {
    if (this._hoverX === null || !this._data.length) return null;
    const pts = this._computeSvgPoints();
    const idx = Math.max(
      0,
      Math.min(Math.round(this._hoverX * (this._data.length - 1)), this._data.length - 1),
    );
    return pts[idx] ?? null;
  }

  // ─── Styles ───────────────────────────────────────────────────────────────

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }

      .temperature-chart {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 14px 16px 12px;
        border-radius: 18px;
        background: var(--iopool-surface);
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

      /* SVG chart wrapper */
      .temperature-chart__svg-wrap {
        position: relative;
        margin: 4px 0;
      }

      .chart-svg {
        width: 100%;
        height: 130px;
        display: block;
        cursor: crosshair;
        overflow: visible;
        /* currentColor used by gradient stops and chart line */
        color: var(--iopool-green, #7ed321);
      }

      .chart-grid-line {
        stroke: var(--divider-color, rgba(23, 129, 122, 0.12));
        stroke-width: 1;
        stroke-dasharray: 2 3;
        opacity: 0.5;
      }

      .chart-axis-label {
        fill: var(--secondary-text-color);
        font-size: 9px;
        font-weight: 600;
      }

      .chart-x-label {
        fill: var(--secondary-text-color);
        font-size: 8px;
        font-weight: 600;
      }

      .chart-area {
        fill-opacity: 1;
      }

      .chart-line {
        fill: none;
        stroke: currentColor;
        stroke-width: 2.2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .chart-hover-line {
        stroke: var(--iopool-primary);
        stroke-width: 1.2;
        stroke-dasharray: 3 3;
      }

      .chart-hover-dot {
        fill: var(--iopool-primary);
        stroke: var(--card-background-color, #fff);
        stroke-width: 2.5;
      }

      /* Floating tooltip overlay */
      .chart-tooltip {
        position: absolute;
        background: var(--primary-text-color);
        color: var(--card-background-color);
        padding: 6px 10px;
        border-radius: 10px;
        font-size: 11px;
        font-weight: 600;
        pointer-events: none;
        white-space: nowrap;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
        transform: translate(-50%, calc(-100% - 8px));
        z-index: 10;
      }

      .chart-tooltip__value {
        font-size: 14px;
        font-weight: 800;
        color: var(--iopool-green, #7ed321);
      }

      .chart-tooltip__date {
        font-size: 10px;
        opacity: 0.7;
        margin-top: 2px;
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

  // ─── Render ───────────────────────────────────────────────────────────────

  override render() {
    const svgPts = this._computeSvgPoints();
    const yTicks = this._yAxisTicks();
    const xTicks = this._xAxisTicks();
    const stats = this._computeStats();
    const hoverDot = this._getHoverDotCoords();

    const latestPoint = this._data.length > 0 ? this._data[this._data.length - 1] : null;
    const currentTempStr = latestPoint ? this._formatNum(latestPoint.value) : '--';

    const linePath = smoothLinePath(svgPts);
    const areaPath = smoothAreaPath(svgPts, CY2);
    const hasPath = svgPts.length >= 2;

    const periodKey = PERIOD_I18N_KEY[this.period] ?? 'chart.period_96h';

    return html`
      <div class="temperature-chart">
        <!-- Header: title + current value + period toggle -->
        <div class="temperature-chart__header">
          <div>
            <div class="temperature-chart__title">
              <ha-icon icon="mdi:coolant-temperature"></ha-icon>
              ${t(this.language, 'chart.temperature')}
            </div>
            <div class="temperature-chart__current">
              ${currentTempStr}<span class="temperature-chart__current-unit">°C</span>
            </div>
          </div>

          <div class="temperature-chart__period-toggle">
            ${CHART_PERIOD_VALUES.map(
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

        <!-- SVG chart -->
        <div
          class="temperature-chart__svg-wrap"
          @mousemove=${this._handleMouseMove}
          @mouseleave=${this._handleMouseLeave}
          @touchstart=${this._handleTouchStart}
          @touchmove=${this._handleTouchMove}
          @touchend=${this._handleMouseLeave}
        >
          <svg class="chart-svg" viewBox="0 0 ${SVG_W} ${SVG_H}" preserveAspectRatio="none">
            <defs>
              <linearGradient id="${this._gradientId}" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stop-color="currentColor" stop-opacity="0.35" />
                <stop offset="100%" stop-color="currentColor" stop-opacity="0" />
              </linearGradient>
            </defs>

            <!-- Grid lines and Y-axis labels -->
            ${yTicks.map(
              (tick) => svg`
                <line
                  class="chart-grid-line"
                  x1="${CX1}"
                  y1="${tick.y}"
                  x2="${CX2}"
                  y2="${tick.y}"
                />
                <text
                  class="chart-axis-label"
                  x="${CX1 - 2}"
                  y="${tick.y}"
                  text-anchor="end"
                  dominant-baseline="middle"
                >
                  ${tick.label}
                </text>
              `,
            )}

            <!-- Area fill -->
            ${hasPath
              ? svg`<path class="chart-area" d="${areaPath}" fill="url(#${this._gradientId})" />`
              : nothing}

            <!-- Line -->
            ${hasPath ? svg`<path class="chart-line" d="${linePath}" />` : nothing}

            <!-- X-axis labels -->
            ${xTicks.map(
              (tick) => svg`
                <text class="chart-x-label" x="${tick.x}" y="${SVG_H - 6}" text-anchor="middle">
                  ${tick.label}
                </text>
              `,
            )}

            <!-- Hover vertical line -->
            ${hoverDot !== null
              ? svg`
                  <line
                    class="chart-hover-line"
                    x1="${hoverDot[0].toFixed(1)}"
                    y1="${CY1}"
                    x2="${hoverDot[0].toFixed(1)}"
                    y2="${CY2}"
                  />
                `
              : nothing}

            <!-- Hover dot -->
            ${hoverDot !== null
              ? svg`
                  <circle
                    class="chart-hover-dot"
                    cx="${hoverDot[0].toFixed(1)}"
                    cy="${hoverDot[1].toFixed(1)}"
                    r="5"
                  />
                `
              : nothing}
          </svg>

          <!-- Floating tooltip -->
          ${hoverDot !== null && this._tooltip !== null
            ? html`
                <div
                  class="chart-tooltip"
                  style="left: ${((hoverDot[0] / SVG_W) * 100).toFixed(2)}%; top: ${(
                    (hoverDot[1] / SVG_H) *
                    100
                  ).toFixed(2)}%"
                >
                  <div class="chart-tooltip__value">${this._formatNum(this._tooltip.value)}°C</div>
                  <div class="chart-tooltip__date">
                    ${this._formatTooltipDate(this._tooltip.timestamp)}
                  </div>
                </div>
              `
            : nothing}
        </div>

        <!-- Stats bar -->
        <div class="chart-stats">
          <div class="stat">
            <div class="stat__label">${t(this.language, 'chart.min')}</div>
            <div class="stat__value">
              ${stats.min !== null ? `${this._formatNum(stats.min.value)}°C` : '--'}
            </div>
            <div class="stat__date">
              ${stats.min !== null ? this._formatStatDate(stats.min.timestamp) : ''}
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
              ${stats.max !== null ? `${this._formatNum(stats.max.value)}°C` : '--'}
            </div>
            <div class="stat__date">
              ${stats.max !== null ? this._formatStatDate(stats.max.timestamp) : ''}
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
