import { useState, type ComponentType } from 'react';
import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LayoutNode } from '@shared/layout';
import { buildWorkspace, builtInLayoutPresets } from '@shared/layout-presets';
import { CardDesigner } from '@renderer/components/editors/Cards/CardDesigner';
import { CardLibrary } from '@renderer/components/editors/Cards/CardLibrary';
import { commitChanges, createBoard, createItem, getBoardNodes, loadBoard } from '@renderer/lib/board';
import { createCardTemplate, createSavedCard } from '@renderer/lib/cards';
import type { EditorProps } from '@renderer/lib/editors';
import { cardTarget, linkTarget, useActiveWorkspace } from '@renderer/lib/workspaces';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

let api: FakeApi;

const NAMES = {
  planning: 'Planning',
  design: 'Design',
  palette: 'Palette',
  assets: 'Assets',
  ideas: 'Idea Map',
  cards: 'Cards',
};

function editorsOf(node: LayoutNode): string[] {
  return node.kind === 'area' ? [node.editor] : node.children.flatMap(editorsOf);
}

function areasOf(node: LayoutNode): { editor: string; state: Record<string, unknown> }[] {
  return node.kind === 'area' ? [node] : node.children.flatMap(areasOf);
}

function Stateful({
  editor: Editor,
  initial = {},
  onState,
}: {
  editor: ComponentType<EditorProps>;
  initial?: Record<string, unknown>;
  onState?: (state: Record<string, unknown>) => void;
}) {
  const [state, setState] = useState(initial);
  return (
    <TooltipProvider>
      <ToastProvider closeLabel="Dismiss" regionLabel="Notifications">
        <Editor
          areaId="cards"
          state={state}
          setState={(patch) => {
            setState((current) => {
              const next = { ...current, ...patch };
              onState?.(next);
              return next;
            });
          }}
        />
      </ToastProvider>
    </TooltipProvider>
  );
}

beforeEach(async () => {
  api = await bootTestApp();
  api.current = makeProject('Space Game');
  api.emitProject();
  await act(async () => {
    await Promise.resolve();
  });
});

describe('cards workspace', () => {
  it('pairs the card library with the designer and ships as a preset', () => {
    expect(editorsOf(buildWorkspace('cards', 'Cards').root)).toEqual(['cardLibrary', 'cardDesigner']);
    const presets = builtInLayoutPresets({ ...NAMES, default: 'Default' });
    expect(presets.find((preset) => preset.id === 'default')?.workspaces.map((item) => item.name)).toContain(
      'Cards',
    );
    expect(presets.find((preset) => preset.id === 'cards')?.workspaces).toHaveLength(1);
  });

  it('opens saved cards and templates in the designer', () => {
    expect(linkTarget({ kind: 'card', id: 'c1' }, NAMES)).toEqual({
      editor: 'cardDesigner',
      state: { target: { kind: 'card', id: 'c1' } },
      template: 'cards',
      workspaceName: 'Cards',
    });
    expect(cardTarget({ kind: 'template', id: 't1' }, NAMES).state).toEqual({
      target: { kind: 'template', id: 't1' },
    });
  });
});

describe('card designer', () => {
  it('builds a new template from a starter and saves it', async () => {
    const user = userEvent.setup();
    const onState = vi.fn();
    render(<Stateful editor={CardDesigner} onState={onState} />);
    await user.click(await screen.findByRole('button', { name: 'Quest' }));
    const fields = screen.getByRole('complementary', { name: 'Fields' });
    expect(within(fields).getByRole('button', { name: 'Edit Title' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add field' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Asset link' }));
    const settings = screen.getByRole('complementary', { name: 'Field' });
    await user.click(within(settings).getByRole('switch', { name: 'Palettes' }));
    await user.click(within(settings).getByRole('switch', { name: 'Allow several' }));

    await user.click(screen.getByRole('button', { name: 'Save template' }));
    const saved = vi.mocked(api.createCardTemplate).mock.calls[0]?.[0];
    expect(saved?.name).toBe('Quest');
    expect(saved?.fields?.at(-1)).toMatchObject({
      kind: 'link',
      linkKinds: ['board', 'note', 'card'],
      multiple: true,
    });
    expect(onState).toHaveBeenLastCalledWith({ target: { kind: 'template', id: 'template-1' } });
    expect(await screen.findByText('Template "Quest" saved.')).toBeInTheDocument();
  });

  it('edits, duplicates and deletes an existing template', async () => {
    const user = userEvent.setup();
    const template = await createCardTemplate({ name: 'Item', fields: [{ id: 'name', kind: 'heading' }] });
    render(<Stateful editor={CardDesigner} initial={{ target: { kind: 'template', id: template.id } }} />);
    const name = await screen.findByRole('textbox', { name: 'Template name' });
    await user.clear(name);
    await user.type(name, 'Loot');
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(screen.getByRole('textbox', { name: 'Template name' })).toHaveValue('Item');
    await user.clear(screen.getByRole('textbox', { name: 'Template name' }));
    await user.type(screen.getByRole('textbox', { name: 'Template name' }), 'Loot');
    await user.click(screen.getByRole('button', { name: 'Save template' }));
    expect(api.updateCardTemplate).toHaveBeenCalledWith(
      template.id,
      expect.objectContaining({ name: 'Loot' }) as object,
    );

    await user.click(screen.getByRole('button', { name: 'Duplicate template' }));
    expect(await screen.findByRole('textbox', { name: 'Template name' })).toHaveValue('Loot copy');
    await user.click(screen.getByRole('button', { name: 'Delete template' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(api.deleteCardTemplate).toHaveBeenCalled();
  });

  it('makes a card from a template, fills it in and saves its values', async () => {
    const user = userEvent.setup();
    const onState = vi.fn();
    const template = await createCardTemplate({
      name: 'Hero',
      fields: [{ id: 'title', kind: 'heading', label: 'Title' }],
    });
    render(
      <Stateful
        editor={CardDesigner}
        initial={{ target: { kind: 'template', id: template.id } }}
        onState={onState}
      />,
    );
    await user.click(await screen.findByRole('button', { name: 'New card from this template' }));
    expect(api.createCard).toHaveBeenCalledWith({ name: 'Hero', templateId: template.id });
    expect(onState).toHaveBeenLastCalledWith({ target: { kind: 'card', id: 'card-2' } });

    expect(await screen.findByRole('textbox', { name: 'Card name' })).toHaveValue('Hero');
    expect(screen.queryByRole('button', { name: 'Add field' })).not.toBeInTheDocument();
    const title = screen.getByRole('textbox', { name: 'Title' });
    await user.type(title, 'Sir Loop');
    await user.tab();
    await user.click(screen.getByRole('button', { name: 'Save card' }));
    expect(api.updateCard).toHaveBeenLastCalledWith(
      'card-2',
      expect.objectContaining({ values: { title: 'Sir Loop' }, templateId: template.id }) as object,
    );

    await user.click(screen.getByRole('button', { name: 'Edit template' }));
    expect(onState).toHaveBeenLastCalledWith({ target: { kind: 'template', id: template.id } });
  });

  it('designs a card without a template and turns it into one', async () => {
    const user = userEvent.setup();
    const onState = vi.fn();
    render(<Stateful editor={CardDesigner} onState={onState} />);
    await user.click(await screen.findByRole('button', { name: 'Blank card without a template' }));
    await user.click(screen.getByRole('button', { name: 'Add field' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Number' }));
    await user.click(screen.getByRole('button', { name: 'Save card' }));
    const created = vi.mocked(api.createCard).mock.calls[0]?.[0];
    expect(created?.templateId).toBeNull();
    expect(created?.layout?.fields?.map((field) => field.kind)).toEqual(['heading', 'longText', 'number']);
    expect(onState).toHaveBeenLastCalledWith({ target: { kind: 'card', id: 'card-1' } });

    await user.click(await screen.findByRole('button', { name: 'Save as template' }));
    expect(api.createCardTemplate).toHaveBeenCalled();
    expect(api.updateCard).toHaveBeenLastCalledWith('card-1', { templateId: 'template-2' });
  });

  it('detaches a card from its template so its layout can change', async () => {
    const user = userEvent.setup();
    const template = await createCardTemplate({ name: 'Hero', fields: [{ id: 'title', kind: 'heading' }] });
    const card = await createSavedCard({ name: 'Knight', templateId: template.id });
    render(<Stateful editor={CardDesigner} initial={{ target: { kind: 'card', id: card.id } }} />);
    await user.click(await screen.findByRole('combobox', { name: 'Template' }));
    await user.click(await screen.findByRole('option', { name: 'No template' }));
    expect(screen.getByRole('button', { name: 'Add field' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save card' }));
    expect(api.updateCard).toHaveBeenLastCalledWith(
      card.id,
      expect.objectContaining({
        templateId: null,
        layout: expect.objectContaining({ fields: [expect.objectContaining({ id: 'title' })] }) as object,
      }) as object,
    );
    await user.click(screen.getByRole('button', { name: 'Delete card' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(api.deleteCard).toHaveBeenCalledWith(card.id);
  });

  it('duplicates a card and moves it to another template', async () => {
    const user = userEvent.setup();
    const onState = vi.fn();
    const hero = await createCardTemplate({ name: 'Hero', fields: [{ id: 'title', kind: 'heading' }] });
    await createCardTemplate({ name: 'Villain', fields: [{ id: 'title', kind: 'heading' }] });
    const card = await createSavedCard({
      name: 'Knight',
      layout: { fields: [{ id: 'title', kind: 'heading' }] },
    });
    render(
      <Stateful
        editor={CardDesigner}
        initial={{ target: { kind: 'card', id: card.id } }}
        onState={onState}
      />,
    );
    await user.click(await screen.findByRole('combobox', { name: 'Template' }));
    await user.click(await screen.findByRole('option', { name: 'Villain' }));
    expect(screen.queryByRole('button', { name: 'Add field' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit template' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(screen.getByRole('button', { name: 'Add field' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Duplicate card' }));
    expect(onState).toHaveBeenLastCalledWith({ target: { kind: 'card', id: 'card-4' } });
    expect(hero.id).toBe('template-1');
  });

  it('starts a card from a template on the start screen', async () => {
    const user = userEvent.setup();
    const onState = vi.fn();
    await createCardTemplate({ name: 'Hero', fields: [{ id: 'title', kind: 'heading', label: 'Title' }] });
    render(<Stateful editor={CardDesigner} onState={onState} />);
    await user.click(await screen.findByRole('button', { name: 'Hero card' }));
    await user.click(screen.getByRole('button', { name: 'Save card' }));
    expect(api.createCard).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Hero', templateId: 'template-1', layout: null }) as object,
    );
  });

  it('edits a card that lives on a board and can save it as a card asset', async () => {
    const user = userEvent.setup();
    const onState = vi.fn();
    const template = await createCardTemplate({
      name: 'Hero',
      fields: [{ id: 'title', kind: 'heading', label: 'Title' }],
    });
    const board = await createBoard({ name: 'Castle' });
    await loadBoard(board.id);
    await commitChanges(
      board.id,
      {
        upsertNodes: [
          {
            ...createItem({
              boardId: board.id,
              preset: 'card',
              rect: { x: 0, y: 0 },
              z: 1,
              data: { templateId: template.id, values: { title: 'Ignis' } },
            }),
            id: 'node',
          },
        ],
      },
      { history: false },
    );
    render(
      <Stateful
        editor={CardDesigner}
        initial={{ target: { kind: 'item', id: 'node', boardId: board.id } }}
        onState={onState}
      />,
    );
    expect(await screen.findByText('This card lives on the board Castle.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete card' })).not.toBeInTheDocument();
    const title = screen.getByRole('textbox', { name: 'Title' });
    expect(title).toHaveValue('Ignis');
    await user.clear(title);
    await user.type(title, 'Ember');
    await user.tab();
    await user.type(screen.getByRole('textbox', { name: 'Card name' }), 'Fire mage');
    await user.click(screen.getByRole('button', { name: 'Save card' }));
    expect(getBoardNodes(board.id)[0]?.data).toMatchObject({
      name: 'Fire mage',
      templateId: template.id,
      values: { title: 'Ember' },
    });

    await user.click(screen.getByRole('button', { name: 'Save as card asset' }));
    expect(api.createCard).toHaveBeenCalledWith({
      name: 'Fire mage',
      templateId: template.id,
      values: { title: 'Ember' },
    });
    await vi.waitFor(() => {
      expect(getBoardNodes(board.id)[0]?.data['cardId']).toBe('card-2');
    });
    expect(onState).toHaveBeenLastCalledWith({ target: { kind: 'card', id: 'card-2' } });
  });

  it('says when its card or template is gone', async () => {
    render(<Stateful editor={CardDesigner} initial={{ target: { kind: 'card', id: 'gone' } }} />);
    expect(await screen.findByText('This card or template was deleted.')).toBeInTheDocument();
  });
});

describe('card library', () => {
  it('lists templates and cards and opens them in the designer', async () => {
    const user = userEvent.setup();
    const template = await createCardTemplate({ name: 'Hero' });
    const card = await createSavedCard({ name: 'Knight', templateId: template.id });
    render(<Stateful editor={CardLibrary} />);
    const templates = await screen.findByRole('list', { name: 'Templates' });
    const cards = screen.getByRole('list', { name: 'Cards' });
    expect(within(cards).getByText('Hero')).toBeInTheDocument();

    await user.click(within(cards).getByRole('button', { name: /Knight/ }));
    const { result } = renderHook(() => useActiveWorkspace());
    const designer = areasOf(result.current?.root ?? { kind: 'area', id: 'x', editor: '', state: {} }).find(
      (area) => area.editor === 'cardDesigner',
    );
    expect(designer?.state).toMatchObject({ target: { kind: 'card', id: card.id } });

    await user.click(within(templates).getByRole('button', { name: /Hero/ }));
    const { result: again } = renderHook(() => useActiveWorkspace());
    expect(JSON.stringify(again.current?.root)).toContain(`"id":"${template.id}"`);

    await user.click(screen.getByRole('button', { name: 'New template' }));
    const { result: blank } = renderHook(() => useActiveWorkspace());
    expect(JSON.stringify(blank.current?.root)).toContain('"target":null');
  });

  it('drags a saved card out as an internal asset link', async () => {
    const card = await createSavedCard({ name: 'Knight' });
    const zone = document.createElement('div');
    zone.setAttribute('data-asset-drop', '');
    document.body.append(zone);
    const seen: { phase: string; links: unknown }[] = [];
    zone.addEventListener('loopy:asset-drag', (event) => {
      const { phase, links } = (event as CustomEvent<{ phase: string; links: unknown }>).detail;
      seen.push({ phase, links });
    });
    vi.spyOn(document, 'elementsFromPoint').mockReturnValue([zone]);
    render(<Stateful editor={CardLibrary} />);
    const row = await screen.findByRole('button', { name: /Knight/ });
    fireEvent.pointerDown(row, { button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(window, { clientX: 1, clientY: 1 });
    fireEvent.pointerMove(window, { clientX: 40, clientY: 40 });
    fireEvent.pointerUp(window, { clientX: 40, clientY: 40 });
    fireEvent.click(row);
    expect(seen.map((item) => item.phase)).toEqual(['move', 'drop']);
    expect(seen[1]?.links).toEqual([{ kind: 'card', id: card.id }]);
    const { result } = renderHook(() => useActiveWorkspace());
    expect(JSON.stringify(result.current?.root)).not.toContain(card.id);

    fireEvent.pointerDown(row, { button: 2 });
    fireEvent.pointerDown(row, { button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerUp(window, { clientX: 0, clientY: 0 });
    zone.remove();
  });

  it('explains an empty library', async () => {
    render(<Stateful editor={CardLibrary} />);
    expect(await screen.findByText('No templates yet')).toBeInTheDocument();
    expect(screen.getByText('No saved cards yet')).toBeInTheDocument();
  });
});
