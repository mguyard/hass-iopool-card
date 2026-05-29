import { beforeEach, describe, expect, it, vi } from 'vitest';
import './liquid-gauge';

function clearDom(): void {
  document.body.innerHTML = '';
}

beforeEach(() => {
  clearDom();
  vi.restoreAllMocks();
});

function createGauge(overrides: Record<string, unknown> = {}): HTMLElement {
  const element = document.createElement('iopool-liquid-gauge');
  Object.assign(element, overrides);
  document.body.append(element);
  return element;
}

describe('iopool-liquid-gauge', () => {
  it('renders the label', async () => {
    const element = createGauge({ label: 'TEMP.' });
    await (element as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;

    expect(element.shadowRoot?.textContent).toContain('TEMP.');
  });

  it('renders a placeholder when the value is null', async () => {
    const element = createGauge({ value: null });
    await (element as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;

    expect(element.shadowRoot?.textContent).toContain('--');
  });

  it('renders the unit', async () => {
    const element = createGauge({ unit: '°C' });
    await (element as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;

    expect(element.shadowRoot?.textContent).toContain('°C');
  });

  it('renders target info when provided', async () => {
    const element = createGauge({ target: 27, targetLabel: 'CIBLE 27°C' });
    await (element as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;

    expect(element.shadowRoot?.textContent).toContain('CIBLE 27°C');
  });

  it('renders target range when both target and targetHigh are provided', async () => {
    const element = createGauge({ target: 20.5, targetHigh: 29, language: 'en' });
    await (element as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;

    expect(element.shadowRoot?.textContent).toContain('20.5');
    expect(element.shadowRoot?.textContent).toContain('29');
    expect(element.shadowRoot?.textContent).toContain('-');
  });

  it('renders single target value when only target is provided', async () => {
    const element = createGauge({ target: 20.5, language: 'en' });
    await (element as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;

    expect(element.shadowRoot?.textContent).toContain('20.5');
  });

  it('starts the animation loop on connect', async () => {
    const requestAnimationFrameSpy = vi
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockReturnValue(42);

    const element = createGauge();
    await (element as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;

    expect(requestAnimationFrameSpy).toHaveBeenCalled();
  });

  it('stops the animation loop on disconnect', async () => {
    const requestAnimationFrameSpy = vi
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockReturnValue(99);
    const cancelAnimationFrameSpy = vi.spyOn(globalThis, 'cancelAnimationFrame');

    const element = createGauge();
    await (element as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;
    element.remove();

    expect(requestAnimationFrameSpy).toHaveBeenCalled();
    expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(99);
  });

  it('applies the correct zone color class', async () => {
    const element = createGauge({ zone: 'ok' });
    await (element as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;

    const root = element.shadowRoot?.querySelector('.iopool-liquid-gauge');
    expect(root?.classList.contains('zone-ok')).toBe(true);
  });

  it('renders the status label based on the zone', async () => {
    const element = createGauge({ zone: 'ok' });
    await (element as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;

    expect(element.shadowRoot?.textContent).toContain('Ideal');
  });

  it('applies status-bad class and Critical label for red-low zone', async () => {
    const element = createGauge({ zone: 'red-low' });
    await (element as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;

    const statusEl = element.shadowRoot?.querySelector('.iopool-liquid-gauge__status');
    expect(statusEl?.classList.contains('status-bad')).toBe(true);
    expect(statusEl?.textContent?.trim()).toBe('Critical');
  });

  it('applies status-warn class for yellow-low zone', async () => {
    const element = createGauge({ zone: 'yellow-low' });
    await (element as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;

    const statusEl = element.shadowRoot?.querySelector('.iopool-liquid-gauge__status');
    expect(statusEl?.classList.contains('status-warn')).toBe(true);
    expect(statusEl?.textContent?.trim()).toBe('Warning');
  });

  it('applies status-ok class for unknown zone', async () => {
    const element = createGauge({ zone: 'unknown' });
    await (element as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;

    const statusEl = element.shadowRoot?.querySelector('.iopool-liquid-gauge__status');
    expect(statusEl?.classList.contains('status-ok')).toBe(true);
  });
});
