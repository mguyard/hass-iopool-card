import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HomeAssistant } from '../types';
import './pump-panel';

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
    states: {},
    entities: {},
    devices: {},
    callService: vi.fn(),
    callApi: vi.fn(),
    ...overrides,
  };
}

function createElement(
  overrides: Record<string, unknown> = {},
): HTMLElement & { updateComplete: Promise<boolean> } {
  const element = document.createElement('iopool-pump-panel');
  Object.assign(element, overrides);
  document.body.append(element);
  return element as HTMLElement & { updateComplete: Promise<boolean> };
}

// ── Pump section ──────────────────────────────────────────────────────────────

describe('iopool-pump-panel — pump section', () => {
  it('renders the pump label', async () => {
    const element = createElement({ hass: createHass(), pumpEntityId: 'switch.pool_pump' });
    await element.updateComplete;

    expect(element.shadowRoot?.textContent).toContain('Pool pump');
  });

  it('renders the on state with green class', async () => {
    const element = createElement({
      hass: createHass(),
      pumpEntityId: 'switch.pool_pump',
      pumpState: 'on',
    });
    await element.updateComplete;

    expect(element.shadowRoot?.textContent).toContain('On');
    expect(element.shadowRoot?.querySelector('.pump-panel__pump-status--on')).toBeTruthy();
    expect(element.shadowRoot?.querySelector('.pump-panel__toggle.on')).toBeTruthy();
  });

  it('renders the off state with red class', async () => {
    const element = createElement({
      hass: createHass(),
      pumpEntityId: 'switch.pool_pump',
      pumpState: 'off',
    });
    await element.updateComplete;

    expect(element.shadowRoot?.textContent).toContain('Off');
    expect(element.shadowRoot?.querySelector('.pump-panel__pump-status--off')).toBeTruthy();
  });

  it('does nothing when the pump is unavailable', async () => {
    const hass = createHass();
    const element = createElement({
      hass,
      pumpEntityId: 'switch.pool_pump',
      pumpState: 'unavailable',
    });
    await element.updateComplete;

    element.shadowRoot
      ?.querySelector('button.pump-panel__toggle')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

    expect(hass.callService).not.toHaveBeenCalled();
  });

  it('calls hass.callService when the toggle is clicked', async () => {
    const hass = createHass();
    const element = createElement({ hass, pumpEntityId: 'switch.pool_pump', pumpState: 'off' });
    await element.updateComplete;

    element.shadowRoot
      ?.querySelector('button.pump-panel__toggle')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

    expect(hass.callService).toHaveBeenCalledWith('switch', 'toggle', {
      entity_id: 'switch.pool_pump',
    });
  });

  it('disables the toggle when hass is missing', async () => {
    const element = createElement({ pumpEntityId: 'switch.pool_pump', pumpState: 'off' });
    await element.updateComplete;

    expect(
      element.shadowRoot?.querySelector('button.pump-panel__toggle')?.hasAttribute('disabled'),
    ).toBe(true);
  });
});

// ── Filtration section ────────────────────────────────────────────────────────

describe('iopool-pump-panel — filtration section', () => {
  it('renders the daily filtration label', async () => {
    const element = createElement();
    await element.updateComplete;

    expect(element.shadowRoot?.textContent).toContain('Daily filtration');
  });

  it('calculates the percentage correctly', async () => {
    const element = createElement({ filtrationDurationMinutes: 492, recommendedMinutes: 360 });
    await element.updateComplete;

    expect(element.shadowRoot?.textContent).toContain('137%');
  });

  it('caps the bar fill width at 100 percent', async () => {
    const element = createElement({ filtrationDurationMinutes: 492, recommendedMinutes: 360 });
    await element.updateComplete;

    const fill = element.shadowRoot?.querySelector(
      '.pump-panel__filtration-fill',
    ) as HTMLElement | null;
    expect(fill?.style.width).toBe('100%');
  });

  it('uses integrationRequiredMinutes as primary target for percentage calculation', async () => {
    const element = createElement({
      filtrationDurationMinutes: 240,
      integrationRequiredMinutes: 300,
      recommendedMinutes: 360,
    });
    await element.updateComplete;
    // 240 / 300 = 80%
    expect(element.shadowRoot?.textContent).toContain('80%');
  });

  it('shows elapsed, required, and iopool values in 3 columns', async () => {
    const element = createElement({
      filtrationDurationMinutes: 90,
      integrationRequiredMinutes: 120,
      recommendedMinutes: 180,
    });
    await element.updateComplete;
    const text = element.shadowRoot?.textContent ?? '';
    // en: "1h30m", "2h00m", "3h00m"
    expect(text).toContain('1h30m');
    expect(text).toContain('2h00m');
    expect(text).toContain('3h00m');
  });

  it('falls back to recommendedMinutes when integrationRequiredMinutes is null', async () => {
    const element = createElement({
      filtrationDurationMinutes: 360,
      integrationRequiredMinutes: null,
      recommendedMinutes: 360,
    });
    await element.updateComplete;
    expect(element.shadowRoot?.textContent).toContain('100%');
  });

  it('shows -- for null integration required duration', async () => {
    const element = createElement({
      filtrationDurationMinutes: 60,
      integrationRequiredMinutes: null,
      recommendedMinutes: 120,
    });
    await element.updateComplete;
    // Required column shows '--'
    const stats = element.shadowRoot?.querySelectorAll('.pump-panel__filtration-stat-value');
    // stats[1] is the Required column (center)
    expect(stats?.[1]?.textContent?.trim()).toBe('--');
  });

  it('shows no-data fallback gracefully', async () => {
    const element = createElement();
    await element.updateComplete;

    expect(element.shadowRoot?.textContent).toContain('0%');
    expect(element.shadowRoot?.textContent).toContain('--');
  });

  it('formats durations using hours and minutes (no seconds)', async () => {
    const element = createElement({ filtrationDurationMinutes: 492, recommendedMinutes: 360 });
    await element.updateComplete;

    expect(element.shadowRoot?.textContent).toContain('8h12m');
    expect(element.shadowRoot?.textContent).toContain('6h00m');
  });

  it('shows integrationRequiredMinutes in the Required column', async () => {
    const element = createElement({
      filtrationDurationMinutes: 492,
      integrationRequiredMinutes: 300,
      recommendedMinutes: 420,
    });
    await element.updateComplete;

    expect(element.shadowRoot?.textContent).toContain('5h00m');
    expect(element.shadowRoot?.textContent).toContain('7h00m');
    // iopool rec. label must be present
    expect(element.shadowRoot?.textContent).toContain('iopool rec.');
  });

  it('applies the --done modifier class when percentage is 100 or more', async () => {
    const element = createElement({ filtrationDurationMinutes: 360, recommendedMinutes: 360 });
    await element.updateComplete;
    expect(element.shadowRoot?.querySelector('.pump-panel__filtration-pct--done')).toBeTruthy();
  });

  it('does not apply the --done modifier class when percentage is below 100', async () => {
    const element = createElement({ filtrationDurationMinutes: 180, recommendedMinutes: 360 });
    await element.updateComplete;
    expect(element.shadowRoot?.querySelector('.pump-panel__filtration-pct--done')).toBeNull();
  });
});

// ── Boost section ─────────────────────────────────────────────────────────────

describe('iopool-pump-panel — boost section', () => {
  it('renders all 6 buttons when boostEntityId is provided', async () => {
    const element = createElement({ hass: createHass(), boostEntityId: 'select.boost' });
    await element.updateComplete;

    const buttons = element.shadowRoot?.querySelectorAll('.pump-panel__boost-btn');
    expect(buttons?.length).toBe(6);
  });

  it('highlights the active button when currentOption matches', async () => {
    const element = createElement({
      hass: createHass(),
      boostEntityId: 'select.boost',
      currentOption: '2H',
    });
    await element.updateComplete;

    const buttons = element.shadowRoot?.querySelectorAll('.pump-panel__boost-btn');
    // Button order: none, 1H, 2H, 4H, 8H, 24H → index 2 is '2H'
    expect(buttons?.[2]?.classList.contains('pump-panel__boost-btn--active')).toBe(true);
    expect(buttons?.[0]?.classList.contains('pump-panel__boost-btn--active')).toBe(false);
  });

  it('calls hass.callService with the correct option when a duration button is clicked', async () => {
    const hass = createHass();
    const element = createElement({
      hass,
      boostEntityId: 'select.pool_boost',
      currentOption: 'none',
    });
    await element.updateComplete;

    // '2H' is the third button (index 2)
    const buttons = element.shadowRoot?.querySelectorAll('.pump-panel__boost-btn');
    (buttons?.[2] as HTMLButtonElement)?.click();

    expect(hass.callService).toHaveBeenCalledWith('select', 'select_option', {
      entity_id: 'select.pool_boost',
      option: '2H',
    });
  });

  it('sends "None" option when the stop button is clicked while boost is active', async () => {
    const hass = createHass();
    const endTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const element = createElement({
      hass,
      boostEntityId: 'select.pool_boost',
      currentOption: '1H',
      endTime,
    });
    await element.updateComplete;

    const noneBtn = element.shadowRoot?.querySelector(
      '.pump-panel__boost-btn',
    ) as HTMLButtonElement;
    noneBtn?.click();

    expect(hass.callService).toHaveBeenCalledWith('select', 'select_option', {
      entity_id: 'select.pool_boost',
      option: 'None',
    });
  });

  it('does not render the countdown bar when boost is inactive', async () => {
    const element = createElement({
      hass: createHass(),
      boostEntityId: 'select.boost',
      currentOption: 'none',
    });
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector('.pump-panel__boost-countdown')).toBeNull();
  });

  it('countdown fill width reflects remaining time correctly', async () => {
    // endTime is 30 minutes from now, total duration is 1h → ~50% remaining
    const endTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const element = createElement({
      hass: createHass(),
      boostEntityId: 'select.boost',
      currentOption: '1H',
      endTime,
    });
    await element.updateComplete;

    const fill = element.shadowRoot?.querySelector(
      '.pump-panel__boost-countdown-fill',
    ) as HTMLElement | null;
    const width = parseFloat(fill?.style.width ?? '');

    // 30 min / 60 min = 50% ± small margin for test execution time
    expect(width).toBeGreaterThan(48);
    expect(width).toBeLessThan(52);
  });

  it('countdown bar is visible only when boost is active', async () => {
    const elementOff = createElement({
      hass: createHass(),
      boostEntityId: 'select.boost',
      currentOption: 'none',
    });
    await elementOff.updateComplete;
    expect(elementOff.shadowRoot?.querySelector('.pump-panel__boost-countdown')).toBeNull();

    const endTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const elementOn = createElement({
      hass: createHass(),
      boostEntityId: 'select.boost',
      currentOption: '2H',
      endTime,
    });
    await elementOn.updateComplete;
    expect(elementOn.shadowRoot?.querySelector('.pump-panel__boost-countdown')).toBeTruthy();
  });

  it('starts the RAF loop on connect and stops it on disconnect', async () => {
    const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(42);
    const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame');

    const element = createElement({ hass: createHass(), boostEntityId: 'select.boost' });
    await element.updateComplete;

    expect(rafSpy).toHaveBeenCalled();

    element.remove();

    expect(cancelSpy).toHaveBeenCalledWith(42);
  });

  it('does nothing when hass is undefined', async () => {
    const element = createElement({ boostEntityId: 'select.boost', currentOption: 'none' });
    await element.updateComplete;

    const buttons = element.shadowRoot?.querySelectorAll('.pump-panel__boost-btn');
    (buttons?.[1] as HTMLButtonElement)?.click();

    // No hass → callService should never be invoked; component must not throw
    expect(element.shadowRoot?.querySelector('.pump-panel__boost-grid')).toBeTruthy();
  });

  it('shows remaining countdown with seconds in the boost header when active', async () => {
    const endTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const element = createElement({
      hass: createHass(),
      boostEntityId: 'select.boost',
      currentOption: '1H',
      endTime,
    });
    await element.updateComplete;

    const header = element.shadowRoot?.querySelector('.pump-panel__boost-header');
    const text = header?.textContent ?? '';
    // Should contain parenthesized countdown with seconds marker
    expect(text).toContain('(');
    expect(text).toContain(')');
    expect(text).toMatch(/\d+m \d{2}s/);
  });
});

// ── Combined rendering ────────────────────────────────────────────────────────

describe('iopool-pump-panel — combined rendering', () => {
  it('does not render the boost section when boostEntityId is undefined', async () => {
    const element = createElement({ hass: createHass() });
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector('.pump-panel__boost')).toBeNull();
    expect(element.shadowRoot?.querySelector('.pump-panel__boost-grid')).toBeNull();
  });

  it('always renders the filtration section', async () => {
    const element = createElement({ hass: createHass() });
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector('.pump-panel__filtration')).toBeTruthy();
  });

  it('renders at least one divider between pump and filtration sections', async () => {
    const element = createElement({ hass: createHass() });
    await element.updateComplete;

    const dividers = element.shadowRoot?.querySelectorAll('.pump-panel__divider');
    expect(dividers?.length).toBeGreaterThanOrEqual(1);
  });

  it('renders two dividers when boostEntityId is provided', async () => {
    const element = createElement({ hass: createHass(), boostEntityId: 'select.boost' });
    await element.updateComplete;

    const dividers = element.shadowRoot?.querySelectorAll('.pump-panel__divider');
    expect(dividers?.length).toBe(2);
  });

  it('renders the outer pump-panel container', async () => {
    const element = createElement({ hass: createHass() });
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector('.pump-panel')).toBeTruthy();
  });

  it('renders pump, filtration, and boost sections together', async () => {
    const endTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const element = createElement({
      hass: createHass(),
      pumpEntityId: 'switch.pool_pump',
      pumpState: 'on',
      filtrationDurationMinutes: 360,
      recommendedMinutes: 360,
      boostEntityId: 'select.boost',
      currentOption: '1H',
      endTime,
    });
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector('.pump-panel__pump')).toBeTruthy();
    expect(element.shadowRoot?.querySelector('.pump-panel__filtration')).toBeTruthy();
    expect(element.shadowRoot?.querySelector('.pump-panel__boost')).toBeTruthy();
  });
});

// ── Custom event dispatching ───────────────────────────────────────────────────

describe('iopool-pump-panel — custom event dispatching', () => {
  it('dispatches pump-icon-tap when the pump icon is clicked', async () => {
    const element = createElement({
      hass: createHass(),
      pumpEntityId: 'switch.pool_pump',
      pumpState: 'off',
    });
    await element.updateComplete;

    let received = false;
    element.addEventListener('pump-icon-tap', () => {
      received = true;
    });

    element.shadowRoot
      ?.querySelector('.pump-panel__icon')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

    expect(received).toBe(true);
  });

  it('does not propagate the original click when pump icon is clicked (stopPropagation)', async () => {
    const element = createElement({
      hass: createHass(),
      pumpEntityId: 'switch.pool_pump',
      pumpState: 'off',
    });
    await element.updateComplete;

    let bubbledClick = false;
    document.body.addEventListener('click', () => {
      bubbledClick = true;
    });

    element.shadowRoot
      ?.querySelector('.pump-panel__icon')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

    // The pump-icon-tap CustomEvent bubbles, but the original click must be stopped.
    // Because composed: true lets it cross shadow boundaries, we verify the handler
    // stops propagation by checking that the document-body click listener was NOT called
    // via the shadow DOM click (MouseEvent is stopped inside the shadow root).
    expect(bubbledClick).toBe(false);
  });

  it('dispatches filtration-tap when the filtration section is clicked', async () => {
    const element = createElement({
      filtrationDurationMinutes: 180,
      recommendedMinutes: 360,
    });
    await element.updateComplete;

    let received = false;
    element.addEventListener('filtration-tap', () => {
      received = true;
    });

    element.shadowRoot
      ?.querySelector('.pump-panel__filtration')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

    expect(received).toBe(true);
  });
});
