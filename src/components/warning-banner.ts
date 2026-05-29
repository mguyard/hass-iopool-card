import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import en from '../locales/en.json';
import fr from '../locales/fr.json';
import { sharedStyles } from '../styles';

type WarningType = 'maintenance' | 'initialization';

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

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }

      .warning-banner {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 12px 16px;
        border-radius: 18px;
        background: rgba(245, 166, 35, 0.14);
        border: 1px solid rgba(245, 166, 35, 0.24);
        color: #9c6a14;
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
    const key = this.type === 'initialization' ? 'warnings.initialization' : 'warnings.maintenance';

    return html`
      <div class="warning-banner" role="status" aria-live="polite">
        <ha-icon icon="mdi:wrench"></ha-icon>
        <div class="warning-banner__text">${t(this.language, key)}</div>
      </div>
    `;
  }
}
