import { describe, expect, it } from 'vitest';
import { evaluateFormula, formulaNames, parseDice } from '@shared/formulas';

describe('shared formulas', () => {
  it('reads dotted names for columns of a referenced row', () => {
    expect(evaluateFormula('weapon.damage * 2 + level', { 'weapon.damage': 4, level: 1 })).toEqual({
      value: 9,
    });
    expect(formulaNames('weapon.damage + max(level, 1)')).toEqual(['weapon.damage', 'level']);
  });

  it('names the missing value', () => {
    expect(evaluateFormula('weapon.damage', {})).toEqual({ error: 'unknown', name: 'weapon.damage' });
  });

  it('still parses dice', () => {
    expect(parseDice('2d6+1')).toEqual({ notation: '2d6+1', min: 3, max: 13, average: 8 });
  });
});
