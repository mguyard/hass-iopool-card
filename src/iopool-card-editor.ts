import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type {
  ActionConfig,
  HomeAssistant,
  IopoolCardConfig,
  SectionActions,
  TemperatureThresholds,
} from './types';
import { DEFAULT_CHART_PERIOD, DEFAULT_POOL_THRESHOLDS, DEFAULT_SPA_THRESHOLDS } from './const';
import { validateThresholds } from './helpers/thresholds';
import en from './locales/en.json';
import fr from './locales/fr.json';

// ---------------------------------------------------------------------------
// i18n helper — same pattern as other components
// ---------------------------------------------------------------------------

const LOCALES: Record<string, Record<string, unknown>> = {
  en: en as Record<string, unknown>,
  fr: fr as Record<string, unknown>,
};

function t(lang: string, key: string): string {
  const locale = LOCALES[lang] ?? LOCALES.en;
  const value = key.split('.').reduce<unknown>((cur, seg) => {
    if (!cur || typeof cur !== 'object') return undefined;
    return (cur as Record<string, unknown>)[seg];
  }, locale);
  return typeof value === 'string' ? value : key;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SchemaEntry {
  name: string;
  required?: boolean;
  selector: Record<string, unknown>;
}

const SECTION_KEYS = ['temperature', 'ph', 'orp', 'pump', 'filtration'] as const;

type SectionKey = (typeof SECTION_KEYS)[number];

const THRESHOLD_INDICES = [0, 1, 2, 3] as const;
type ThresholdIndex = (typeof THRESHOLD_INDICES)[number];

// ---------------------------------------------------------------------------
// Editor component
// ---------------------------------------------------------------------------

@customElement('iopool-card-editor')
export class IopoolCardEditor extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;
  @state() private _config?: IopoolCardConfig;
  @state() private _validationError: string | undefined = undefined;

  public setConfig(config: IopoolCardConfig): void {
    this._config = config;
    this._validationError = undefined;
  }

  // Resolved language code — strips region variant (e.g. 'fr-FR' → 'fr').
  private get _lang(): string {
    const raw = this.hass?.locale?.language ?? this.hass?.language ?? 'en';
    return raw.split('-')[0] ?? raw;
  }

  // ha-form schema for the main configuration fields.
  // Defined as a getter so chart_period labels update when language changes.
  private get _schema(): SchemaEntry[] {
    return [
      {
        name: 'device_id',
        required: true,
        selector: {
          device: {
            filter: { integration: 'iopool' },
          },
        },
      },
      {
        name: 'pump_entity',
        selector: {
          entity: { domain: 'switch' },
        },
      },
    ];
  }

  private _computeLabel(schema: { name: string }): string {
    const lang = this._lang;
    const labels: Record<string, string> = {
      device_id: t(lang, 'editor.device_id'),
      pump_entity: t(lang, 'editor.pump_entity'),
      show_chart: t(lang, 'editor.show_chart'),
      chart_period: t(lang, 'editor.chart_period'),
      temperature_thresholds: t(lang, 'editor.temperature_thresholds'),
      '0': t(lang, 'editor.threshold_t0'),
      '1': t(lang, 'editor.threshold_t1'),
      '2': t(lang, 'editor.threshold_t2'),
      '3': t(lang, 'editor.threshold_t3'),
    };
    return labels[schema.name] ?? schema.name;
  }

  private _dispatchConfig(config: IopoolCardConfig): void {
    this.dispatchEvent(
      new CustomEvent('config-changed', {
        detail: { config },
        bubbles: true,
        composed: true,
      }),
    );
  }

  // Called when ha-form fires value-changed (device_id, pump_entity).
  private _valueChanged(ev: CustomEvent<{ value: IopoolCardConfig }>): void {
    const newConfig = ev.detail.value;

    if (!newConfig.device_id) {
      this._validationError = t(this._lang, 'errors.device_required');
      return;
    }

    if (newConfig.pump_entity !== undefined && !newConfig.pump_entity.startsWith('switch.')) {
      // Defensive: entity selector already filters by domain but guard against YAML edits.
      this._validationError = t(this._lang, 'errors.device_not_iopool');
      return;
    }

    if (
      newConfig.temperature_thresholds !== undefined &&
      !validateThresholds(newConfig.temperature_thresholds)
    ) {
      this._validationError = t(this._lang, 'errors.thresholds_order');
      return;
    }

    this._validationError = undefined;
    this._dispatchConfig(newConfig);
  }

  private _applyPreset(type: 'pool' | 'spa'): void {
    if (!this._config) return;
    const thresholds: TemperatureThresholds =
      type === 'pool' ? DEFAULT_POOL_THRESHOLDS : DEFAULT_SPA_THRESHOLDS;
    this._dispatchConfig({ ...this._config, temperature_thresholds: thresholds });
  }

  private _thresholdChanged(index: ThresholdIndex, value: number): void {
    if (!this._config) return;
    const current: TemperatureThresholds = this._config.temperature_thresholds
      ? ([...this._config.temperature_thresholds] as TemperatureThresholds)
      : ([...DEFAULT_POOL_THRESHOLDS] as TemperatureThresholds);
    current[index] = value;

    if (!validateThresholds(current)) {
      this._validationError = t(this._lang, 'errors.thresholds_order');
      return;
    }

    this._validationError = undefined;
    this._dispatchConfig({ ...this._config, temperature_thresholds: current });
  }

  private _sectionActionChanged(
    section: SectionKey,
    actionKey: keyof SectionActions,
    ev: CustomEvent<{ value: ActionConfig }>,
  ): void {
    if (!this._config) return;
    const prevSectionActions = this._config.section_actions ?? {};
    const prevSection: SectionActions = prevSectionActions[section] ?? {};
    const updatedSection: SectionActions = {
      ...prevSection,
      [actionKey]: ev.detail.value,
    };
    // Cast required: TypeScript cannot narrow the computed key [section] against the
    // specific section_actions interface without an explicit assertion here.
    const newSectionActions = {
      ...prevSectionActions,
      [section]: updatedSection,
    } as NonNullable<IopoolCardConfig['section_actions']>;
    this._dispatchConfig({
      ...this._config,
      section_actions: newSectionActions,
    });
  }

  // Stable empty-label function — suppresses ha-form's built-in label so the
  // surrounding .field-header provides the label and description instead.
  // TypeScript accepts () => string as assignable to (schema: SchemaEntry) => string
  // because functions with fewer parameters are structurally compatible.
  private readonly _emptyLabel = (): string => '';

  private _showChartChanged(ev: CustomEvent<{ value: boolean }>): void {
    if (!this._config) return;
    this._dispatchConfig({ ...this._config, show_chart: ev.detail.value });
  }

  private _chartPeriodChanged(period: 24 | 48 | 96 | 168): void {
    if (!this._config) return;
    this._dispatchConfig({ ...this._config, chart_period: period });
  }

  private _periodLabel(period: number, lang: string): string {
    if (period === 168) return t(lang, 'chart.period_7d');
    return t(lang, `chart.period_${period}h`);
  }

  private _thresholdZonePcts(
    thresholds: TemperatureThresholds,
  ): [number, number, number, number, number] {
    const RED_PCT = 15;
    const INNER_PCT = 70; // remaining 70% shared by the 3 inner zones
    const [t0, t1, t2, t3] = thresholds;
    const dOrange1 = Math.max(0, t1 - t0);
    const dGreen = Math.max(0, t2 - t1);
    const dOrange2 = Math.max(0, t3 - t2);
    const innerTotal = dOrange1 + dGreen + dOrange2 || 1;
    const scale = INNER_PCT / innerTotal;
    return [RED_PCT, dOrange1 * scale, dGreen * scale, dOrange2 * scale, RED_PCT];
  }

  private _renderThresholdBar(thresholds: TemperatureThresholds, lang: string) {
    const [p0, p1, p2, p3, p4] = this._thresholdZonePcts(thresholds);
    const zoneColors = [
      'zone-red',
      'zone-orange',
      'zone-green',
      'zone-orange',
      'zone-red',
    ] as const;
    const pcts = [p0, p1, p2, p3, p4];
    const zoneLabels = [
      t(lang, 'status.too_low'),
      t(lang, 'status.low'),
      t(lang, 'status.ideal'),
      t(lang, 'status.high'),
      t(lang, 'status.too_high'),
    ];
    return html`
      <div class="threshold-visual">
        <div class="threshold-bar">
          ${pcts.map(
            (pct, idx) => html`
              <div class="threshold-zone ${zoneColors[idx]}" style="width: ${pct}%"></div>
            `,
          )}
        </div>
        <div class="threshold-zone-labels">
          ${pcts.map(
            (pct, idx) => html`
              <span
                class="zone-label"
                style="width: ${pct}%; min-width: 0;"
                title="${zoneLabels[idx]}"
                >${zoneLabels[idx]}</span
              >
            `,
          )}
        </div>
      </div>
    `;
  }

  protected override render() {
    if (!this._config) return html``;

    const lang = this._lang;
    const thresholds: TemperatureThresholds =
      this._config.temperature_thresholds ?? DEFAULT_POOL_THRESHOLDS;

    // Per-field schemas — full _config is still passed as data so ha-form emits
    // the complete config object with the changed field updated.
    const deviceSchema = this._schema.filter((f) => f.name === 'device_id');
    const pumpSchema = this._schema.filter((f) => f.name === 'pump_entity');

    return html`
      <div class="editor">
        <!-- device_id field -->
        <div class="editor-field">
          <div class="field-header">
            <span class="field-title">${t(lang, 'editor.device_id')}</span>
            <span class="field-description">${t(lang, 'editor.device_id_description')}</span>
          </div>
          <ha-form
            .hass=${this.hass}
            .data=${this._config}
            .schema=${deviceSchema}
            .computeLabel=${this._emptyLabel}
            @value-changed=${this._valueChanged}
          ></ha-form>
        </div>

        <!-- pump_entity field -->
        <div class="editor-field">
          <div class="field-header">
            <span class="field-title">${t(lang, 'editor.pump_entity')}</span>
            <span class="field-description">${t(lang, 'editor.pump_entity_description')}</span>
          </div>
          <ha-form
            .hass=${this.hass}
            .data=${this._config}
            .schema=${pumpSchema}
            .computeLabel=${this._emptyLabel}
            @value-changed=${this._valueChanged}
          ></ha-form>
        </div>

        <!-- Temperature collapsible section -->
        <details class="section-temperature">
          <summary>
            <ha-icon icon="mdi:coolant-temperature"></ha-icon>
            ${t(lang, 'editor.temperature_section')}
          </summary>
          <div class="temperature-content">
            <!-- Temperature thresholds -->
            <div class="editor-field">
              <div class="field-header">
                <span class="field-title">${t(lang, 'editor.temperature_thresholds')}</span>
                <span class="field-description"
                  >${t(lang, 'editor.temperature_thresholds_description')}</span
                >
              </div>
              <div class="presets">
                <button class="preset-btn" @click=${() => this._applyPreset('pool')}>
                  ${t(lang, 'editor.preset_pool')}
                </button>
                <button class="preset-btn" @click=${() => this._applyPreset('spa')}>
                  ${t(lang, 'editor.preset_spa')}
                </button>
              </div>
              ${this._renderThresholdBar(thresholds, lang)}
              <div class="thresholds-grid">
                ${THRESHOLD_INDICES.map(
                  (i) => html`
                    <div class="threshold-field">
                      <div class="threshold-field-label">
                        <span class="threshold-indicator threshold-indicator-${i}"></span>
                        <label>${this._computeLabel({ name: String(i) })}</label>
                      </div>
                      <ha-selector
                        .hass=${this.hass}
                        .selector=${{ number: { min: -20, max: 50, step: 0.5, mode: 'box' } }}
                        .value=${thresholds[i]}
                        @value-changed=${(ev: CustomEvent<{ value: number }>) =>
                          this._thresholdChanged(i, ev.detail.value)}
                      ></ha-selector>
                    </div>
                  `,
                )}
              </div>
            </div>

            <!-- show_chart field -->
            <div class="editor-field show-chart-field">
              <div class="show-chart-row">
                <div class="field-header">
                  <span class="field-title">${t(lang, 'editor.show_chart')}</span>
                  <span class="field-description">${t(lang, 'editor.show_chart_description')}</span>
                </div>
                <ha-selector
                  .hass=${this.hass}
                  .selector=${{ boolean: {} }}
                  .value=${this._config.show_chart ?? true}
                  @value-changed=${this._showChartChanged}
                ></ha-selector>
              </div>
            </div>

            <!-- chart_period field -->
            <div class="editor-field">
              <div class="field-header">
                <span class="field-title">${t(lang, 'editor.chart_period')}</span>
                <span class="field-description">${t(lang, 'editor.chart_period_description')}</span>
              </div>
              <div class="period-chips">
                ${([24, 48, 96, 168] as const).map(
                  (period) => html`
                    <button
                      class="chip-btn ${(this._config!.chart_period ?? DEFAULT_CHART_PERIOD) ===
                      period
                        ? 'chip-btn--active'
                        : ''}"
                      @click=${() => this._chartPeriodChanged(period)}
                    >
                      ${this._periodLabel(period, lang)}
                    </button>
                  `,
                )}
              </div>
            </div>
          </div>
        </details>

        ${this._validationError ? html`<p class="error">${this._validationError}</p>` : ''}

        <!-- Section actions (Interactions) — collapsible -->
        <details class="section-actions">
          <summary>
            <ha-icon icon="mdi:gesture-double-tap"></ha-icon>
            ${t(lang, 'editor.section_actions')}
          </summary>
          <div class="actions-content">
            ${SECTION_KEYS.map((section) => this._renderSectionActions(section))}
          </div>
        </details>
      </div>
    `;
  }

  private _renderSectionActions(section: SectionKey) {
    const lang = this._lang;
    const sectionActions: SectionActions = this._config?.section_actions?.[section] ?? {};

    return html`
      <div class="section-action-group">
        <div class="section-action-header">
          <div class="section-action-title">${t(lang, `editor.section_${section}_title`)}</div>
          <div class="section-action-description">
            ${t(lang, `editor.section_${section}_description`)}
          </div>
        </div>
        ${([['tap_action', 'editor.tap_action']] as const).map(
          ([actionKey, labelKey]) => html`
            <div class="action-row">
              <label>${t(lang, labelKey)}</label>
              <ha-selector
                .hass=${this.hass}
                .selector=${{ ui_action: {} }}
                .value=${sectionActions[actionKey] ?? { action: 'more-info' }}
                @value-changed=${(ev: CustomEvent<{ value: ActionConfig }>) =>
                  this._sectionActionChanged(section, actionKey, ev)}
              ></ha-selector>
            </div>
          `,
        )}
      </div>
    `;
  }

  static override styles = css`
    .editor {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .section-title {
      font-size: 13px;
      font-weight: 700;
      color: var(--primary-text-color);
      margin-top: 4px;
    }

    .presets {
      display: flex;
      gap: 8px;
      margin: 12px 0;
    }

    .preset-btn {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid var(--divider-color, #e0e0e0);
      border-radius: 8px;
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color);
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      transition:
        background 0.2s,
        border-color 0.2s;
    }

    .preset-btn:hover {
      background: var(--iopool-primary, #17817a);
      color: #fff;
      border-color: var(--iopool-primary, #17817a);
    }

    /* Threshold visual bar */
    .threshold-visual {
      margin: 8px 0 12px;
    }

    .threshold-bar {
      display: flex;
      height: 12px;
      border-radius: 6px;
      overflow: hidden;
    }

    .threshold-zone {
      transition: width 0.3s ease;
      flex-shrink: 0;
    }

    .zone-red {
      background: var(--iopool-red, #d0021b);
    }
    .zone-orange {
      background: var(--iopool-orange, #f5a623);
    }
    .zone-green {
      background: var(--iopool-green, #7ed321);
    }

    .threshold-zone-labels {
      display: flex;
      margin-top: 4px;
    }

    .zone-label {
      font-size: 10px;
      color: var(--secondary-text-color);
      text-align: center;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex-shrink: 0;
    }

    /* Threshold inputs grid */
    .thresholds-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .threshold-field-label {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
    }

    .threshold-field-label label {
      font-size: 12px;
      color: var(--secondary-text-color);
    }

    /* Bicolor circle indicators showing the zone transition at each threshold */
    .threshold-indicator {
      display: inline-block;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .threshold-indicator-0 {
      background: linear-gradient(
        to right,
        var(--iopool-red, #d0021b) 50%,
        var(--iopool-orange, #f5a623) 50%
      );
    }
    .threshold-indicator-1 {
      background: linear-gradient(
        to right,
        var(--iopool-orange, #f5a623) 50%,
        var(--iopool-green, #7ed321) 50%
      );
    }
    .threshold-indicator-2 {
      background: linear-gradient(
        to right,
        var(--iopool-green, #7ed321) 50%,
        var(--iopool-orange, #f5a623) 50%
      );
    }
    .threshold-indicator-3 {
      background: linear-gradient(
        to right,
        var(--iopool-orange, #f5a623) 50%,
        var(--iopool-red, #d0021b) 50%
      );
    }

    .editor-field {
      margin-bottom: 16px;
    }

    .field-header {
      margin-bottom: 8px;
    }

    .field-title {
      display: block;
      font-size: 14px;
      font-weight: 500;
      color: var(--primary-text-color);
    }

    .field-description {
      display: block;
      font-size: 12px;
      color: var(--secondary-text-color);
      margin-top: 2px;
    }

    .show-chart-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .show-chart-field .field-header {
      flex: 1;
      margin-bottom: 0;
    }

    .period-chips {
      display: flex;
      gap: 8px;
    }

    .chip-btn {
      flex: 1;
      padding: 6px 12px;
      border: 1px solid var(--divider-color, #e0e0e0);
      border-radius: 20px;
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color);
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition:
        background 0.2s,
        border-color 0.2s;
    }

    .chip-btn:hover:not(.chip-btn--active) {
      border-color: var(--iopool-primary, #17817a);
      color: var(--iopool-primary, #17817a);
      -webkit-text-fill-color: var(--iopool-primary, #17817a);
    }

    .chip-btn--active {
      background: var(--iopool-primary, #17817a);
      color: #fff !important;
      -webkit-text-fill-color: #fff;
      border-color: var(--iopool-primary, #17817a);
    }

    .error {
      color: var(--error-color, #d0021b);
      font-size: 13px;
      margin: 0;
    }

    .section-temperature {
      border: 1px solid var(--divider-color, #e0e0e0);
      border-radius: 8px;
      padding: 8px 12px;
    }

    .section-temperature summary,
    .section-actions summary {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      padding: 4px 0;
      user-select: none;
    }

    .section-temperature summary ha-icon,
    .section-actions summary ha-icon {
      --mdc-icon-size: 18px;
      width: 18px;
      height: 18px;
      color: var(--secondary-text-color);
    }

    .temperature-content {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-top: 12px;
    }

    .section-actions {
      border: 1px solid var(--divider-color, #e0e0e0);
      border-radius: 8px;
      padding: 8px 12px;
    }

    .actions-content {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-top: 12px;
    }

    .section-action-group {
      border-top: 1px solid var(--divider-color, #e0e0e0);
      padding-top: 12px;
    }

    .section-action-header {
      margin-bottom: 8px;
    }

    .section-action-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--primary-text-color);
    }

    .section-action-description {
      font-size: 11px;
      color: var(--secondary-text-color);
      margin-top: 2px;
    }

    .action-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 8px;
    }

    .action-row label {
      font-size: 12px;
      color: var(--secondary-text-color);
    }
  `;
}
