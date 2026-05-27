import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HomeAssistant, IopoolCardConfig } from './types';
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
  _schema: Array<{ name: string; required?: boolean; selector: Record<string, unknown> }>;
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

  it('does not render an error paragraph when there is no validation error', async () => {
    const editor = createEditor({ hass: buildMockHass() });
    editor.setConfig(VALID_CONFIG);
    await (editor as WithUpdateComplete).updateComplete;
    expect(editor.shadowRoot?.querySelector('.error')).toBeFalsy();
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
    expect(device).toBeTruthy();
    const filter = device.filter as Record<string, unknown>;
    expect(filter.integration).toBe('iopool');
  });

  it('includes pump_entity with an entity selector filtering the switch domain', () => {
    const editor = createEditor({ hass: buildMockHass() });
    const schema = asInternals(editor)._schema;
    const field = schema.find((f) => f.name === 'pump_entity');
    expect(field).toBeTruthy();
    const entity = (field?.selector as Record<string, Record<string, unknown>>).entity;
    expect(entity.domain).toBe('switch');
  });

  it('includes show_chart with a boolean selector', () => {
    const editor = createEditor({ hass: buildMockHass() });
    const schema = asInternals(editor)._schema;
    const field = schema.find((f) => f.name === 'show_chart');
    expect(field).toBeTruthy();
    expect((field?.selector as Record<string, unknown>).boolean).toBeDefined();
  });

  it('includes chart_period with a select selector containing 4 options', () => {
    const editor = createEditor({ hass: buildMockHass() });
    const schema = asInternals(editor)._schema;
    const field = schema.find((f) => f.name === 'chart_period');
    expect(field).toBeTruthy();
    const select = (field?.selector as Record<string, Record<string, unknown>>).select;
    const options = select.options as Array<unknown>;
    expect(options.length).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// 12. Editor isolation — window.customCards
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
