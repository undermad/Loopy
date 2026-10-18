import { describe, expect, it } from 'vitest';
import {
  extractSection,
  findMentions,
  formatLink,
  parseLinkText,
  parseNote,
  parseProperties,
  rewriteLinks,
  setProperties,
  wordCount,
} from '@shared/markdown';
import { sanitiseNoteTitle, uniqueNoteTitle } from '@shared/notes';

describe('note links', () => {
  it('parses targets, headings, blocks, aliases and Loopy kinds', () => {
    expect(parseLinkText('Combat#Melee|melee')).toEqual({
      kind: 'note',
      target: 'Combat',
      subpath: 'Melee',
      alias: 'melee',
    });
    expect(parseLinkText('Rules.md#^abc')).toEqual({
      kind: 'note',
      target: 'Rules',
      subpath: '^abc',
      alias: null,
    });
    expect(parseLinkText('Board: Level 1')).toEqual({
      kind: 'board',
      target: 'Level 1',
      subpath: null,
      alias: null,
    });
    expect(parseLinkText('ticket:12|Fix jump')).toMatchObject({
      kind: 'ticket',
      target: '12',
      alias: 'Fix jump',
    });
    expect(formatLink({ kind: 'asset', target: 'hero.png', subpath: null, alias: null }, true)).toBe(
      '![[asset:hero.png]]',
    );
  });

  it('finds links outside code and records embeds', () => {
    const parsed = parseNote('A [[One]] `[[Two]]`\n```\n[[Three]]\n```\n![[palette:Forest]] %%[[Four]]%%');
    expect(parsed.links.map((link) => [link.kind, link.target, link.embed])).toEqual([
      ['note', 'One', false],
      ['palette', 'Forest', true],
    ]);
  });

  it('rewrites only matching links and keeps their subpaths and aliases', () => {
    const body = '[[Old]] [[old#Part|alias]] [[Older]] [[board:Old]] `[[Old]]`';
    expect(rewriteLinks(body, 'note', 'Old', 'New')).toBe(
      '[[New]] [[New#Part|alias]] [[Older]] [[board:Old]] `[[Old]]`',
    );
  });
});

describe('note structure', () => {
  const body = [
    '---',
    'aliases: [AI, Brains]',
    'tags:',
    '  - enemy',
    'hp: 10',
    'boss: false',
    '---',
    '# Enemy AI #draft',
    'Uses #behaviour/tree and #2 not a tag. [[Link#tag]]',
    '## States',
    '- [ ] Patrol',
    '- [x] Chase ^chase',
    '## Notes',
    'More',
  ].join('\n');

  it('reads properties, tags, headings, tasks and blocks', () => {
    const parsed = parseNote(body);
    expect(parsed.properties).toEqual({ aliases: ['AI', 'Brains'], tags: ['enemy'], hp: 10, boss: false });
    expect(parsed.aliases).toEqual(['AI', 'Brains']);
    expect(parsed.tags).toEqual(['enemy', 'draft', 'behaviour/tree']);
    expect(parsed.headings.map((heading) => [heading.level, heading.text])).toEqual([
      [1, 'Enemy AI #draft'],
      [2, 'States'],
      [2, 'Notes'],
    ]);
    expect(parsed.tasks).toEqual([
      { done: false, text: 'Patrol', line: 10 },
      { done: true, text: 'Chase ^chase', line: 11 },
    ]);
    expect(parsed.blocks).toEqual(['chase']);
  });

  it('extracts heading sections and blocks for embeds', () => {
    expect(extractSection(body, 'States')).toBe('## States\n- [ ] Patrol\n- [x] Chase ^chase');
    expect(extractSection(body, '^chase')).toBe('- [x] Chase');
    expect(extractSection('Intro\n\nOne\ntwo ^para\nThree', '^para')).toBe('One\ntwo');
    expect(extractSection(body, 'Missing')).toBe('');
    expect(extractSection('---\na: 1\n---\nBody', null)).toBe('Body');
  });

  it('writes properties back into the frontmatter', () => {
    const next = setProperties('---\ntitle: Old\n---\nText', {
      title: 'New one',
      tags: ['a', 'b'],
      done: true,
    });
    expect(next).toBe('---\ntitle: New one\ntags:\n  - a\n  - b\ndone: true\n---\nText');
    expect(parseProperties(next)).toEqual({ title: 'New one', tags: ['a', 'b'], done: true });
    expect(setProperties('Text', {})).toBe('Text');
  });

  it('finds unlinked mentions and counts words', () => {
    const mentions = findMentions('Combat is fun. [[Combat]] again, combatant, combat!', ['Combat']);
    expect(mentions.map((mention) => mention.from)).toEqual([0, 44]);
    expect(wordCount('---\na: b\n---\n# Hello [[World|there]] friend')).toBe(3);
  });
});

describe('note titles', () => {
  it('sanitises and de-duplicates titles', () => {
    expect(sanitiseNoteTitle('Boss: Phase/1.md')).toBe('Boss Phase 1');
    expect(sanitiseNoteTitle('Beta.markdown')).toBe('Beta');
    expect(sanitiseNoteTitle('   ')).toBe('Untitled');
    expect(uniqueNoteTitle('Idea', ['idea', 'Idea 2'])).toBe('Idea 3');
  });
});
