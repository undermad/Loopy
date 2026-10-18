import { useState } from 'react';
import { render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssetsEditor } from '@renderer/components/editors/Assets/AssetsEditor';
import { AreaContext } from '@renderer/components/Shell/AreaContext';
import { createBoard } from '@renderer/lib/board';
import { createPalette } from '@renderer/lib/palettes';
import { useActiveWorkspaceId, useWorkspaces } from '@renderer/lib/workspaces';
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

beforeEach(async () => {
  patches.mockReset();
  api = await bootTestApp();
  const project = makeProject('Space Game');
  api.current = project;
  api.emitProject();
  await createBoard({ name: 'Level map' });
  await createPalette({
    name: 'Dusk',
    harmony: 'custom',
    baseIndex: 0,
    source: 'wheel',
    colours: [
      { name: '', hex: '#ff8800' },
      { name: '', hex: '#220044' },
    ],
  });
});

describe('internal assets', () => {
  it('lists boards and palettes in their own fixed folders and files them into subfolders', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByText('External')).toBeInTheDocument();
    expect(screen.getByText('Internal')).toBeInTheDocument();

    const boards = screen.getByRole('tree', { name: 'Boards' });
    await user.click(within(boards).getByRole('treeitem', { name: /Boards/ }));
    expect(patches).toHaveBeenLastCalledWith({ scope: 'boards', folderId: '' });
    const card = screen.getByRole('button', { name: 'Level map' });
    expect(card).toHaveAttribute('data-internal', 'board');

    await user.pointer({
      keys: '[MouseRight]',
      target: within(boards).getByRole('treeitem', { name: /Boards/ }),
    });
    expect(screen.queryByRole('menuitem', { name: 'Delete folder' })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('menuitem', { name: 'New folder' }));
    await user.type(await screen.findByLabelText(/Folder name/), 'Act 1');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Create' }));
    expect(api.createAssetFolder).toHaveBeenCalledWith({ name: 'Act 1', parentId: null, scope: 'boards' });
    await waitFor(() => {
      expect(within(boards).getByRole('treeitem', { name: /Act 1/ })).toBeInTheDocument();
    });
    expect(screen.getByRole('tree', { name: 'Folders' })).not.toHaveTextContent('Act 1');

    await user.click(card);
    const panel = screen.getByRole('complementary', { name: 'Details panel' });
    expect(within(panel).getByRole('textbox', { name: 'Name' })).toHaveValue('Level map');
    await user.click(within(panel).getByRole('combobox', { name: 'Folder' }));
    expect(screen.queryByRole('option', { name: 'Images' })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('option', { name: 'Act 1' }));
    expect(api.updateBoard).toHaveBeenLastCalledWith('board-1', { folderId: 'folder-1' });

    const name = within(panel).getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'World map{Enter}');
    expect(api.updateBoard).toHaveBeenLastCalledWith('board-1', { name: 'World map' });

    const active = renderHook(() => useActiveWorkspaceId());
    await user.click(within(panel).getByRole('button', { name: 'Open' }));
    active.rerender();
    const design = renderHook(() => useWorkspaces()).result.current.find((item) => item.name === 'Design');
    expect(active.result.current).toBe(design?.id);
  });

  it('finds internal assets from search and from the file type list', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByRole('searchbox', { name: 'Search assets' }), 'dus');
    const found = screen.getByRole('group', { name: 'Internal' });
    const palette = within(found).getByRole('button', { name: 'Dusk' });
    expect(palette).toHaveAttribute('data-internal', 'palette');
    expect(palette.querySelectorAll('span[style]')).toHaveLength(2);
    await user.click(palette);
    expect(patches).toHaveBeenLastCalledWith({ internalId: 'palette:palette-1' });
    expect(
      within(screen.getByRole('complementary', { name: 'Details panel' })).getByText('Colour palette'),
    ).toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox', { name: 'Search assets' }));
    await user.click(screen.getByRole('radio', { name: 'File types' }));
    const kinds = screen.getByRole('listbox', { name: 'File types' });
    await user.click(within(kinds).getByRole('option', { name: /Boards/ }));
    expect(screen.getByRole('button', { name: 'Level map' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dusk' })).not.toBeInTheDocument();
  });
});
