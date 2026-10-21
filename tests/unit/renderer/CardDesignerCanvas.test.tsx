import { useState } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardTemplateInput } from '@shared/cards';
import { CardDesigner } from '@renderer/components/editors/Cards/CardDesigner';
import { createCardTemplate, createSavedCard } from '@renderer/lib/cards';
import { runEditCommand } from '@renderer/lib/commands';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

let api: FakeApi;

const TEMPLATE: CardTemplateInput = {
  name: 'Hero',
  fields: [
    { id: 'name', kind: 'text', label: 'Name', style: { size: 'lg', weight: 'bold' } },
    { id: 'attack', kind: 'number', label: 'Attack', span: 6 },
    { id: 'defence', kind: 'number', label: 'Defence', span: 6 },
    { id: 'power', kind: 'formula', label: 'Power', expression: 'attack + defence' },
    { id: 'notes', kind: 'text', label: 'Notes', zone: 'footer' },
  ],
};

function Designer({ initial }: { initial: Record<string, unknown> }) {
  const [state, setState] = useState(initial);
  return (
    <TooltipProvider>
      <ToastProvider closeLabel="Dismiss" regionLabel="Notifications">
        <CardDesigner
          areaId="cards"
          state={state}
          setState={(patch) => {
            setState((current) => ({ ...current, ...patch }));
          }}
        />
      </ToastProvider>
    </TooltipProvider>
  );
}

async function openTemplate(input: CardTemplateInput = TEMPLATE) {
  const template = await act(() => createCardTemplate(input));
  render(<Designer initial={{ target: { kind: 'template', id: template.id } }} />);
  await screen.findByRole('group', { name: 'Card canvas' });
  return template;
}

function canvas() {
  return screen.getByRole('group', { name: 'Card canvas' });
}

function fieldOnCanvas(name: string) {
  return within(canvas()).getByRole('group', { name });
}

function fieldIds(): string[] {
  return [...canvas().querySelectorAll('[data-field-id]')].map(
    (item) => item.getAttribute('data-field-id') ?? '',
  );
}

const SLOW = 15_000;

beforeEach(async () => {
  api = await bootTestApp();
  api.current = makeProject('Space Game');
  api.emitProject();
  await act(async () => {
    await Promise.resolve();
  });
});

describe('design mode', { timeout: SLOW }, () => {
  it('starts in design mode and switches to fill in with the toggle or Ctrl+E', async () => {
    const user = userEvent.setup();
    await openTemplate();
    expect(screen.getByRole('radio', { name: 'Design' })).toBeChecked();
    expect(within(canvas()).queryByRole('textbox', { name: 'Name' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Fill in' }));
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeInTheDocument();
    fireEvent.keyDown(canvas(), { key: 'e', ctrlKey: true });
    expect(screen.getByRole('radio', { name: 'Design' })).toBeChecked();
  });

  it('selects a field on the canvas and shows its settings, toolbar and resize handles', async () => {
    const user = userEvent.setup();
    await openTemplate();
    await user.click(fieldOnCanvas('Attack'));
    expect(fieldOnCanvas('Attack')).toHaveAttribute('data-selected', 'true');
    expect(screen.getByRole('textbox', { name: 'Label' })).toHaveValue('Attack');
    expect(screen.getByRole('toolbar', { name: 'Field tools' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Resize width of Attack' })).toHaveAttribute(
      'aria-valuenow',
      '6',
    );
    expect(screen.getByRole('slider', { name: 'Resize height of Attack' })).toBeInTheDocument();
  });

  it('shows every zone with a drop hint while designing', async () => {
    await openTemplate();
    expect(within(canvas()).getByRole('region', { name: 'Header zone' })).toHaveTextContent(
      'Drop fields here',
    );
    expect(within(canvas()).getByRole('region', { name: 'Footer zone' })).not.toHaveTextContent(
      'Drop fields here',
    );
  });

  it('keeps lock, duplicate and delete apart from the field options', async () => {
    const user = userEvent.setup();
    await openTemplate();
    await user.click(fieldOnCanvas('Attack'));
    const tools = screen.getByRole('toolbar', { name: 'Field tools' });
    const actions = within(tools).getByRole('group', { name: 'Field actions' });
    expect(within(tools).queryByRole('button', { name: 'Wider' })).not.toBeInTheDocument();
    expect(within(tools).queryByRole('button', { name: 'Move earlier' })).not.toBeInTheDocument();
    await user.click(within(actions).getByRole('button', { name: 'Duplicate' }));
    expect(fieldIds()).toContain('attack_2');
    expect(screen.getByRole('textbox', { name: 'Label' })).toHaveValue('Attack 2');
    const copy = () =>
      within(screen.getByRole('toolbar', { name: 'Field tools' })).getByRole('group', {
        name: 'Field actions',
      });
    await user.click(within(copy()).getByRole('button', { name: 'Lock' }));
    expect(within(fieldOnCanvas('Attack 2')).getByRole('img', { name: 'Locked' })).toBeInTheDocument();
    expect(screen.queryByRole('slider', { name: 'Resize width of Attack 2' })).not.toBeInTheDocument();
    expect(within(copy()).getByRole('button', { name: 'Delete' })).toBeDisabled();
    await user.click(within(copy()).getByRole('button', { name: 'Unlock' }));
    await user.click(within(copy()).getByRole('button', { name: 'Delete' }));
    expect(fieldIds()).not.toContain('attack_2');
  });

  it('resizes width and height with the handles from the keyboard', async () => {
    const user = userEvent.setup();
    await openTemplate();
    await user.click(fieldOnCanvas('Attack'));
    const width = screen.getByRole('slider', { name: 'Resize width of Attack' });
    fireEvent.keyDown(width, { key: 'ArrowRight' });
    fireEvent.keyDown(width, { key: 'ArrowRight' });
    expect(fieldOnCanvas('Attack').style.gridColumn).toBe('span 8');
    fireEvent.keyDown(width, { key: 'End' });
    expect(fieldOnCanvas('Attack').style.gridColumn).toBe('span 12');
    fireEvent.keyDown(width, { key: 'Home' });
    expect(fieldOnCanvas('Attack').style.gridColumn).toBe('span 1');
    const height = screen.getByRole('slider', { name: 'Resize height of Attack' });
    fireEvent.keyDown(height, { key: 'ArrowDown' });
    expect(fieldOnCanvas('Attack').style.minHeight).toBe('24px');
    fireEvent.keyDown(height, { key: 'ArrowDown' });
    expect(fieldOnCanvas('Attack').style.minHeight).toBe('32px');
    fireEvent.keyDown(height, { key: 'Delete' });
    expect(fieldOnCanvas('Attack').style.minHeight).toBe('');
  });

  it('resizes width by dragging the handle and snaps to columns', async () => {
    const user = userEvent.setup();
    await openTemplate();
    await user.click(fieldOnCanvas('Attack'));
    const zone = within(canvas()).getByRole('region', { name: 'Body zone' });
    vi.spyOn(zone, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 240, 400));
    vi.spyOn(fieldOnCanvas('Attack'), 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 120, 30));
    const width = screen.getByRole('slider', { name: 'Resize width of Attack' });
    fireEvent.pointerDown(width, { pointerId: 1, clientX: 120, clientY: 10, button: 0 });
    fireEvent.pointerMove(width, { pointerId: 1, clientX: 200, clientY: 10 });
    expect(screen.getByText('10/12')).toBeInTheDocument();
    expect(canvas().querySelector('[data-column-guides]')).not.toBeNull();
    fireEvent.pointerUp(width, { pointerId: 1, clientX: 200, clientY: 10 });
    expect(fieldOnCanvas('Attack').style.gridColumn).toBe('span 10');
    expect(canvas().querySelector('[data-column-guides]')).toBeNull();
  });

  it('resizes height by dragging the handle and snaps to 4 pixels', async () => {
    const user = userEvent.setup();
    await openTemplate();
    await user.click(fieldOnCanvas('Attack'));
    vi.spyOn(fieldOnCanvas('Attack'), 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 120, 30));
    const height = screen.getByRole('slider', { name: 'Resize height of Attack' });
    fireEvent.pointerDown(height, { pointerId: 2, clientX: 60, clientY: 30, button: 0 });
    fireEvent.pointerMove(height, { pointerId: 2, clientX: 60, clientY: 81 });
    expect(screen.getByText('80 px')).toBeInTheDocument();
    fireEvent.pointerMove(height, { pointerId: 9, clientX: 60, clientY: 300 });
    fireEvent.pointerUp(height, { pointerId: 2, clientX: 60, clientY: 81, altKey: true });
    expect(fieldOnCanvas('Attack').style.minHeight).toBe('81px');
    fireEvent.pointerDown(height, { pointerId: 3, clientX: 60, clientY: 30, button: 2 });
    expect(screen.queryByText(/px$/)).not.toBeInTheDocument();
  });

  it('shows options that belong to the selected kind of field', async () => {
    const user = userEvent.setup();
    await openTemplate({
      name: 'Kinds',
      fields: [
        { id: 'a', kind: 'text', label: 'A', showLabel: false },
        { id: 'n', kind: 'number', label: 'N' },
        { id: 'c', kind: 'choice', label: 'C', options: ['X'] },
        { id: 'd', kind: 'dice', label: 'D' },
        { id: 's', kind: 'separator' },
      ],
    });
    const options = () =>
      within(screen.getByRole('toolbar', { name: 'Field tools' })).getByRole('group', {
        name: 'Field options',
      });
    await user.click(fieldOnCanvas('A'));
    await user.click(within(options()).getByRole('button', { name: 'Bold' }));
    expect(within(options()).getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(options()).getByRole('button', { name: 'Larger text' }));
    await user.click(within(options()).getByRole('button', { name: 'Several lines' }));
    await user.click(within(options()).getByRole('button', { name: 'Show label' }));
    expect(within(fieldOnCanvas('A')).getByText('A')).toBeInTheDocument();
    expect(within(options()).getByRole('button', { name: 'Several lines' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(fieldOnCanvas('N'));
    await user.click(within(options()).getByRole('button', { name: 'Show as bar' }));
    expect(within(fieldOnCanvas('N')).getByRole('meter')).toBeInTheDocument();
    await user.click(within(options()).getByRole('button', { name: 'Low and high' }));
    expect(within(options()).queryByRole('button', { name: 'Show as bar' })).not.toBeInTheDocument();

    await user.click(fieldOnCanvas('C'));
    await user.click(within(options()).getByRole('button', { name: 'Allow several' }));
    expect(within(options()).getByRole('button', { name: 'Allow several' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(options()).queryByRole('button', { name: 'Bold' })).toBeInTheDocument();

    await user.click(fieldOnCanvas('D'));
    await user.click(within(options()).getByRole('button', { name: 'Roll button' }));
    await user.click(within(options()).getByRole('button', { name: 'Dice builder' }));
    expect(within(options()).getByRole('button', { name: 'Dice builder' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    const separator = canvas().querySelector<HTMLElement>('[data-field-id="s"]');
    if (!separator) throw new Error('no separator');
    await user.click(separator);
    await user.click(within(options()).getByRole('button', { name: 'More space' }));
    expect(separator.querySelector<HTMLElement>('[data-spacer]')?.style.height).toBe('24px');
    await user.click(within(options()).getByRole('button', { name: 'Draw a line' }));
    expect(separator.querySelector('hr')).toBeNull();
    expect(within(options()).queryByRole('button', { name: 'Show label' })).not.toBeInTheDocument();
  });

  it('renames a label in place with a double click', async () => {
    const user = userEvent.setup();
    await openTemplate();
    await user.dblClick(within(fieldOnCanvas('Attack')).getByText('Attack'));
    const input = screen.getByRole('textbox', { name: 'Rename Attack' });
    await user.clear(input);
    await user.type(input, 'Strike{Enter}');
    expect(fieldOnCanvas('Strike')).toBeInTheDocument();
    await user.dblClick(within(fieldOnCanvas('Strike')).getByText('Strike'));
    await user.type(screen.getByRole('textbox', { name: 'Rename Strike' }), 'zzz{Escape}');
    expect(fieldOnCanvas('Strike')).toBeInTheDocument();
  });

  it('adds a field at the end of a zone from the plus below it', async () => {
    const user = userEvent.setup();
    await openTemplate();
    expect(
      within(fieldOnCanvas('Name')).queryByRole('button', { name: /Add field/ }),
    ).not.toBeInTheDocument();
    await user.click(within(canvas()).getByRole('button', { name: 'Add field to Footer' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Checkbox' }));
    expect(fieldIds().slice(-2)).toEqual(['notes', 'checkbox']);
    expect(fieldOnCanvas('Checkbox')).toHaveAttribute('data-selected', 'true');
  });

  it('shows badges for formulas, show when rules and hidden fields', async () => {
    await openTemplate({
      name: 'Badges',
      fields: [
        { id: 'a', kind: 'number', label: 'A' },
        { id: 'f', kind: 'formula', label: 'F', expression: 'a' },
        { id: 'w', kind: 'text', label: 'W', visibleWhen: { field: 'a', op: 'filled', value: '' } },
        { id: 'h', kind: 'text', label: 'H', hidden: true },
      ],
    });
    expect(within(fieldOnCanvas('F')).getByRole('img', { name: 'Formula' })).toBeInTheDocument();
    expect(within(fieldOnCanvas('W')).getByRole('img', { name: 'Has a show when rule' })).toBeInTheDocument();
    expect(within(fieldOnCanvas('H')).getByRole('img', { name: 'Hidden on card' })).toBeInTheDocument();
  });

  it('toggles the column grid and zooms the preview', async () => {
    const user = userEvent.setup();
    await openTemplate();
    expect(canvas().querySelector('[data-grid-overlay]')).toBeNull();
    await user.click(screen.getByRole('switch', { name: 'Show grid' }));
    expect(canvas().querySelectorAll('[data-grid-overlay]').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('combobox', { name: 'Zoom' }));
    await user.click(await screen.findByRole('option', { name: '150%' }));
    expect(canvas().style.zoom).toBe('1.5');
  });
});

describe('keyboard editing', { timeout: SLOW }, () => {
  it('selects, moves, resizes, duplicates and deletes fields from the keyboard', async () => {
    const user = userEvent.setup();
    await openTemplate();
    await user.click(fieldOnCanvas('Name'));
    fireEvent.keyDown(canvas(), { key: 'ArrowDown' });
    expect(fieldOnCanvas('Attack')).toHaveAttribute('data-selected', 'true');
    fireEvent.keyDown(canvas(), { key: 'ArrowUp', altKey: true });
    expect(fieldIds().slice(0, 2)).toEqual(['attack', 'name']);
    fireEvent.keyDown(canvas(), { key: ']' });
    expect(fieldOnCanvas('Attack').style.gridColumn).toBe('span 7');
    fireEvent.keyDown(canvas(), { key: '[' });
    expect(fieldOnCanvas('Attack').style.gridColumn).toBe('span 6');
    fireEvent.keyDown(canvas(), { key: 'd', ctrlKey: true });
    expect(fieldIds()).toContain('attack_2');
    fireEvent.keyDown(canvas(), { key: 'Delete' });
    expect(fieldIds()).not.toContain('attack_2');
    fireEvent.keyDown(canvas(), { key: 'Escape' });
    expect(screen.getByRole('heading', { name: 'Card' })).toBeInTheDocument();
  });

  it('undoes and redoes design changes with the keys and the buttons', async () => {
    const user = userEvent.setup();
    await openTemplate();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    await user.click(fieldOnCanvas('Attack'));
    fireEvent.keyDown(canvas(), { key: 'Delete' });
    expect(fieldIds()).not.toContain('attack');
    fireEvent.keyDown(canvas(), { key: 'z', ctrlKey: true });
    expect(fieldIds()).toContain('attack');
    fireEvent.keyDown(canvas(), { key: 'z', ctrlKey: true, shiftKey: true });
    expect(fieldIds()).not.toContain('attack');
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(fieldIds()).toContain('attack');
    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(fieldIds()).not.toContain('attack');
    fireEvent.keyDown(canvas(), { key: 'y', ctrlKey: true });
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
    act(() => {
      canvas().focus();
    });
    act(() => {
      expect(runEditCommand('undo')).toBe(true);
    });
    expect(fieldIds()).toContain('attack');
    act(() => {
      expect(runEditCommand('selectAll')).toBe(true);
    });
    expect(screen.getByRole('heading', { name: '5 fields' })).toBeInTheDocument();
  });

  it('selects several fields and edits them together', async () => {
    const user = userEvent.setup();
    await openTemplate();
    await user.click(fieldOnCanvas('Attack'));
    await user.click(fieldOnCanvas('Defence'));
    fireEvent.click(fieldOnCanvas('Name'), { shiftKey: true });
    expect(screen.getByRole('heading', { name: '2 fields' })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Third' }));
    expect(fieldOnCanvas('Name').style.gridColumn).toBe('span 4');
    expect(fieldOnCanvas('Defence').style.gridColumn).toBe('span 4');
    expect(fieldOnCanvas('Attack').style.gridColumn).toBe('span 6');
    fireEvent.keyDown(canvas(), { key: 'a', ctrlKey: true });
    expect(screen.getByRole('heading', { name: '5 fields' })).toBeInTheDocument();
  });

  it('changes zone, text size, label, hiding and locking for several fields', async () => {
    const user = userEvent.setup();
    await openTemplate();
    await user.click(fieldOnCanvas('Attack'));
    fireEvent.click(fieldOnCanvas('Defence'), { ctrlKey: true });
    const columns = screen.getByRole('spinbutton', { name: 'Columns' });
    fireEvent.change(columns, { target: { value: '3' } });
    fireEvent.blur(columns);
    expect(fieldOnCanvas('Defence').style.gridColumn).toBe('span 3');
    await user.click(screen.getByRole('combobox', { name: 'Text size' }));
    await user.click(await screen.findByRole('option', { name: 'Large' }));
    await user.click(screen.getByRole('switch', { name: 'Show label' }));
    expect(within(fieldOnCanvas('Attack')).queryByText('Attack')).not.toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: 'Hide on card' }));
    expect(within(fieldOnCanvas('Defence')).getByRole('img', { name: 'Hidden on card' })).toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: 'Lock on the canvas' }));
    expect(within(fieldOnCanvas('Attack')).getByRole('img', { name: 'Locked' })).toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: 'Lock on the canvas' }));
    await user.click(screen.getByRole('combobox', { name: 'Zone' }));
    await user.click(await screen.findByRole('option', { name: 'Header' }));
    expect(fieldIds().slice(0, 2)).toEqual(['attack', 'defence']);
    await user.click(screen.getByRole('button', { name: 'Duplicate fields' }));
    expect(screen.getByRole('heading', { name: '2 fields' })).toBeInTheDocument();
    expect(fieldIds()).toEqual(expect.arrayContaining(['attack_2', 'defence_2']));
    await user.click(screen.getByRole('button', { name: 'Delete fields' }));
    expect(fieldIds()).not.toContain('attack_2');
    expect(screen.getByRole('heading', { name: 'Card' })).toBeInTheDocument();
  });

  it('copies, cuts and pastes fields between templates', async () => {
    const user = userEvent.setup();
    await openTemplate();
    await user.click(fieldOnCanvas('Attack'));
    fireEvent.click(fieldOnCanvas('Power'), { ctrlKey: true });
    fireEvent.keyDown(canvas(), { key: 'c', ctrlKey: true });
    fireEvent.keyDown(canvas(), { key: 'v', ctrlKey: true });
    expect(fieldIds()).toEqual(['name', 'attack', 'defence', 'power', 'attack_2', 'power_2', 'notes']);
    fireEvent.keyDown(canvas(), { key: 'x', ctrlKey: true });
    expect(fieldIds()).toEqual(['name', 'attack', 'defence', 'power', 'notes']);
  });

  it('opens the add field menu with a slash and renames with Enter', async () => {
    const user = userEvent.setup();
    await openTemplate();
    await user.click(fieldOnCanvas('Attack'));
    fireEvent.keyDown(canvas(), { key: '/' });
    await user.click(await screen.findByRole('menuitem', { name: 'Date' }));
    expect(fieldIds().slice(1, 3)).toEqual(['attack', 'date']);
    fireEvent.keyDown(canvas(), { key: 'Enter' });
    expect(screen.getByRole('textbox', { name: 'Rename Date' })).toHaveFocus();
  });
});

describe('field list helpers', { timeout: SLOW }, () => {
  it('adds several fields from lines and blocks from the menu', async () => {
    const user = userEvent.setup();
    await openTemplate();
    await user.click(screen.getByRole('button', { name: 'Add several' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add several fields' });
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Labels, one per line' }),
      'Speed{Enter}Luck',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Add fields' }));
    expect(fieldIds()).toEqual(expect.arrayContaining(['speed', 'luck']));
    await user.click(screen.getByRole('button', { name: 'Add field' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Stat block' }));
    expect(fieldIds()).toEqual(expect.arrayContaining(['attack_2', 'defence_2', 'speed_2']));
  });

  it('selects several rows in the field list with Ctrl and Shift', async () => {
    const user = userEvent.setup();
    await openTemplate();
    await user.click(screen.getByRole('button', { name: 'Edit Name' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Defence' }), { shiftKey: true });
    expect(screen.getByRole('heading', { name: '3 fields' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Attack' }), { ctrlKey: true });
    expect(screen.getByRole('heading', { name: '2 fields' })).toBeInTheDocument();
  });

  it('renames a field id and updates the formula', async () => {
    const user = userEvent.setup();
    await openTemplate();
    await user.click(fieldOnCanvas('Attack'));
    await user.click(screen.getByRole('button', { name: 'Advanced' }));
    const id = screen.getByRole('textbox', { name: 'Field id' });
    fireEvent.change(id, { target: { value: 'Strike' } });
    fireEvent.blur(id);
    expect(fieldIds()).toContain('strike');
    await user.click(fieldOnCanvas('Power'));
    expect(screen.getByRole('textbox', { name: 'Formula' })).toHaveValue('strike + defence');
  });
});

describe('preview helpers', { timeout: SLOW }, () => {
  it('fills sample values and clears them in fill in mode', async () => {
    const user = userEvent.setup();
    await openTemplate();
    await user.click(screen.getByRole('radio', { name: 'Fill in' }));
    await user.click(screen.getByRole('button', { name: 'Fill with sample values' }));
    expect(screen.getByRole('spinbutton', { name: 'Attack' })).not.toHaveValue(null);
    await user.click(screen.getByRole('button', { name: 'Clear values' }));
    expect(screen.getByRole('spinbutton', { name: 'Attack' })).toHaveValue(null);
  });

  it('previews the values of a saved card that uses the template', async () => {
    const user = userEvent.setup();
    const template = await act(() => createCardTemplate(TEMPLATE));
    await act(() => createSavedCard({ name: 'Ignis', templateId: template.id, values: { attack: 9 } }));
    await act(() => createSavedCard({ name: 'Aqua', templateId: template.id, values: { attack: 3 } }));
    render(<Designer initial={{ target: { kind: 'template', id: template.id } }} />);
    expect(await screen.findByText('Used by 2 cards')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Fill in' }));
    await user.click(screen.getByRole('combobox', { name: 'Preview values from' }));
    await user.click(await screen.findByRole('option', { name: 'Ignis' }));
    expect(screen.getByRole('spinbutton', { name: 'Attack' })).toHaveValue(9);
  });

  it('warns when fields do not fit and fits the card height', async () => {
    const user = userEvent.setup();
    await openTemplate();
    const measure = (value: number) =>
      function (this: HTMLElement) {
        return this.dataset['zone'] === 'body' ? value : 0;
      };
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(measure(600));
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(measure(300));
    await user.click(screen.getByRole('radio', { name: 'Fill in' }));
    await user.click(screen.getByRole('radio', { name: 'Design' }));
    expect(await screen.findByText('Some fields do not fit the card.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Fit height' }));
    expect(screen.getByRole('spinbutton', { name: 'Height' })).toHaveValue(660);
    vi.restoreAllMocks();
  });
});

describe('unsaved changes', { timeout: SLOW }, () => {
  it('asks before another template replaces unsaved changes', async () => {
    const user = userEvent.setup();
    const { CardLibrary } = await import('@renderer/components/editors/Cards/CardLibrary');
    const other = await act(() => createCardTemplate({ name: 'Villain' }));
    await openTemplate();
    render(
      <TooltipProvider>
        <ToastProvider closeLabel="Dismiss" regionLabel="Notifications">
          <CardLibrary areaId="library" state={{}} setState={vi.fn()} />
        </ToastProvider>
      </TooltipProvider>,
    );
    await user.click(fieldOnCanvas('Attack'));
    fireEvent.keyDown(canvas(), { key: 'Delete' });
    await user.click(screen.getByRole('button', { name: /^Villain/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Discard unsaved changes?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(fieldIds()).not.toContain('attack');
    expect(other.name).toBe('Villain');
  });
});
