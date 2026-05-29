import { beforeEach, describe, expect, it } from 'vitest';
import './header';

function clearDom(): void {
  document.body.innerHTML = '';
}

beforeEach(clearDom);

function createHeader(overrides: Partial<HTMLElement> = {}): HTMLElement {
  const element = document.createElement('iopool-header');
  Object.assign(element, overrides);
  document.body.append(element);
  return element;
}

describe('iopool-header', () => {
  it('renders the pool name', async () => {
    const element = createHeader({ poolName: 'Bazemont' } as unknown as Partial<HTMLElement>);
    await (element as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;

    expect(element.shadowRoot?.textContent).toContain('Bazemont');
  });

  it('renders the correct mode badge icon for each mode', async () => {
    const cases = [
      ['Standard', 'mdi:white-balance-sunny'],
      ['Active-Winter', 'mdi:sun-snowflake-variant'],
      ['Passive-Winter', 'mdi:snowflake'],
    ] as const;

    for (const [mode, icon] of cases) {
      const element = createHeader({ poolMode: mode } as unknown as Partial<HTMLElement>);
      await (element as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;

      expect(element.shadowRoot?.querySelector(`ha-icon[icon="${icon}"]`)).toBeTruthy();
    }
  });

  it('renders the status badge with the ok class', async () => {
    const element = createHeader({ status: 'ok' } as unknown as Partial<HTMLElement>);
    await (element as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;

    const badge = element.shadowRoot?.querySelector('.iopool-header__badge--ok');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toContain('All good');
  });

  it('renders the status badge with the warn class for action_recommended', async () => {
    const element = createHeader({
      status: 'action_recommended',
    } as unknown as Partial<HTMLElement>);
    await (element as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;

    const badge = element.shadowRoot?.querySelector('.iopool-header__badge--warn');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toContain('Action recommended');
  });

  it('renders the status badge with the err class for action_required', async () => {
    const element = createHeader({ status: 'action_required' } as unknown as Partial<HTMLElement>);
    await (element as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;

    const badge = element.shadowRoot?.querySelector('.iopool-header__badge--err');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toContain('Action required');
  });

  it('shows the DEBUG badge when debugEnabled is true', async () => {
    const element = createHeader({ debugEnabled: true } as unknown as Partial<HTMLElement>);
    await (element as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;

    expect(element.shadowRoot?.textContent).toContain('DEBUG');
  });

  it('hides the DEBUG badge when debugEnabled is false', async () => {
    const element = createHeader({ debugEnabled: false } as unknown as Partial<HTMLElement>);
    await (element as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;

    expect(element.shadowRoot?.textContent).not.toContain('DEBUG');
  });

  it('uses the translated subtitle', async () => {
    const element = createHeader({ language: 'fr' } as unknown as Partial<HTMLElement>);
    await (element as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;

    expect(element.shadowRoot?.textContent).toContain('Gestion de votre bassin');
  });
});
