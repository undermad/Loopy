import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssetsEditor } from '@renderer/components/editors/Assets/AssetsEditor';
import { AreaContext } from '@renderer/components/Shell/AreaContext';
import { importFiles } from '@renderer/lib/assets';
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

function menuClosed() {
  return waitFor(() => {
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
}

function file(name: string, type: string): File {
  return new File([new Uint8Array([1, 2, 3, 4])], name, { type });
}

function rect(x: number, y: number, width: number, height: number): DOMRect {
  return {
    x,
    y,
    left: x,
    top: y,
    width,
    height,
    right: x + width,
    bottom: y + height,
    toJSON: () => undefined,
  };
}

const tick = () =>
  act(
    () =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      }),
  );

async function press(target: Element | Document, code: string) {
  await act(async () => {
    fireEvent.keyDown(target, { code, key: code === 'Space' ? ' ' : code });
    await Promise.resolve();
  });
  await tick();
}

beforeEach(async () => {
  patches.mockReset();
  api = await bootTestApp();
  const project = makeProject('Space Game');
  api.projects = [project];
  api.current = project;
  api.emitProject();
  await importFiles([file('hero.png', 'image/png'), file('theme.mp3', 'audio/mpeg')], 'auto');
  await importFiles([file('notes.txt', 'text/plain')], null);
});

describe('AssetsEditor details panel', () => {
  it('selects a file, edits its name, tags and folder, and deletes it', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(await screen.findByRole('button', { name: 'hero.png' }));
    expect(patches).toHaveBeenCalledWith({ selectedId: 'asset-1' });
    const panel = screen.getByRole('complementary', { name: 'Details panel' });
    expect(within(panel).getByText('image/png')).toBeInTheDocument();
    expect(within(panel).getByText('16 × 16')).toBeInTheDocument();
    expect(within(panel).getByText('4 B')).toBeInTheDocument();

    const name = within(panel).getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'player.png{Enter}');
    expect(api.updateAsset).toHaveBeenCalledWith('asset-1', { name: 'player.png' });
    await user.clear(name);
    await user.tab();
    expect(name).toHaveValue('player.png');
    expect(api.updateAsset).toHaveBeenCalledTimes(1);

    const tags = within(panel).getByLabelText('Tags');
    await user.type(tags, 'sprite{Enter}');
    expect(api.updateAsset).toHaveBeenCalledWith('asset-1', { tags: ['sprite'] });
    await user.type(tags, 'sprite{Enter}');
    expect(api.updateAsset).toHaveBeenCalledTimes(2);
    await user.type(tags, ' {Enter}');
    expect(api.updateAsset).toHaveBeenCalledTimes(2);
    await user.click(await within(panel).findByRole('button', { name: 'Remove tag sprite' }));
    expect(api.updateAsset).toHaveBeenLastCalledWith('asset-1', { tags: [] });

    await user.click(within(panel).getByRole('combobox', { name: 'Folder' }));
    await user.click(await screen.findByRole('option', { name: 'Audio' }));
    expect(api.moveAssets).toHaveBeenCalledWith(['asset-1'], 'folder-audio');

    await user.click(within(panel).getByRole('button', { name: 'Export…' }));
    expect(api.exportAsset).toHaveBeenCalledWith('asset-1');

    await user.click(within(panel).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Delete "player.png"? This cannot be undone.')).toBeInTheDocument();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    expect(api.deleteAssets).toHaveBeenCalledWith(['asset-1']);
    expect(await within(panel).findByText('No file selected')).toBeInTheDocument();
  });

  it('previews audio and video, hides the panel and reopens it on double-click', async () => {
    const user = userEvent.setup();
    await importFiles([file('intro.mp4', 'video/mp4')], null);
    render(<Harness initial={{ selectedId: 'asset-2' }} />);
    const panel = await screen.findByRole('complementary', { name: 'Details panel' });
    expect(within(panel).getByLabelText('theme.mp3').tagName).toBe('AUDIO');

    await user.click(screen.getByRole('button', { name: 'intro.mp4' }));
    expect(within(panel).getByLabelText('intro.mp4').tagName).toBe('VIDEO');

    await user.click(screen.getByRole('button', { name: 'Details panel' }));
    expect(patches).toHaveBeenCalledWith({ details: false });
    expect(screen.queryByRole('complementary', { name: 'Details panel' })).not.toBeInTheDocument();

    await user.dblClick(screen.getByRole('button', { name: 'notes.txt' }));
    expect(patches).toHaveBeenLastCalledWith({ selectedId: 'asset-3', details: true });
    expect(screen.getByRole('complementary', { name: 'Details panel' })).toBeInTheDocument();
  });

  it('multi-selects with Ctrl and Shift', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ details: false }} />);
    const hero = await screen.findByRole('button', { name: 'hero.png' });
    const notes = screen.getByRole('button', { name: 'notes.txt' });
    const theme = screen.getByRole('button', { name: 'theme.mp3' });

    await user.click(hero);
    await user.keyboard('{Control>}');
    await user.click(theme);
    await user.keyboard('{/Control}');
    expect(hero).toHaveAttribute('aria-pressed', 'true');
    expect(theme).toHaveAttribute('aria-pressed', 'true');
    expect(notes).toHaveAttribute('aria-pressed', 'false');

    await user.keyboard('{Control>}');
    await user.click(theme);
    await user.keyboard('{/Control}');
    expect(theme).toHaveAttribute('aria-pressed', 'false');
    expect(patches).toHaveBeenLastCalledWith({ selectedId: 'asset-1' });

    await user.keyboard('{Shift>}');
    await user.click(theme);
    await user.keyboard('{/Shift}');
    expect(hero).toHaveAttribute('aria-pressed', 'true');
    expect(notes).toHaveAttribute('aria-pressed', 'true');
    expect(theme).toHaveAttribute('aria-pressed', 'true');

    fireEvent.contextMenu(notes);
    await user.click(await screen.findByRole('menuitem', { name: 'Delete 3 files' }));
    expect(await screen.findByText('Delete 3 files? This cannot be undone.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(api.deleteAssets).toHaveBeenCalledWith(['asset-1', 'asset-3', 'asset-2']);
    expect(await screen.findByText('No files here')).toBeInTheDocument();

    notes.focus();
    await user.keyboard('{Enter}');
  });
});

describe('AssetsEditor card menu and options', () => {
  it('renames, moves, exports and deletes a file from its context menu', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ details: false }} />);
    const card = await screen.findByRole('button', { name: 'theme.mp3' });

    fireEvent.contextMenu(card);
    await user.click(await screen.findByRole('menuitem', { name: 'Rename file' }));
    const input = await screen.findByLabelText(/File name/);
    expect(input).toHaveValue('theme.mp3');
    await user.clear(input);
    await user.type(input, 'menu.mp3');
    await user.click(screen.getByRole('button', { name: 'Rename' }));
    expect(api.updateAsset).toHaveBeenCalledWith('asset-2', { name: 'menu.mp3' });

    const renamed = await screen.findByRole('button', { name: 'menu.mp3' });
    fireEvent.contextMenu(renamed);
    fireEvent.keyDown(await screen.findByRole('menuitem', { name: 'Move to…' }), { key: 'ArrowRight' });
    expect(await screen.findByRole('menuitem', { name: 'Audio' })).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Top level' }));
    expect(api.moveAssets).toHaveBeenCalledWith(['asset-2'], null);
    await menuClosed();

    fireEvent.contextMenu(renamed);
    await user.click(await screen.findByRole('menuitem', { name: 'Export…' }));
    expect(api.exportAsset).toHaveBeenCalledWith('asset-2');
    await menuClosed();

    fireEvent.contextMenu(renamed);
    await user.click(await screen.findByRole('menuitem', { name: 'Delete file' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(api.deleteAssets).toHaveBeenCalledWith(['asset-2']);
    expect(screen.queryByRole('button', { name: 'menu.mp3' })).not.toBeInTheDocument();
  });

  it('keeps the focused card selectable with Enter', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ details: false }} />);
    const card = await screen.findByRole('button', { name: 'hero.png' });
    card.focus();
    await user.keyboard('{Enter}');
    expect(card).toHaveAttribute('aria-pressed', 'true');
    expect(patches).toHaveBeenCalledWith({ selectedId: 'asset-1' });
  });

  it('changes where dropped files go and the folder per kind', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await screen.findByRole('tree', { name: 'Folders' });
    await user.click(screen.getByRole('button', { name: 'Asset options' }));
    const dialog = await screen.findByRole('dialog', { name: 'Asset options' });

    const images = within(dialog).getByRole('combobox', { name: 'Folder for Images' });
    expect(images).toHaveTextContent('Images');
    await user.click(images);
    await user.click(await screen.findByRole('option', { name: 'Audio' }));
    expect(api.setAssetSettings).toHaveBeenCalledWith({ kindFolders: { image: 'folder-audio' } });
    expect(within(dialog).getByRole('combobox', { name: 'Folder for Images' })).toHaveTextContent('Audio');

    await user.click(within(dialog).getByRole('combobox', { name: 'Folder for Audio' }));
    await user.click(await screen.findByRole('option', { name: 'Top level' }));
    expect(api.setAssetSettings).toHaveBeenCalledWith({ kindFolders: { audio: null } });
    expect(within(dialog).getByRole('combobox', { name: 'Folder for Other' })).toHaveTextContent('Top level');

    await user.click(within(dialog).getByRole('combobox', { name: 'Where dropped files go' }));
    await user.click(await screen.findByRole('option', { name: 'Top level' }));
    expect(api.setAssetSettings).toHaveBeenCalledWith({ dropTarget: 'root' });
    expect(within(dialog).queryByRole('combobox', { name: 'Folder for Images' })).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole('combobox', { name: 'Where dropped files go' }));
    await user.click(await screen.findByRole('option', { name: 'Documents' }));
    expect(api.setAssetSettings).toHaveBeenCalledWith({ dropTarget: 'folder-documents' });

    await user.click(within(dialog).getByRole('combobox', { name: 'Where dropped files go' }));
    await user.click(await screen.findByRole('option', { name: 'Folder matching the file type' }));
    expect(api.setAssetSettings).toHaveBeenCalledWith({ dropTarget: 'byKind' });
    expect(within(dialog).getByRole('combobox', { name: 'Folder for Images' })).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('AssetsEditor drag and drop between folders', () => {
  it('moves a card onto a folder row with the keyboard', async () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      if (this.getAttribute('role') === 'treeitem') {
        const rows = Array.from(document.querySelectorAll('[role="treeitem"]'));
        return rect(0, rows.indexOf(this) * 30, 200, 28);
      }
      if (this.getAttribute('aria-roledescription') === 'draggable') return rect(210, 60, 100, 28);
      if (this.closest('[style*="position: fixed"]')) return rect(210, 60, 100, 28);
      return rect(0, 0, 0, 0);
    });
    render(<Harness initial={{ details: false }} />);
    const card = await screen.findByRole('button', { name: 'notes.txt' });
    card.focus();

    await press(card, 'Space');
    expect(screen.getAllByText('notes.txt')).toHaveLength(2);
    await press(document, 'Escape');
    expect(screen.getAllByText('notes.txt')).toHaveLength(1);
    expect(api.moveAssets).not.toHaveBeenCalled();

    await press(card, 'Space');
    await press(document, 'ArrowLeft');
    await press(document, 'Space');
    expect(api.moveAssets).toHaveBeenCalledWith(['asset-3'], 'folder-audio');
    expect(screen.getByRole('treeitem', { name: /Audio/ })).toHaveTextContent('Audio2');
  });
});
