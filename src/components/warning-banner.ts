import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import en from '../locales/en.json';
import fr from '../locales/fr.json';
import { sharedStyles } from '../styles';

type WarningType = 'maintenance' | 'initialization' | 'opening';

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

@customElement('iopool-warning-banner')
export class IopoolWarningBanner extends LitElement {
  @property({ type: String }) type: WarningType = 'maintenance';

  @property({ type: String }) language = 'en';

  @property({ type: Array }) sensors: Array<'temperature' | 'ph' | 'orp'> = [];

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: block;
        margin-top: 6px;
      }

      .warning-banner {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 12px 16px;
        border-radius: 18px;
        background: color-mix(in srgb, var(--iopool-orange, #f5a623) 14%, transparent);
        border: 1px solid color-mix(in srgb, var(--iopool-orange, #f5a623) 24%, transparent);
        color: color-mix(in srgb, var(--iopool-orange) 65%, black);
        font-size: 12px;
        font-weight: 600;
        line-height: 1.35;
      }

      .warning-banner ha-icon {
        width: 18px;
        height: 18px;
        flex: 0 0 auto;
      }

      .warning-banner__text {
        min-width: 0;
      }
    `,
  ];

  override render() {
    if (this.type === 'initialization') {
      return html`
        <div class="warning-banner" role="status" aria-live="polite">
          <ha-icon icon="mdi:wrench"></ha-icon>
          <div class="warning-banner__text">${t(this.language, 'warnings.initialization')}</div>
        </div>
      `;
    }

    if (this.type === 'opening') {
      return html`
        <div class="warning-banner" role="status" aria-live="polite">
          <ha-icon icon="mdi:pool"></ha-icon>
          <div class="warning-banner__text">${t(this.language, 'warnings.opening')}</div>
        </div>
      `;
    }

    // maintenance — compose dynamic message from sensor list
    const sensorNames =
      this.sensors.length > 0
        ? this.sensors.map((s) => t(this.language, `measures.${s}`)).join(', ')
        : t(this.language, 'warnings.maintenance');
    const suffix =
      this.sensors.length > 0 ? ` ${t(this.language, 'warnings.maintenance_suffix')}` : '';

    return html`
      <div class="warning-banner" role="status" aria-live="polite">
        <ha-icon icon="mdi:wrench"></ha-icon>
        <div class="warning-banner__text">${sensorNames}${suffix}</div>
      </div>
    `;
  }
}
