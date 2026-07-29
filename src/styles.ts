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
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

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
    --iopool-neutral: #94a39e;
    --iopool-grad-button: linear-gradient(135deg, #51afe7 0%, #62d2c6 100%);
    --iopool-grad-main: linear-gradient(180deg, #42bdaa 0%, #2c7c70 100%);
    /* Derived from the theme card background so it follows light/dark without
       any mode detection: white -> rgb(234,244,243) (the former #eaf4f2),
       #1c1c1c -> #1c2524. See SPECIFICATIONS §7.7. */
    --iopool-gauge-bg: color-mix(in srgb, var(--iopool-primary) 9%, var(--card-background-color));
    /* Anchored on --primary-text-color, which always moves *away* from the
       background: it darkens a light card and lightens a dark one. Ratios are
       solved so the light-mode luminance matches the former teal overlays
       exactly, while dark-mode separation gains ~60%. See SPECIFICATIONS §7.7. */
    --iopool-surface: color-mix(
      in srgb,
      var(--primary-text-color) 2.6%,
      var(--card-background-color)
    );
    --iopool-surface-strong: color-mix(
      in srgb,
      var(--primary-text-color) 5.3%,
      var(--card-background-color)
    );
    --iopool-divider: rgba(23, 129, 122, 0.12);

    display: block;
    font-family: var(--primary-font-family, system-ui, sans-serif);
  }

  ha-card {
    border-radius: var(--ha-card-border-radius, 28px);
    overflow: hidden;
    /* HA gives --ha-card-background priority over --card-background-color for
       cards; themes that only set the former would otherwise mismatch. */
    background: var(--ha-card-background, var(--card-background-color));
  }

  /* === Card root container === */

  .iopool-card {
    background: var(--card-background-color);
    color: var(--primary-text-color);
    overflow: hidden;
  }

  /* === Section container === */

  .iopool-section {
    padding: 0 12px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
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
    grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
    gap: 12px;
    padding: 12px;
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
