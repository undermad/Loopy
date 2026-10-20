import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoardNode } from '@shared/board';
import { cardFieldSchema, cardLayoutSchema, type CardField } from '@shared/cards';
import { CardView } from '@renderer/components/editors/Cards/CardView';
import { CardSettings, FieldSettings } from '@renderer/components/editors/Cards/settings';
import type { TemplateDraft } from '@renderer/components/editors/Cards/CardDesigner';
import { NodeProperties } from '@renderer/components/editors/Properties/NodeProperties';
import { importFiles } from '@renderer/lib/assets';
import { commitChanges, createBoard, createItem, loadBoard, useBoardSnapshot } from '@renderer/lib/board';
import { createCardTemplate, updateSavedCard } from '@renderer/lib/cards';
import { newLayer } from '@renderer/lib/drawing';
import { useActiveWorkspace } from '@renderer/lib/workspaces';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

let api: FakeApi;

function field(input: Record<string, unknown> & Pick<CardField, 'id' | 'kind'>): CardField {
  return cardFieldSchema.parse(input);
}

function Live({ boardId, id }: { boardId: string; id: string }) {
  const snapshot = useBoardSnapshot(boardId);
  const node = snapshot?.nodes.find((candidate) => candidate.id === id);
  if (!snapshot || !node) return null;
  return <NodeProperties board={snapshot.board} node={node} nodes={snapshot.nodes} />;
}

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <ToastProvider closeLabel="Dismiss" regionLabel="Notifications">
        {children}
      </ToastProvider>
    </TooltipProvider>
  );
}

function lastNode(): BoardNode | undefined {
  return vi.mocked(api.applyBoardChanges).mock.calls.at(-1)?.[1].upsertNodes?.[0];
}

async function pick(user: ReturnType<typeof userEvent.setup>, combobox: HTMLElement, option: string) {
  await user.click(combobox);
  await user.click(await screen.findByRole('option', { name: option }));
}

beforeEach(async () => {
  api = await bootTestApp();
  const project = makeProject('Space Game');
  api.current = project;
  api.emitProject();
  await act(async () => {
    await Promise.resolve();
  });
});

describe('card view', () => {
  it('renders every field kind read only with fallbacks', () => {
    const fields = [
      field({ id: 'h', kind: 'text', label: 'Title', style: { size: 'xl', weight: 'medium' } }),
      field({ id: 't', kind: 'text', placeholder: 'Nothing yet' }),
      field({ id: 'n', kind: 'number', label: 'Level' }),
      field({ id: 'm', kind: 'number', label: 'Power' }),
      field({ id: 's', kind: 'choice', label: 'Rarity' }),
      field({ id: 'c', kind: 'checkbox', label: 'Ready' }),
      field({ id: 'g', kind: 'choice', multiple: true, allowNew: true, label: 'Tags' }),
      field({ id: 'i', kind: 'image', label: 'Portrait' }),
      field({ id: 'j', kind: 'image', label: 'Icon' }),
      field({ id: 'st', kind: 'number', display: 'bar', label: 'HP' }),
      field({ id: 'co', kind: 'colour', label: 'Tint' }),
      field({ id: 'cx', kind: 'colour', label: 'Glow' }),
      field({ id: 'd', kind: 'separator', showLabel: true }),
    ];
    render(
      <CardView
        layout={{ fields, gap: 4 }}
        values={{ h: 'Hero', m: 7, c: true, g: ['Fire'], j: 'pic', st: 'x', cx: '#ff0000' }}
        editable={false}
      />,
    );
    expect(screen.getByText('Hero')).toHaveStyle({ fontWeight: '500' });
    expect(screen.getByText('Nothing yet').className).toContain('empty');
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getAllByText('–').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByRole('checkbox', { name: 'Ready' })).toBeDisabled();
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove Fire' })).not.toBeInTheDocument();
    expect(screen.getByText('No image')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Icon' })).toHaveAttribute('src', 'loopy-asset://asset/pic');
    const meter = screen.getByRole('meter', { name: 'HP' });
    expect(meter).toHaveAttribute('aria-valuenow', '0');
    expect(meter).toHaveAttribute('aria-valuemax', '100');
    expect(screen.getByText('#ff0000')).toBeInTheDocument();
    expect(document.querySelector('hr')).not.toBeNull();
    expect(screen.queryByText('Divider')).not.toBeInTheDocument();
  });

  it('edits text, numbers, choices, tags, colours and images', async () => {
    const user = userEvent.setup();
    const { ids } = await act(() =>
      importFiles([new File(['p'], 'hero.png', { type: 'image/png' })], 'auto'),
    );
    const onChange = vi.fn();
    const onSelectField = vi.fn();
    const fields = [
      field({ id: 'l', kind: 'text', lines: 'multi', label: 'Story' }),
      field({ id: 't', kind: 'text', label: 'Name' }),
      field({ id: 'n', kind: 'number', label: 'Level' }),
      field({ id: 's', kind: 'choice', label: 'Rarity', options: ['Common'] }),
      field({ id: 'g', kind: 'choice', multiple: true, allowNew: true, label: 'Tags' }),
      field({ id: 'st', kind: 'number', display: 'bar', label: 'HP', min: 0, max: 10 }),
      field({ id: 'co', kind: 'colour', label: 'Tint' }),
      field({ id: 'i', kind: 'image', label: 'Portrait' }),
    ];
    render(
      <CardView
        layout={{ fields, gap: 4 }}
        values={{ t: 'Ann', s: 'Common', g: ['Fire'], st: 3 }}
        editable
        onChange={onChange}
        selectedFieldId="t"
        onSelectField={onSelectField}
      />,
    );

    const story = screen.getByRole('textbox', { name: 'Story' });
    fireEvent.change(story, { target: { value: 'Once' } });
    fireEvent.keyDown(story, { key: 'a' });
    fireEvent.blur(story);
    expect(onChange).toHaveBeenLastCalledWith('l', 'Once');
    const calls = onChange.mock.calls.length;
    fireEvent.blur(screen.getByRole('textbox', { name: 'Name' }));
    expect(onChange).toHaveBeenCalledTimes(calls);

    const level = screen.getByRole('spinbutton', { name: 'Level' });
    fireEvent.change(level, { target: { value: '5' } });
    fireEvent.keyDown(level, { key: 'Enter' });
    fireEvent.blur(level);
    expect(onChange).toHaveBeenLastCalledWith('n', 5);

    fireEvent.change(screen.getByRole('combobox', { name: 'Rarity' }), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith('s', null);

    const tag = screen.getByRole('textbox', { name: 'Tags: Add a tag…' });
    fireEvent.change(tag, { target: { value: 'Fire' } });
    fireEvent.keyDown(tag, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalledWith('g', ['Fire', 'Fire']);
    fireEvent.change(tag, { target: { value: ' Ice ' } });
    fireEvent.keyDown(tag, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith('g', ['Fire', 'Ice']);

    fireEvent.change(screen.getByLabelText('Tint'), { target: { value: '#00ff00' } });
    expect(onChange).toHaveBeenLastCalledWith('co', '#00ff00');

    const hp = screen.getByRole('spinbutton', { name: 'HP' });
    fireEvent.change(hp, { target: { value: '8' } });
    fireEvent.blur(hp);
    expect(onChange).toHaveBeenLastCalledWith('st', 8);

    await user.click(screen.getByRole('button', { name: 'Portrait: Choose image' }));
    await user.click(await screen.findByRole('menuitem', { name: 'hero.png' }));
    expect(onChange).toHaveBeenLastCalledWith('i', ids[0]);

    fireEvent.click(screen.getByText('Story').closest('[data-field-id]') ?? document.body);
    expect(onSelectField).toHaveBeenCalledWith('l');
  });

  it('offers to clear a chosen image and explains when there are none', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const fields = [field({ id: 'i', kind: 'image', label: 'Portrait' })];
    const { rerender } = render(
      <CardView layout={{ fields, gap: 4 }} values={{}} editable onChange={onChange} />,
    );
    await user.click(screen.getByRole('button', { name: 'Portrait: Choose image' }));
    expect(await screen.findByText('No images in assets yet')).toBeInTheDocument();
    await user.keyboard('{Escape}');

    rerender(<CardView layout={{ fields, gap: 4 }} values={{ i: 'old' }} editable onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Portrait: Choose image' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Remove image' }));
    expect(onChange).toHaveBeenLastCalledWith('i', null);
  });
});

describe('template field settings', () => {
  it('edits choices, ranges, defaults and typography', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const choice = field({
      id: 's',
      kind: 'choice',
      label: 'Rarity',
      options: ['Common', 'Rare'],
      defaultValue: 'Rare',
      style: { size: 'lg', weight: 'bold', align: 'center', colour: { hex: '#123456', ref: null } },
    });
    const { rerender } = render(
      <Providers>
        <FieldSettings field={choice} onChange={onChange} />
      </Providers>,
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Placeholder' }), { target: { value: 'Pick' } });
    fireEvent.blur(screen.getByRole('textbox', { name: 'Placeholder' }));
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ placeholder: 'Pick' });

    await user.click(screen.getByRole('switch', { name: 'Show label' }));
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ showLabel: false });

    await user.click(screen.getByRole('radio', { name: 'Half' }));
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ span: 6 });

    await pick(user, screen.getByRole('combobox', { name: 'Default value' }), '–');
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ defaultValue: null });
    await pick(user, screen.getByRole('combobox', { name: 'Default value' }), 'Common');
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ defaultValue: 'Common' });

    await pick(user, screen.getByRole('combobox', { name: 'Text size' }), '–');
    expect(onChange.mock.lastCall?.[0]).toMatchObject({
      style: { weight: 'bold', align: 'center', colour: { hex: '#123456', ref: null } },
    });
    expect(onChange.mock.lastCall?.[0]).not.toHaveProperty('style.size');
    await pick(user, screen.getByRole('combobox', { name: 'Text size' }), 'Small');
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ style: { size: 'sm' } });
    await pick(user, screen.getByRole('combobox', { name: 'Weight' }), '–');
    expect(onChange.mock.lastCall?.[0]).not.toHaveProperty('style.weight');
    await pick(user, screen.getByRole('combobox', { name: 'Weight' }), 'Regular');
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ style: { weight: 'normal' } });
    await pick(user, screen.getByRole('combobox', { name: 'Alignment' }), '–');
    expect(onChange.mock.lastCall?.[0]).not.toHaveProperty('style.align');
    await pick(user, screen.getByRole('combobox', { name: 'Alignment' }), 'Right');
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ style: { align: 'right' } });

    await user.click(screen.getByRole('button', { name: 'Default' }));
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ style: { colour: null } });

    await pick(user, screen.getByRole('combobox', { name: 'Field type' }), 'Number');
    expect(onChange.mock.lastCall?.[0]).toMatchObject({
      id: 's',
      label: 'Rarity',
      kind: 'number',
      display: 'number',
    });

    rerender(
      <Providers>
        <FieldSettings
          field={field({ id: 'st', kind: 'number', display: 'bar', label: 'HP' })}
          onChange={onChange}
        />
      </Providers>,
    );
    const min = screen.getByRole('spinbutton', { name: 'Minimum' });
    fireEvent.change(min, { target: { value: '2' } });
    fireEvent.blur(min);
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ min: 2 });
    const max = screen.getByRole('spinbutton', { name: 'Maximum' });
    fireEvent.change(max, { target: { value: '9' } });
    fireEvent.blur(max);
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ max: 9 });
    const fallback = screen.getByRole('spinbutton', { name: 'Default value' });
    expect(fallback).toHaveValue(null);
    fireEvent.change(fallback, { target: { value: '4' } });
    fireEvent.blur(fallback);
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ defaultValue: 4 });
    const before = onChange.mock.calls.length;
    fireEvent.blur(fallback);
    expect(onChange).toHaveBeenCalledTimes(before);
  });

  it('edits defaults for tags, checkboxes and text and hides them for images and dividers', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const view = (next: CardField) => (
      <Providers>
        <FieldSettings field={next} onChange={onChange} />
      </Providers>
    );
    const { rerender } = render(
      view(field({ id: 'g', kind: 'choice', multiple: true, allowNew: true, defaultValue: ['a', 'b'] })),
    );
    const tags = screen.getByRole('textbox', { name: 'Default value' });
    expect(tags).toHaveValue('a, b');
    fireEvent.change(tags, { target: { value: 'x, y' } });
    fireEvent.blur(tags);
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ defaultValue: ['x', 'y'] });

    rerender(view(field({ id: 'g2', kind: 'choice', multiple: true, allowNew: true })));
    expect(screen.getByRole('textbox', { name: 'Default value' })).toHaveValue('');

    rerender(view(field({ id: 'c', kind: 'checkbox', defaultValue: true })));
    await user.click(screen.getByRole('switch', { name: 'Default value' }));
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ defaultValue: false });

    rerender(view(field({ id: 't', kind: 'text', defaultValue: 'Hi' })));
    const text = screen.getByRole('textbox', { name: 'Default value' });
    expect(text).toHaveValue('Hi');
    fireEvent.change(text, { target: { value: '  ' } });
    fireEvent.blur(text);
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ defaultValue: null });
    fireEvent.change(screen.getByRole('textbox', { name: 'Label' }), { target: { value: 'Name' } });
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ label: 'Name' });

    rerender(view(field({ id: 'i', kind: 'image' })));
    expect(screen.queryByText('Default value')).not.toBeInTheDocument();
    expect(screen.queryByText('Text style')).not.toBeInTheDocument();

    rerender(view(field({ id: 'd', kind: 'separator' })));
    expect(screen.queryByText('Default value')).not.toBeInTheDocument();
  });
});

describe('template card settings', () => {
  it('clamps sizes and resets colours', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const draft: TemplateDraft = {
      ...cardLayoutSchema.parse({}),
      name: 'Hero',
      width: 300,
      height: 300,
      gap: 8,
      accent: { hex: '#ff0000', ref: null },
      fields: [],
      style: {
        fill: { hex: '#ffffff', ref: null },
        stroke: { hex: '#000000', ref: null },
        textColour: { hex: '#111111', ref: null },
      },
    };
    render(
      <Providers>
        <CardSettings draft={draft} onChange={onChange} />
      </Providers>,
    );
    const commit = (label: string, value: string) => {
      const input = screen.getByRole('spinbutton', { name: label });
      fireEvent.change(input, { target: { value } });
      fireEvent.blur(input);
    };
    commit('Width', '9000');
    expect(onChange).toHaveBeenLastCalledWith({ width: 2000 });
    commit('Height', '9000');
    expect(onChange).toHaveBeenLastCalledWith({ height: 4000 });
    commit('Spacing', '100');
    expect(onChange).toHaveBeenLastCalledWith({ gap: 64 });
    commit('Padding', '500');
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ style: { padding: 200 } });
    commit('Border width', '50');
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ style: { strokeWidth: 32 } });
    commit('Corner radius', '999');
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ style: { radius: 400 } });
    commit('Font size', '1000');
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ style: { fontSize: 400 } });
    const shadow = screen.getByRole('switch', { name: 'Shadow' });
    const shown = shadow.getAttribute('aria-checked') === 'true';
    await user.click(shadow);
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ style: { shadow: !shown } });

    await user.click(screen.getByRole('button', { name: 'No accent' }));
    expect(onChange).toHaveBeenLastCalledWith({ accent: null });
    const resets = screen.getAllByRole('button', { name: 'Default' });
    expect(resets).toHaveLength(3);
    for (const reset of resets) await user.click(reset);
    const styles = onChange.mock.calls.slice(-3).map((call: unknown[]) => call[0]);
    expect(styles).toEqual([
      { style: expect.objectContaining({ fill: null }) as object },
      { style: expect.objectContaining({ stroke: null }) as object },
      { style: expect.objectContaining({ textColour: null }) as object },
    ]);
  });
});

describe('node properties', () => {
  async function show(node: (boardId: string) => BoardNode, extra: BoardNode[] = []) {
    const board = await createBoard({ name: 'Ideas', unit: 'px' });
    await loadBoard(board.id);
    const item = node(board.id);
    await commitChanges(board.id, { upsertNodes: [item, ...extra] }, { history: false });
    render(
      <Providers>
        <Live boardId={board.id} id={item.id} />
      </Providers>,
    );
    return item;
  }

  function commit(label: string, value: string) {
    const input = screen.getByRole('spinbutton', { name: label });
    fireEvent.change(input, { target: { value } });
    fireEvent.blur(input);
  }

  it('edits transform and style values of a text item', async () => {
    const user = userEvent.setup();
    await show((boardId) => ({
      ...createItem({ boardId, preset: 'sticky', rect: { x: 0, y: 0 }, z: 1 }),
      id: 'a',
      data: { text: 'Hi', style: { fill: { hex: '#ff0000', ref: null } } },
    }));
    commit('Y (px)', '40');
    expect(lastNode()).toMatchObject({ id: 'a', y: 40 });
    commit('Rotation (°)', '45');
    expect(lastNode()?.data['rotation']).toBe(45);
    commit('Height (px)', '300');
    expect(lastNode()).toMatchObject({ height: 300 });
    commit('Border width', '99');
    expect(lastNode()?.data['style']).toMatchObject({ strokeWidth: 32 });
    commit('Corner radius', '12');
    expect(lastNode()?.data['style']).toMatchObject({ radius: 12 });
    commit('Opacity (%)', '50');
    expect(lastNode()?.data['style']).toMatchObject({ opacity: 0.5 });
    commit('Font size', '2');
    expect(lastNode()?.data['style']).toMatchObject({ fontSize: 6 });
    await user.click(screen.getByRole('switch', { name: 'Shadow' }));
    expect(lastNode()?.data['style']).toMatchObject({ shadow: true });
    await pick(user, screen.getByRole('combobox', { name: 'Border style' }), 'Dashed');
    expect(lastNode()?.data['style']).toMatchObject({ strokeStyle: 'dashed' });
    await pick(user, screen.getByRole('combobox', { name: 'Weight' }), 'Bold');
    expect(lastNode()?.data['style']).toMatchObject({ fontWeight: 'bold' });
    await user.click(screen.getByRole('radio', { name: 'Right' }));
    expect(lastNode()?.data['style']).toMatchObject({ align: 'right' });
    await user.click(screen.getByRole('radio', { name: 'Bottom' }));
    expect(lastNode()?.data['style']).toMatchObject({ verticalAlign: 'bottom' });
    await user.click(first(screen.getAllByRole('button', { name: 'Default' })));
    expect(lastNode()?.data['style']).not.toHaveProperty('fill');
  });

  it('names, locks and titles a container and clears its colours', async () => {
    const user = userEvent.setup();
    await show((boardId) => ({
      ...createItem({ boardId, preset: 'container', rect: { x: 0, y: 0 }, z: 1 }),
      id: 'room',
      data: { title: 'Room' },
    }));
    const name = screen.getByRole('textbox', { name: 'Item name' });
    fireEvent.change(name, { target: { value: 'Lobby' } });
    fireEvent.blur(name);
    expect(lastNode()?.data['name']).toBe('Lobby');
    const title = screen.getByRole('textbox', { name: 'Title' });
    fireEvent.change(title, { target: { value: 'Hall' } });
    fireEvent.blur(title);
    expect(lastNode()?.data['title']).toBe('Hall');
    await user.click(screen.getByRole('switch', { name: 'Show title' }));
    expect(lastNode()?.data).toHaveProperty('showTitle');
    await user.click(screen.getByRole('switch', { name: 'Locked' }));
    expect(lastNode()?.data['locked']).toBe(true);
    await user.click(first(screen.getAllByRole('button', { name: 'None' })));
    expect(lastNode()?.data['style']).toMatchObject({ fill: null });
    await pick(user, screen.getByRole('combobox', { name: 'Shape' }), 'Ellipse');
    expect(lastNode()?.data['style']).toMatchObject({ shape: 'ellipse' });
  });

  it('picks a template for a card and edits its values', async () => {
    const user = userEvent.setup();
    const template = await createCardTemplate({
      name: 'Hero',
      fields: [{ id: 'name', kind: 'text', label: 'Hero name' }],
    });
    await show(
      (boardId) => ({
        ...createItem({ boardId, preset: 'card', rect: { x: 0, y: 0 }, z: 1 }),
        id: 'card',
        data: { templateId: null, values: {} },
      }),
      [],
    );
    await pick(user, screen.getByRole('combobox', { name: 'Template' }), 'Hero');
    expect(lastNode()?.data['templateId']).toBe(template.id);
    const hero = await screen.findByRole('textbox', { name: 'Hero name' });
    fireEvent.change(hero, { target: { value: 'Ignis' } });
    fireEvent.blur(hero);
    expect(lastNode()?.data['values']).toEqual({ name: 'Ignis' });
    await pick(
      user,
      screen.getByRole('combobox', { name: 'Template' }),
      'Pick a template in the Properties panel',
    );
    expect(lastNode()?.data['templateId']).toBeNull();
  });

  it('clears the file behind a file item', async () => {
    const user = userEvent.setup();
    await act(() => importFiles([new File(['a'], 'theme.mp3', { type: 'audio/mpeg' })], 'auto'));
    await show((boardId) => ({
      ...createItem({ boardId, preset: 'file', rect: { x: 0, y: 0 }, z: 1, data: { assetId: 'gone' } }),
      id: 'f',
    }));
    await pick(user, screen.getByRole('combobox', { name: 'File' }), 'File not found');
    expect(lastNode()?.data['assetId']).toBeNull();
  });

  it('commits edited sticky text only when it changed', async () => {
    await show((boardId) => ({
      ...createItem({ boardId, preset: 'sticky', rect: { x: 0, y: 0 }, z: 1 }),
      id: 's',
      data: { text: 'Hi' },
    }));
    const content = screen.getByRole('textbox', { name: 'Content' });
    const before = vi.mocked(api.applyBoardChanges).mock.calls.length;
    fireEvent.blur(content);
    expect(vi.mocked(api.applyBoardChanges).mock.calls).toHaveLength(before);
    fireEvent.change(content, { target: { value: 'Hello' } });
    fireEvent.blur(content);
    expect(lastNode()?.data['text']).toBe('Hello');
  });

  it('picks images and fits for an image item', async () => {
    const user = userEvent.setup();
    await act(() => importFiles([new File(['p'], 'map.png', { type: 'image/png' })], 'auto'));
    await show((boardId) => ({
      ...createItem({ boardId, preset: 'image', rect: { x: 0, y: 0 }, z: 1, data: { assetId: 'x' } }),
      id: 'img',
    }));
    expect(screen.queryByText('Text style')).not.toBeInTheDocument();
    await pick(user, screen.getByRole('combobox', { name: 'Choose image' }), 'No image chosen');
    expect(lastNode()?.data['assetId']).toBeNull();
    await pick(user, screen.getByRole('combobox', { name: 'Fit' }), 'Stretch');
    expect(lastNode()?.data['fit']).toBe('fill');
  });

  it('points a link item at another board or a palette', async () => {
    const user = userEvent.setup();
    const other = await createBoard({ name: 'Level' });
    await show((boardId) => ({
      ...createItem({ boardId, preset: 'link', rect: { x: 0, y: 0 }, z: 1 }),
      id: 'ln',
      data: { target: { kind: 'board', id: other.id } },
    }));
    const target = screen.getByRole('combobox', { name: 'Links to' });
    expect(target).toHaveTextContent('Board: Level');
    await pick(user, target, 'Missing asset');
    expect(lastNode()?.data['target']).toBeNull();
    await pick(user, screen.getByRole('combobox', { name: 'Links to' }), 'Board: Level');
    expect(lastNode()?.data['target']).toEqual({ kind: 'board', id: other.id });
  });

  it('changes the opacity of a drawing layer', async () => {
    await show((boardId) => {
      const layer = newLayer({ boardId, name: 'Ink', z: 1, at: { x: 0, y: 0 } });
      const { style: _style, ...data } = layer.data;
      return { ...layer, data };
    });
    expect(screen.getByText('0 tiles')).toBeInTheDocument();
    commit('Opacity', '40');
    expect(lastNode()?.data['style']).toMatchObject({ opacity: 0.4 });
  });

  it('opens the card designer to make or edit a template', async () => {
    const user = userEvent.setup();
    await show((boardId) => ({
      ...createItem({ boardId, preset: 'card', rect: { x: 0, y: 0 }, z: 1 }),
      id: 'card',
      data: { templateId: null, values: {} },
    }));
    await user.click(screen.getByRole('button', { name: 'Edit template' }));
    const { result } = renderHook(() => useActiveWorkspace());
    expect(result.current?.name).toBe('Cards');
    expect(JSON.stringify(result.current?.root)).toContain('"editor":"cardDesigner"');
  });

  it('saves a card as a card asset, follows it live and copies it back out', async () => {
    const user = userEvent.setup();
    const template = await createCardTemplate({
      name: 'Hero',
      fields: [{ id: 'name', kind: 'text', label: 'Hero name' }],
    });
    await show((boardId) => ({
      ...createItem({ boardId, preset: 'card', rect: { x: 0, y: 0 }, z: 1 }),
      id: 'card',
      data: { templateId: template.id, values: { name: 'Ignis' } },
    }));
    await user.click(screen.getByRole('button', { name: 'Save as card asset' }));
    await vi.waitFor(() => {
      expect(lastNode()?.data['cardId']).toBe('card-2');
    });
    expect(api.createCard).toHaveBeenCalledWith({
      name: 'Hero',
      templateId: template.id,
      values: { name: 'Ignis' },
    });
    expect(await screen.findByText('Shows the saved card Hero')).toBeInTheDocument();

    const hero = screen.getByRole('textbox', { name: 'Hero name' });
    fireEvent.change(hero, { target: { value: 'Ember' } });
    fireEvent.blur(hero);
    await vi.waitFor(() => {
      expect(api.updateCard).toHaveBeenLastCalledWith('card-2', { values: { name: 'Ember' } });
    });
    await act(() => updateSavedCard('card-2', { values: { name: 'Blaze' } }));
    expect(screen.getByRole('textbox', { name: 'Hero name' })).toHaveValue('Blaze');

    await user.click(screen.getByRole('button', { name: 'Make independent copy' }));
    expect(lastNode()?.data).toMatchObject({
      cardId: null,
      templateId: template.id,
      values: { name: 'Blaze' },
    });
  });

  it('keeps the values of a saved card that was deleted', async () => {
    const template = await createCardTemplate({
      name: 'Hero',
      fields: [{ id: 'name', kind: 'text', label: 'Hero name' }],
    });
    await show((boardId) => ({
      ...createItem({ boardId, preset: 'card', rect: { x: 0, y: 0 }, z: 1 }),
      id: 'card',
      data: { templateId: template.id, cardId: 'gone', values: { name: 'Ignis' } },
    }));
    expect(screen.getByRole('textbox', { name: 'Hero name' })).toHaveValue('Ignis');
    expect(
      screen.getByText('The saved card was deleted; this card keeps its last values.'),
    ).toBeInTheDocument();
  });
});

function first(items: HTMLElement[]): HTMLElement {
  const [item] = items;
  if (!item) throw new Error('missing element');
  return item;
}
