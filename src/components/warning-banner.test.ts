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

describe('iopool-warning-banner', () => {
  it('renders the maintenance message', async () => {
    const element = createBanner({ type: 'maintenance' });
    await (element as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;

    expect(element.shadowRoot?.textContent).toContain('Maintenance mode · data may be outdated');
  });

  it('renders the initialization message', async () => {
    const element = createBanner({ type: 'initialization' });
    await (element as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;

    expect(element.shadowRoot?.textContent).toContain(
      'Initialization in progress · data may be incomplete',
    );
  });

  it('uses the wrench icon', async () => {
    const element = createBanner({ type: 'maintenance' });
    await (element as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;

    expect(element.shadowRoot?.querySelector('ha-icon[icon="mdi:wrench"]')).toBeTruthy();
  });
});
