import { css } from 'lit';

/**
 * Shared LitElement styles for all iopool-card components.
 *
 * Uses HA CSS variables for light/dark theme inheritance, with iopool brand
 * custom properties as fallbacks. Components import this and compose it via
 * `static override styles = [sharedStyles, css`...`]`.
 *
 * See SPECIFICATIONS §7.2 (typography), §7.3 (CSS variables), §7.4 (spacing).
 */
export const sharedStyles = css`
  :host {
    /* iopool brand custom properties — used as fallbacks when HA vars are absent */
    --iopool-primary: #17817a;
    --iopool-primary-dark: #0f5d57;
    --iopool-eco: #43d1cd;
    --iopool-sharing: #4bcffa;
    --iopool-treatments: #42bdaa;
    --iopool-green: #7ed321;
    --iopool-orange: #f5a623;
    --iopool-red: #d0021b;
    --iopool-grad-button: linear-gradient(135deg, #51afe7 0%, #62d2c6 100%);
    --iopool-grad-main: linear-gradient(180deg, #42bdaa 0%, #2c7c70 100%);
    --iopool-gauge-bg: #eaf4f2;
    --iopool-gauge-bg-dark: #1a2625;
    --iopool-surface: rgba(23, 129, 122, 0.04);
    --iopool-surface-strong: rgba(23, 129, 122, 0.08);
    --iopool-divider: rgba(23, 129, 122, 0.12);

    display: block;
    font-family: var(--primary-font-family, system-ui, sans-serif);
  }

  ha-card {
    border-radius: var(--ha-card-border-radius, 28px);
    overflow: hidden;
    background: var(--card-background-color);
  }

  /* === Card root container === */

  .iopool-card {
    background: var(--card-background-color);
    color: var(--primary-text-color);
    overflow: hidden;
  }

  /* === Section container === */

  .iopool-section {
    padding: 0 20px 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .iopool-section + .iopool-section {
    border-top: 1px solid var(--divider-color, var(--iopool-divider));
  }

  /* === Error state === */

  .error {
    padding: 16px;
    color: var(--error-color, var(--iopool-red));
    font-size: 14px;
    font-weight: 600;
  }

  /* === Typography scale (SPECIFICATIONS §7.2) === */

  .io-title {
    font-size: 22px;
    font-weight: 800;
    color: var(--primary-text-color);
    letter-spacing: -0.025em;
    line-height: 1.1;
  }

  .io-subtitle {
    font-size: 12px;
    color: var(--secondary-text-color);
    font-weight: 500;
    margin-top: 4px;
  }

  .io-section-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--primary-text-color);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .io-label {
    font-size: 10px;
    color: var(--secondary-text-color);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .io-value-large {
    font-size: 26px;
    font-weight: 800;
    color: var(--primary-text-color);
    letter-spacing: -0.03em;
  }

  /* === Status color utilities === */

  .io-status-ok {
    color: var(--success-color, var(--iopool-green));
  }

  .io-status-warn {
    color: var(--warning-color, var(--iopool-orange));
  }

  .io-status-error {
    color: var(--error-color, var(--iopool-red));
  }

  /* === Gauge row (3 equal-width columns) === */

  .iopool-gauges {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    padding: 20px;
  }

  /* === Grayed-out state (MAINTENANCE / INITIALIZATION) === */

  .iopool-grayed {
    opacity: 0.45;
    pointer-events: none;
  }

  /* === Inner surface blocks (sections, rows) === */

  .io-surface {
    background: var(--iopool-surface);
    border-radius: 18px;
    padding: 14px 16px;
  }

  .io-surface-strong {
    background: var(--iopool-surface-strong);
    border-radius: 18px;
    padding: 14px 16px;
  }
`;
