import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DebugLogger, createDebugLogger } from './debug';

describe('DebugLogger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
    vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
    vi.spyOn(console, 'time').mockImplementation(() => {});
    vi.spyOn(console, 'timeEnd').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('when disabled', () => {
    it('does not emit debug messages', () => {
      const logger = new DebugLogger(false);
      logger.debug('lifecycle', 'setConfig called');
      expect(console.log).not.toHaveBeenCalled();
    });

    it('does not emit info messages', () => {
      const logger = new DebugLogger(false);
      logger.info('device', 'entities resolved');
      expect(console.info).not.toHaveBeenCalled();
    });

    it('still emits warn messages', () => {
      const logger = new DebugLogger(false);
      logger.warn('config', 'device not found');
      expect(console.warn).toHaveBeenCalledOnce();
    });

    it('still emits error messages', () => {
      const logger = new DebugLogger(false);
      logger.error('config', 'critical failure');
      expect(console.error).toHaveBeenCalledOnce();
    });

    it('does not start a timer', () => {
      const logger = new DebugLogger(false);
      logger.timeStart('history-fetch');
      expect(console.time).not.toHaveBeenCalled();
    });

    it('does not stop a timer', () => {
      const logger = new DebugLogger(false);
      logger.timeEnd('history-fetch');
      expect(console.timeEnd).not.toHaveBeenCalled();
    });

    it('executes the group callback but does not open a console group', () => {
      const logger = new DebugLogger(false);
      const callback = vi.fn();
      logger.group('test group', callback);
      expect(callback).toHaveBeenCalledOnce();
      expect(console.groupCollapsed).not.toHaveBeenCalled();
    });
  });

  describe('when enabled', () => {
    it('emits debug messages via console.log with prefix', () => {
      const logger = new DebugLogger(true);
      logger.debug('lifecycle', 'setConfig called', { device_id: 'abc' });
      expect(console.log).toHaveBeenCalledOnce();
      const call = vi.mocked(console.log).mock.calls[0]!;
      expect(call[0]).toContain('[iopool-card]');
      expect(call[0]).toContain('[lifecycle]');
      expect(call[0]).toContain('setConfig called');
    });

    it('emits info messages via console.info', () => {
      const logger = new DebugLogger(true);
      logger.info('device', 'entities resolved');
      expect(console.info).toHaveBeenCalledOnce();
    });

    it('emits warn messages via console.warn', () => {
      const logger = new DebugLogger(true);
      logger.warn('config', 'fallback used');
      expect(console.warn).toHaveBeenCalledOnce();
    });

    it('emits error messages via console.error', () => {
      const logger = new DebugLogger(true);
      logger.error('config', 'setConfig failed');
      expect(console.error).toHaveBeenCalledOnce();
    });

    it('starts a timer via console.time', () => {
      const logger = new DebugLogger(true);
      logger.timeStart('history-fetch');
      expect(console.time).toHaveBeenCalledWith('[iopool-card] history-fetch');
    });

    it('stops a timer via console.timeEnd', () => {
      const logger = new DebugLogger(true);
      logger.timeEnd('history-fetch');
      expect(console.timeEnd).toHaveBeenCalledWith('[iopool-card] history-fetch');
    });

    it('opens and closes a console group, running the callback inside it', () => {
      const logger = new DebugLogger(true);
      const callback = vi.fn();
      logger.group('device resolution', callback);
      expect(console.groupCollapsed).toHaveBeenCalledOnce();
      expect(callback).toHaveBeenCalledOnce();
      expect(console.groupEnd).toHaveBeenCalledOnce();
    });

    it('closes the group even if the callback throws', () => {
      const logger = new DebugLogger(true);
      expect(() => {
        logger.group('failing group', () => {
          throw new Error('callback error');
        });
      }).toThrow('callback error');
      expect(console.groupEnd).toHaveBeenCalledOnce();
    });
  });

  describe('setEnabled', () => {
    it('can be toggled from disabled to enabled', () => {
      const logger = new DebugLogger(false);
      expect(console.log).not.toHaveBeenCalled();
      logger.setEnabled(true);
      logger.debug('test', 'message');
      expect(console.log).toHaveBeenCalledOnce();
    });

    it('can be toggled from enabled to disabled', () => {
      const logger = new DebugLogger(true);
      logger.setEnabled(false);
      logger.debug('test', 'message');
      expect(console.log).not.toHaveBeenCalled();
    });
  });
});

describe('createDebugLogger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a no-op function when disabled', () => {
    const log = createDebugLogger(false);
    log('some', 'message', 123);
    expect(console.debug).not.toHaveBeenCalled();
  });

  it('returns a function that calls console.debug when enabled', () => {
    const log = createDebugLogger(true);
    log('some', 'message', 123);
    expect(console.debug).toHaveBeenCalledOnce();
    expect(console.debug).toHaveBeenCalledWith('[iopool-card]', 'some', 'message', 123);
  });

  it('disabled logger accepts any arguments without error', () => {
    const log = createDebugLogger(false);
    expect(() => log('arg1', { obj: true }, [1, 2, 3])).not.toThrow();
  });
});
