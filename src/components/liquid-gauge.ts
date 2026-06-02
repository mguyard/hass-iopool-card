import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import en from '../locales/en.json';
import fr from '../locales/fr.json';
import { sharedStyles } from '../styles';
import type { Zone } from '../types';

type GaugeStatusZone = 'ok' | 'warn' | 'bad';

const ZONE_CLASS_MAP: Record<Zone, string> = {
  'red-low': 'bad',
  'yellow-low': 'warn',
  ok: 'ok',
  'yellow-high': 'warn',
  'red-high': 'bad',
  unknown: 'unknown',
};

const STATUS_ZONE_CLASS: Record<GaugeStatusZone, string> = {
  ok: 'status-ok',
  warn: 'status-warn',
  bad: 'status-bad',
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatGaugeValue(value: number, language: string): string {
  const decimals = Number.isInteger(value) ? 0 : 1;
  return new Intl.NumberFormat(language, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: 1,
  }).format(value);
}

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

function buildWavePath(
  timeMs: number,
  fillPct: number,
  amplitude: number,
  phaseShift: number,
  wavelengthFactor: number,
): string {
  const clampedFill = clamp(fillPct, 0, 1);
  const baseY = (1 - clampedFill) * 100;
  const segmentCount = 24;
  const phase = timeMs / 700;
  const points: string[] = [];

  for (let index = 0; index <= segmentCount; index += 1) {
    const x = (index / segmentCount) * 100;
    const wave =
      Math.sin((x / 100) * Math.PI * 2 * wavelengthFactor + phase + phaseShift) * amplitude;
    const y = clamp(baseY + wave, 0, 100);
    points.push(`${x.toFixed(2)} ${y.toFixed(2)}`);
  }

  return `M 0 100 L ${points.join(' L ')} L 100 100 Z`;
}

@customElement('iopool-liquid-gauge')
export class IopoolLiquidGauge extends LitElement {
  @property({ type: String }) label = '';

  @property({ type: Number }) value: number | null = null;

  @property({ type: String }) unit = '';

  @property({ type: Number }) target?: number;

  @property({ type: Number }) targetHigh?: number;

  @property({ type: String }) targetLabel?: string;

  @property({ type: String }) zone: Zone = 'unknown';

  @property({ type: Number }) fillPercent = 0.5;

  @property({ type: String }) statusLabel = 'Idéal';

  @property({ type: String }) statusZone: GaugeStatusZone = 'ok';

  @property({ type: String }) language = 'en';

  @state() private _animationTime = 0;

  private _animationId: number | undefined;

  private _animate = (now: number): void => {
    this._animationTime = now;

    if (!this.isConnected) {
      this._animationId = undefined;
      return;
    }

    this._animationId = requestAnimationFrame(this._animate);
  };

  override connectedCallback(): void {
    super.connectedCallback();

    if (this._animationId === undefined) {
      this._animationId = requestAnimationFrame(this._animate);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();

    if (this._animationId !== undefined) {
      cancelAnimationFrame(this._animationId);
      this._animationId = undefined;
    }
  }

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: block;
        container-type: inline-size;
      }

      .iopool-liquid-gauge {
        position: relative;
        display: block;
        aspect-ratio: 1;
        border-radius: clamp(12px, 14cqi, 22px);
        overflow: hidden;
        background: var(--iopool-gauge-bg, #eaf4f2);
        border: 1px solid var(--divider-color, var(--iopool-divider));
      }

      .iopool-liquid-gauge__label,
      .iopool-liquid-gauge__status,
      .iopool-liquid-gauge__target {
        position: absolute;
        z-index: 3;
        pointer-events: none;
      }

      .iopool-liquid-gauge__label {
        top: clamp(8px, 9cqi, 14px);
        left: clamp(8px, 9cqi, 14px);
        font-size: clamp(7px, 6cqi, 10px);
        font-weight: 700;
        color: var(--secondary-text-color);
        letter-spacing: 0.08em;
      }

      .iopool-liquid-gauge__status {
        top: clamp(6px, 8cqi, 12px);
        right: clamp(6px, 8cqi, 12px);
        font-size: clamp(7px, 6cqi, 9px);
        font-weight: 700;
        padding: clamp(2px, 2cqi, 3px) clamp(4px, 4cqi, 7px);
        border-radius: 999px;
        backdrop-filter: blur(8px);
      }

      .iopool-liquid-gauge__status.status-ok {
        background: color-mix(in srgb, var(--iopool-green, #7ed321) 25%, transparent);
        color: color-mix(in srgb, var(--iopool-green) 40%, black);
      }

      .iopool-liquid-gauge__status.status-warn {
        background: color-mix(in srgb, var(--iopool-orange, #f5a623) 30%, transparent);
        color: color-mix(in srgb, var(--iopool-orange) 40%, black);
      }

      .iopool-liquid-gauge__status.status-bad {
        background: color-mix(in srgb, var(--iopool-red, #d0021b) 25%, transparent);
        color: color-mix(in srgb, var(--iopool-red) 50%, black);
      }

      .iopool-liquid-gauge__value-wrap {
        position: absolute;
        left: clamp(8px, 9cqi, 14px);
        right: clamp(8px, 9cqi, 14px);
        bottom: clamp(12px, 14cqi, 22px);
        padding-bottom: clamp(4px, 4cqi, 6px);
        z-index: 3;
        line-height: 1;
      }

      .iopool-liquid-gauge__value {
        font-size: clamp(14px, 16cqi, 26px);
        font-weight: 800;
        letter-spacing: -0.03em;
        color: var(--primary-text-color);
        text-shadow:
          0 1px 2px rgba(255, 255, 255, 0.8),
          0 0 12px rgba(255, 255, 255, 0.6);
      }

      .iopool-liquid-gauge__unit {
        font-size: clamp(8px, 8cqi, 13px);
        font-weight: 600;
        opacity: 0.65;
        color: var(--primary-text-color);
        margin-left: clamp(1px, 1cqi, 2px);
      }

      .iopool-liquid-gauge__target {
        margin-top: clamp(3px, 4cqi, 6px);
        font-size: clamp(7px, 6cqi, 9px);
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--primary-text-color);
        opacity: 0.78;
      }

      .iopool-liquid-gauge__svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
      }

      .iopool-liquid-gauge__wave {
        fill: currentColor;
      }

      .zone-ok {
        color: var(--iopool-green);
      }

      .zone-warn {
        color: var(--iopool-orange);
      }

      .zone-bad {
        color: var(--iopool-red);
      }

      .zone-unknown {
        color: var(--iopool-neutral, #94a39e);
      }

      .iopool-liquid-gauge__wave--primary {
        opacity: 0.9;
      }

      .iopool-liquid-gauge__wave--secondary {
        opacity: 0.45;
      }
    `,
  ];

  override render() {
    const zoneClass = ZONE_CLASS_MAP[this.zone];
    const valueLabel = this.value === null ? '--' : formatGaugeValue(this.value, this.language);
    const targetText =
      this.targetLabel ??
      (typeof this.target === 'number' && typeof this.targetHigh === 'number'
        ? t(this.language, 'measures.target_range')
            .replace('{low}', formatGaugeValue(this.target, this.language))
            .replace('{high}', formatGaugeValue(this.targetHigh, this.language))
        : typeof this.target === 'number'
          ? t(this.language, 'measures.target').replace(
              '{value}',
              formatGaugeValue(this.target, this.language),
            )
          : '');
    const fillPct = clamp(this.fillPercent, 0, 1);
    // Derive status zone and label from the gauge zone — overrides statusZone/statusLabel properties
    const effectiveStatusZone: GaugeStatusZone =
      zoneClass === 'bad' || zoneClass === 'warn' ? zoneClass : 'ok';
    const effectiveStatusLabel = t(this.language, `measures.status_${effectiveStatusZone}`);

    return html`
      <div class="iopool-liquid-gauge zone-${zoneClass}">
        <div class="iopool-liquid-gauge__label">${this.label}</div>
        <div class="iopool-liquid-gauge__status ${STATUS_ZONE_CLASS[effectiveStatusZone]}">
          ${effectiveStatusLabel}
        </div>

        <svg
          class="iopool-liquid-gauge__svg"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            class="iopool-liquid-gauge__wave iopool-liquid-gauge__wave--secondary"
            d=${buildWavePath(this._animationTime, fillPct, 3.1, Math.PI / 2, 1.15)}
          ></path>
          <path
            class="iopool-liquid-gauge__wave iopool-liquid-gauge__wave--primary"
            d=${buildWavePath(this._animationTime, fillPct, 4.2, 0, 1.05)}
          ></path>
        </svg>

        <div class="iopool-liquid-gauge__value-wrap">
          <span class="iopool-liquid-gauge__value">${valueLabel}</span>
          ${this.unit ? html`<span class="iopool-liquid-gauge__unit">${this.unit}</span>` : null}
          ${targetText ? html`<div class="iopool-liquid-gauge__target">${targetText}</div>` : null}
        </div>
      </div>
    `;
  }
}
