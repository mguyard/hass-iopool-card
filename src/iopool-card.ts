import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
// Register the visual editor custom element so HA discovers it via getConfigElement().
import './iopool-card-editor';
import type {
  HomeAssistant,
  IopoolCardConfig,
  ResolvedEntities,
  DisplayFlags,
  ActionConfig,
  SectionActions,
  IopoolMode,
  PoolFilterMode,
} from './types';
import { CARD_VERSION, CHART_PERIODS, DEFAULT_CHART_PERIOD } from './const';
import { resolveEntities } from './helpers/device';
import { validateThresholds } from './helpers/thresholds';
import { DebugLogger } from './helpers/debug';
import { sharedStyles } from './styles';

@customElement('iopool-card')
export class IopoolCard extends LitElement {
  // HA sets hass directly via property assignment on every state change.
  // We intercept it to trigger re-render and lazy-resolve entities.
  private _hass?: HomeAssistant;

  @state() private _config?: IopoolCardConfig;
  @state() private _entities?: ResolvedEntities;
  // Explicit `| undefined` (not `?:`) so we can assign undefined with exactOptionalPropertyTypes enabled.
  @state() private _error: string | undefined = undefined;

  // Last device_id for which entities were resolved — used to detect changes.
  private _prevDeviceId?: string;

  private _logger = new DebugLogger(false);

  // --- Lovelace API: hass property ---

  set hass(hass: HomeAssistant) {
    this._hass = hass;
    // Resolve entities once per device_id — not on every HA state change.
    if (this._config && this._config.device_id !== this._prevDeviceId) {
      this._resolveEntities(hass, this._config.device_id);
      this._prevDeviceId = this._config.device_id;
    }
    this.requestUpdate();
  }

  get hass(): HomeAssistant {
    // Non-null assertion is safe: HA always sets hass before rendering.
    return this._hass!;
  }

  // --- Lovelace API: setConfig ---

  public setConfig(config: IopoolCardConfig): void {
    if (!config.device_id) {
      throw new Error('iopool-card: device_id is required');
    }

    if (
      config.chart_period !== undefined &&
      !(CHART_PERIODS as readonly number[]).includes(config.chart_period)
    ) {
      throw new Error(`iopool-card: chart_period must be one of ${CHART_PERIODS.join(', ')}`);
    }

    if (
      config.temperature_thresholds !== undefined &&
      !validateThresholds(config.temperature_thresholds)
    ) {
      throw new Error('iopool-card: temperature_thresholds must be 4 strictly ascending numbers');
    }

    if (config.pump_entity !== undefined && !config.pump_entity.startsWith('switch.')) {
      throw new Error('iopool-card: pump_entity must be a switch entity (e.g. switch.my_pump)');
    }

    // Use ?? to apply defaults without spreading `undefined` values (exactOptionalPropertyTypes compat).
    const normalized: IopoolCardConfig = {
      ...config,
      show_chart: config.show_chart ?? true,
      chart_period: config.chart_period ?? (DEFAULT_CHART_PERIOD as 24 | 48 | 96 | 168),
      debug: config.debug ?? false,
    };

    this._logger.setEnabled(normalized.debug ?? false);
    this._logger.debug('lifecycle', 'setConfig called', normalized);

    // If hass is already available and device_id changed, resolve immediately.
    if (this._hass && normalized.device_id !== this._prevDeviceId) {
      this._resolveEntities(this._hass, normalized.device_id);
      this._prevDeviceId = normalized.device_id;
    }

    this._config = normalized;
    this._error = undefined;
  }

  // --- Entity resolution ---

  private _resolveEntities(hass: HomeAssistant, deviceId: string): void {
    this._entities = resolveEntities(hass, deviceId);
    this._logger.debug('entities', 'Resolved entities for device', deviceId, this._entities);
  }

  // --- LitElement lifecycle ---

  protected override firstUpdated(): void {
    // Edge case: setConfig called before hass was available (first load).
    if (this._config && this._hass && !this._entities) {
      this._resolveEntities(this._hass, this._config.device_id);
      this._prevDeviceId = this._config.device_id;
    }
  }

  // --- Display flags ---

  /**
   * Computes visibility flags from current probe mode and config.
   * Called inside render() on every update — no caching needed (pure computation).
   * See SPECIFICATIONS §6.2.
   */
  private get _displayFlags(): DisplayFlags {
    if (!this._hass || !this._config) {
      return {
        showGauges: false,
        showChart: false,
        showActionBadge: false,
        showMode: false,
        showPump: false,
        showFiltration: false,
        showBoost: false,
        isGrayed: false,
        warningBanner: null,
      };
    }

    const modeState = this._entities?.mode ? this._hass.states[this._entities.mode] : undefined;
    const poolModeState = this._entities?.poolMode
      ? this._hass.states[this._entities.poolMode]
      : undefined;

    const iopoolMode = (modeState?.state ?? 'STANDARD') as IopoolMode;
    const poolMode = (poolModeState?.state ?? 'Standard') as PoolFilterMode;

    const isStandard = iopoolMode === 'STANDARD' || iopoolMode === 'OPENING';
    const isPassiveWinter = iopoolMode === 'WINTER';
    const isMaintenance = iopoolMode === 'MAINTENANCE';
    const isInitialization = iopoolMode === 'INITIALIZATION';
    const isGrayed = isMaintenance || isInitialization;

    const hasPumpEntity =
      !!this._config.pump_entity && !!this._hass.states[this._config.pump_entity];
    const hasFiltrationEntity = !!this._entities?.filtration;
    const showChartConfig = this._config.show_chart !== false;

    return {
      showGauges: isStandard || isGrayed,
      showChart: (isStandard || isGrayed) && showChartConfig,
      showActionBadge: isStandard || isGrayed,
      showMode: true,
      showPump: hasPumpEntity && !isPassiveWinter,
      showFiltration: hasFiltrationEntity && !isPassiveWinter,
      showBoost: isStandard && poolMode === 'Standard',
      isGrayed,
      warningBanner: isMaintenance ? 'maintenance' : isInitialization ? 'initialization' : null,
    };
  }

  // --- Action handling ---

  /**
   * Resolves the primary entity for a section (used by default more-info action).
   */
  private _getPrimaryEntity(section: string): string | undefined {
    switch (section) {
      case 'temperature':
        return this._entities?.temperature;
      case 'ph':
        return this._entities?.ph;
      case 'orp':
        return this._entities?.orp;
      case 'pump':
        return this._config?.pump_entity;
      case 'filtration':
        return this._entities?.filtration;
      case 'mode':
        return this._entities?.poolMode;
      case 'boost':
        return this._entities?.boostSelector;
      default:
        return undefined;
    }
  }

  /**
   * Default action for a section when no section_actions override is configured.
   * See SPECIFICATIONS §6.1.2.
   */
  private _getDefaultAction(section: string): ActionConfig {
    switch (section) {
      case 'pump':
        return { action: 'toggle' };
      case 'mode':
      case 'boost':
      case 'chart':
        return { action: 'none' };
      default:
        return { action: 'more-info' };
    }
  }

  /**
   * Executes a section action (tap / hold / double_tap).
   * Reads section_actions config override; falls back to _getDefaultAction.
   */
  private _handleAction(
    section: string,
    actionType: 'tap' | 'hold' | 'double_tap',
    entityId?: string,
  ): void {
    if (!this._hass || !this._config) return;

    type SectionKey = keyof NonNullable<IopoolCardConfig['section_actions']>;
    type ActionKey = keyof SectionActions;

    const sectionActions = this._config.section_actions?.[section as SectionKey];
    const actionKey = `${actionType}_action` as ActionKey;
    const actionConfig: ActionConfig | undefined = sectionActions?.[actionKey];

    const action = actionConfig ?? this._getDefaultAction(section);
    if (!action || action.action === 'none') return;

    const targetEntityId = entityId ?? this._getPrimaryEntity(section);

    switch (action.action) {
      case 'more-info':
        if (targetEntityId) {
          this.dispatchEvent(
            new CustomEvent('hass-more-info', {
              detail: { entityId: targetEntityId },
              bubbles: true,
              composed: true,
            }),
          );
        }
        break;

      case 'toggle':
        if (targetEntityId) {
          void this._hass.callService('homeassistant', 'toggle', {
            entity_id: targetEntityId,
          });
        }
        break;

      case 'navigate':
        if (action.navigation_path) {
          history.pushState(null, '', action.navigation_path);
          this.dispatchEvent(
            new CustomEvent('location-changed', { bubbles: true, composed: true }),
          );
        }
        break;

      case 'url':
        if (action.url_path) {
          window.open(action.url_path, '_blank');
        }
        break;

      case 'call-service':
        if (action.service) {
          const dotIndex = action.service.indexOf('.');
          if (dotIndex > 0) {
            const domain = action.service.slice(0, dotIndex);
            const service = action.service.slice(dotIndex + 1);
            void this._hass.callService(domain, service, action.service_data);
          }
        }
        break;

      default:
        break;
    }
  }

  // --- HA static methods ---

  static getConfigElement(): HTMLElement {
    return document.createElement('iopool-card-editor');
  }

  static getStubConfig(hass: HomeAssistant): IopoolCardConfig {
    const iopoolDevice = Object.values(hass.devices).find((device) =>
      device.identifiers.some(([domain]) => domain === 'iopool'),
    );
    return {
      type: 'custom:iopool-card',
      device_id: iopoolDevice?.id ?? '',
    };
  }

  public getCardSize(): number {
    return 8;
  }

  // --- Render ---

  protected override render() {
    if (!this._config) return html``;

    if (this._error) {
      return html`<ha-card><div class="error">${this._error}</div></ha-card>`;
    }

    return html`
      <ha-card>
        <div class="iopool-card">
          <!-- Phase 8 will replace these with real components -->
          <div class="header-slot"></div>
          <div class="warning-slot"></div>
          <div class="gauges-slot"></div>
          <div class="mode-slot"></div>
          <div class="pump-slot"></div>
          <div class="filtration-slot"></div>
          <div class="boost-slot"></div>
          <div class="chart-slot"></div>
        </div>
      </ha-card>
    `;
  }

  static override styles = [sharedStyles];
}

// --- HA card registration ---

declare global {
  interface Window {
    customCards?: Array<{
      type: string;
      name: string;
      description: string;
      preview?: boolean;
      documentationURL?: string;
    }>;
  }
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'iopool-card',
  name: 'iopool Card',
  description: 'Official iopool — full management of a connected pool',
  preview: true,
  documentationURL: 'https://github.com/mguyard/hass-iopool-card',
});

console.info(
  `%c iopool-card %c v${CARD_VERSION} `,
  'color: white; background: #17817A; font-weight: 700; padding: 2px 6px; border-radius: 3px 0 0 3px;',
  'color: #17817A; background: white; font-weight: 700; padding: 2px 6px; border-radius: 0 3px 3px 0; border: 1px solid #17817A;',
);
