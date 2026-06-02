import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import en from '../locales/en.json';
import fr from '../locales/fr.json';
import { sharedStyles } from '../styles';

type IopoolProbeMode =
  | 'STANDARD'
  | 'OPENING'
  | 'ACTIVE_WINTER'
  | 'WINTER'
  | 'INITIALIZATION'
  | 'MAINTENANCE';
type HeaderStatus = 'ok' | 'action_recommended' | 'action_required';

const LOCALES: Record<string, Record<string, unknown>> = {
  en: en as Record<string, unknown>,
  fr: fr as Record<string, unknown>,
};

function t(lang: string, key: string): string {
  const locale = LOCALES[lang] ?? LOCALES.en;
  const value = key.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object') {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, locale);

  return typeof value === 'string' ? value : key;
}

function getModeIcon(mode: string): string {
  switch (mode) {
    case 'ACTIVE_WINTER':
      return 'mdi:sun-snowflake-variant';
    case 'WINTER':
      return 'mdi:snowflake';
    case 'OPENING':
      return 'mdi:pool';
    case 'INITIALIZATION':
      return 'mdi:progress-clock';
    case 'MAINTENANCE':
      return 'mdi:wrench';
    case 'STANDARD':
    default:
      return 'mdi:white-balance-sunny';
  }
}

function getModeLabel(mode: string, language: string): string {
  const label = t(language, `iopool_mode.${mode}`);
  return label === `iopool_mode.${mode}` ? mode : label;
}

function getStatusLabel(status: HeaderStatus, language: string): string {
  switch (status) {
    case 'action_required':
      return t(language, 'header.action_required');
    case 'action_recommended':
      return t(language, 'header.action_recommended');
    case 'ok':
    default:
      return t(language, 'header.all_good');
  }
}

function getStatusClass(status: HeaderStatus): 'ok' | 'warn' | 'err' {
  switch (status) {
    case 'action_required':
      return 'err';
    case 'action_recommended':
      return 'warn';
    case 'ok':
    default:
      return 'ok';
  }
}

@customElement('iopool-header')
export class IopoolHeader extends LitElement {
  @property({ type: String }) poolName = '';

  @property({ type: String }) iopoolMode: IopoolProbeMode | string = 'STANDARD';

  @property({ type: String }) status: HeaderStatus = 'ok';

  @property({ type: Boolean }) debugEnabled = false;

  @property({ type: String }) language = 'en';

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }

      .iopool-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
        padding: 16px 20px 12px;
        border-bottom: 1px solid var(--divider-color, var(--iopool-divider));
      }

      .iopool-header__title {
        min-width: 0;
        flex: 1;
      }

      .iopool-header__name {
        font-size: 22px;
        font-weight: 800;
        line-height: 1.1;
        letter-spacing: -0.025em;
        color: var(--primary-text-color);
        overflow-wrap: anywhere;
      }

      .iopool-header__subtitle {
        margin-top: 4px;
        font-size: 12px;
        font-weight: 500;
        color: var(--secondary-text-color);
      }

      .iopool-header__badges {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 6px;
        flex-shrink: 0;
      }

      .iopool-header__badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 10px 5px 8px;
        border-radius: 999px;
        font-size: 10px;
        font-weight: 700;
        line-height: 1;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        white-space: nowrap;
      }

      .iopool-header__badge ha-icon {
        width: 14px;
        height: 14px;
        --mdc-icon-size: 14px;
        flex: 0 0 auto;
      }

      .iopool-header__badge--mode {
        background: var(--iopool-surface-strong);
        color: var(--iopool-primary, #17817a);
      }

      .iopool-header__badge--ok {
        background: color-mix(in srgb, var(--iopool-green, #7ed321) 16%, transparent);
        color: color-mix(in srgb, var(--iopool-green) 60%, black);
      }

      .iopool-header__badge--warn {
        background: color-mix(in srgb, var(--iopool-orange, #f5a623) 18%, transparent);
        color: color-mix(in srgb, var(--iopool-orange) 65%, black);
      }

      .iopool-header__badge--err {
        background: color-mix(in srgb, var(--iopool-red, #d0021b) 13%, transparent);
        color: color-mix(in srgb, var(--iopool-red) 75%, black);
      }

      .iopool-header__badge--debug {
        background: color-mix(in srgb, var(--iopool-primary, #17817a) 10%, transparent);
        color: var(--iopool-primary, #17817a);
        border: 1px solid color-mix(in srgb, var(--iopool-primary, #17817a) 18%, transparent);
      }
    `,
  ];

  override render() {
    const name = this.poolName.trim() || t(this.language, 'card.default_name');
    const modeLabel = getModeLabel(this.iopoolMode, this.language);
    const statusClass = getStatusClass(this.status);

    return html`
      <div class="iopool-header">
        <div class="iopool-header__title">
          <div class="iopool-header__name">${name}</div>
          <div class="iopool-header__subtitle">${t(this.language, 'card.pool_management')}</div>
        </div>

        <div class="iopool-header__badges" aria-label="iopool card status badges">
          <div class="iopool-header__badge iopool-header__badge--mode">
            <ha-icon icon=${getModeIcon(this.iopoolMode)}></ha-icon>
            <span>${modeLabel}</span>
          </div>

          <div class="iopool-header__badge iopool-header__badge--${statusClass}">
            <ha-icon
              icon=${statusClass === 'ok'
                ? 'mdi:emoticon-cool-outline'
                : statusClass === 'warn'
                  ? 'mdi:alert-circle-outline'
                  : 'mdi:alert-circle'}
            ></ha-icon>
            <span>${getStatusLabel(this.status, this.language)}</span>
          </div>

          ${this.debugEnabled
            ? html`
                <div class="iopool-header__badge iopool-header__badge--debug">
                  <span>DEBUG</span>
                </div>
              `
            : null}
        </div>
      </div>
    `;
  }
}
