import { describe, expect, it } from 'vitest';
import { parseEnv } from '../../../src/main/env';

describe('parseEnv', () => {
  it('applies defaults when variables are missing', () => {
    expect(parseEnv({})).toEqual({ LOOPY_LOG_LEVEL: 'info' });
  });

  it('accepts a valid log level', () => {
    expect(parseEnv({ LOOPY_LOG_LEVEL: 'debug' }).LOOPY_LOG_LEVEL).toBe('debug');
  });

  it('fails with a readable message on an invalid value', () => {
    expect(() => parseEnv({ LOOPY_LOG_LEVEL: 'loud' })).toThrow(/LOOPY_LOG_LEVEL/);
  });
});
