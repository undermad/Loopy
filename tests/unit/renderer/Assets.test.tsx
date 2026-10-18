import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssetsEditor } from '@renderer/components/editors/Assets/AssetsEditor';
import { AreaContext } from '@renderer/components/Shell/AreaContext';
import { assetActions, folderActions, importFiles } from '@renderer/lib/assets';
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

function editorOf(element: Element): HTMLElement {
  const editor = element.closest<HTMLElement>('.editor');
  if (!editor) throw new Error('The editor root is missing');
  return editor;
}

function menuClosed() {
  return waitFor(() => {
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
}

function file(name: string, type: string): File {
  return new File([new Uint8Array([1, 2, 3, 4])], name, { type });
}

function openProject() {
  const project = makeProject('Space Game');
  api.current = project;
  api.emitProject();
}

beforeEach(async () => {
  patches.mockReset();
  api = await bootTestApp();
  openProject();
});

describe('AssetsEditor tree and views', () => {
  it('shows a spinner until the project loads, then the default folders with counts', async () => {
    api = await bootTestApp();
    render(<Harness />);
    expect(screen.getByRole('status', { name: 'Loading assets…' })).toBeInTheDocument();

    await act(async () => {
      openProject();
      await Promise.resolve();
    });
    const tree = await screen.findByRole('tree', { name: 'Folders' });
    const rows = within(tree).getAllByRole('treeitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      'All files0',
      'Archives0',
      'Audio0',
      'Documents0',
      'Fonts0',
      'Images0',
      'Models0',
      'Video0',
    ]);
    expect(rows[0]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('No files here')).toBeInTheDocument();
    expect(screen.getByText('No file selected')).toBeInTheDocument();
  });

  it('switches to the file types view and selects a kind', async () => {
    const user = userEvent.setup();
    await importFiles([file('hero.png', 'image/png'), file('theme.mp3', 'audio/mpeg')], 'auto');
    render(<Harness />);
    await screen.findByRole('tree', { name: 'Folders' });

    await user.click(screen.getByRole('radio', { name: 'File types' }));
    expect(patches).toHaveBeenCalledWith({ view: 'types' });
    const list = await screen.findByRole('listbox', { name: 'File types' });
    expect(within(list).getByRole('option', { name: 'Images1' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'hero.png' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'theme.mp3' })).not.toBeInTheDocument();

    await user.click(within(list).getByRole('option', { name: 'Audio1' }));
    expect(patches).toHaveBeenCalledWith({ kind: 'audio' });
    expect(await screen.findByRole('button', { name: 'theme.mp3' })).toBeInTheDocument();

    within(list).getByRole('option', { name: '3D models0' }).focus();
    await user.keyboard('{Enter}');
    expect(patches).toHaveBeenCalledWith({ kind: 'model' });
  });

  it('expands, collapses and walks the tree with the keyboard', async () => {
    const user = userEvent.setup();
    await folderActions.create({ name: 'Heroes', parentId: 'folder-images' });
    render(<Harness />);
    const tree = await screen.findByRole('tree', { name: 'Folders' });
    const images = within(tree).getByRole('treeitem', { name: /Images/ });
    expect(images).toHaveAttribute('aria-expanded', 'true');
    expect(within(tree).getByRole('treeitem', { name: /Heroes/ })).toBeInTheDocument();

    within(tree)
      .getByRole('treeitem', { name: /All files/ })
      .focus();
    await user.keyboard('{ArrowDown}');
    expect(within(tree).getByRole('treeitem', { name: /Archives/ })).toHaveFocus();
    await user.keyboard('{End}');
    expect(within(tree).getByRole('treeitem', { name: /Video/ })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(within(tree).getByRole('treeitem', { name: /All files/ })).toHaveFocus();

    images.focus();
    await user.keyboard('{ArrowLeft}');
    expect(images).toHaveAttribute('aria-expanded', 'false');
    expect(within(tree).queryByRole('treeitem', { name: /Heroes/ })).not.toBeInTheDocument();
    await user.keyboard('{ArrowRight}');
    expect(images).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{ArrowRight}');
    const heroes = within(tree).getByRole('treeitem', { name: /Heroes/ });
    expect(heroes).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(patches).toHaveBeenCalledWith({ scope: 'files', folderId: 'folder-1' });
    expect(heroes).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowLeft}');
    expect(images).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(within(tree).getByRole('treeitem', { name: /Fonts/ })).toHaveFocus();
  });
});

describe('AssetsEditor folders', () => {
  it('creates a folder inside the selected folder from the header', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const tree = await screen.findByRole('tree', { name: 'Folders' });
    await user.click(within(tree).getByRole('treeitem', { name: /Images/ }));
    expect(patches).toHaveBeenCalledWith({ scope: 'files', folderId: 'folder-images' });

    await user.click(screen.getByRole('button', { name: 'New' }));
    await user.click(await screen.findByRole('menuitem', { name: 'New folder' }));
    await user.type(await screen.findByLabelText(/Folder name/), 'Heroes');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'New folder' }));
    expect(api.createAssetFolder).toHaveBeenCalledWith({
      name: 'Heroes',
      parentId: 'folder-images',
      scope: 'files',
    });
    expect(await within(tree).findByRole('treeitem', { name: /Heroes/ })).toBeInTheDocument();
  });

  it('renames, nests, moves and deletes folders from the context menu', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const tree = await screen.findByRole('tree', { name: 'Folders' });

    fireEvent.contextMenu(within(tree).getByRole('treeitem', { name: /Images/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Rename folder' }));
    const input = await screen.findByLabelText(/Folder name/);
    expect(input).toHaveValue('Images');
    await user.clear(input);
    await user.type(input, 'Sprites');
    await user.click(screen.getByRole('button', { name: 'Rename' }));
    expect(api.updateAssetFolder).toHaveBeenCalledWith('folder-images', { name: 'Sprites' });
    const sprites = await within(tree).findByRole('treeitem', { name: /Sprites/ });

    fireEvent.contextMenu(sprites);
    await user.click(await screen.findByRole('menuitem', { name: 'New subfolder' }));
    await user.type(await screen.findByLabelText(/Folder name/), 'Enemies');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(api.createAssetFolder).toHaveBeenCalledWith({
      name: 'Enemies',
      parentId: 'folder-images',
      scope: 'files',
    });
    const enemies = await within(tree).findByRole('treeitem', { name: /Enemies/ });
    expect(enemies).toHaveAttribute('aria-level', '3');

    fireEvent.contextMenu(enemies);
    fireEvent.keyDown(await screen.findByRole('menuitem', { name: 'Move to…' }), { key: 'ArrowRight' });
    const audio = await screen.findByRole('menuitem', { name: 'Audio' });
    expect(screen.getByRole('menuitem', { name: 'Sprites' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByRole('menuitem', { name: 'Enemies' })).not.toBeInTheDocument();
    fireEvent.click(audio);
    expect(api.updateAssetFolder).toHaveBeenCalledWith('folder-1', { parentId: 'folder-audio' });
    await menuClosed();

    fireEvent.contextMenu(within(tree).getByRole('treeitem', { name: /Enemies/ }));
    fireEvent.keyDown(await screen.findByRole('menuitem', { name: 'Move to…' }), { key: 'ArrowRight' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'All files' }));
    expect(api.updateAssetFolder).toHaveBeenCalledWith('folder-1', { parentId: null });
    await menuClosed();

    const moved = within(tree).getByRole('treeitem', { name: /Enemies/ });
    await user.click(moved);
    fireEvent.contextMenu(moved);
    await user.click(await screen.findByRole('menuitem', { name: 'Delete folder' }));
    expect(
      await screen.findByText('Delete the folder "Enemies"? Its files and subfolders move to All files.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(api.deleteAssetFolder).toHaveBeenCalledWith('folder-1');
    expect(patches).toHaveBeenLastCalledWith({ scope: 'files', folderId: '' });
    expect(within(tree).queryByRole('treeitem', { name: /Enemies/ })).not.toBeInTheDocument();

    fireEvent.contextMenu(within(tree).getByRole('treeitem', { name: /All files/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'New folder' }));
    await user.type(await screen.findByLabelText(/Folder name/), 'Misc');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(api.createAssetFolder).toHaveBeenCalledWith({ name: 'Misc', parentId: null, scope: 'files' });
  });
});

describe('AssetsEditor imports and search', () => {
  it('imports through the file dialog into the selected folder', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ folderId: 'folder-images' }} />);
    await screen.findByRole('tree', { name: 'Folders' });
    api.assetsData.pickQueue.push([{ name: 'hero.png', mime: 'image/png', bytes: new Uint8Array(10) }]);

    await user.click(screen.getByRole('button', { name: 'Import files…' }));
    expect(api.pickAssets).toHaveBeenCalledWith('folder-images');
    expect(await screen.findByRole('button', { name: 'hero.png' })).toHaveAttribute('aria-pressed', 'true');
    expect(patches).toHaveBeenCalledWith({ selectedId: 'asset-1', internalId: '' });
    expect(screen.getByRole('treeitem', { name: /Images/ })).toHaveTextContent('Images1');
    expect(screen.getByRole('img', { name: 'Preview of hero.png' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Import files…' }));
    expect(patches).toHaveBeenCalledTimes(1);
  });

  it('imports dropped files into the current folder, a tree row, or by kind in the types view', async () => {
    render(<Harness />);
    const tree = await screen.findByRole('tree', { name: 'Folders' });
    const editor = editorOf(tree);

    fireEvent.dragEnter(editor, { dataTransfer: { files: [], types: ['Files'] } });
    fireEvent.dragOver(editor, { dataTransfer: { files: [], types: ['Files'] } });
    expect(editor).toHaveClass('dropping');
    expect(screen.getByText('Drop to import into All files')).toBeInTheDocument();
    fireEvent.dragLeave(editor, { dataTransfer: { files: [], types: ['Files'] } });
    expect(editor).not.toHaveClass('dropping');

    fireEvent.drop(editor, { dataTransfer: { files: [file('notes.txt', 'text/plain')], types: ['Files'] } });
    expect(await screen.findByRole('button', { name: 'notes.txt' })).toBeInTheDocument();
    expect(api.importAssets).toHaveBeenLastCalledWith(expect.objectContaining({ target: null }) as object);

    const audio = within(tree).getByRole('treeitem', { name: /Audio/ });
    fireEvent.dragOver(audio, { dataTransfer: { files: [], types: ['Files'] } });
    expect(audio).toHaveClass('over');
    fireEvent.dragLeave(audio, { dataTransfer: { files: [], types: ['Files'] } });
    expect(audio).not.toHaveClass('over');
    fireEvent.drop(audio, { dataTransfer: { files: [file('theme.mp3', 'audio/mpeg')], types: ['Files'] } });
    await screen.findByRole('button', { name: 'theme.mp3' });
    expect(api.importAssets).toHaveBeenLastCalledWith(
      expect.objectContaining({ target: 'folder-audio' }) as object,
    );
    expect(api.importAssets).toHaveBeenCalledTimes(2);
    expect(within(tree).getByRole('treeitem', { name: /Audio/ })).toHaveTextContent('Audio1');

    fireEvent.drop(editor, { dataTransfer: { files: [], types: [] } });
    expect(api.importAssets).toHaveBeenCalledTimes(2);
  });

  it('uses the kind folders for drops in the types view', async () => {
    render(<Harness initial={{ view: 'types', kind: 'audio' }} />);
    const list = await screen.findByRole('listbox', { name: 'File types' });
    const editor = editorOf(list);
    fireEvent.dragEnter(editor, { dataTransfer: { files: [], types: ['Files'] } });
    expect(screen.getByText('Drop to import into the folders for each file type')).toBeInTheDocument();
    fireEvent.drop(editor, { dataTransfer: { files: [file('hero.png', 'image/png')], types: ['Files'] } });
    expect(await screen.findByRole('button', { name: 'hero.png' })).toBeInTheDocument();
    expect(api.importAssets).toHaveBeenLastCalledWith(expect.objectContaining({ target: 'auto' }) as object);
    expect(patches).toHaveBeenCalledWith({ selectedId: 'asset-1', internalId: '', kind: 'image' });

    const fonts = within(list).getByRole('option', { name: /Fonts/ });
    fireEvent.dragOver(fonts, { dataTransfer: { files: [], types: ['Files'] } });
    expect(fonts).toHaveClass('over');
    fireEvent.dragLeave(fonts, { dataTransfer: { files: [], types: ['Files'] } });
    fireEvent.drop(fonts, { dataTransfer: { files: [file('body.ttf', 'font/ttf')], types: ['Files'] } });
    await screen.findByRole('button', { name: 'body.ttf' });
    expect(api.importAssets).toHaveBeenLastCalledWith(expect.objectContaining({ target: 'auto' }) as object);
  });

  it('filters the visible files by name, kind and tag', async () => {
    const user = userEvent.setup();
    await importFiles([file('hero.png', 'image/png'), file('theme.mp3', 'audio/mpeg')], 'auto');
    await assetActions.update('asset-2', { tags: ['menu'] });
    render(<Harness />);
    await screen.findByRole('button', { name: 'hero.png' });
    expect(screen.getByRole('group', { name: 'Files' }).children).toHaveLength(2);

    const search = screen.getByRole('searchbox', { name: 'Search assets' });
    await user.type(search, 'menu');
    expect(patches).toHaveBeenLastCalledWith({ search: 'menu' });
    expect(screen.queryByRole('button', { name: 'hero.png' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'theme.mp3' })).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'zzz');
    expect(screen.getByText('No files match')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'List' }));
    expect(patches).toHaveBeenCalledWith({ layout: 'list' });
    await user.clear(search);
    expect(screen.getByRole('group', { name: 'Files' })).toHaveClass('listLayout');
    expect(screen.getAllByText('Images')).not.toHaveLength(0);
  });
});
