import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import en from '../locales/en.json';
import fr from '../locales/fr.json';
import { sharedStyles } from '../styles';

type PoolMode = 'Standard' | 'Active-Winter' | 'Passive-Winter';
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
    case 'Active-Winter':
      return 'mdi:sun-snowflake-variant';
    case 'Passive-Winter':
      return 'mdi:snowflake';
    case 'Standard':
    default:
      return 'mdi:white-balance-sunny';
  }
}

function getModeLabel(mode: string, language: string): string {
  const label = t(language, `pool_mode.${mode}`);
  return label === `pool_mode.${mode}` ? mode : label;
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

  @property({ type: String }) poolMode: PoolMode | string = 'Standard';

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
        padding: 22px 20px 18px;
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
        background: rgba(126, 211, 33, 0.16);
        color: #4d8a0e;
      }

      .iopool-header__badge--warn {
        background: rgba(245, 166, 35, 0.18);
        color: #9c6a14;
      }

      .iopool-header__badge--err {
        background: rgba(208, 2, 27, 0.13);
        color: #a3001a;
      }

      .iopool-header__badge--debug {
        background: rgba(23, 129, 122, 0.1);
        color: var(--iopool-primary, #17817a);
        border: 1px solid rgba(23, 129, 122, 0.18);
      }
    `,
  ];

  override render() {
    const name = this.poolName.trim() || t(this.language, 'card.default_name');
    const modeLabel = getModeLabel(this.poolMode, this.language);
    const statusClass = getStatusClass(this.status);

    return html`
      <div class="iopool-header">
        <div class="iopool-header__title">
          <div class="iopool-header__name">${name}</div>
          <div class="iopool-header__subtitle">${t(this.language, 'card.pool_management')}</div>
        </div>

        <div class="iopool-header__badges" aria-label="iopool card status badges">
          <div class="iopool-header__badge iopool-header__badge--mode">
            <ha-icon icon=${getModeIcon(this.poolMode)}></ha-icon>
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
