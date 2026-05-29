import { describe, it, expect } from 'vitest';
import { sharedStyles } from './styles';

describe('sharedStyles', () => {
  it('is a truthy CSSResult', () => {
    expect(sharedStyles).toBeTruthy();
  });

  it('has a cssText or toString that returns a non-empty string', () => {
    const text = sharedStyles.toString();
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
  });

  it('contains .iopool-card class', () => {
    expect(sharedStyles.toString()).toContain('.iopool-card');
  });

  it('contains --iopool-primary custom property definition', () => {
    expect(sharedStyles.toString()).toContain('--iopool-primary');
  });

  it('contains .iopool-section class', () => {
    expect(sharedStyles.toString()).toContain('.iopool-section');
  });

  it('contains .error class', () => {
    expect(sharedStyles.toString()).toContain('.error');
  });

  it('contains .iopool-grayed class', () => {
    expect(sharedStyles.toString()).toContain('.iopool-grayed');
  });

  it('uses HA CSS variables for theming', () => {
    const text = sharedStyles.toString();
    expect(text).toContain('--primary-text-color');
    expect(text).toContain('--card-background-color');
  });
});
