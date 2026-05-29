import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HomeAssistant } from '../types';
import './mode-selector';

function clearDom(): void {
  document.body.innerHTML = '';
}

beforeEach(() => {
  clearDom();
  vi.restoreAllMocks();
});

function createHass(overrides: Partial<HomeAssistant> = {}): HomeAssistant {
  return {
    language: 'en',
    states: {
      'select.pool_mode': {
        entity_id: 'select.pool_mode',
        state: 'Standard',
        attributes: {},
        last_changed: '2026-01-01T00:00:00.000Z',
        last_updated: '2026-01-01T00:00:00.000Z',
      },
    },
    entities: {},
    devices: {},
    callService: vi.fn(),
    callApi: vi.fn(),
    ...overrides,
  };
}

type ModeSelectorElement = HTMLElement & {
  currentMode: string;
  updateComplete: Promise<boolean>;
};

function createElement(overrides: Record<string, unknown> = {}): ModeSelectorElement {
  const element = document.createElement('iopool-mode-selector') as ModeSelectorElement;
  Object.assign(element, overrides);
  document.body.append(element);
  return element;
}

describe('iopool-mode-selector', () => {
  it('renders the active segment button with the current mode text', async () => {
    const element = createElement({
      currentMode: 'Active-Winter',
      hass: createHass(),
      modeEntityId: 'select.pool_mode',
    });
    await element.updateComplete;

    expect(element.shadowRoot?.textContent).toContain('Active winter');
  });

  it('does not render the mode-selector__current element', async () => {
    const element = createElement({
      currentMode: 'Standard',
      hass: createHass(),
      modeEntityId: 'select.pool_mode',
    });
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector('.mode-selector__current')).toBeNull();
  });

  it('renders 3 segment buttons', async () => {
    const element = createElement({ hass: createHass(), modeEntityId: 'select.pool_mode' });
    await element.updateComplete;

    expect(element.shadowRoot?.querySelectorAll('button')).toHaveLength(3);
  });

  it('marks the active segment with the active class', async () => {
    const element = createElement({
      currentMode: 'Passive-Winter',
      hass: createHass(),
      modeEntityId: 'select.pool_mode',
    });
    await element.updateComplete;

    const activeButton = element.shadowRoot?.querySelector('.mode-selector__button--active');
    expect(activeButton?.textContent).toContain('Passive winter');
  });

  it('calls hass.callService when a segment is clicked', async () => {
    const hass = createHass();
    const element = createElement({ hass, modeEntityId: 'select.pool_mode' });
    await element.updateComplete;

    const buttons = element.shadowRoot?.querySelectorAll('button');
    buttons?.[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

    expect(hass.callService).toHaveBeenCalledWith('select', 'select_option', {
      entity_id: 'select.pool_mode',
      option: 'Active-Winter',
    });
  });

  it('does nothing when hass is undefined', async () => {
    const element = createElement({ modeEntityId: 'select.pool_mode' });
    await (element as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;

    const button = element.shadowRoot?.querySelector('button');
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

    expect(button?.hasAttribute('disabled')).toBe(true);
  });

  it('does nothing when modeEntityId is undefined', async () => {
    const hass = createHass();
    const element = createElement({ hass });
    await (element as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;

    const button = element.shadowRoot?.querySelector('button');
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

    expect(hass.callService).not.toHaveBeenCalled();
  });
});
