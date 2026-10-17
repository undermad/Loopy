import { describe, expect, it } from 'vitest';
import { EXCHANGE_FILE_EXTENSIONS, exchangeEnvelopeSchema, wrapExchange } from '@shared/exchange';
import { firstKey, keyBetween, keysBetween } from '@shared/ordering';
import { builtInThemeFor, lightTheme } from '@shared/theme';
import { isSupportedLanguage } from '@shared/i18n';

describe('exchange envelope', () => {
  it('wraps data with its kind and version and rejects unknown kinds', () => {
    const envelope = wrapExchange('theme', 1, '0.1.0', lightTheme);
    expect(exchangeEnvelopeSchema.parse(envelope)).toEqual(envelope);
    expect(
      exchangeEnvelopeSchema.safeParse({ loopy: { kind: 'font', schemaVersion: 1, app: 'x' }, data: {} })
        .success,
    ).toBe(false);
    expect(EXCHANGE_FILE_EXTENSIONS.layout).toBe('loopy-layout.json');
  });

  it('covers the remaining ordering and theme helpers', () => {
    expect(keyBetween(null, 'a') < 'a').toBe(true);
    expect(keysBetween(null, null, 3)).toHaveLength(3);
    expect(firstKey()).toBe('i');
    expect(builtInThemeFor('light').id).toBe('light');
    expect(isSupportedLanguage('de')).toBe(false);
  });
});
