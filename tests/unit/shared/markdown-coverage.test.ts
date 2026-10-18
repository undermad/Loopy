import { describe, expect, it } from 'vitest';
import {
  extractSection,
  findMentions,
  formatLink,
  formatProperties,
  frontmatterEnd,
  lineAround,
  maskCode,
  parseLinkText,
  parseNote,
  parseProperties,
  replaceLinks,
  rewriteLinks,
  setProperties,
  wordCount,
} from '@shared/markdown';

describe('parseProperties edge cases', () => {
  it('returns nothing without frontmatter or with unterminated frontmatter', () => {
    expect(parseProperties('no frontmatter')).toEqual({});
    expect(parseProperties('---\ntitle: Open')).toEqual({});
    expect(frontmatterEnd('---\ntitle: Open\nstill open')).toBe(0);
    expect(frontmatterEnd('plain')).toBe(0);
  });

  it('reads empty, null and tilde values as null', () => {
    expect(parseProperties('---\na: ~\nb: null\nc:\n---\n')).toEqual({ a: null, b: null, c: null });
  });

  it('reads quoted, numeric, boolean and inline list values', () => {
    const body = [
      '---',
      "single: 'quoted value'",
      'double: "a: b"',
      'lone: "',
      'count: -3.5',
      'on: true',
      'off: false',
      'list: [one, "two", , \'three\']',
      'empty: []',
      '---',
      'body',
    ].join('\n');
    expect(parseProperties(body)).toEqual({
      single: 'quoted value',
      double: 'a: b',
      lone: '"',
      count: -3.5,
      on: true,
      off: false,
      list: ['one', 'two', 'three'],
      empty: [],
    });
  });

  it('collects block lists under the last empty key and ignores orphan items', () => {
    const body = [
      '---',
      '- orphan',
      'my key:',
      '  - first',
      '- "second"',
      '  - ',
      'other: value',
      '  - ignored',
      '# comment',
      'not a pair',
      '---',
    ].join('\n');
    expect(parseProperties(body)).toEqual({ 'my key': ['first', 'second'], other: 'value' });
  });

  it('keeps an empty list key as an empty array when items are blank', () => {
    expect(parseProperties('---\ntags:\n  - \n---\n')).toEqual({ tags: [] });
  });

  it('accepts CRLF frontmatter and frontmatter at end of file', () => {
    expect(parseProperties('---\r\ntitle: Win\r\n---\r\nbody')).toEqual({ title: 'Win' });
    expect(frontmatterEnd('---\n---')).toBe(7);
  });
});

describe('formatProperties', () => {
  it('formats every value type', () => {
    expect(
      formatProperties({
        none: null,
        list: ['plain', 'needs: quotes'],
        empty: [],
        word: 'simple text',
        padded: ' padded ',
        blank: '',
        colon: 'a: b',
        num: 4,
        flag: false,
      }),
    ).toBe(
      [
        '---',
        'none:',
        'list:',
        '  - plain',
        '  - "needs: quotes"',
        'empty: []',
        'word: simple text',
        'padded: " padded "',
        'blank: ""',
        'colon: "a: b"',
        'num: 4',
        'flag: false',
        '---',
        '',
      ].join('\n'),
    );
  });

  it('returns an empty string for no properties and strips frontmatter on set', () => {
    expect(formatProperties({})).toBe('');
    expect(setProperties('---\na: 1\n---\nBody', {})).toBe('Body');
    expect(setProperties('Body', { a: 1 })).toBe('---\na: 1\n---\nBody');
  });

  it('round-trips through parseProperties', () => {
    const properties = { title: 'Hello: world', tags: ['a b', 'c'], count: 2, done: true, none: null };
    expect(parseProperties(formatProperties(properties))).toEqual(properties);
  });
});

describe('maskCode', () => {
  it('masks tilde fences and keeps line lengths', () => {
    const body = 'a\n~~~\n[[Hidden]]\n~~~\nb';
    const masked = maskCode(body);
    expect(masked.length).toBe(body.length);
    expect(masked).not.toContain('Hidden');
    expect(masked.split('\n')[4]).toBe('b');
  });

  it('only closes a fence with the same marker of at least the same length', () => {
    const body = '````\n```\n~~~\n[[Inside]]\n````\n[[Outside]]';
    const masked = maskCode(body);
    expect(masked).not.toContain('Inside');
    expect(masked).toContain('[[Outside]]');
  });

  it('masks unterminated fences to the end', () => {
    expect(maskCode('```\n[[Never]]').trim()).toBe('');
  });

  it('masks inline code and comments', () => {
    expect(maskCode('x `y` %%z%% w')).toBe('x     %%z%% w'.replace('%%z%%', '     '));
  });
});

describe('links', () => {
  it('handles empty aliases, subpaths and kind targets', () => {
    expect(parseLinkText('Note#|')).toEqual({ kind: 'note', target: 'Note', subpath: null, alias: null });
    expect(parseLinkText('asset:')).toEqual({ kind: 'asset', target: '', subpath: null, alias: null });
    expect(formatLink({ kind: 'note', target: 'A', subpath: 'B', alias: 'C' })).toBe('[[A#B|C]]');
  });

  it('skips links with neither target nor subpath', () => {
    expect(parseNote('[[ ]] [[#Head]] [[|alias]]').links.map((link) => link.subpath)).toEqual(['Head']);
  });

  it('leaves the body untouched when no link matches', () => {
    const body = '[[Other]] [[board:Old]]';
    expect(rewriteLinks(body, 'note', 'Old', 'New')).toBe(body);
    expect(rewriteLinks(body, 'board', ' old ', 'New')).toBe('[[Other]] [[board:New]]');
  });

  it('replaces only links the callback returns text for', () => {
    const body = '[[Keep]] and ![[Swap]]';
    expect(replaceLinks(body, (link) => (link.target === 'Swap' ? `<${link.target}>` : null))).toBe(
      '[[Keep]] and <Swap>',
    );
    expect(replaceLinks(body, () => null)).toBe(body);
  });
});

describe('parseNote details', () => {
  it('reads tags from a comma string property and ignores numeric tags', () => {
    const parsed = parseNote('---\ntag: "#one, two"\naliases: Alt, Other\n---\n#1 #three- #Two (#four)');
    expect(parsed.tags).toEqual(['one', 'two', 'three', 'four']);
    expect(parsed.aliases).toEqual(['Alt', 'Other']);
  });

  it('ignores non-list alias values', () => {
    expect(parseNote('---\naliases: 3\n---\n').aliases).toEqual([]);
  });

  it('reads headings, blocks and tasks', () => {
    const parsed = parseNote('# Title ##\ntext ^id-1\n- [x] Done\n* [ ] Open');
    expect(parsed.headings).toEqual([{ level: 1, text: 'Title', from: 0, line: 0 }]);
    expect(parsed.blocks).toEqual(['id-1']);
    expect(parsed.tasks).toEqual([
      { done: true, text: 'Done', line: 2 },
      { done: false, text: 'Open', line: 3 },
    ]);
  });
});

describe('extractSection', () => {
  const body = [
    '---',
    'a: 1',
    '---',
    '# One',
    'para start',
    'para end ^para',
    '',
    '1. first ^num',
    '- item ^item',
    '## Two',
    'two body',
    '# Three',
    'three body',
  ].join('\n');

  it('returns the whole body without a subpath', () => {
    expect(extractSection(body, null)).toBe(body.slice(frontmatterEnd(body)));
  });

  it('returns empty for a missing block or heading', () => {
    expect(extractSection(body, '^missing')).toBe('');
    expect(extractSection(body, 'Nope')).toBe('');
  });

  it('returns the paragraph around a block and a single list item', () => {
    expect(extractSection(body, '^para')).toBe('para start\npara end');
    expect(extractSection(body, '^num')).toBe('1. first');
    expect(extractSection(body, '^item')).toBe('- item');
  });

  it('returns a heading section up to the next heading of the same level', () => {
    expect(extractSection(body, 'One#Two')).toBe('## Two\ntwo body');
    expect(extractSection(body, 'three')).toBe('# Three\nthree body');
    expect(extractSection(body, 'One')).toContain('## Two');
  });

  it('starts a block at the first line', () => {
    expect(extractSection('only line ^top', '^top')).toBe('only line');
  });
});

describe('mentions, lines and words', () => {
  it('ignores empty names', () => {
    expect(findMentions('Hero walks', ['', '  '])).toEqual([]);
  });

  it('finds whole-word mentions outside links, code and frontmatter', () => {
    const body = '---\nname: Hero\n---\nHero meets [[Hero]] and `Hero`\nSuperhero. hero!';
    const mentions = findMentions(body, ['Hero', 'Her']);
    expect(mentions.map((mention) => body.slice(mention.from, mention.to))).toEqual(['Hero', 'hero']);
    expect(mentions[0]?.line).toBe('Hero meets [[Hero]] and `Hero`');
    expect(mentions[1]?.line).toBe('Superhero. hero!');
  });

  it('escapes regular expression characters in names', () => {
    expect(findMentions('a C++ b', ['C++']).map((mention) => mention.from)).toEqual([2]);
    expect(findMentions('use (x) now', ['x'])).toHaveLength(1);
  });

  it('reads the line around an offset at the start and end', () => {
    const body = 'first\n  second  \nthird';
    expect(lineAround(body, 0)).toBe('first');
    expect(lineAround(body, body.length)).toBe('third');
    expect(lineAround(body, 8)).toBe('second');
  });

  it('counts words outside code and uses link aliases', () => {
    expect(wordCount('---\ntitle: x\n---\nOne [[Two|three four]]\n```\ncode here\n```\nit’s - done')).toBe(5);
    expect(wordCount('')).toBe(0);
    expect(wordCount('# * -')).toBe(0);
  });
});
