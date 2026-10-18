import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssetsEditor } from '@renderer/components/editors/Assets/AssetsEditor';
import { AreaContext } from '@renderer/components/Shell/AreaContext';
import { folderActions, importFiles, isRenameClick, pickSelection, recordClick } from '@renderer/lib/assets';
import { createBoard } from '@renderer/lib/board';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

let api: FakeApi;
const patches = vi.fn();

function Harness({ initial = {} }: { initial?: Record<string, unknown> }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [state, setState] = useState<Record<string, unknown>>(initial);
  return (
    <TooltipProvider>
      <ToastProvider closeLabel="Dismiss" regionLabel="Notifications">
        <div ref={setSlot} />
        <AreaContext value={{ areaId: 'a', headerSlot: slot }}>
          <AssetsEditor
            areaId="a"
            state={state}
            setState={(patch) => {
              patches(patch);
              setState((current) => ({ ...current, ...patch }));
            }}
          />
        </AreaContext>
      </ToastProvider>
    </TooltipProvider>
  );
}

function file(name: string, type: string): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type });
}

function menuClosed() {
  return waitFor(() => {
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
}

beforeEach(async () => {
  patches.mockReset();
  api = await bootTestApp();
  const project = makeProject('Space Game');
  api.current = project;
  api.emitProject();
  await importFiles([file('hero.png', 'image/png'), file('theme.mp3', 'audio/mpeg')], 'auto');
  await importFiles([file('notes.txt', 'text/plain')], null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('selection helpers', () => {
  it('picks single, toggled and ranged selections', () => {
    const order = ['a', 'b', 'c', 'd'];
    expect(pickSelection(order, ['a'], 'a', 'c', { ctrl: false, shift: false })).toEqual({
      selection: ['c'],
      anchor: 'c',
    });
    expect(pickSelection(order, ['a'], 'a', 'c', { ctrl: true, shift: false }).selection).toEqual(['a', 'c']);
    expect(pickSelection(order, ['a', 'c'], 'c', 'c', { ctrl: true, shift: false }).selection).toEqual(['a']);
    expect(pickSelection(order, ['d'], 'd', 'b', { ctrl: false, shift: true })).toEqual({
      selection: ['b', 'c', 'd'],
      anchor: 'd',
    });
    expect(pickSelection(order, [], null, 'b', { ctrl: false, shift: true }).selection).toEqual(['b']);
  });

  it('treats a second click on the same item inside the window as a rename', () => {
    const first = recordClick('a', 1000);
    expect(isRenameClick(first, 'a', 1200)).toBe(false);
    expect(isRenameClick(first, 'a', 1700)).toBe(true);
    expect(isRenameClick(first, 'a', 3000)).toBe(false);
    expect(isRenameClick(first, 'b', 1700)).toBe(false);
    expect(isRenameClick(null, 'a')).toBe(false);
  });
});

describe('browsing assets', () => {
  it('puts search, import and the new menu above the folder trees', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ scope: 'boards', folderId: '' }} />);
    const search = await screen.findByRole('searchbox', { name: 'Search assets' });
    const importButton = screen.getByRole('button', { name: 'Import files…' });
    const create = screen.getByRole('button', { name: 'New' });
    const external = screen.getByText('External');
    const after = Node.DOCUMENT_POSITION_FOLLOWING;
    expect(search.compareDocumentPosition(importButton) & after).toBeTruthy();
    expect(importButton.compareDocumentPosition(create) & after).toBeTruthy();
    expect(create.compareDocumentPosition(external) & after).toBeTruthy();

    await user.click(create);
    await user.click(await screen.findByRole('menuitem', { name: 'New board' }));
    const name = await screen.findByLabelText(/Name/);
    expect(name).toHaveValue('New board');
    await user.clear(name);
    await user.type(name, 'Dungeon');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Create' }));
    expect(api.createBoard).toHaveBeenCalledWith({ name: 'Dungeon' });
    expect(await screen.findByRole('button', { name: 'Dungeon' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(create);
    await user.click(await screen.findByRole('menuitem', { name: 'New colour palette' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Create' }));
    expect(api.createPalette).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'New palette', harmony: 'analogous' }) as unknown,
    );
  });

  it('files new boards and palettes into the open internal folder', async () => {
    const user = userEvent.setup();
    await act(async () => {
      await folderActions.create({ name: 'Levels', parentId: null, scope: 'boards' });
      await folderActions.create({ name: 'Moods', parentId: null, scope: 'palettes' });
    });
    const folders = (await api.getAssets()).folders;
    const levels = folders.find((folder) => folder.name === 'Levels')?.id ?? '';
    const moods = folders.find((folder) => folder.name === 'Moods')?.id ?? '';
    const view = render(<Harness initial={{ scope: 'boards', folderId: levels }} />);
    await user.click(await screen.findByRole('button', { name: 'New' }));
    await user.click(await screen.findByRole('menuitem', { name: 'New board' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Create' }));
    expect(api.updateBoard).toHaveBeenCalledWith(expect.any(String), { folderId: levels });
    view.unmount();

    render(<Harness initial={{ scope: 'palettes', folderId: moods }} />);
    await user.click(await screen.findByRole('button', { name: 'New' }));
    await user.click(await screen.findByRole('menuitem', { name: 'New colour palette' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Create' }));
    expect(api.updatePalette).toHaveBeenCalledWith(expect.any(String), { folderId: moods });
  });

  it('deletes, clears, selects all and renames with the keyboard and a slow second click', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ details: false }} />);
    const hero = await screen.findByRole('button', { name: 'hero.png' });
    const notes = screen.getByRole('button', { name: 'notes.txt' });

    await user.click(hero);
    fireEvent.keyDown(hero, { key: 'Escape' });
    expect(hero).toHaveAttribute('aria-pressed', 'false');
    fireEvent.keyDown(hero, { key: 'Escape' });

    fireEvent.keyDown(hero, { key: 'a', ctrlKey: true });
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(3);
    fireEvent.keyDown(hero, { key: 'F2' });
    expect(screen.queryByRole('textbox', { name: 'File name' })).not.toBeInTheDocument();

    const now = vi.spyOn(Date, 'now').mockReturnValue(10_000);
    await user.click(notes);
    now.mockReturnValue(10_800);
    await user.click(notes);
    const inline = screen.getByRole('textbox', { name: 'File name' });
    expect(inline).toHaveValue('notes.txt');
    await user.keyboard('{Escape}');
    expect(api.updateAsset).not.toHaveBeenCalled();
    now.mockRestore();

    fireEvent.keyDown(notes, { key: 'F2' });
    const renaming = screen.getByRole('textbox', { name: 'File name' });
    await user.clear(renaming);
    await user.type(renaming, 'todo.txt{Enter}');
    expect(api.updateAsset).toHaveBeenCalledWith('asset-3', { name: 'todo.txt' });

    const todo = await screen.findByRole('button', { name: 'todo.txt' });
    fireEvent.keyDown(todo, { key: 'Delete' });
    expect(await screen.findByText('Delete "todo.txt"? This cannot be undone.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(api.deleteAssets).toHaveBeenCalledWith(['asset-3']);
    expect(patches).toHaveBeenLastCalledWith({ selectedId: '', internalId: '' });
    fireEvent.keyDown(hero, { key: 'Delete' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows files inside the folder tree and works on them there', async () => {
    const user = userEvent.setup();
    await act(() => createBoard({ name: 'Map' }));
    render(<Harness initial={{ treeFiles: true }} />);
    const tree = await screen.findByRole('tree', { name: 'Folders' });
    const notes = within(tree).getByRole('treeitem', { name: 'notes.txt' });
    const theme = within(tree).getByRole('treeitem', { name: 'theme.mp3' });
    expect(within(tree).getByRole('treeitem', { name: 'hero.png' })).toHaveAttribute('aria-level', '3');
    expect(notes).toHaveAttribute('aria-level', '2');
    const boards = screen.getByRole('tree', { name: 'Boards' });
    expect(within(boards).getByRole('treeitem', { name: 'Map' })).toBeInTheDocument();

    await user.click(notes);
    expect(patches).toHaveBeenLastCalledWith({ selectedId: 'asset-3', internalId: '' });
    expect(notes).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Shift>}');
    await user.click(theme);
    await user.keyboard('{/Shift}');
    expect(within(tree).getByRole('treeitem', { name: 'hero.png' })).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(theme, { key: 'ArrowUp' });
    fireEvent.keyDown(theme, { key: 'ArrowDown' });
    fireEvent.keyDown(theme, { key: 'ArrowLeft' });
    fireEvent.keyDown(notes, { key: ' ' });
    expect(notes).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(notes, { key: 'Enter' });
    expect(patches).toHaveBeenLastCalledWith({ selectedId: 'asset-3', details: true, internalId: '' });

    fireEvent.keyDown(notes, { key: 'F2' });
    const inline = within(tree).getByRole('textbox', { name: 'File name' });
    await user.clear(inline);
    await user.type(inline, 'plan.txt{Enter}');
    expect(api.updateAsset).toHaveBeenCalledWith('asset-3', { name: 'plan.txt' });

    fireEvent.contextMenu(within(tree).getByRole('treeitem', { name: 'plan.txt' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Export…' }));
    expect(api.exportAsset).toHaveBeenCalledWith('asset-3');
    await menuClosed();

    fireEvent.click(within(boards).getByRole('treeitem', { name: 'Map' }));
    expect(patches).toHaveBeenLastCalledWith({ internalId: expect.stringMatching(/^board:/) as unknown });

    await user.click(screen.getByRole('button', { name: 'Show files in the folder tree' }));
    expect(within(tree).queryByRole('treeitem', { name: 'plan.txt' })).not.toBeInTheDocument();
  });

  it('renames and deletes folders with keys and a slow second click', async () => {
    const user = userEvent.setup();
    await act(() => folderActions.create({ name: 'Heroes', parentId: null }));
    render(<Harness />);
    const tree = await screen.findByRole('tree', { name: 'Folders' });
    const heroes = within(tree).getByRole('treeitem', { name: /Heroes/ });

    const now = vi.spyOn(Date, 'now').mockReturnValue(5_000);
    await user.click(heroes);
    now.mockReturnValue(5_900);
    await user.click(heroes);
    expect(await screen.findByLabelText(/Folder name/)).toHaveValue('Heroes');
    await user.keyboard('{Escape}');
    now.mockRestore();

    fireEvent.keyDown(heroes, { key: 'F2' });
    expect(await screen.findByLabelText(/Folder name/)).toHaveValue('Heroes');
    await user.keyboard('{Escape}');
    fireEvent.keyDown(heroes, { key: 'Delete' });
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(api.deleteAssetFolder).toHaveBeenCalledWith(expect.stringMatching(/^folder-/));
  });

  it('opens, renames, moves and deletes boards from their menu', async () => {
    const user = userEvent.setup();
    await act(async () => {
      await createBoard({ name: 'Map' });
      await createBoard({ name: 'Town' });
      await folderActions.create({ name: 'Levels', parentId: null, scope: 'boards' });
    });
    render(<Harness initial={{ scope: 'boards', folderId: '' }} />);
    const map = await screen.findByRole('button', { name: 'Map' });
    const town = screen.getByRole('button', { name: 'Town' });

    fireEvent.contextMenu(map);
    await user.click(await screen.findByRole('menuitem', { name: 'Rename' }));
    const inline = screen.getByRole('textbox', { name: 'Name' });
    await user.clear(inline);
    await user.type(inline, 'World{Enter}');
    expect(api.updateBoard).toHaveBeenCalledWith('board-1', { name: 'World' });

    const world = await screen.findByRole('button', { name: 'World' });
    await user.click(world);
    await user.keyboard('{Control>}');
    await user.click(town);
    await user.keyboard('{/Control}');
    fireEvent.contextMenu(town);
    fireEvent.keyDown(await screen.findByRole('menuitem', { name: 'Move to…' }), { key: 'ArrowRight' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Levels' }));
    expect(api.updateBoard).toHaveBeenCalledWith('board-1', {
      folderId: expect.stringMatching(/^folder-/) as unknown,
    });
    expect(api.updateBoard).toHaveBeenCalledWith('board-2', {
      folderId: expect.stringMatching(/^folder-/) as unknown,
    });
    await menuClosed();

    fireEvent.contextMenu(town);
    await user.click(await screen.findByRole('menuitem', { name: 'Delete 2 items' }));
    expect(await screen.findByText('Delete 2 items? This cannot be undone.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(api.deleteBoard).toHaveBeenCalledWith('board-1');
    expect(api.deleteBoard).toHaveBeenCalledWith('board-2');
  });

  it('deletes a single board after confirming and opens one from its menu', async () => {
    const user = userEvent.setup();
    await act(() => createBoard({ name: 'Map' }));
    render(<Harness initial={{ scope: 'boards', folderId: '' }} />);
    const map = await screen.findByRole('button', { name: 'Map' });
    fireEvent.contextMenu(map);
    await user.click(await screen.findByRole('menuitem', { name: 'Open' }));
    await menuClosed();
    fireEvent.contextMenu(map);
    await user.click(await screen.findByRole('menuitem', { name: 'Delete board' }));
    expect(await screen.findByText('Delete "Map"? This cannot be undone.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(api.deleteBoard).toHaveBeenCalledWith('board-1');
  });

  it('clears the selection from empty space and shows only the tree when files are in it', async () => {
    const user = userEvent.setup();
    const view = render(<Harness initial={{ details: false }} />);
    const hero = await screen.findByRole('button', { name: 'hero.png' });
    await user.click(hero);
    expect(hero).toHaveAttribute('aria-pressed', 'true');
    const grid = screen.getByRole('group', { name: 'Files' });
    await user.click(grid);
    expect(hero).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getAllByRole('separator').length).toBeGreaterThan(0);
    view.unmount();

    render(<Harness initial={{ treeFiles: true }} />);
    await screen.findByRole('tree', { name: 'Folders' });
    expect(screen.queryByRole('group', { name: 'Files' })).not.toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: 'Layout' })).not.toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Details panel' })).toBeInTheDocument();
  });
});

describe('selection in the folder tree', () => {
  it('keeps one thing selected when switching between folders and items', async () => {
    const user = userEvent.setup();
    await act(() => createBoard({ name: 'Map' }));
    render(<Harness initial={{ treeFiles: true }} />);
    const files = await screen.findByRole('tree', { name: 'Folders' });
    const boards = screen.getByRole('tree', { name: 'Boards' });
    const images = within(files).getByRole('treeitem', { name: /Images/ });
    const notes = within(files).getByRole('treeitem', { name: 'notes.txt' });
    const theme = within(files).getByRole('treeitem', { name: 'theme.mp3' });
    const map = within(boards).getByRole('treeitem', { name: 'Map' });
    const selected = () => screen.getAllByRole('treeitem', { selected: true }).map((row) => row.textContent);

    await user.click(images);
    expect(selected()).toEqual(['Images1']);
    await user.click(notes);
    expect(selected()).toEqual(['notes.txt']);
    await user.click(theme);
    expect(selected()).toEqual(['theme.mp3']);
    await user.click(map);
    expect(selected()).toEqual(['Map']);

    await user.click(within(boards).getByRole('treeitem', { name: /^Boards/ }));
    expect(selected()).toEqual(['Boards1']);
    await user.click(images);
    expect(selected()).toEqual(['Images1']);
    await user.click(notes);
    expect(selected()).toEqual(['notes.txt']);
  });
});
