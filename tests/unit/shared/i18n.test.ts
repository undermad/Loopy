import { describe, expect, it } from 'vitest';
import { NAMESPACES, SUPPORTED_LANGUAGES, resolveLanguage, resources } from '@shared/i18n';

function keysOf(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => keysOf(child, prefix ? `${prefix}.${key}` : key));
}

describe('i18n resources', () => {
  it('ships every namespace for every supported language with string leaves', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      for (const namespace of NAMESPACES) {
        const bundle: unknown = resources[language][namespace];
        expect(keysOf(bundle).length).toBeGreaterThan(0);
        for (const key of keysOf(bundle)) {
          const leaf = key
            .split('.')
            .reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], bundle);
          expect(typeof leaf, `${language}:${namespace}:${key}`).toBe('string');
        }
      }
    }
  });

  it('keeps the same key set across languages', () => {
    const reference = NAMESPACES.map((namespace) => keysOf(resources.en[namespace]).sort());
    for (const language of SUPPORTED_LANGUAGES) {
      NAMESPACES.forEach((namespace, index) => {
        expect(keysOf(resources[language][namespace]).sort()).toEqual(reference[index]);
      });
    }
  });
});

describe('resolveLanguage', () => {
  it('uses the explicit setting, the system locale when supported, and English otherwise', () => {
    expect(resolveLanguage('en', 'pl-PL')).toBe('en');
    expect(resolveLanguage('system', 'en-GB')).toBe('en');
    expect(resolveLanguage('system', 'pl_PL')).toBe('en');
    expect(resolveLanguage('system', '')).toBe('en');
  });
});
