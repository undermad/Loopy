import { useState, type ComponentType } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TableEditor } from '@renderer/components/editors/Tables/TableEditor';
import { importFiles, reportAssetDrag } from '@renderer/lib/assets';
import { runEditCommand } from '@renderer/lib/commands';
import type { TableColumnKind } from '@shared/tables';
import type { EditorProps } from '@renderer/lib/editors';
import { createTable } from '@renderer/lib/tables';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

let api: FakeApi;

function Stateful({
  editor: Editor,
  initial,
}: {
  editor: ComponentType<EditorProps>;
  initial: Record<string, unknown>;
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

beforeEach(async () => {
  api = await bootTestApp();
  api.current = makeProject('Space Game');
  api.emitProject();
  await act(async () => {
    await Promise.resolve();
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function cell(row: number, column: number): HTMLElement {
  const found = screen
    .getByRole('grid')
    .querySelector<HTMLElement>(`[data-row="${String(row)}"][data-column="${String(column)}"]`);
  if (!found) throw new Error(`cell ${String(row)},${String(column)} not rendered`);
  return found;
}

async function open(tableId: string, extra: Record<string, unknown> = {}) {
  render(<Stateful editor={TableEditor} initial={{ tableId, ...extra }} />);
  return screen.findByRole('grid');
}

function lastColumns(): Record<string, unknown>[] {
  return api.tablesData.tables.at(-1)?.columns ?? [];
}

describe('cell views', () => {
  it('shows every kind of value', async () => {
    const [imageId] = (
      await act(() => importFiles([new File(['x'], 'hero.png', { type: 'image/png' })], null))
    ).ids;
    const owners = await act(() =>
      createTable({ name: 'Owners', rows: [{ key: 'knight' }, { key: 'mage' }] }),
    );
    const [knight, mage] = owners.rows;
    const { table } = await act(() =>
      createTable({
        name: 'Kinds',
        columns: [
          {
            id: 'tags',
            label: 'Tags',
            kind: 'choice',
            multiple: true,
            options: [{ value: 'fire', colour: { hex: '#ff0000' } }, 'ice'],
          },
          { id: 'tint', label: 'Tint', kind: 'colour' },
          { id: 'icon', label: 'Icon', kind: 'image' },
          { id: 'lost', label: 'Lost', kind: 'image' },
          { id: 'see', label: 'See', kind: 'link', multiple: true },
          { id: 'owner', label: 'Owner', kind: 'reference', tableId: owners.table.id },
          { id: 'party', label: 'Party', kind: 'reference', tableId: owners.table.id, multiple: true },
          { id: 'bad', label: 'Bad', kind: 'formula', expression: 'nope + 1' },
          { id: 'roll', label: 'Roll', kind: 'dice' },
        ],
        rows: [
          {
            key: 'a',
            cells: {
              tags: ['fire', 'ice'],
              tint: '#00ff00',
              icon: imageId ?? '',
              lost: 'gone',
              see: [
                { kind: 'table', id: owners.table.id },
                { kind: 'board', id: 'gone' },
              ],
              owner: knight?.id ?? '',
              party: [mage?.id ?? '', 'gone'],
              roll: '2d6',
            },
          },
          { key: 'b', cells: { owner: 'gone' } },
        ],
      }),
    );
    await open(table.id);

    await waitFor(() => {
      expect(cell(0, 6).textContent).toBe('knight');
    });
    expect(within(cell(0, 1)).getByText('fire')).toBeTruthy();
    expect(within(cell(0, 1)).getByText('ice')).toBeTruthy();
    expect(cell(0, 2).textContent).toBe('#00ff00');
    expect(cell(0, 3).textContent).toBe('hero.png');
    expect(cell(0, 4).textContent).toBe('Missing asset');
    expect(cell(0, 5).textContent).toBe('OwnersMissing asset');
    expect(cell(0, 7).textContent).toBe('mage, ?');
    expect(cell(0, 8).textContent).toBe('#unknown');
    expect(cell(0, 9).textContent).toBe('2d6');
    expect(cell(1, 6).textContent).toBe('?');
    expect(screen.getByText('4 problems')).toBeTruthy();
  });
});

describe('keyboard and commands', () => {
  async function items() {
    return act(() =>
      createTable({
        name: 'Items',
        columns: [
          { id: 'name', label: 'Name', kind: 'text' },
          { id: 'rare', label: 'Rare', kind: 'checkbox' },
          { id: 'kind', label: 'Kind', kind: 'choice', options: ['blade', 'bow'] },
        ],
        rows: [
          { key: 'sword', cells: { name: 'Sword', kind: 'blade' } },
          { key: 'bow', cells: { name: 'Bow' } },
          { key: 'axe', cells: { name: 'Axe' } },
        ],
      }),
    );
  }

  it('moves with arrows, Home, End, Page keys, Tab and Escape', async () => {
    const { table } = await items();
    const user = userEvent.setup();
    await open(table.id);
    const focused = () => screen.getByRole('grid').querySelector('[aria-selected="true"]');

    await user.click(cell(0, 0));
    await user.keyboard('{End}');
    expect(cell(0, 3).getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{Home}{ArrowRight}{ArrowDown}');
    expect(cell(1, 1).getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{ArrowLeft}{ArrowUp}{PageDown}');
    expect(cell(2, 0).getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{PageUp}{Tab}{Tab}');
    expect(cell(0, 2).getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(cell(0, 1).getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{Shift>}{ArrowDown}{/Shift}{Escape}');
    expect(screen.getByRole('grid').querySelectorAll('[aria-selected="true"]')).toHaveLength(1);
    expect(focused()).toBe(cell(1, 1));
  });

  it('toggles a checkbox with Space, selects all and runs Edit menu commands', async () => {
    const { table } = await items();
    const user = userEvent.setup();
    await open(table.id);
    const writeText = vi.fn(() => Promise.resolve());
    const readText = vi.fn(() => Promise.resolve('Spear'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText, readText }, configurable: true });

    await user.click(cell(0, 2));
    await user.keyboard(' ');
    await waitFor(() => {
      expect(api.tablesData.rows.get(table.id)?.[0]?.cells['rare']).toBe(true);
    });

    await user.keyboard('{Control>}a{/Control}');
    expect(screen.getByRole('grid').querySelectorAll('[aria-selected="true"]')).toHaveLength(12);

    await user.click(cell(1, 1));
    act(() => {
      runEditCommand('copy');
    });
    expect(writeText).toHaveBeenLastCalledWith('Bow');
    await act(async () => {
      runEditCommand('paste');
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(cell(1, 1).textContent).toBe('Spear');
    });
    act(() => {
      runEditCommand('cut');
    });
    await waitFor(() => {
      expect(cell(1, 1).textContent).toBe('');
    });
    act(() => {
      runEditCommand('undo');
    });
    await waitFor(() => {
      expect(cell(1, 1).textContent).toBe('Spear');
    });
    act(() => {
      runEditCommand('redo');
    });
    await waitFor(() => {
      expect(cell(1, 1).textContent).toBe('');
    });
    await user.click(cell(2, 1));
    act(() => {
      runEditCommand('delete');
    });
    await waitFor(() => {
      expect(cell(2, 1).textContent).toBe('');
    });
    act(() => {
      runEditCommand('selectAll');
    });
    expect(screen.getByRole('grid').querySelectorAll('[aria-selected="true"]')).toHaveLength(12);
  });

  it('cuts with the clipboard event, cancels an edit with Escape and refuses an empty key', async () => {
    const { table } = await items();
    const user = userEvent.setup();
    const grid = await open(table.id);

    await user.click(cell(0, 1));
    const copied = { value: '' };
    fireEvent.cut(grid, {
      clipboardData: { setData: (_type: string, text: string) => (copied.value = text) },
    });
    expect(copied.value).toBe('Sword');
    await waitFor(() => {
      expect(cell(0, 1).textContent).toBe('');
    });

    await user.dblClick(cell(1, 1));
    await user.keyboard('Long{Escape}');
    expect(cell(1, 1).textContent).toBe('Bow');

    await user.click(cell(1, 0));
    await user.keyboard('{Enter}');
    await user.clear(screen.getByRole('textbox', { name: 'Edit cell' }));
    await user.keyboard('{Tab}');
    expect(await screen.findByText('A row needs a key')).toBeTruthy();
    expect(cell(1, 0).textContent).toBe('bow');
  });

  it('offers choices while editing and reports skipped pasted values', async () => {
    const { table } = await items();
    const user = userEvent.setup();
    const grid = await open(table.id);

    await user.click(cell(1, 3));
    await user.keyboard('{F2}');
    expect(screen.getByRole('combobox', { name: 'Edit cell' }).getAttribute('list')).toBeTruthy();
    expect(
      [...document.querySelectorAll('datalist option')].map((option) => option.getAttribute('value')),
    ).toEqual(['blade', 'bow']);
    await user.keyboard('{Escape}');

    await user.click(cell(2, 0));
    fireEvent.paste(grid, { clipboardData: { getData: () => 'bow\tAxe 2\nmace\tMace' } });
    expect(await screen.findByText('1 pasted value did not fit and was skipped')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getAllByRole('row')).toHaveLength(5);
    });
    expect(cell(2, 0).textContent).toBe('axe');
    expect(cell(2, 1).textContent).toBe('Axe 2');
  });
});

describe('drops and headers', () => {
  it('drops images and links onto the cells that take them', async () => {
    const [imageId] = (
      await act(() => importFiles([new File(['x'], 'hero.png', { type: 'image/png' })], null))
    ).ids;
    const other = await act(() => createTable({ name: 'Other' }));
    const { table } = await act(() =>
      createTable({
        name: 'Drops',
        columns: [
          { id: 'icon', label: 'Icon', kind: 'image' },
          { id: 'see', label: 'See', kind: 'link', multiple: true, linkKinds: ['table'] },
          { id: 'one', label: 'One', kind: 'link' },
        ],
        rows: [{ key: 'a' }],
      }),
    );
    const grid = await open(table.id);
    const drop = (target: HTMLElement, ids: string[], links: { kind: 'table' | 'note'; id: string }[]) => {
      vi.spyOn(document, 'elementsFromPoint').mockReturnValue([target, grid]);
      act(() => {
        reportAssetDrag(ids, 5, 5, 'move', links);
      });
      act(() => {
        reportAssetDrag(ids, 5, 5, 'drop', links);
      });
    };

    drop(cell(0, 1), [imageId ?? ''], []);
    await waitFor(() => {
      expect(cell(0, 1).textContent).toBe('hero.png');
    });
    drop(cell(0, 2), [], [{ kind: 'note', id: 'n1' }]);
    drop(cell(0, 2), [], [{ kind: 'table', id: other.table.id }]);
    await waitFor(() => {
      expect(api.tablesData.rows.get(table.id)?.[0]?.cells['see']).toHaveLength(1);
    });
    await waitFor(() => {
      expect(cell(0, 2).textContent).toBe('Other');
    });
    drop(cell(0, 2), [], [{ kind: 'table', id: other.table.id }]);
    await waitFor(() => {
      expect(api.tablesData.rows.get(table.id)?.[0]?.cells['see']).toHaveLength(2);
    });
    drop(cell(0, 3), [], [{ kind: 'table', id: other.table.id }]);
    await waitFor(() => {
      expect(api.tablesData.rows.get(table.id)?.[0]?.cells['one']).toEqual({
        kind: 'table',
        id: other.table.id,
      });
    });
    drop(cell(0, 0), [imageId ?? ''], []);
    act(() => {
      reportAssetDrag([], 5, 5, 'cancel');
    });
  });

  it('resizes a column by dragging its header edge', async () => {
    const { table } = await act(() =>
      createTable({ name: 'Wide', columns: [{ id: 'name', label: 'Name', kind: 'text' }] }),
    );
    await open(table.id);
    const header = screen.getAllByRole('columnheader')[1];
    const handle = header?.querySelector<HTMLElement>('span[aria-hidden="true"]');
    if (!handle) throw new Error('no resize handle');

    fireEvent(handle, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 100 }));
    fireEvent(window, new MouseEvent('pointermove', { clientX: 160 }));
    fireEvent(window, new MouseEvent('pointerup', { clientX: 160 }));

    await waitFor(() => {
      expect(lastColumns()[0]?.['width']).toBe(200);
    });
  });

  it('undoes and redoes from the toolbar and reports a failed export', async () => {
    const { table } = await act(() =>
      createTable({ name: 'Tools', columns: [{ id: 'name', kind: 'text' }], rows: [{ key: 'a' }] }),
    );
    const user = userEvent.setup();
    await open(table.id);
    await user.click(screen.getByRole('button', { name: 'Add row' }));
    await waitFor(() => {
      expect(screen.getAllByRole('row')).toHaveLength(3);
    });
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => {
      expect(screen.getAllByRole('row')).toHaveLength(2);
    });
    await user.click(screen.getByRole('button', { name: 'Redo' }));
    await waitFor(() => {
      expect(screen.getAllByRole('row')).toHaveLength(3);
    });

    vi.mocked(api.exportTable).mockRejectedValueOnce(new Error('disk full'));
    await user.click(screen.getByRole('button', { name: 'Export' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Markdown table' }));
    expect(await screen.findByText('Could not export Tools')).toBeTruthy();

    vi.mocked(api.patchTableRows).mockRejectedValueOnce(new Error('locked'));
    await user.click(screen.getByRole('button', { name: 'Add row' }));
    expect(await screen.findByText('Could not save the change')).toBeTruthy();
  });
});

describe('column settings', () => {
  async function settingsFor(kind: TableColumnKind, extra: Record<string, unknown> = {}) {
    const other = await act(() => createTable({ name: 'Other' }));
    const { table } = await act(() =>
      createTable({
        name: 'Settings',
        columns: [
          { id: 'first', label: 'First', kind: 'text' },
          { id: 'subject', label: 'Subject', kind, ...extra },
        ],
      }),
    );
    await open(table.id, { column: 'subject' });
    return { table, other, panel: screen.getByRole('complementary', { name: 'Column settings' }) };
  }

  it('edits text settings, the description, the id and the rules', async () => {
    const user = userEvent.setup();
    const { panel } = await settingsFor('text');

    await user.click(within(panel).getByRole('switch', { name: 'Several lines' }));
    await user.type(within(panel).getByRole('spinbutton', { name: 'Maximum length' }), '12{Enter}');
    await user.type(within(panel).getByRole('textbox', { name: 'Description' }), 'Shown text{Enter}');
    await user.click(within(panel).getByRole('switch', { name: 'Required' }));
    await user.click(within(panel).getByRole('switch', { name: 'Unique' }));
    await waitFor(() => {
      expect(lastColumns()[1]).toMatchObject({
        multiline: true,
        maxLength: 12,
        description: 'Shown text',
        required: true,
        unique: true,
      });
    });

    const id = within(panel).getByRole('textbox', { name: 'Id' });
    await user.clear(id);
    await user.type(id, 'first{Enter}');
    await user.clear(id);
    await user.type(id, 'Bad Id{Escape}');
    expect(lastColumns()[1]?.['id']).toBe('subject');
    await user.clear(id);
    await user.type(id, 'topic{Enter}');
    await waitFor(() => {
      expect(lastColumns()[1]?.['id']).toBe('topic');
    });
  });

  it('edits number, reference, link and formula settings and changes the kind', async () => {
    const user = userEvent.setup();
    const { panel, other } = await settingsFor('number');
    await user.click(within(panel).getByRole('switch', { name: 'Whole numbers' }));
    await user.type(within(panel).getByRole('spinbutton', { name: 'Minimum' }), '1{Enter}');
    await user.type(within(panel).getByRole('spinbutton', { name: 'Maximum' }), '9{Enter}');
    await waitFor(() => {
      expect(lastColumns()[1]).toMatchObject({ integer: true, min: 1, max: 9 });
    });

    await user.click(within(panel).getByRole('combobox', { name: 'Type' }));
    await user.click(await screen.findByRole('option', { name: 'Row reference' }));
    await waitFor(() => {
      expect(lastColumns()[1]).toMatchObject({ kind: 'reference', label: 'Subject' });
    });
    await user.click(within(panel).getByRole('combobox', { name: 'Table' }));
    await user.click(await screen.findByRole('option', { name: 'Other' }));
    await user.click(within(panel).getByRole('switch', { name: 'Allow several' }));
    await waitFor(() => {
      expect(lastColumns()[1]).toMatchObject({ tableId: other.table.id, multiple: true });
    });

    await user.click(within(panel).getByRole('combobox', { name: 'Type' }));
    await user.click(await screen.findByRole('option', { name: 'Asset link' }));
    await user.click(await within(panel).findByRole('switch', { name: 'Board' }));
    await user.click(within(panel).getByRole('switch', { name: 'Board' }));
    await user.click(within(panel).getByRole('switch', { name: 'Data table' }));
    await user.click(within(panel).getByRole('switch', { name: 'Allow several' }));
    await waitFor(() => {
      expect(lastColumns()[1]).toMatchObject({ kind: 'link', linkKinds: ['table'], multiple: true });
    });

    await user.click(within(panel).getByRole('combobox', { name: 'Type' }));
    await user.click(await screen.findByRole('option', { name: 'Formula' }));
    await user.type(await within(panel).findByRole('textbox', { name: 'Formula' }), '2 * 3{Enter}');
    await user.type(within(panel).getByRole('spinbutton', { name: 'Decimal places' }), '2{Enter}');
    await waitFor(() => {
      expect(lastColumns()[1]).toMatchObject({ kind: 'formula', expression: '2 * 3', decimals: 2 });
    });
    expect(within(panel).queryByRole('switch', { name: 'Required' })).toBeNull();
  });

  it('moves and deletes columns and closes', async () => {
    const user = userEvent.setup();
    const { panel } = await settingsFor('dice');
    await user.click(within(panel).getByRole('button', { name: 'Move left' }));
    await waitFor(() => {
      expect(lastColumns().map((column) => column['id'])).toEqual(['subject', 'first']);
    });
    await user.click(within(panel).getByRole('button', { name: 'Move right' }));
    await waitFor(() => {
      expect(lastColumns().map((column) => column['id'])).toEqual(['first', 'subject']);
    });
    await user.click(within(panel).getByRole('button', { name: 'Close settings' }));
    expect(screen.queryByRole('complementary', { name: 'Column settings' })).toBeNull();
  });

  it('renames the key column from its own settings', async () => {
    const user = userEvent.setup();
    const { table } = await act(() =>
      createTable({ name: 'Keys', columns: [{ id: 'name', label: 'Name', kind: 'text' }] }),
    );
    await open(table.id);
    await user.click(screen.getByRole('button', { name: 'Settings for id' }));
    const panel = screen.getByRole('complementary', { name: 'Column settings' });
    expect(within(panel).getByText('Key column')).toBeTruthy();
    const input = within(panel).getByRole('textbox', { name: 'Key column id' });
    await user.clear(input);
    await user.type(input, 'name{Enter}');
    expect(api.tablesData.tables.at(-1)?.keyName).toBe('id');
    await user.clear(input);
    await user.type(input, 'slug{Enter}');
    await waitFor(() => {
      expect(api.tablesData.tables.at(-1)?.keyName).toBe('slug');
    });
    await user.click(screen.getByRole('button', { name: 'Settings for slug' }));
    expect(screen.queryByRole('complementary', { name: 'Column settings' })).toBeNull();
  });
});
