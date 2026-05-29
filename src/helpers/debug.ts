const PREFIX = '[iopool-card]';
const STYLE_INFO = 'color: #17817A; font-weight: 700;';
const STYLE_WARN = 'color: #F5A623; font-weight: 700;';
const STYLE_ERROR = 'color: #D0021B; font-weight: 700;';
const STYLE_DEBUG = 'color: #4BCFFA; font-weight: 700;';

/**
 * Structured debug logger for the iopool card (SPECIFICATIONS §11.3).
 *
 * When enabled (config.debug === true):
 * - debug() and info() emit styled console messages with group context.
 * - warn() and error() are ALWAYS emitted, regardless of enabled state.
 *
 * Usage:
 *   const logger = new DebugLogger(config.debug ?? false);
 *   logger.debug('lifecycle', 'setConfig called', config);
 */
export class DebugLogger {
  private _enabled: boolean;

  constructor(enabled: boolean) {
    this._enabled = enabled;
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
  }

  debug(group: string, message: string, ...data: unknown[]): void {
    if (!this._enabled) return;
    console.log(`%c${PREFIX} [${group}] ${message}`, STYLE_DEBUG, ...data);
  }

  info(group: string, message: string, ...data: unknown[]): void {
    if (!this._enabled) return;
    console.info(`%c${PREFIX} [${group}] ${message}`, STYLE_INFO, ...data);
  }

  // Warnings are always shown — never gated on _enabled
  warn(group: string, message: string, ...data: unknown[]): void {
    console.warn(`%c${PREFIX} [${group}] ${message}`, STYLE_WARN, ...data);
  }

  // Errors are always shown — never gated on _enabled
  error(group: string, message: string, ...data: unknown[]): void {
    console.error(`%c${PREFIX} [${group}] ${message}`, STYLE_ERROR, ...data);
  }

  group(name: string, fn: () => void): void {
    if (!this._enabled) {
      fn();
      return;
    }
    console.groupCollapsed(`%c${PREFIX} ${name}`, STYLE_DEBUG);
    try {
      fn();
    } finally {
      console.groupEnd();
    }
  }

  timeStart(label: string): void {
    if (!this._enabled) return;
    console.time(`${PREFIX} ${label}`);
  }

  timeEnd(label: string): void {
    if (!this._enabled) return;
    console.timeEnd(`${PREFIX} ${label}`);
  }
}

/**
 * Lightweight factory function for simple debug logging needs.
 * Returns a no-op when disabled.
 *
 * For structured logging with groups and levels, use DebugLogger instead.
 */
export function createDebugLogger(enabled: boolean): (...args: unknown[]) => void {
  if (!enabled) return () => {};
  return (...args: unknown[]) => console.debug('[iopool-card]', ...args);
}
