import { describe, expect, it } from 'vitest';
import { parseDelimited, toDelimited } from '@shared/tables';

describe('delimited text', () => {
  it('reads quoted fields with commas, quotes and line breaks', () => {
    expect(parseDelimited('id,name\r\nsword,"Iron, ""old"""\nbow,"Long\nbow"\n', ',')).toEqual([
      ['id', 'name'],
      ['sword', 'Iron, "old"'],
      ['bow', 'Long\nbow'],
    ]);
  });

  it('reads tab separated text from a spreadsheet', () => {
    expect(parseDelimited('a\tb\n1\t2', '\t')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(parseDelimited('', '\t')).toEqual([]);
    expect(parseDelimited('﻿a,b', ',')).toEqual([['a', 'b']]);
  });

  it('quotes only when a field needs it', () => {
    expect(
      toDelimited(
        [
          ['id', 'name'],
          ['sword', 'Iron, "old"'],
          ['bow', 'Long\nbow'],
        ],
        ',',
      ),
    ).toBe('id,name\r\nsword,"Iron, ""old"""\r\nbow,"Long\nbow"');
    expect(toDelimited([['a\tb', 'c']], '\t')).toBe('"a\tb"\tc');
  });

  it('round-trips', () => {
    const matrix = [
      ['a', '"b"', 'c,d'],
      ['', 'e\nf', ' g '],
    ];
    expect(parseDelimited(toDelimited(matrix, ','), ',')).toEqual(matrix);
  });
});
