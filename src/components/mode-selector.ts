import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import en from '../locales/en.json';
import fr from '../locales/fr.json';
import { sharedStyles } from '../styles';
import type { HomeAssistant } from '../types';

type FiltrationMode = 'Standard' | 'Active-Winter' | 'Passive-Winter';

const LOCALES: Record<string, Record<string, unknown>> = {
  en: en as Record<string, unknown>,
  fr: fr as Record<string, unknown>,
};

const MODE_OPTIONS: Array<{
  value: FiltrationMode;
  icon: string;
  labelKey: string;
}> = [
  {
    value: 'Standard',
    icon: 'mdi:white-balance-sunny',
    labelKey: 'pool_mode.Standard',
  },
  {
    value: 'Active-Winter',
    icon: 'mdi:sun-snowflake-variant',
    labelKey: 'pool_mode.Active-Winter',
  },
  {
    value: 'Passive-Winter',
    icon: 'mdi:snowflake',
    labelKey: 'pool_mode.Passive-Winter',
  },
];

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

function normalizeMode(mode: string): FiltrationMode {
  switch (mode.toLowerCase().replace(/-/g, '_')) {
    case 'active_winter':
      return 'Active-Winter';
    case 'passive_winter':
      return 'Passive-Winter';
    case 'standard':
    default:
      return 'Standard';
  }
}

@customElement('iopool-mode-selector')
export class IopoolModeSelector extends LitElement {
  @property({ type: String }) currentMode = 'Standard';

  @property({ type: String }) language = 'en';

  @property() onModeChange?: (mode: string, hass: HomeAssistant) => void;

  @property({ type: String }) modeEntityId?: string;

  @property() hass?: HomeAssistant;

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: block;
        container-type: inline-size;
      }

      .mode-selector {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        width: 100%;
        padding: 10px 16px;
        border-radius: 18px;
        background: var(--iopool-surface);
      }

      .mode-selector__summary {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }

      .mode-selector__icon {
        width: 36px;
        height: 36px;
        border-radius: 12px;
        background: linear-gradient(
          135deg,
          var(--iopool-primary, #17817a),
          var(--iopool-primary-dark, #0f5d57)
        );
        color: #fff;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
        box-shadow: 0 4px 10px color-mix(in srgb, var(--iopool-primary, #17817a) 25%, transparent);
      }

      .mode-selector__icon ha-icon {
        width: 22px;
        height: 22px;
        --mdc-icon-size: 22px;
      }

      .mode-selector__text {
        min-width: 0;
      }

      .mode-selector__label {
        display: block;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--secondary-text-color);
      }

      .mode-selector__segments {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 3px;
        padding: 3px;
        border-radius: 14px;
        background: var(--iopool-surface-strong);
        flex: 0 0 auto;
      }

      .mode-selector__button {
        min-width: 0;
        border: 0;
        border-radius: 10px;
        padding: 5px 7px;
        font: inherit;
        font-size: 10px;
        font-weight: 700;
        line-height: 1;
        cursor: pointer;
        color: var(--primary-text-color);
        background: transparent;
        transition:
          background-color 0.18s ease,
          color 0.18s ease,
          transform 0.18s ease,
          opacity 0.18s ease;
      }

      .mode-selector__button:hover:not(:disabled):not(.mode-selector__button--active) {
        transform: translateY(-1px);
        background: color-mix(in srgb, var(--iopool-primary, #17817a) 8%, transparent);
      }

      .mode-selector__button--active:hover:not(:disabled) {
        transform: translateY(-1px);
        background: var(--iopool-green, #7ed321);
      }

      .mode-selector__button:focus {
        outline: none;
      }

      .mode-selector__button:focus-visible {
        outline: 2px solid var(--iopool-primary, #17817a);
        outline-offset: 2px;
      }

      .mode-selector__button--active {
        background: var(--iopool-green, #7ed321);
        color: #fff;
        box-shadow: 0 2px 8px rgba(126, 211, 33, 0.3);
      }

      .mode-selector__button:disabled {
        cursor: not-allowed;
        opacity: 0.45;
      }

      .mode-selector--disabled {
        opacity: 0.75;
      }

      @container (max-width: 380px) {
        .mode-selector {
          flex-direction: column;
          align-items: flex-start;
          justify-content: flex-start;
          gap: 10px;
        }

        .mode-selector__segments {
          width: 100%;
          flex: 1 1 100%;
        }
      }
    `,
  ];

  private get _modeState(): string | undefined {
    if (!this.hass || !this.modeEntityId) {
      return undefined;
    }

    return this.hass.states[this.modeEntityId]?.state;
  }

  private get _isDisabled(): boolean {
    return !this.hass || !this.modeEntityId || this._modeState === 'unavailable';
  }

  private _handleModeChange(mode: FiltrationMode): void {
    if (!this.hass || !this.modeEntityId || this._isDisabled) {
      return;
    }

    if (this.onModeChange) {
      this.onModeChange(mode, this.hass);
      return;
    }

    void this.hass.callService('select', 'select_option', {
      entity_id: this.modeEntityId,
      option: mode,
    });
  }

  override render() {
    const currentMode = normalizeMode(this.currentMode);
    const currentOption = MODE_OPTIONS.find((option) => option.value === currentMode);
    if (!currentOption) {
      return html``;
    }

    return html`
      <div class="mode-selector ${this._isDisabled ? 'mode-selector--disabled' : ''}">
        <div class="mode-selector__summary">
          <div class="mode-selector__icon">
            <ha-icon icon=${currentOption.icon}></ha-icon>
          </div>
          <div class="mode-selector__text">
            <span class="mode-selector__label"
              >${t(this.language, 'sections.mode_filtration')}</span
            >
          </div>
        </div>

        <div
          class="mode-selector__segments"
          role="group"
          aria-label=${t(this.language, 'sections.mode_filtration')}
        >
          ${MODE_OPTIONS.map(
            (option) => html`
              <button
                class=${`mode-selector__button ${option.value === currentMode ? 'mode-selector__button--active' : ''}`}
                ?disabled=${this._isDisabled}
                type="button"
                @click=${() => this._handleModeChange(option.value)}
              >
                ${t(this.language, option.labelKey)}
              </button>
            `,
          )}
        </div>
      </div>
    `;
  }
}
