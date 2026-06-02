import { beforeEach, describe, expect, it } from 'vitest';
import './warning-banner';

function clearDom(): void {
  document.body.innerHTML = '';
}

beforeEach(clearDom);

function createBanner(overrides: Record<string, unknown> = {}): HTMLElement {
  const element = document.createElement('iopool-warning-banner');
  Object.assign(element, overrides);
  document.body.append(element);
  return element;
}

type UpdateableElement = HTMLElement & { updateComplete: Promise<boolean> };

describe('iopool-warning-banner', () => {
  // --- initialization ---

  it('renders the initialization message', async () => {
    const element = createBanner({ type: 'initialization' }) as UpdateableElement;
    await element.updateComplete;
    expect(element.shadowRoot?.textContent).toContain(
      'Initialization in progress · data may be incomplete',
    );
  });

  // --- opening ---

  it('renders the opening message', async () => {
    const element = createBanner({ type: 'opening' }) as UpdateableElement;
    await element.updateComplete;
    expect(element.shadowRoot?.textContent).toContain(
      'Opening in progress · data may be incomplete',
    );
  });

  it('uses the pool icon for opening type', async () => {
    const element = createBanner({ type: 'opening' }) as UpdateableElement;
    await element.updateComplete;
    expect(element.shadowRoot?.querySelector('ha-icon[icon="mdi:pool"]')).toBeTruthy();
  });

  // --- maintenance with sensors ---

  it('renders sensor name + suffix when one sensor (temperature) is in maintenance', async () => {
    const element = createBanner({
      type: 'maintenance',
      sensors: ['temperature'],
    }) as UpdateableElement;
    await element.updateComplete;
    const text = element.shadowRoot?.textContent ?? '';
    expect(text).toContain('Temperature');
    expect(text).toContain('· data may be outdated');
  });

  it('renders sensor names + suffix when multiple sensors are in maintenance', async () => {
    const element = createBanner({
      type: 'maintenance',
      sensors: ['ph', 'orp'],
    }) as UpdateableElement;
    await element.updateComplete;
    const text = element.shadowRoot?.textContent ?? '';
    expect(text).toContain('pH');
    expect(text).toContain('ORP');
    expect(text).toContain('· data may be outdated');
  });

  it('renders all three sensor names when all are in maintenance', async () => {
    const element = createBanner({
      type: 'maintenance',
      sensors: ['temperature', 'ph', 'orp'],
    }) as UpdateableElement;
    await element.updateComplete;
    const text = element.shadowRoot?.textContent ?? '';
    expect(text).toContain('Temperature');
    expect(text).toContain('pH');
    expect(text).toContain('ORP');
    expect(text).toContain('· data may be outdated');
  });

  it('renders fallback maintenance message when sensors list is empty', async () => {
    const element = createBanner({ type: 'maintenance', sensors: [] }) as UpdateableElement;
    await element.updateComplete;
    expect(element.shadowRoot?.textContent).toContain('Maintenance mode · data may be outdated');
  });

  // --- French locale ---

  it('renders French sensor names when language is fr', async () => {
    const element = createBanner({
      type: 'maintenance',
      sensors: ['temperature'],
      language: 'fr',
    }) as UpdateableElement;
    await element.updateComplete;
    const text = element.shadowRoot?.textContent ?? '';
    expect(text).toContain('Température');
    expect(text).toContain('· données pouvant être obsolètes');
  });

  // --- icon ---

  it('uses the wrench icon for initialization type', async () => {
    const element = createBanner({ type: 'initialization' }) as UpdateableElement;
    await element.updateComplete;
    expect(element.shadowRoot?.querySelector('ha-icon[icon="mdi:wrench"]')).toBeTruthy();
  });
});
