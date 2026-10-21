import { useState, type ComponentType } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LayoutNode } from '@shared/layout';
import { buildWorkspace, builtInLayoutPresets } from '@shared/layout-presets';
import { TableEditor } from '@renderer/components/editors/Tables/TableEditor';
import { TableLibrary } from '@renderer/components/editors/Tables/TableLibrary';
import type { EditorProps } from '@renderer/lib/editors';
import { createTable } from '@renderer/lib/tables';
import { useActiveWorkspace } from '@renderer/lib/workspaces';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

let api: FakeApi;

function editorsOf(node: LayoutNode): string[] {
  return node.kind === 'area' ? [node.editor] : node.children.flatMap(editorsOf);
}

function areasOf(node: LayoutNode): { editor: string; state: Record<string, unknown> }[] {
  return node.kind === 'area' ? [node] : node.children.flatMap(areasOf);
}

function Stateful({
  editor: Editor,
  initial = {},
}: {
  editor: ComponentType<EditorProps>;
  initial?: Record<string, unknown>;
}) {
  const [state, setState] = useState(initial);
  return (
    <TooltipProvider>
      <ToastProvider closeLabel="Dismiss" regionLabel="Notifications">
        <Editor
          areaId="tables"
          state={state}
          setState={(patch) => {
            setState((current) => ({ ...current, ...patch }));
          }}
        />
      </ToastProvider>
    </TooltipProvider>
  );
}

function ActiveTable() {
  const workspace = useActiveWorkspace();
  const area = workspace ? areasOf(workspace.root).find((item) => item.editor === 'table') : undefined;
  const tableId = area?.state['tableId'];
  return <output aria-label="open table">{typeof tableId === 'string' ? tableId : ''}</output>;
}

beforeEach(async () => {
  api = await bootTestApp();
  api.current = makeProject('Space Game');
  api.emitProject();
  await act(async () => {
    await Promise.resolve();
  });
});

async function weapons() {
  return act(() =>
    createTable({
      name: 'Weapons',
      columns: [
        { id: 'name', label: 'Name', kind: 'text', required: true },
        { id: 'damage', label: 'Damage', kind: 'number' },
        { id: 'rare', label: 'Rare', kind: 'checkbox' },
        { id: 'dps', label: 'DPS', kind: 'formula', expression: 'damage * 2' },
      ],
      rows: [
        { key: 'sword', cells: { name: 'Sword', damage: 4 } },
        { key: 'bow', cells: { name: 'Bow', damage: 3 } },
      ],
    }),
  );
}

function cell(row: number, column: number): HTMLElement {
  const grid = screen.getByRole('grid');
  const found = grid.querySelector<HTMLElement>(
    `[data-row="${String(row)}"][data-column="${String(column)}"]`,
  );
  if (!found) throw new Error(`cell ${String(row)},${String(column)} not rendered`);
  return found;
}

describe('tables workspace', () => {
  it('pairs the table library with the table editor and ships as a preset', () => {
    expect(editorsOf(buildWorkspace('tables', 'Data tables').root)).toEqual(['tableLibrary', 'table']);
    const names = {
      default: 'Default',
      planning: 'Planning',
      design: 'Design',
      palette: 'Palette',
      assets: 'Assets',
      ideas: 'Idea Map',
      cards: 'Cards',
      tables: 'Data tables',
    };
    const presets = builtInLayoutPresets(names);
    expect(presets.find((preset) => preset.id === 'default')?.workspaces.map((item) => item.name)).toContain(
      'Data tables',
    );
    expect(presets.find((preset) => preset.id === 'tables')?.workspaces).toHaveLength(1);
  });
});

describe('table library', () => {
  it('lists tables with row counts, filters them and opens one in the editor', async () => {
    await weapons();
    await act(() => createTable({ name: 'Enemies' }));
    const user = userEvent.setup();
    render(
      <>
        <Stateful editor={TableLibrary} />
        <ActiveTable />
      </>,
    );

    const list = screen.getByRole('list', { name: 'Data tables' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((item) => item.querySelector('button')?.textContent),
    ).toEqual(['Enemies0 rows', 'Weapons2 rows']);
    await user.type(screen.getByRole('searchbox', { name: 'Search tables' }), 'wea');
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);

    await user.click(within(list).getByRole('button', { name: /^Weapons/ }));
    expect(screen.getByLabelText('open table').textContent).toBe(api.tablesData.tables[0]?.id);
  });

  it('creates a table with a unique name and opens it', async () => {
    await act(() => createTable({ name: 'Untitled table' }));
    const user = userEvent.setup();
    render(
      <>
        <Stateful editor={TableLibrary} />
        <ActiveTable />
      </>,
    );

    await user.click(screen.getByRole('button', { name: 'New table' }));

    await waitFor(() => {
      expect(api.tablesData.tables.map((table) => table.name)).toEqual([
        'Untitled table',
        'Untitled table 2',
      ]);
    });
    expect(api.tablesData.tables[1]?.columns.map((column) => column.id)).toEqual(['name']);
    expect(screen.getByLabelText('open table').textContent).toBe(api.tablesData.tables[1]?.id);
  });

  it('imports a table file into the library and opens it', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Stateful editor={TableLibrary} />
        <ActiveTable />
      </>,
    );
    vi.mocked(api.importTable).mockImplementationOnce(async () => {
      const snapshot = await api.createTable({ name: 'Bats', rows: [{ key: 'bat' }] });
      return { status: 'imported', snapshot };
    });

    await user.click(screen.getByRole('button', { name: 'Import' }));

    await waitFor(() => {
      expect(screen.getByLabelText('open table').textContent).toBe(api.tablesData.tables[0]?.id);
    });
    expect(api.importTable).toHaveBeenLastCalledWith(null);
    expect(within(screen.getByRole('list', { name: 'Data tables' })).getByText('Bats')).toBeTruthy();

    vi.mocked(api.importTable).mockResolvedValueOnce({ status: 'invalid', name: 'broken.json' });
    await user.click(screen.getByRole('button', { name: 'Import' }));
    expect(await screen.findByText('Could not read broken.json as a table')).toBeTruthy();
  });

  it('duplicates and deletes a table from its menu', async () => {
    await weapons();
    const user = userEvent.setup();
    render(<Stateful editor={TableLibrary} />);

    await user.click(screen.getByRole('button', { name: 'More for Weapons' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Duplicate' }));
    await waitFor(() => {
      expect(api.tablesData.tables.map((table) => table.name)).toEqual(['Weapons', 'Weapons copy']);
    });

    await user.click(screen.getByRole('button', { name: 'More for Weapons copy' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: 'Delete table' }));
    await waitFor(() => {
      expect(api.tablesData.tables.map((table) => table.name)).toEqual(['Weapons']);
    });
  });
});

describe('table editor', () => {
  it('asks for a table when none is open and says when one is gone', async () => {
    const { unmount } = render(<Stateful editor={TableEditor} />);
    expect(screen.getByText('No table open')).toBeTruthy();
    unmount();
    render(<Stateful editor={TableEditor} initial={{ tableId: 'gone' }} />);
    expect(await screen.findByText('This table no longer exists')).toBeTruthy();
  });

  it('shows the key, typed values and computed formulas', async () => {
    const { table } = await weapons();
    render(<Stateful editor={TableEditor} initial={{ tableId: table.id }} />);

    await screen.findByRole('grid', { name: 'Weapons' });
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'id',
      'Name',
      'Damage',
      'Rare',
      'DPS',
    ]);
    expect(cell(0, 0).textContent).toBe('sword');
    expect(cell(0, 2).textContent).toBe('4');
    expect(cell(1, 4).textContent).toBe('6');
    expect(within(cell(0, 3)).getByRole('checkbox')).toHaveProperty('checked', false);
  });

  it('edits a cell by typing, commits with Enter and undoes with Ctrl+Z', async () => {
    const { table } = await weapons();
    const user = userEvent.setup();
    render(<Stateful editor={TableEditor} initial={{ tableId: table.id }} />);
    await screen.findByRole('grid');

    await user.click(cell(0, 2));
    await user.keyboard('9{Enter}');
    await waitFor(() => {
      expect(cell(0, 2).textContent).toBe('9');
    });
    expect(cell(0, 4).textContent).toBe('18');

    await user.keyboard('{Control>}z{/Control}');
    await waitFor(() => {
      expect(cell(0, 2).textContent).toBe('4');
    });
    await user.keyboard('{Control>}y{/Control}');
    await waitFor(() => {
      expect(cell(0, 2).textContent).toBe('9');
    });
  });

  it('refuses a value the column cannot hold and a duplicate key', async () => {
    const { table } = await weapons();
    const user = userEvent.setup();
    render(<Stateful editor={TableEditor} initial={{ tableId: table.id }} />);
    await screen.findByRole('grid');

    await user.dblClick(cell(0, 2));
    await user.keyboard('lots{Enter}');
    expect(await screen.findByText('Damage needs a number')).toBeTruthy();

    await user.click(cell(1, 0));
    await user.keyboard('{F2}');
    const input = screen.getByRole('textbox', { name: 'Edit cell' });
    await user.clear(input);
    await user.keyboard('sword{Enter}');
    expect(await screen.findByText('Duplicate key sword')).toBeTruthy();
    expect(cell(1, 0).textContent).toBe('bow');
  });

  it('toggles a checkbox, clears cells with Delete and fills down with Ctrl+D', async () => {
    const { table } = await weapons();
    const user = userEvent.setup();
    render(<Stateful editor={TableEditor} initial={{ tableId: table.id }} />);
    await screen.findByRole('grid');

    await user.click(within(cell(1, 3)).getByRole('checkbox'));
    await waitFor(() => {
      expect(api.tablesData.rows.get(table.id)?.[1]?.cells['rare']).toBe(true);
    });

    await user.click(cell(0, 1));
    await user.keyboard('{Shift>}{ArrowDown}{/Shift}{Control>}d{/Control}');
    await waitFor(() => {
      expect(cell(1, 1).textContent).toBe('Sword');
    });

    await user.click(cell(1, 2));
    await user.keyboard('{Delete}');
    await waitFor(() => {
      expect(cell(1, 2).textContent).toBe('');
    });
  });

  it('copies and pastes tab separated text, adding rows past the end', async () => {
    const { table } = await weapons();
    const user = userEvent.setup();
    render(<Stateful editor={TableEditor} initial={{ tableId: table.id }} />);
    const grid = await screen.findByRole('grid');

    await user.click(cell(0, 0));
    await user.keyboard('{Shift>}{ArrowRight}{ArrowRight}{/Shift}');
    const copied = { value: '' };
    fireEvent.copy(grid, {
      clipboardData: { setData: (_type: string, text: string) => (copied.value = text) },
    });
    expect(copied.value).toBe('sword\tSword\t4');

    await user.click(cell(1, 1));
    fireEvent.paste(grid, { clipboardData: { getData: () => 'Longbow\t5\nAxe\t7' } });
    await waitFor(() => {
      expect(screen.getAllByRole('row')).toHaveLength(4);
    });
    expect(cell(1, 1).textContent).toBe('Longbow');
    expect(cell(2, 0).textContent).toBe('row_1');
    expect(cell(2, 2).textContent).toBe('7');
  });

  it('adds rows and columns and edits a column in its settings', async () => {
    const { table } = await weapons();
    const user = userEvent.setup();
    render(<Stateful editor={TableEditor} initial={{ tableId: table.id }} />);
    await screen.findByRole('grid');

    await user.click(screen.getByRole('button', { name: 'Add row' }));
    await waitFor(() => {
      expect(screen.getAllByRole('row')).toHaveLength(4);
    });
    expect(cell(2, 0).textContent).toBe('row_1');

    await user.click(screen.getByRole('button', { name: 'Add column' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Choice' }));
    await waitFor(() => {
      expect(api.tablesData.tables[0]?.columns.at(-1)).toMatchObject({ id: 'choice', kind: 'choice' });
    });

    const settings = await screen.findByRole('complementary', { name: 'Column settings' });
    const label = within(settings).getByRole('textbox', { name: 'Label' });
    await user.clear(label);
    await user.type(label, 'Rarity{Enter}');
    await user.type(within(settings).getByRole('textbox', { name: 'Options' }), 'Common{Enter}Rare');
    fireEvent.blur(within(settings).getByRole('textbox', { name: 'Options' }));
    await waitFor(() => {
      expect(api.tablesData.tables[0]?.columns.at(-1)).toMatchObject({
        label: 'Rarity',
        options: [{ value: 'Common' }, { value: 'Rare' }],
      });
    });

    await user.click(within(settings).getByRole('button', { name: 'Delete column' }));
    await waitFor(() => {
      expect(api.tablesData.tables[0]?.columns.map((column) => column.id)).not.toContain('choice');
    });
  });

  it('sorts by a column, searches rows and renames the table', async () => {
    const { table } = await weapons();
    const user = userEvent.setup();
    render(<Stateful editor={TableEditor} initial={{ tableId: table.id }} />);
    await screen.findByRole('grid');

    await user.click(screen.getByRole('button', { name: 'Sort by Damage' }));
    expect(cell(0, 0).textContent).toBe('bow');
    await user.click(screen.getByRole('button', { name: 'Sort by Damage' }));
    expect(cell(0, 0).textContent).toBe('sword');

    await user.type(screen.getByRole('searchbox', { name: 'Search rows' }), 'bow');
    expect(screen.getAllByRole('row')).toHaveLength(2);

    const name = screen.getByRole('textbox', { name: 'Table name' });
    await user.clear(name);
    await user.type(name, 'Arms{Enter}');
    await waitFor(() => {
      expect(api.tablesData.tables[0]?.name).toBe('Arms');
    });
  });

  it('counts problems and marks the cells that have them', async () => {
    const { table } = await weapons();
    const user = userEvent.setup();
    render(<Stateful editor={TableEditor} initial={{ tableId: table.id }} />);
    await screen.findByRole('grid');

    await user.click(cell(0, 1));
    await user.keyboard('{Delete}');

    expect(await screen.findByText('1 problem')).toBeTruthy();
    expect(cell(0, 1).getAttribute('aria-invalid')).toBe('true');
  });

  it('exports the table in a chosen format', async () => {
    const { table } = await weapons();
    const user = userEvent.setup();
    render(<Stateful editor={TableEditor} initial={{ tableId: table.id }} />);
    await screen.findByRole('grid');

    await user.click(screen.getByRole('button', { name: 'Export' }));
    await user.click(await screen.findByRole('menuitem', { name: 'JSON keyed by id' }));

    expect(api.exportTable).toHaveBeenLastCalledWith(table.id, 'jsonKeyed');
    expect(await screen.findByText('Weapons exported')).toBeTruthy();
  });

  it('renders only the rows in view for a long table', async () => {
    const rows = Array.from({ length: 2000 }, (_, index) => ({ key: `r${String(index)}`, cells: {} }));
    const { table } = await act(() => createTable({ name: 'Big', rows }));
    render(<Stateful editor={TableEditor} initial={{ tableId: table.id }} />);
    await screen.findByRole('grid');

    expect(screen.getAllByRole('row').length).toBeLessThan(80);
    expect(screen.getByRole('grid').getAttribute('aria-rowcount')).toBe('2001');
  });
});
