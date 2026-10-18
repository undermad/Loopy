import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseEnv, userDataOverride } from '../../../src/main/env';

describe('userDataOverride', () => {
  const appData = join('C:', 'Users', 'me', 'AppData', 'Roaming');

  it('uses LOOPY_USER_DATA when it is set', () => {
    expect(userDataOverride({ LOOPY_USER_DATA: 'D:/data' }, { packaged: true, appData })).toBe('D:/data');
    expect(userDataOverride({ LOOPY_USER_DATA: 'D:/data' }, { packaged: false, appData })).toBe('D:/data');
  });

  it('keeps unpacked builds out of the installed app data', () => {
    expect(userDataOverride({}, { packaged: false, appData })).toBe(join(appData, 'loopy-dev'));
  });

  it('keeps the default for the installed app', () => {
    expect(userDataOverride({}, { packaged: true, appData })).toBeNull();
  });
});

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
