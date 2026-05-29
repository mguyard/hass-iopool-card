import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type {
  ActionConfig,
  HomeAssistant,
  IopoolCardConfig,
  SectionActions,
  TemperatureThresholds,
} from './types';
import { DEFAULT_POOL_THRESHOLDS, DEFAULT_SPA_THRESHOLDS } from './const';
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

const SECTION_KEYS = [
  'temperature',
  'ph',
  'orp',
  'mode',
  'pump',
  'filtration',
  'boost',
  'chart',
] as const;

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
    const lang = this._lang;
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
      {
        name: 'show_chart',
        selector: { boolean: {} },
      },
      {
        name: 'chart_period',
        selector: {
          select: {
            options: [
              { value: 24, label: t(lang, 'chart.period_24h') },
              { value: 48, label: t(lang, 'chart.period_48h') },
              { value: 96, label: t(lang, 'chart.period_96h') },
              { value: 168, label: t(lang, 'chart.period_7d') },
            ],
          },
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

  // Called when ha-form fires value-changed (device, pump, show_chart, chart_period).
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

  protected override render() {
    if (!this._config) return html``;

    const lang = this._lang;
    const thresholds: TemperatureThresholds =
      this._config.temperature_thresholds ?? DEFAULT_POOL_THRESHOLDS;

    return html`
      <div class="editor">
        <!-- Main form: device, pump entity, show_chart, chart_period -->
        <ha-form
          .hass=${this.hass}
          .data=${this._config}
          .schema=${this._schema}
          .computeLabel=${this._computeLabel.bind(this)}
          @value-changed=${this._valueChanged}
        ></ha-form>

        <!-- Temperature thresholds section -->
        <div class="section-title">${t(lang, 'editor.temperature_thresholds')}</div>

        <div class="presets">
          <button class="preset-btn" @click=${() => this._applyPreset('pool')}>
            ${t(lang, 'editor.preset_pool')}
          </button>
          <button class="preset-btn" @click=${() => this._applyPreset('spa')}>
            ${t(lang, 'editor.preset_spa')}
          </button>
        </div>

        <div class="thresholds-grid">
          ${THRESHOLD_INDICES.map(
            (i) => html`
              <div class="threshold-field">
                <label>${this._computeLabel({ name: String(i) })}</label>
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

        ${this._validationError ? html`<p class="error">${this._validationError}</p>` : ''}

        <!-- Section actions — collapsible to avoid overwhelming the editor -->
        <details class="section-actions">
          <summary>${t(lang, 'editor.section_actions')}</summary>
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
        <div class="section-action-title">${section}</div>
        ${(
          [
            ['tap_action', 'editor.tap_action'],
            ['hold_action', 'editor.hold_action'],
            ['double_tap_action', 'editor.double_tap_action'],
          ] as const
        ).map(
          ([actionKey, labelKey]) => html`
            <div class="action-row">
              <label>${t(lang, labelKey)}</label>
              <ha-selector
                .hass=${this.hass}
                .selector=${{ ui_action: {} }}
                .value=${sectionActions[actionKey] ?? { action: 'none' }}
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

    .thresholds-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .threshold-field label {
      display: block;
      font-size: 12px;
      color: var(--secondary-text-color);
      margin-bottom: 4px;
    }

    .error {
      color: var(--error-color, #d0021b);
      font-size: 13px;
      margin: 0;
    }

    .section-actions {
      border: 1px solid var(--divider-color, #e0e0e0);
      border-radius: 8px;
      padding: 8px 12px;
    }

    .section-actions summary {
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      padding: 4px 0;
      user-select: none;
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

    .section-action-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--secondary-text-color);
      margin-bottom: 8px;
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
