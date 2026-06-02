import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HomeAssistant, IopoolCardConfig, TemperatureThresholds } from './types';
import { DEFAULT_POOL_THRESHOLDS, DEFAULT_SPA_THRESHOLDS } from './const';
// Importing the module registers the custom element and runs side-effects.
import { IopoolCardEditor } from './iopool-card-editor';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildMockHass(overrides: Partial<HomeAssistant> = {}): HomeAssistant {
  return {
    language: 'en',
    states: {},
    entities: {},
    devices: {},
    callService: vi.fn().mockResolvedValue(undefined),
    callApi: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

const VALID_CONFIG: IopoolCardConfig = {
  type: 'custom:iopool-card',
  device_id: 'device-abc123',
};

// Access private internals via type-casting — avoids exposing in production types.
type EditorInternals = {
  _config: IopoolCardConfig | undefined;
  _validationError: string | undefined;
  _computeLabel: (schema: { name: string }) => string;
  _applyPreset: (type: 'pool' | 'spa') => void;
  _valueChanged: (ev: CustomEvent<{ value: IopoolCardConfig }>) => void;
  _showChartChanged: (ev: CustomEvent<{ value: boolean }>) => void;
  _chartPeriodChanged: (period: 24 | 48 | 96 | 168) => void;
  _schema: Array<{ name: string; required?: boolean; selector: Record<string, unknown> }>;
  _thresholdZonePcts: (
    thresholds: TemperatureThresholds,
  ) => [number, number, number, number, number];
};

function asInternals(editor: IopoolCardEditor): EditorInternals {
  return editor as unknown as EditorInternals;
}

type WithUpdateComplete = HTMLElement & { updateComplete: Promise<boolean> };

function createEditor(overrides: Partial<{ hass: HomeAssistant }> = {}): IopoolCardEditor {
  const editor = document.createElement('iopool-card-editor') as IopoolCardEditor;
  Object.assign(editor, overrides);
  document.body.append(editor);
  return editor;
}

function clearDom(): void {
  document.body.innerHTML = '';
}

beforeEach(clearDom);

// ---------------------------------------------------------------------------
// 1. setConfig
// ---------------------------------------------------------------------------

describe('IopoolCardEditor.setConfig', () => {
  it('stores the config', () => {
    const editor = createEditor();
    editor.setConfig(VALID_CONFIG);
    expect(asInternals(editor)._config).toEqual(VALID_CONFIG);
  });

  it('clears any existing validation error', () => {
    const editor = createEditor();
    editor.setConfig(VALID_CONFIG);
    expect(asInternals(editor)._validationError).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 2–3. render
// ---------------------------------------------------------------------------

describe('IopoolCardEditor render', () => {
  it('renders nothing (no .editor div) when no config is set', async () => {
    const editor = createEditor({ hass: buildMockHass() });
    await (editor as WithUpdateComplete).updateComplete;
    // Lit always injects the <style> block, but the .editor container must be absent.
    expect(editor.shadowRoot?.querySelector('.editor')).toBeFalsy();
  });

  it('renders ha-form when config is set', async () => {
    const editor = createEditor({ hass: buildMockHass() });
    editor.setConfig(VALID_CONFIG);
    await (editor as WithUpdateComplete).updateComplete;
    expect(editor.shadowRoot?.querySelector('ha-form')).toBeTruthy();
  });

  it('renders the two preset buttons', async () => {
    const editor = createEditor({ hass: buildMockHass() });
    editor.setConfig(VALID_CONFIG);
    await (editor as WithUpdateComplete).updateComplete;
    const buttons = editor.shadowRoot?.querySelectorAll('.preset-btn');
    expect(buttons?.length).toBe(2);
  });

  it('renders 4 ha-selector elements inside threshold-field wrappers', async () => {
    const editor = createEditor({ hass: buildMockHass() });
    editor.setConfig(VALID_CONFIG);
    await (editor as WithUpdateComplete).updateComplete;
    const selectors = editor.shadowRoot?.querySelectorAll('.threshold-field ha-selector');
    expect(selectors?.length).toBe(4);
  });

  it('renders the collapsible section-actions details element', async () => {
    const editor = createEditor({ hass: buildMockHass() });
    editor.setConfig(VALID_CONFIG);
    await (editor as WithUpdateComplete).updateComplete;
    expect(editor.shadowRoot?.querySelector('details.section-actions')).toBeTruthy();
  });

  it('renders 5 section-action-description elements', async () => {
    const editor = createEditor({ hass: buildMockHass() });
    editor.setConfig(VALID_CONFIG);
    await (editor as WithUpdateComplete).updateComplete;
    const descriptions = editor.shadowRoot?.querySelectorAll('.section-action-description');
    expect(descriptions?.length).toBe(5);
  });

  it('does not render an error paragraph when there is no validation error', async () => {
    const editor = createEditor({ hass: buildMockHass() });
    editor.setConfig(VALID_CONFIG);
    await (editor as WithUpdateComplete).updateComplete;
    expect(editor.shadowRoot?.querySelector('.error')).toBeFalsy();
  });

  it('renders .threshold-bar inside the temperature section', async () => {
    const editor = createEditor({ hass: buildMockHass() });
    editor.setConfig(VALID_CONFIG);
    await (editor as WithUpdateComplete).updateComplete;
    expect(editor.shadowRoot?.querySelector('.threshold-bar')).toBeTruthy();
  });

  it('renders threshold-indicator elements for all 4 thresholds', async () => {
    const editor = createEditor({ hass: buildMockHass() });
    editor.setConfig(VALID_CONFIG);
    await (editor as WithUpdateComplete).updateComplete;
    for (let i = 0; i < 4; i++) {
      expect(editor.shadowRoot?.querySelector(`.threshold-indicator-${i}`)).toBeTruthy();
    }
  });

  it('uses the updated active and hover chip button styles', async () => {
    const editor = createEditor({ hass: buildMockHass() });
    editor.setConfig(VALID_CONFIG);
    await (editor as WithUpdateComplete).updateComplete;

    const styleText = Array.from(editor.shadowRoot?.querySelectorAll('style') ?? [])
      .map((style) => style.textContent ?? '')
      .join('\n');

    expect(styleText).toContain('.chip-btn:hover:not(.chip-btn--active)');
    expect(styleText).toContain('-webkit-text-fill-color: var(--iopool-primary, #17817a);');
    expect(styleText).toContain('color: #fff !important;');
    expect(styleText).toContain('-webkit-text-fill-color: #fff;');
  });
});

// ---------------------------------------------------------------------------
// 4. _valueChanged → config-changed event
// ---------------------------------------------------------------------------

describe('IopoolCardEditor._valueChanged', () => {
  it('dispatches config-changed with the updated config on valid input', () => {
    const editor = createEditor({ hass: buildMockHass() });
    editor.setConfig(VALID_CONFIG);

    let emitted: IopoolCardConfig | undefined;
    editor.addEventListener('config-changed', (ev) => {
      emitted = (ev as CustomEvent<{ config: IopoolCardConfig }>).detail.config;
    });

    const newConfig: IopoolCardConfig = { ...VALID_CONFIG, show_chart: false };
    asInternals(editor)._valueChanged(
      new CustomEvent('value-changed', { detail: { value: newConfig } }),
    );

    expect(emitted).toEqual(newConfig);
  });

  it('does NOT dispatch config-changed when device_id is empty', () => {
    const editor = createEditor({ hass: buildMockHass() });
    editor.setConfig(VALID_CONFIG);

    let emitted = false;
    editor.addEventListener('config-changed', () => {
      emitted = true;
    });

    asInternals(editor)._valueChanged(
      new CustomEvent('value-changed', {
        detail: { value: { ...VALID_CONFIG, device_id: '' } },
      }),
    );

    expect(emitted).toBe(false);
  });

  it('sets a validation error when device_id is empty', () => {
    const editor = createEditor({ hass: buildMockHass() });
    editor.setConfig(VALID_CONFIG);

    asInternals(editor)._valueChanged(
      new CustomEvent('value-changed', {
        detail: { value: { ...VALID_CONFIG, device_id: '' } },
      }),
    );

    expect(asInternals(editor)._validationError).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 11. Invalid pump_entity does NOT emit config-changed
// ---------------------------------------------------------------------------

describe('IopoolCardEditor pump_entity validation', () => {
  it('does NOT dispatch config-changed when pump_entity does not start with switch.', () => {
    const editor = createEditor({ hass: buildMockHass() });
    editor.setConfig(VALID_CONFIG);

    let emitted = false;
    editor.addEventListener('config-changed', () => {
      emitted = true;
    });

    asInternals(editor)._valueChanged(
      new CustomEvent('value-changed', {
        detail: {
          value: {
            ...VALID_CONFIG,
            pump_entity: 'input_boolean.pump',
          },
        },
      }),
    );

    expect(emitted).toBe(false);
  });

  it('dispatches config-changed when pump_entity is a valid switch entity', () => {
    const editor = createEditor({ hass: buildMockHass() });
    editor.setConfig(VALID_CONFIG);

    let emitted = false;
    editor.addEventListener('config-changed', () => {
      emitted = true;
    });

    asInternals(editor)._valueChanged(
      new CustomEvent('value-changed', {
        detail: {
          value: {
            ...VALID_CONFIG,
            pump_entity: 'switch.pool_pump',
          },
        },
      }),
    );

    expect(emitted).toBe(true);
  });

  it('does NOT dispatch config-changed when temperature_thresholds are not strictly ascending', () => {
    const editor = createEditor({ hass: buildMockHass() });
    editor.setConfig(VALID_CONFIG);

    let emitted = false;
    editor.addEventListener('config-changed', () => {
      emitted = true;
    });

    asInternals(editor)._valueChanged(
      new CustomEvent('value-changed', {
        detail: {
          value: {
            ...VALID_CONFIG,
            temperature_thresholds: [20, 15, 29, 32] as unknown as [number, number, number, number],
          },
        },
      }),
    );

    expect(emitted).toBe(false);
  });

  it('sets a validation error when thresholds are not strictly ascending', () => {
    const editor = createEditor({ hass: buildMockHass() });
    editor.setConfig(VALID_CONFIG);

    asInternals(editor)._valueChanged(
      new CustomEvent('value-changed', {
        detail: {
          value: {
            ...VALID_CONFIG,
            temperature_thresholds: [20, 20, 29, 32] as unknown as [number, number, number, number],
          },
        },
      }),
    );

    expect(asInternals(editor)._validationError).toContain('Thresholds');
  });
});

// ---------------------------------------------------------------------------
// 5–6. _applyPreset
// ---------------------------------------------------------------------------

describe('IopoolCardEditor._applyPreset', () => {
  it('dispatches config-changed with DEFAULT_POOL_THRESHOLDS for the pool preset', () => {
    const editor = createEditor({ hass: buildMockHass() });
    editor.setConfig(VALID_CONFIG);

    let emitted: IopoolCardConfig | undefined;
    editor.addEventListener('config-changed', (ev) => {
      emitted = (ev as CustomEvent<{ config: IopoolCardConfig }>).detail.config;
    });

    asInternals(editor)._applyPreset('pool');

    expect(emitted?.temperature_thresholds).toEqual(DEFAULT_POOL_THRESHOLDS);
  });

  it('dispatches config-changed with DEFAULT_SPA_THRESHOLDS for the spa preset', () => {
    const editor = createEditor({ hass: buildMockHass() });
    editor.setConfig(VALID_CONFIG);

    let emitted: IopoolCardConfig | undefined;
    editor.addEventListener('config-changed', (ev) => {
      emitted = (ev as CustomEvent<{ config: IopoolCardConfig }>).detail.config;
    });

    asInternals(editor)._applyPreset('spa');

    expect(emitted?.temperature_thresholds).toEqual(DEFAULT_SPA_THRESHOLDS);
  });

  it('does nothing when config has not been set yet', () => {
    const editor = createEditor({ hass: buildMockHass() });

    let emitted = false;
    editor.addEventListener('config-changed', () => {
      emitted = true;
    });

    asInternals(editor)._applyPreset('pool');

    expect(emitted).toBe(false);
  });

  it('preserves existing config fields when applying a preset', () => {
    const editor = createEditor({ hass: buildMockHass() });
    const configWithPump: IopoolCardConfig = {
      ...VALID_CONFIG,
      pump_entity: 'switch.pool_pump',
    };
    editor.setConfig(configWithPump);

    let emitted: IopoolCardConfig | undefined;
    editor.addEventListener('config-changed', (ev) => {
      emitted = (ev as CustomEvent<{ config: IopoolCardConfig }>).detail.config;
    });

    asInternals(editor)._applyPreset('spa');

    expect(emitted?.pump_entity).toBe('switch.pool_pump');
    expect(emitted?.temperature_thresholds).toEqual(DEFAULT_SPA_THRESHOLDS);
  });
});

// ---------------------------------------------------------------------------
// 7–8. _computeLabel
// ---------------------------------------------------------------------------

describe('IopoolCardEditor._computeLabel', () => {
  it('returns the translated label for device_id (en)', () => {
    const editor = createEditor({ hass: buildMockHass({ language: 'en' }) });
    const label = asInternals(editor)._computeLabel({ name: 'device_id' });
    expect(label).toBe('iopool device');
  });

  it('returns the translated label for pump_entity (en)', () => {
    const editor = createEditor({ hass: buildMockHass({ language: 'en' }) });
    const label = asInternals(editor)._computeLabel({ name: 'pump_entity' });
    expect(label).toBe('Pump entity (optional)');
  });

  it('returns the translated label for show_chart (en)', () => {
    const editor = createEditor({ hass: buildMockHass({ language: 'en' }) });
    const label = asInternals(editor)._computeLabel({ name: 'show_chart' });
    expect(label).toBe('Show temperature chart');
  });

  it('returns boundary-style label for threshold 0 (en)', () => {
    const editor = createEditor({ hass: buildMockHass({ language: 'en' }) });
    const label = asInternals(editor)._computeLabel({ name: '0' });
    expect(label).toBe('Too cold \u2192 Cold');
  });

  it('returns boundary-style label for threshold 1 (en)', () => {
    const editor = createEditor({ hass: buildMockHass({ language: 'en' }) });
    const label = asInternals(editor)._computeLabel({ name: '1' });
    expect(label).toBe('Cold \u2192 Ideal');
  });

  it('returns boundary-style label for threshold 2 (en)', () => {
    const editor = createEditor({ hass: buildMockHass({ language: 'en' }) });
    const label = asInternals(editor)._computeLabel({ name: '2' });
    expect(label).toBe('Ideal \u2192 Warm');
  });

  it('returns boundary-style label for threshold 3 (en)', () => {
    const editor = createEditor({ hass: buildMockHass({ language: 'en' }) });
    const label = asInternals(editor)._computeLabel({ name: '3' });
    expect(label).toBe('Warm \u2192 Too hot');
  });

  it('returns the field name itself for unknown fields', () => {
    const editor = createEditor({ hass: buildMockHass() });
    const label = asInternals(editor)._computeLabel({ name: 'unknown_field_xyz' });
    expect(label).toBe('unknown_field_xyz');
  });

  it('returns French labels when language is fr', () => {
    const editor = createEditor({ hass: buildMockHass({ language: 'fr' }) });
    const label = asInternals(editor)._computeLabel({ name: 'device_id' });
    expect(label).toBe('Appareil iopool');
  });
});

// ---------------------------------------------------------------------------
// 9–10. _schema structure
// ---------------------------------------------------------------------------

describe('IopoolCardEditor._schema', () => {
  it('includes device_id with a device selector filtered to the iopool integration', () => {
    const editor = createEditor({ hass: buildMockHass() });
    const schema = asInternals(editor)._schema;
    const field = schema.find((f) => f.name === 'device_id');
    expect(field).toBeTruthy();
    expect(field?.required).toBe(true);
    const device = (field?.selector as Record<string, Record<string, unknown>>).device;
    if (!device) {
      throw new Error('Expected device selector');
    }
    const filter = device.filter as Record<string, unknown>;
    expect(filter.integration).toBe('iopool');
  });

  it('includes pump_entity with an entity selector filtering the switch domain', () => {
    const editor = createEditor({ hass: buildMockHass() });
    const schema = asInternals(editor)._schema;
    const field = schema.find((f) => f.name === 'pump_entity');
    expect(field).toBeTruthy();
    const entity = (field?.selector as Record<string, Record<string, unknown>>).entity;
    if (!entity) {
      throw new Error('Expected entity selector');
    }
    expect(entity.domain).toBe('switch');
  });

  it('does NOT include show_chart (now rendered as ha-selector, not via _schema)', () => {
    const editor = createEditor({ hass: buildMockHass() });
    const schema = asInternals(editor)._schema;
    const field = schema.find((f) => f.name === 'show_chart');
    expect(field).toBeUndefined();
  });

  it('does NOT include chart_period (now rendered as chip buttons, not via _schema)', () => {
    const editor = createEditor({ hass: buildMockHass() });
    const schema = asInternals(editor)._schema;
    const field = schema.find((f) => f.name === 'chart_period');
    expect(field).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 12. New editor structure — field wrappers, temperature section
// ---------------------------------------------------------------------------

describe('IopoolCardEditor new structure', () => {
  it('renders the section-temperature collapsible details element', async () => {
    const editor = createEditor({ hass: buildMockHass() });
    editor.setConfig(VALID_CONFIG);
    await (editor as WithUpdateComplete).updateComplete;
    expect(editor.shadowRoot?.querySelector('details.section-temperature')).toBeTruthy();
  });

  it('renders exactly 2 ha-form elements (device_id and pump_entity)', async () => {
    const editor = createEditor({ hass: buildMockHass() });
    editor.setConfig(VALID_CONFIG);
    await (editor as WithUpdateComplete).updateComplete;
    const forms = editor.shadowRoot?.querySelectorAll('ha-form');
    expect(forms?.length).toBe(2);
  });

  it('renders exactly 5 editor-field wrappers (device, pump, thresholds, show_chart, chart_period)', async () => {
    const editor = createEditor({ hass: buildMockHass() });
    editor.setConfig(VALID_CONFIG);
    await (editor as WithUpdateComplete).updateComplete;
    const fields = editor.shadowRoot?.querySelectorAll('.editor-field');
    expect(fields?.length).toBe(5);
  });

  it('renders field-header elements with field-title and field-description spans', async () => {
    const editor = createEditor({ hass: buildMockHass() });
    editor.setConfig(VALID_CONFIG);
    await (editor as WithUpdateComplete).updateComplete;
    const titles = editor.shadowRoot?.querySelectorAll('.field-title');
    const descriptions = editor.shadowRoot?.querySelectorAll('.field-description');
    expect(titles?.length ?? 0).toBeGreaterThanOrEqual(5);
    expect(descriptions?.length ?? 0).toBeGreaterThanOrEqual(5);
  });

  it('uses "Interactions" as the section-actions summary label (en)', async () => {
    const editor = createEditor({ hass: buildMockHass({ language: 'en' }) });
    editor.setConfig(VALID_CONFIG);
    await (editor as WithUpdateComplete).updateComplete;
    const summary = editor.shadowRoot?.querySelector('details.section-actions summary');
    expect(summary?.querySelector('ha-icon')).toBeTruthy();
    expect(summary?.textContent?.trim()).toContain('Interactions');
  });

  it('uses "Interactions" as the section-actions summary label (fr)', async () => {
    const editor = createEditor({ hass: buildMockHass({ language: 'fr' }) });
    editor.setConfig(VALID_CONFIG);
    await (editor as WithUpdateComplete).updateComplete;
    const summary = editor.shadowRoot?.querySelector('details.section-actions summary');
    expect(summary?.querySelector('ha-icon')).toBeTruthy();
    expect(summary?.textContent?.trim()).toContain('Interactions');
  });

  it('renders translated section-action titles and descriptions', async () => {
    const editor = createEditor({ hass: buildMockHass({ language: 'en' }) });
    editor.setConfig(VALID_CONFIG);
    await (editor as WithUpdateComplete).updateComplete;

    const titles = Array.from(
      editor.shadowRoot?.querySelectorAll('.section-action-title') ?? [],
    ).map((el) => el.textContent?.trim());
    const descriptions = Array.from(
      editor.shadowRoot?.querySelectorAll('.section-action-description') ?? [],
    ).map((el) => el.textContent?.trim());

    expect(titles).toEqual(['Temperature', 'pH', 'ORP', 'Pump', 'Filtration']);
    expect(descriptions).toEqual([
      'Triggered when tapping the temperature gauge',
      'Triggered when tapping the pH gauge',
      'Triggered when tapping the ORP gauge',
      'Triggered when tapping the pump icon in the pump widget',
      'Triggered when tapping the filtration section in the pump widget',
    ]);
  });

  it('defaults tap_action to more-info', async () => {
    const editor = createEditor({ hass: buildMockHass() });
    editor.setConfig(VALID_CONFIG);
    await (editor as WithUpdateComplete).updateComplete;

    const firstGroupSelectors = editor.shadowRoot?.querySelectorAll(
      '.section-action-group:first-of-type .action-row ha-selector',
    );

    expect(firstGroupSelectors?.length).toBe(1);
    expect((firstGroupSelectors?.[0] as HTMLElement & { value?: unknown })?.value).toEqual({
      action: 'more-info',
    });
  });

  it('renders ha-selector inside show-chart-field for the show_chart toggle', async () => {
    const editor = createEditor({ hass: buildMockHass() });
    editor.setConfig(VALID_CONFIG);
    await (editor as WithUpdateComplete).updateComplete;
    const selector = editor.shadowRoot?.querySelector('.show-chart-field ha-selector');
    expect(selector).toBeTruthy();
  });

  it('renders 4 chip-btn elements inside period-chips for chart_period', async () => {
    const editor = createEditor({ hass: buildMockHass() });
    editor.setConfig(VALID_CONFIG);
    await (editor as WithUpdateComplete).updateComplete;
    const chips = editor.shadowRoot?.querySelectorAll('.period-chips .chip-btn');
    expect(chips?.length).toBe(4);
  });

  it('renders ha-icon inside the section-temperature summary', async () => {
    const editor = createEditor({ hass: buildMockHass() });
    editor.setConfig(VALID_CONFIG);
    await (editor as WithUpdateComplete).updateComplete;
    const summary = editor.shadowRoot?.querySelector('details.section-temperature summary');
    expect(summary?.querySelector('ha-icon')).toBeTruthy();
  });

  it('renders temperature thresholds field first inside temperature-content', async () => {
    const editor = createEditor({ hass: buildMockHass() });
    editor.setConfig(VALID_CONFIG);
    await (editor as WithUpdateComplete).updateComplete;
    const fields = editor.shadowRoot?.querySelectorAll('.temperature-content .editor-field');
    // First field must be the thresholds field (contains .thresholds-grid)
    expect(fields?.[0]?.querySelector('.thresholds-grid')).toBeTruthy();
    // Second field must be show_chart (contains .show-chart-row)
    expect(fields?.[1]?.querySelector('.show-chart-row')).toBeTruthy();
    // Third field must be chart_period (contains .period-chips)
    expect(fields?.[2]?.querySelector('.period-chips')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 14. _showChartChanged
// ---------------------------------------------------------------------------

describe('IopoolCardEditor._showChartChanged', () => {
  it('dispatches config-changed with show_chart: true', () => {
    const editor = createEditor({ hass: buildMockHass() });
    editor.setConfig(VALID_CONFIG);

    let emitted: IopoolCardConfig | undefined;
    editor.addEventListener('config-changed', (ev) => {
      emitted = (ev as CustomEvent<{ config: IopoolCardConfig }>).detail.config;
    });

    asInternals(editor)._showChartChanged(
      new CustomEvent('value-changed', { detail: { value: true } }),
    );

    expect(emitted?.show_chart).toBe(true);
  });

  it('dispatches config-changed with show_chart: false', () => {
    const editor = createEditor({ hass: buildMockHass() });
    editor.setConfig({ ...VALID_CONFIG, show_chart: true });

    let emitted: IopoolCardConfig | undefined;
    editor.addEventListener('config-changed', (ev) => {
      emitted = (ev as CustomEvent<{ config: IopoolCardConfig }>).detail.config;
    });

    asInternals(editor)._showChartChanged(
      new CustomEvent('value-changed', { detail: { value: false } }),
    );

    expect(emitted?.show_chart).toBe(false);
  });

  it('does nothing when config has not been set', () => {
    const editor = createEditor({ hass: buildMockHass() });

    let emitted = false;
    editor.addEventListener('config-changed', () => {
      emitted = true;
    });

    asInternals(editor)._showChartChanged(
      new CustomEvent('value-changed', { detail: { value: true } }),
    );

    expect(emitted).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 15. _chartPeriodChanged
// ---------------------------------------------------------------------------

describe('IopoolCardEditor._chartPeriodChanged', () => {
  it('dispatches config-changed with numeric chart_period 24', () => {
    const editor = createEditor({ hass: buildMockHass() });
    editor.setConfig(VALID_CONFIG);

    let emitted: IopoolCardConfig | undefined;
    editor.addEventListener('config-changed', (ev) => {
      emitted = (ev as CustomEvent<{ config: IopoolCardConfig }>).detail.config;
    });

    asInternals(editor)._chartPeriodChanged(24);

    expect(emitted?.chart_period).toBe(24);
    expect(typeof emitted?.chart_period).toBe('number');
  });

  it('dispatches config-changed with numeric chart_period 168', () => {
    const editor = createEditor({ hass: buildMockHass() });
    editor.setConfig(VALID_CONFIG);

    let emitted: IopoolCardConfig | undefined;
    editor.addEventListener('config-changed', (ev) => {
      emitted = (ev as CustomEvent<{ config: IopoolCardConfig }>).detail.config;
    });

    asInternals(editor)._chartPeriodChanged(168);

    expect(emitted?.chart_period).toBe(168);
    expect(typeof emitted?.chart_period).toBe('number');
  });

  it('does nothing when config has not been set', () => {
    const editor = createEditor({ hass: buildMockHass() });

    let emitted = false;
    editor.addEventListener('config-changed', () => {
      emitted = true;
    });

    asInternals(editor)._chartPeriodChanged(48);

    expect(emitted).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 16. _thresholdZonePcts
// ---------------------------------------------------------------------------

describe('IopoolCardEditor._thresholdZonePcts', () => {
  it('returns 5 values that sum to 100 for valid thresholds', () => {
    const editor = createEditor({ hass: buildMockHass() });
    const pcts = asInternals(editor)._thresholdZonePcts([15, 20.5, 29, 32]);
    expect(pcts).toHaveLength(5);
    const sum = pcts.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(100, 5);
    expect(pcts[0]).toBe(15);
    expect(pcts[4]).toBe(15);
  });

  it('all 5 values are non-negative', () => {
    const editor = createEditor({ hass: buildMockHass() });
    const pcts = asInternals(editor)._thresholdZonePcts([15, 20.5, 29, 32]);
    pcts.forEach((p) => expect(p).toBeGreaterThanOrEqual(0));
  });

  it('clamps negative widths to 0 for inverted thresholds and still sums to 100', () => {
    const editor = createEditor({ hass: buildMockHass() });
    const pcts = asInternals(editor)._thresholdZonePcts([20, 15, 29, 32]);
    pcts.forEach((p) => expect(p).toBeGreaterThanOrEqual(0));
    const sum = pcts.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(100, 5);
    expect(pcts[0]).toBe(15);
    expect(pcts[4]).toBe(15);
  });

  it('uses pool preset thresholds and returns proportional inner percentages', () => {
    const editor = createEditor({ hass: buildMockHass() });
    const pcts = asInternals(editor)._thresholdZonePcts(DEFAULT_POOL_THRESHOLDS);
    expect(pcts).toHaveLength(5);
    const sum = pcts.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(100, 5);
    expect(pcts[0]).toBe(15);
    expect(pcts[4]).toBe(15);
    expect(pcts[1]).toBeCloseTo(22.6, 1);
    expect(pcts[2]).toBeCloseTo(35.0, 1);
    expect(pcts[3]).toBeCloseTo(12.4, 1);
  });
});

// ---------------------------------------------------------------------------
// 13. Editor isolation — window.customCards
// ---------------------------------------------------------------------------

describe('IopoolCardEditor isolation', () => {
  it('does not register itself in window.customCards', () => {
    // Only the main iopool-card registers in window.customCards.
    // The editor must not self-register there.
    const cards = (window as Window & { customCards?: Array<{ type: string }> }).customCards ?? [];
    const editorEntry = cards.find((c) => c.type === 'iopool-card-editor');
    expect(editorEntry).toBeUndefined();
  });

  it('registers the iopool-card-editor custom element', () => {
    expect(customElements.get('iopool-card-editor')).toBe(IopoolCardEditor);
  });
});

// ---------------------------------------------------------------------------
// 17. show_chart default (Task 2 fix)
// ---------------------------------------------------------------------------

describe('IopoolCardEditor show_chart default', () => {
  it('defaults show_chart ha-selector value to true when not set in config', async () => {
    const editor = createEditor({ hass: buildMockHass() });
    editor.setConfig(VALID_CONFIG);
    await (editor as WithUpdateComplete).updateComplete;

    const selector = editor.shadowRoot?.querySelector('.show-chart-field ha-selector') as
      | (HTMLElement & { value?: boolean })
      | null;
    expect(selector?.value).toBe(true);
  });

  it('respects show_chart: false when explicitly set', async () => {
    const editor = createEditor({ hass: buildMockHass() });
    editor.setConfig({ ...VALID_CONFIG, show_chart: false });
    await (editor as WithUpdateComplete).updateComplete;

    const selector = editor.shadowRoot?.querySelector('.show-chart-field ha-selector') as
      | (HTMLElement & { value?: boolean })
      | null;
    expect(selector?.value).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 18. chart_period chip default (Task 3 fix)
// ---------------------------------------------------------------------------

describe('IopoolCardEditor chart_period chip default', () => {
  it('marks the 24h chip as active when chart_period is not set (DEFAULT_CHART_PERIOD = 24)', async () => {
    const editor = createEditor({ hass: buildMockHass() });
    editor.setConfig(VALID_CONFIG); // no chart_period
    await (editor as WithUpdateComplete).updateComplete;

    const chips = Array.from(editor.shadowRoot?.querySelectorAll('.period-chips .chip-btn') ?? []);
    // Chips are rendered in order: [24, 48, 96, 168]
    expect(chips[0]?.classList.contains('chip-btn--active')).toBe(true);
    expect(chips[1]?.classList.contains('chip-btn--active')).toBe(false);
    expect(chips[2]?.classList.contains('chip-btn--active')).toBe(false);
    expect(chips[3]?.classList.contains('chip-btn--active')).toBe(false);
  });

  it('marks the 96h chip as active when chart_period is explicitly 96', async () => {
    const editor = createEditor({ hass: buildMockHass() });
    editor.setConfig({ ...VALID_CONFIG, chart_period: 96 });
    await (editor as WithUpdateComplete).updateComplete;

    const chips = Array.from(editor.shadowRoot?.querySelectorAll('.period-chips .chip-btn') ?? []);
    expect(chips[0]?.classList.contains('chip-btn--active')).toBe(false);
    expect(chips[1]?.classList.contains('chip-btn--active')).toBe(false);
    expect(chips[2]?.classList.contains('chip-btn--active')).toBe(true);
    expect(chips[3]?.classList.contains('chip-btn--active')).toBe(false);
  });
});

