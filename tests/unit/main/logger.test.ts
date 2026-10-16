import { describe, expect, it, vi } from 'vitest';
import { createLogger } from '../../../src/main/services/logger';

describe('createLogger', () => {
  it('writes messages at or above the configured level', () => {
    const sink = { log: vi.fn() };
    const logger = createLogger('warn', sink);

    logger.debug('hidden');
    logger.info('hidden');
    logger.warn('shown');
    logger.error('also shown');

    expect(sink.log.mock.calls).toEqual([['[warn] shown'], ['[error] also shown']]);
  });

  it('writes everything at debug level', () => {
    const sink = { log: vi.fn() };
    createLogger('debug', sink).debug('visible');

    expect(sink.log).toHaveBeenCalledWith('[debug] visible');
  });
});
