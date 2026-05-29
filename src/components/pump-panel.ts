import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { formatDuration } from '../helpers/format';
import en from '../locales/en.json';
import fr from '../locales/fr.json';
import { sharedStyles } from '../styles';
import type { HomeAssistant } from '../types';

type PumpState = 'on' | 'off' | 'unavailable';

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

function resolveTargetMinutes(primary: number | null, fallback: number | null): number | null {
  if (primary !== null && primary > 0) {
    return primary;
  }

  if (fallback !== null && fallback > 0) {
    return fallback;
  }

  return null;
}

// Duration options in order (values sent to HA select entity)
const BOOST_DURATIONS = ['1H', '2H', '4H', '8H', '24H'] as const;

@customElement('iopool-pump-panel')
export class IopoolPumpPanel extends LitElement {
  // ── Pump ─────────────────────────────────────────────────────────────────
  @property({ type: String }) pumpEntityId?: string;

  @property({ type: String }) pumpState: PumpState = 'unavailable';

  @property() hass?: HomeAssistant;

  // ── Filtration ────────────────────────────────────────────────────────────
  @property({ type: Number }) filtrationDurationMinutes: number | null = null;

  @property({ type: Number }) recommendedMinutes: number | null = null;

  @property({ type: Number }) integrationRequiredMinutes: number | null = null;

  // ── Boost ─────────────────────────────────────────────────────────────────
  @property() boostEntityId?: string;

  @property() currentOption: string = 'none';

  @property() endTime?: string;

  // ── Shared ────────────────────────────────────────────────────────────────
  @property({ type: String }) language = 'en';

  // ── RAF for boost countdown ───────────────────────────────────────────────
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

  // ── Pump helpers ──────────────────────────────────────────────────────────

  private get _isPumpDisabled(): boolean {
    return !this.hass || !this.pumpEntityId || this.pumpState === 'unavailable';
  }

  private _handleToggle(): void {
    if (!this.hass || !this.pumpEntityId || this.pumpState === 'unavailable') {
      return;
    }

    void this.hass.callService('switch', 'toggle', { entity_id: this.pumpEntityId });
  }

  // ── Boost helpers ─────────────────────────────────────────────────────────

  private get _isBoostActive(): boolean {
    return this.currentOption.toLowerCase() !== 'none';
  }

  private _isOptionActive(option: string): boolean {
    return this.currentOption.toLowerCase() === option.toLowerCase();
  }

  private _getDurationMs(option: string): number {
    const lower = option.toLowerCase();
    if (lower === 'none') return 0;
    const hours = parseInt(lower.replace('h', ''), 10);
    if (isNaN(hours)) return 0;
    return hours * 3600 * 1000;
  }

  private _getCountdownPercent(): number {
    if (!this._isBoostActive || !this.endTime) return 0;
    const totalMs = this._getDurationMs(this.currentOption);
    if (totalMs <= 0) return 0;
    const remainingMs = new Date(this.endTime).getTime() - Date.now();
    return Math.max(0, Math.min(1, remainingMs / totalMs));
  }

  private _getRemainingText(): string {
    if (!this.endTime) return '';
    const remainingMs = Math.max(0, new Date(this.endTime).getTime() - Date.now());
    const remainingMinutes = Math.floor(remainingMs / 60000);
    return formatDuration(remainingMinutes, this.language);
  }

  private _getRemainingCountdown(): string {
    if (!this.endTime) return '';
    const remainingMs = Math.max(0, new Date(this.endTime).getTime() - Date.now());
    const totalSeconds = Math.floor(remainingMs / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const pad = (n: number): string => String(n).padStart(2, '0');
    if (h > 0) {
      return `${h}h ${pad(m)}m ${pad(s)}s`;
    }
    return `${pad(m)}m ${pad(s)}s`;
  }

  private _handleBoostSelect(option: string): void {
    if (!this.hass || !this.boostEntityId) return;
    void this.hass.callService('select', 'select_option', {
      entity_id: this.boostEntityId,
      option: option,
    });
  }

  // ── Section renderers ─────────────────────────────────────────────────────

  private _renderPumpSection() {
    const stateKey =
      this.pumpState === 'on' ? 'on' : this.pumpState === 'off' ? 'off' : 'unavailable';
    const statusLabel =
      stateKey === 'unavailable'
        ? t(this.language, 'status.unavailable')
        : t(this.language, `pump.${stateKey}`);

    return html`
      <div class="pump-panel__pump">
        <div class="pump-panel__pump-summary">
          <div class="pump-panel__icon pump-panel__icon--${stateKey}">
            <ha-icon
              icon=${stateKey === 'off' ? 'mdi:water-boiler-off' : 'mdi:water-boiler'}
            ></ha-icon>
          </div>
          <div class="pump-panel__pump-text">
            <div class="pump-panel__label">${t(this.language, 'sections.pump')}</div>
            <div class="pump-panel__pump-status pump-panel__pump-status--${stateKey}">
              ${statusLabel}
            </div>
          </div>
        </div>

        <button
          class="pump-panel__toggle ${stateKey === 'on' ? 'on' : ''}"
          ?disabled=${this._isPumpDisabled}
          aria-pressed=${stateKey === 'on'}
          type="button"
          @click=${this._handleToggle}
        >
          <span class="pump-panel__knob"></span>
        </button>
      </div>
    `;
  }

  private _renderFiltrationSection() {
    const fmtMin = (minutes: number | null): string =>
      minutes === null ? '--' : formatDuration(minutes, this.language);

    const targetMinutes = resolveTargetMinutes(
      this.integrationRequiredMinutes,
      this.recommendedMinutes,
    );
    const durationMinutes = this.filtrationDurationMinutes;
    const hasData = durationMinutes !== null && targetMinutes !== null;
    const rawPercentage = hasData ? Math.round((durationMinutes / targetMinutes) * 100) : 0;
    const fillPct = hasData
      ? Math.min(100, Math.max(0, (durationMinutes / targetMinutes) * 100))
      : 0;

    const fillClass = !hasData
      ? 'pump-panel__filtration-fill--muted'
      : rawPercentage >= 100
        ? 'pump-panel__filtration-fill--green'
        : 'pump-panel__filtration-fill--blue';

    return html`
      <div class="pump-panel__filtration">
        <div class="pump-panel__filtration-header">
          <span class="pump-panel__label">
            ${t(this.language, 'filtration.daily_filtration')}
          </span>
          <div
            class="pump-panel__filtration-pct ${rawPercentage >= 100
              ? 'pump-panel__filtration-pct--done'
              : ''}"
          >
            ${hasData ? `${rawPercentage}%` : '0%'}
          </div>
        </div>

        <div class="pump-panel__filtration-bar" aria-hidden="true">
          <div class="pump-panel__filtration-fill ${fillClass}" style="width: ${fillPct}%"></div>
        </div>

        <div class="pump-panel__filtration-stats">
          <div class="pump-panel__filtration-stat">
            <span class="pump-panel__label">${t(this.language, 'filtration.elapsed')}</span>
            <span class="pump-panel__filtration-stat-value">${fmtMin(durationMinutes)}</span>
          </div>
          <div class="pump-panel__filtration-stat pump-panel__filtration-stat--center">
            <span class="pump-panel__label">${t(this.language, 'filtration.required')}</span>
            <span class="pump-panel__filtration-stat-value"
              >${fmtMin(this.integrationRequiredMinutes)}</span
            >
          </div>
          <div class="pump-panel__filtration-stat pump-panel__filtration-stat--right">
            <span class="pump-panel__label"
              >${t(this.language, 'filtration.iopool_recommended')}</span
            >
            <span class="pump-panel__filtration-stat-value"
              >${fmtMin(this.recommendedMinutes)}</span
            >
          </div>
        </div>
      </div>
    `;
  }

  private _renderBoostSection() {
    const isActive = this._isBoostActive;
    // _animationTime is read here to let Lit track the reactive state and
    // trigger re-renders from the RAF loop so the countdown is recomputed
    // in real-time via Date.now().
    const countdownPct = (this._animationTime, this._getCountdownPercent());
    const noneLabel = isActive ? t(this.language, 'boost.stop') : t(this.language, 'boost.none');

    return html`
      <div class="pump-panel__boost">
        <div class="pump-panel__boost-header">
          <span class="pump-panel__label">${t(this.language, 'boost.boost')}</span>
          ${isActive
            ? html`<span class="pump-panel__boost-active-info"
                >(${this._getRemainingCountdown()})</span
              >`
            : nothing}
        </div>

        <div class="pump-panel__boost-grid">
          <!-- None / Stop button -->
          <button
            class="pump-panel__boost-btn ${this._isOptionActive('none')
              ? 'pump-panel__boost-btn--active'
              : ''}"
            title="${noneLabel}"
            aria-label="${noneLabel}"
            @click=${() => this._handleBoostSelect('None')}
          >
            <ha-icon icon="mdi:timer-stop-outline"></ha-icon>
          </button>

          <!-- Duration buttons -->
          ${BOOST_DURATIONS.map(
            (option) => html`
              <button
                class="pump-panel__boost-btn ${this._isOptionActive(option)
                  ? 'pump-panel__boost-btn--active'
                  : ''}"
                @click=${() => this._handleBoostSelect(option)}
              >
                ${option}
              </button>
            `,
          )}
        </div>

        ${isActive
          ? html`
              <div class="pump-panel__boost-countdown">
                <div
                  class="pump-panel__boost-countdown-fill"
                  style="width: ${(countdownPct * 100).toFixed(2)}%"
                ></div>
              </div>
            `
          : nothing}
      </div>
    `;
  }

  // ── Main render ───────────────────────────────────────────────────────────

  override render() {
    return html`
      <div class="pump-panel">
        ${this._renderPumpSection()}
        <div class="pump-panel__divider"></div>
        ${this._renderFiltrationSection()}
        ${this.boostEntityId
          ? html`
              <div class="pump-panel__divider"></div>
              ${this._renderBoostSection()}
            `
          : nothing}
      </div>
    `;
  }

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }

      /* ── Outer container ── */
      .pump-panel {
        display: flex;
        flex-direction: column;
        width: 100%;
        padding: 14px 16px;
        border-radius: 18px;
        background: var(--iopool-surface);
      }

      /* ── Divider between sections ── */
      .pump-panel__divider {
        height: 1px;
        background: var(--divider-color, rgba(148, 163, 158, 0.18));
        margin: 10px 0;
      }

      /* ── Shared uppercase label ── */
      .pump-panel__label {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--secondary-text-color);
      }

      /* ── Pump section ── */
      .pump-panel__pump {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }

      .pump-panel__pump-summary {
        display: flex;
        align-items: center;
        gap: 14px;
        min-width: 0;
      }

      .pump-panel__icon {
        width: 40px;
        height: 40px;
        border-radius: 12px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
        color: #fff;
      }

      .pump-panel__icon--on {
        background: rgba(126, 211, 33, 0.14);
        color: var(--iopool-green, #7ed321);
        box-shadow: 0 4px 10px rgba(126, 211, 33, 0.2);
      }

      .pump-panel__icon--off {
        background: rgba(208, 2, 27, 0.12);
        color: var(--iopool-red, #d0021b);
        box-shadow: none;
      }

      .pump-panel__icon--unavailable {
        background: var(--iopool-surface-strong);
        color: var(--secondary-text-color);
        box-shadow: none;
      }

      .pump-panel__icon ha-icon {
        width: 22px;
        height: 22px;
        --mdc-icon-size: 22px;
      }

      .pump-panel__pump-text {
        min-width: 0;
      }

      .pump-panel__pump-status {
        margin-top: 4px;
        font-size: 14px;
        font-weight: 700;
        overflow-wrap: anywhere;
      }

      .pump-panel__pump-status--on {
        color: var(--iopool-green, #7ed321);
      }

      .pump-panel__pump-status--off {
        color: var(--iopool-red, #d0021b);
      }

      .pump-panel__pump-status--unavailable {
        color: var(--secondary-text-color);
      }

      .pump-panel__toggle {
        display: inline-flex;
        align-items: center;
        justify-content: flex-start;
        width: 54px;
        height: 30px;
        padding: 3px;
        border: 0;
        border-radius: 999px;
        background: rgba(148, 163, 158, 0.3);
        cursor: pointer;
        transition:
          background-color 0.18s ease,
          opacity 0.18s ease,
          transform 0.18s ease;
      }

      .pump-panel__toggle:hover:not(:disabled) {
        transform: translateY(-1px);
      }

      .pump-panel__toggle.on {
        background: var(--iopool-green, #7ed321);
      }

      .pump-panel__toggle:disabled {
        cursor: not-allowed;
        opacity: 0.45;
      }

      .pump-panel__knob {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
        transform: translateX(0);
        transition: transform 0.18s ease;
      }

      .pump-panel__toggle.on .pump-panel__knob {
        transform: translateX(24px);
      }

      /* ── Filtration section ── */
      .pump-panel__filtration {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .pump-panel__filtration-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .pump-panel__filtration-pct {
        font-size: 22px;
        font-weight: 800;
        letter-spacing: -0.03em;
        color: var(--primary-text-color);
      }

      .pump-panel__filtration-pct--done {
        color: var(--success-color, var(--iopool-green));
      }

      .pump-panel__filtration-bar {
        width: 100%;
        height: 12px;
        border-radius: 999px;
        background: rgba(148, 163, 158, 0.18);
        overflow: hidden;
      }

      .pump-panel__filtration-fill {
        width: 0;
        height: 100%;
        border-radius: inherit;
        transition: width 0.22s ease;
      }

      .pump-panel__filtration-fill--blue {
        background: linear-gradient(90deg, #4bcffa 0%, #17817a 100%);
      }

      .pump-panel__filtration-fill--green {
        background: linear-gradient(90deg, #7ed321 0%, #56a618 100%);
      }

      .pump-panel__filtration-fill--muted {
        background: rgba(148, 163, 158, 0.42);
      }

      /* ── Filtration stats row (3 columns) ── */
      .pump-panel__filtration-stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        margin-top: 2px;
      }

      .pump-panel__filtration-stat {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .pump-panel__filtration-stat--center {
        align-items: center;
        text-align: center;
      }

      .pump-panel__filtration-stat--right {
        align-items: flex-end;
        text-align: right;
      }

      .pump-panel__filtration-stat-value {
        font-size: 13px;
        font-weight: 700;
        color: var(--primary-text-color);
        letter-spacing: -0.01em;
      }

      /* ── Boost section ── */
      .pump-panel__boost {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .pump-panel__boost-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .pump-panel__boost-active-info {
        font-size: 11px;
        font-weight: 700;
        color: var(--iopool-primary);
        white-space: nowrap;
      }

      .pump-panel__boost-grid {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 4px;
      }

      .pump-panel__boost-btn {
        height: 32px;
        border-radius: 9px;
        background: var(--card-background-color, #fff);
        border: 1px solid var(--divider-color, var(--iopool-divider));
        color: var(--secondary-text-color);
        font-weight: 700;
        font-size: 11px;
        cursor: pointer;
        font-family: inherit;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        transition:
          border-color 0.2s,
          color 0.2s,
          background 0.2s,
          box-shadow 0.2s;
      }

      .pump-panel__boost-btn ha-icon {
        --mdc-icon-size: 16px;
      }

      .pump-panel__boost-btn:hover:not(.pump-panel__boost-btn--active) {
        border-color: var(--iopool-primary);
        color: var(--iopool-primary);
      }

      .pump-panel__boost-btn--active {
        background: var(--iopool-green, #7ed321);
        color: #fff;
        border-color: transparent;
        box-shadow: 0 2px 8px rgba(126, 211, 33, 0.3);
      }

      .pump-panel__boost-countdown {
        height: 4px;
        border-radius: 100px;
        overflow: hidden;
        background: var(--divider-color, rgba(23, 129, 122, 0.12));
      }

      .pump-panel__boost-countdown-fill {
        height: 100%;
        border-radius: 100px;
        background: linear-gradient(90deg, var(--iopool-primary), var(--iopool-eco));
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    'iopool-pump-panel': IopoolPumpPanel;
  }
}
