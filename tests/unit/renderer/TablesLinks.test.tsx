import { useState } from 'react';
import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useResolvedLink } from '@renderer/components/AssetLinkCard/AssetLinkCard';
import { AssetsEditor } from '@renderer/components/editors/Assets/AssetsEditor';
import { TablePreview } from '@renderer/components/editors/Tables/TablePreview';
import { AreaContext } from '@renderer/components/Shell/AreaContext';
import { createTable } from '@renderer/lib/tables';
import { linkTarget } from '@renderer/lib/workspaces';
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
  tables: 'Data tables',
};

function AssetsHarness({ initial = {} }: { initial?: Record<string, unknown> }) {
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
              setState((current) => ({ ...current, ...patch }));
            }}
          />
        </AreaContext>
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

async function items() {
  return act(() =>
    createTable({
      name: 'Items',
      columns: [
        { id: 'damage', label: 'Damage', kind: 'number' },
        { id: 'double', label: 'Double', kind: 'formula', expression: 'damage * 2' },
      ],
      rows: [
        { key: 'sword', cells: { damage: 4 } },
        { key: 'bow', cells: { damage: 3 } },
      ],
    }),
  );
}

describe('table links', () => {
  it('opens a table link in the Tables workspace', () => {
    expect(linkTarget({ kind: 'table', id: 't1' }, NAMES)).toEqual({
      editor: 'table',
      state: { tableId: 't1' },
      template: 'tables',
      workspaceName: 'Data tables',
    });
  });

  it('resolves a table link to its name and row count, or to a missing asset', async () => {
    const { table } = await items();
    const found = renderHook(() => useResolvedLink({ kind: 'table', id: table.id }));
    expect(found.result.current).toMatchObject({ name: 'Items', detail: '2 rows', missing: false });
    const gone = renderHook(() => useResolvedLink({ kind: 'table', id: 'gone' }));
    expect(gone.result.current).toMatchObject({ name: 'Missing asset', missing: true });
  });

  it('previews a table with computed values and a row count past the limit', async () => {
    const { table } = await items();
    render(<TablePreview tableId={table.id} limit={1} />);

    const preview = await screen.findByRole('table');
    expect(
      within(preview)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['id', 'Damage', 'Double']);
    expect(within(preview).getAllByRole('row')).toHaveLength(2);
    expect(within(preview).getByRole('rowheader').textContent).toBe('sword');
    expect(
      within(preview)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['4', '8']);
    expect(screen.getByText('2 rows')).toBeTruthy();
  });
});

describe('tables in the Assets editor', () => {
  it('lists tables in their own tree and from the file type list', async () => {
    await items();
    const user = userEvent.setup();
    const { unmount } = render(<AssetsHarness />);
    const tree = await screen.findByRole('tree', { name: 'Data tables' });
    await user.click(within(tree).getByRole('treeitem', { name: /Data tables/ }));
    expect(screen.getByRole('button', { name: 'Items' })).toHaveAttribute('data-internal', 'table');
    unmount();

    render(<AssetsHarness initial={{ view: 'types', kind: 'table' }} />);
    expect(await screen.findByRole('button', { name: 'Items' })).toHaveAttribute('data-internal', 'table');
  });

  it('creates a data table from the new menu', async () => {
    const user = userEvent.setup();
    render(<AssetsHarness />);

    await user.click(await screen.findByRole('button', { name: 'New' }));
    await user.click(await screen.findByRole('menuitem', { name: 'New data table' }));
    await user.click(await screen.findByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(api.tablesData.tables.map((table) => table.name)).toEqual(['Untitled table']);
    });
  });
});
