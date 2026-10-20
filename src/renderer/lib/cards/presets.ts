import type { CardTemplateInput } from '@shared/cards';

export interface CardSize {
  id: 'poker' | 'bridge' | 'tarot' | 'mini' | 'square' | 'landscape';
  width: number;
  height: number;
}

export const CARD_SIZES: CardSize[] = [
  { id: 'poker', width: 250, height: 350 },
  { id: 'bridge', width: 225, height: 350 },
  { id: 'tarot', width: 275, height: 475 },
  { id: 'mini', width: 175, height: 250 },
  { id: 'square', width: 300, height: 300 },
  { id: 'landscape', width: 350, height: 250 },
];

export interface StarterTemplate {
  id: string;
  template: CardTemplateInput;
}

const accent = (hex: string) => ({ hex, ref: null });
const HEADING = { size: 'lg', weight: 'bold' } as const;

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'character',
    template: {
      name: 'Character',
      width: 320,
      height: 540,
      accent: accent('#6366f1'),
      fields: [
        { id: 'portrait', kind: 'image', label: 'Portrait', showLabel: false },
        {
          id: 'name',
          kind: 'text',
          style: HEADING,
          label: 'Name',
          showLabel: false,
          span: 8,
          placeholder: 'Name',
        },
        {
          id: 'role',
          kind: 'choice',
          label: 'Role',
          showLabel: false,
          span: 4,
          options: ['Hero', 'Ally', 'Enemy', 'Boss'],
        },
        {
          id: 'health',
          kind: 'number',
          display: 'bar',
          label: 'Health',
          min: 0,
          max: 100,
          defaultValue: 100,
        },
        { id: 'attack', kind: 'number', label: 'Attack', span: 4, defaultValue: 10 },
        { id: 'defence', kind: 'number', label: 'Defence', span: 4, defaultValue: 5 },
        { id: 'power', kind: 'formula', label: 'Power', span: 4, expression: 'attack * 2 + defence' },
        {
          id: 'attributes',
          kind: 'attributes',
          label: 'Attributes',
          rows: [
            { id: 'strength', label: 'Strength' },
            { id: 'agility', label: 'Agility' },
            { id: 'wits', label: 'Wits' },
          ],
        },
        { id: 'abilities', kind: 'choice', multiple: true, allowNew: true, label: 'Abilities' },
        { id: 'bio', kind: 'text', lines: 'multi', label: 'Description', placeholder: 'Who are they?' },
      ],
    },
  },
  {
    id: 'item',
    template: {
      name: 'Item',
      width: 280,
      height: 380,
      accent: accent('#f59e0b'),
      fields: [
        {
          id: 'name',
          kind: 'text',
          style: HEADING,
          label: 'Name',
          showLabel: false,
          span: 8,
          placeholder: 'Item name',
        },
        {
          id: 'rarity',
          kind: 'choice',
          label: 'Rarity',
          showLabel: false,
          span: 4,
          options: [
            { value: 'Common', colour: accent('#94a3b8') },
            { value: 'Rare', colour: accent('#3b82f6') },
            { value: 'Epic', colour: accent('#a855f7') },
            { value: 'Legendary', colour: accent('#f59e0b') },
          ],
        },
        { id: 'icon', kind: 'icon', label: 'Icon', showLabel: false, span: 4, defaultValue: 'gem' },
        { id: 'value', kind: 'number', label: 'Value', span: 4 },
        { id: 'stackable', kind: 'checkbox', label: 'Stackable', span: 4 },
        { id: 'effect', kind: 'text', lines: 'multi', label: 'Effect' },
      ],
    },
  },
  {
    id: 'ability',
    template: {
      name: 'Ability',
      width: 300,
      height: 420,
      accent: accent('#ef4444'),
      fields: [
        {
          id: 'name',
          kind: 'text',
          style: HEADING,
          label: 'Name',
          showLabel: false,
          placeholder: 'Ability name',
        },
        {
          id: 'element',
          kind: 'choice',
          label: 'Element',
          span: 6,
          options: ['Fire', 'Water', 'Earth', 'Air', 'Lightning'],
        },
        { id: 'colour', kind: 'colour', label: 'Colour', span: 6 },
        { id: 'cost', kind: 'number', label: 'Cost', span: 6 },
        { id: 'cooldown', kind: 'number', label: 'Cooldown', span: 6, suffix: ' s' },
        { id: 'damage', kind: 'dice', label: 'Damage', span: 12, defaultValue: '2d6+1' },
        { id: 'power', kind: 'number', display: 'bar', label: 'Power', min: 0, max: 10, defaultValue: 5 },
        { id: 'description', kind: 'text', lines: 'multi', label: 'Description' },
      ],
    },
  },
  {
    id: 'location',
    template: {
      name: 'Location',
      width: 340,
      height: 460,
      accent: accent('#10b981'),
      fields: [
        {
          id: 'name',
          kind: 'text',
          style: HEADING,
          label: 'Name',
          showLabel: false,
          placeholder: 'Location name',
        },
        { id: 'image', kind: 'image', label: 'Image', showLabel: false },
        { id: 'region', kind: 'text', label: 'Region', span: 6 },
        {
          id: 'danger',
          kind: 'choice',
          label: 'Danger',
          span: 6,
          options: ['Safe', 'Low', 'Medium', 'High'],
        },
        { id: 'divider', kind: 'separator', label: '', showLabel: false },
        { id: 'notes', kind: 'text', lines: 'multi', label: 'Notes' },
      ],
    },
  },
  {
    id: 'quest',
    template: {
      name: 'Quest',
      width: 320,
      height: 420,
      accent: accent('#0ea5e9'),
      fields: [
        {
          id: 'title',
          kind: 'text',
          style: HEADING,
          label: 'Title',
          showLabel: false,
          placeholder: 'Quest title',
        },
        { id: 'giver', kind: 'text', label: 'Given by', span: 6 },
        { id: 'level', kind: 'number', label: 'Level', span: 6 },
        {
          id: 'difficulty',
          kind: 'number',
          display: 'symbols',
          label: 'Difficulty',
          max: 5,
          defaultValue: 2,
        },
        { id: 'goal', kind: 'text', lines: 'multi', label: 'Goal' },
        { id: 'steps', kind: 'checklist', label: 'Steps' },
        { id: 'rewards', kind: 'choice', multiple: true, allowNew: true, label: 'Rewards' },
        { id: 'done', kind: 'checkbox', label: 'Completed' },
      ],
    },
  },
];

export function blankTemplate(name: string): CardTemplateInput {
  return {
    name,
    accent: accent('#6366f1'),
    fields: [
      { id: 'title', kind: 'text', style: HEADING, label: 'Title', showLabel: false, placeholder: 'Title' },
      { id: 'description', kind: 'text', lines: 'multi', label: 'Description' },
    ],
  };
}
