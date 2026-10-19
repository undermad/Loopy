import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cardFieldSchema, type CardField } from '@shared/cards';
import { CardView } from '@renderer/components/editors/Cards/CardView';
import { FieldPicker } from '@renderer/components/editors/Cards/FieldPicker';
import { FieldSettings } from '@renderer/components/editors/Cards/settings';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

let api: FakeApi;

function field(input: Record<string, unknown> & { id: string; kind: CardField['kind'] }): CardField {
  return cardFieldSchema.parse(input);
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

function settings(next: CardField, onChange = vi.fn()) {
  return (
    <Providers>
      <FieldSettings field={next} onChange={onChange} />
    </Providers>
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

describe('field picker', () => {
  it('groups the field kinds and reports the one picked', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(
      <Providers>
        <FieldPicker label="Add field" onPick={onPick} />
      </Providers>,
    );
    await user.click(screen.getByRole('button', { name: 'Add field' }));
    for (const group of ['Text', 'Numbers', 'Choices', 'Media', 'References', 'Layout']) {
      expect(await screen.findByRole('group', { name: group })).toBeInTheDocument();
    }
    await user.click(screen.getByRole('menuitem', { name: 'Stat bar' }));
    expect(onPick).toHaveBeenCalledWith('stat');
  });
});

describe('field settings order', () => {
  it('lists basics, value, layout, text style and advanced in that order', () => {
    render(settings(field({ id: 'name', kind: 'text', label: 'Name' })));
    const headings = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
    expect(headings).toEqual(['Field', 'Basics', 'Value', 'Layout', 'Text style', 'Advanced']);
  });

  it('keeps help text and hiding under advanced', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(settings(field({ id: 'bio', kind: 'longText', label: 'Bio' }), onChange));
    expect(screen.queryByRole('textbox', { name: 'Help text' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Advanced' }));
    const help = screen.getByRole('textbox', { name: 'Help text' });
    fireEvent.change(help, { target: { value: 'Who they are' } });
    fireEvent.blur(help);
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ id: 'bio', help: 'Who they are' });
    await user.click(screen.getByRole('switch', { name: 'Hide on card' }));
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ hidden: true });
  });

  it('edits the prefix and suffix of a number', () => {
    const onChange = vi.fn();
    render(settings(field({ id: 'gold', kind: 'number', label: 'Gold' }), onChange));
    const prefix = screen.getByRole('textbox', { name: 'Prefix' });
    fireEvent.change(prefix, { target: { value: '$' } });
    fireEvent.blur(prefix);
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ prefix: '$' });
    const suffix = screen.getByRole('textbox', { name: 'Suffix' });
    fireEvent.change(suffix, { target: { value: ' g' } });
    fireEvent.blur(suffix);
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ suffix: ' g' });
  });
});

describe('card view field options', () => {
  const fields = [
    field({ id: 'secret', kind: 'text', label: 'Secret', hidden: true }),
    field({ id: 'name', kind: 'text', label: 'Name', help: 'Who they are' }),
    field({ id: 'gold', kind: 'number', label: 'Gold', prefix: '$', suffix: ' g' }),
  ];

  it('leaves hidden fields off the card face but shows them while designing', () => {
    const { container, rerender } = render(
      <CardView layout={{ fields, gap: 4 }} values={{ secret: 'x' }} editable={false} />,
    );
    expect(container.querySelector('[data-field-id="secret"]')).toBeNull();
    rerender(<CardView layout={{ fields, gap: 4 }} values={{ secret: 'x' }} editable={false} showHidden />);
    expect(container.querySelector('[data-field-id="secret"]')).not.toBeNull();
  });

  it('shows help text and number affixes', () => {
    render(
      <Providers>
        <CardView layout={{ fields, gap: 4 }} values={{ gold: 12 }} editable={false} />
      </Providers>,
    );
    expect(screen.getByRole('img', { name: 'Who they are' })).toBeInTheDocument();
    expect(screen.getByText('$12 g')).toBeInTheDocument();
  });
});

describe('new field kinds on the card', () => {
  function view(fields: CardField[], values: Record<string, unknown>, editable: boolean, onChange = vi.fn()) {
    return (
      <Providers>
        <CardView
          layout={{ fields, gap: 4 }}
          values={values as never}
          editable={editable}
          onChange={onChange}
        />
      </Providers>
    );
  }

  it('rates with clickable symbols', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const rating = field({ id: 'r', kind: 'rating', label: 'Fun', max: 5 });
    const { rerender } = render(view([rating], { r: 2 }, true, onChange));
    await user.click(screen.getByRole('button', { name: 'Fun: 4 of 5' }));
    expect(onChange).toHaveBeenLastCalledWith('r', 4);
    await user.click(screen.getByRole('button', { name: 'Fun: 2 of 5' }));
    expect(onChange).toHaveBeenLastCalledWith('r', 0);
    rerender(view([rating], { r: 4 }, false));
    expect(screen.getByRole('img', { name: 'Fun: 4 of 5' })).toBeInTheDocument();
  });

  it('ticks, adds and removes checklist steps', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const list = field({ id: 'c', kind: 'checklist', label: 'Steps' });
    const steps = [
      { text: 'Find key', done: false },
      { text: 'Open door', done: true },
    ];
    render(view([list], { c: steps }, true, onChange));
    expect(screen.getByText('1/2')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Find key' }));
    expect(onChange).toHaveBeenLastCalledWith('c', [
      { text: 'Find key', done: true },
      { text: 'Open door', done: true },
    ]);
    await user.type(screen.getByRole('textbox', { name: 'Steps: Add a step' }), 'Leave{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('c', [...steps, { text: 'Leave', done: false }]);
    await user.click(screen.getByRole('button', { name: 'Remove Open door' }));
    expect(onChange).toHaveBeenLastCalledWith('c', [steps[0]]);
  });

  it('toggles several choices', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const multi = field({ id: 'm', kind: 'multiSelect', label: 'Elements', options: ['Fire', 'Ice'] });
    const { rerender } = render(view([multi], { m: ['Ice'] }, true, onChange));
    expect(screen.getByRole('button', { name: 'Ice' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Fire' }));
    expect(onChange).toHaveBeenLastCalledWith('m', ['Ice', 'Fire']);
    await user.click(screen.getByRole('button', { name: 'Ice' }));
    expect(onChange).toHaveBeenLastCalledWith('m', null);
    rerender(view([multi], { m: ['Ice'] }, false));
    expect(screen.queryByRole('button', { name: 'Fire' })).not.toBeInTheDocument();
    expect(screen.getByText('Ice')).toBeInTheDocument();
  });

  it('edits a range and shows numbers per attribute', () => {
    const onChange = vi.fn();
    const range = field({ id: 'g', kind: 'range', label: 'Gold', suffix: 'g' });
    const stats = field({
      id: 'a',
      kind: 'attributes',
      label: 'Stats',
      rows: [
        { id: 'str', label: 'Strength' },
        { id: 'dex', label: 'Dexterity' },
      ],
    });
    const { rerender } = render(
      view([range, stats], { g: { min: 2, max: 8 }, a: { str: 4 } }, true, onChange),
    );
    const to = screen.getByRole('spinbutton', { name: 'Gold: to' });
    fireEvent.change(to, { target: { value: '9' } });
    fireEvent.blur(to);
    expect(onChange).toHaveBeenLastCalledWith('g', { min: 2, max: 9 });
    const dex = screen.getByRole('spinbutton', { name: 'Dexterity' });
    fireEvent.change(dex, { target: { value: '3' } });
    fireEvent.blur(dex);
    expect(onChange).toHaveBeenLastCalledWith('a', { str: 4, dex: 3 });
    rerender(view([range, stats], { g: { min: 2, max: 8 }, a: { str: 4 } }, false));
    expect(screen.getByText('2g–8g')).toBeInTheDocument();
    expect(screen.getByText('Strength')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('shows dice odds, formula results, static text and spacing', () => {
    const fields = [
      field({ id: 'atk', kind: 'number', label: 'Attack' }),
      field({ id: 'dmg', kind: 'dice', label: 'Damage' }),
      field({ id: 'power', kind: 'formula', label: 'Power', expression: 'atk * 2', suffix: ' pts' }),
      field({ id: 'broken', kind: 'formula', label: 'Broken', expression: 'atk *' }),
      field({ id: 'rules', kind: 'staticText', text: 'Discard after use.' }),
      field({ id: 'gap', kind: 'spacer', size: 24 }),
    ];
    const { container } = render(view(fields, { atk: 3, dmg: '2d6+1' }, false));
    expect(screen.getByText('2d6+1')).toBeInTheDocument();
    expect(screen.getByText('3–13, average 8')).toBeInTheDocument();
    expect(screen.getByText('6 pts')).toBeInTheDocument();
    expect(screen.getByText('Check the formula')).toBeInTheDocument();
    expect(screen.getByText('Discard after use.')).toBeInTheDocument();
    expect(container.querySelector<HTMLElement>('[data-field-id="gap"] [data-spacer]')?.style.height).toBe(
      '24px',
    );
  });

  it('picks an icon and a date', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const fields = [
      field({ id: 'sym', kind: 'icon', label: 'Symbol' }),
      field({ id: 'due', kind: 'date', label: 'Due' }),
    ];
    render(view(fields, {}, true, onChange));
    await user.click(screen.getByRole('button', { name: 'Symbol: Choose icon' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Sword' }));
    expect(onChange).toHaveBeenLastCalledWith('sym', 'sword');
    fireEvent.change(screen.getByLabelText('Due'), { target: { value: '2026-10-19' } });
    expect(onChange).toHaveBeenLastCalledWith('due', '2026-10-19');
  });

  it('hides a field while its rule does not hold', () => {
    const fields = [
      field({ id: 'role', kind: 'select', label: 'Role', options: ['Hero', 'Boss'] }),
      field({
        id: 'phase',
        kind: 'text',
        label: 'Phase',
        visibleWhen: { field: 'role', op: 'equals', value: 'Boss' },
      }),
    ];
    const { container, rerender } = render(view(fields, { role: 'Hero' }, false));
    expect(container.querySelector('[data-field-id="phase"]')).toBeNull();
    rerender(view(fields, { role: 'Boss' }, false));
    expect(container.querySelector('[data-field-id="phase"]')).not.toBeNull();
  });
});

describe('new field kind settings', () => {
  it('edits choices with colours', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      settings(field({ id: 'r', kind: 'select', label: 'Rarity', options: ['Common', 'Rare'] }), onChange),
    );
    const first = screen.getByRole('textbox', { name: 'Choice 1' });
    fireEvent.change(first, { target: { value: 'Plain' } });
    fireEvent.blur(first);
    expect(onChange.mock.lastCall?.[0]).toMatchObject({
      options: [
        { value: 'Plain', colour: null },
        { value: 'Rare', colour: null },
      ],
    });
    await user.click(screen.getByRole('button', { name: 'Add choice' }));
    expect(onChange.mock.lastCall?.[0]).toHaveProperty('options.length', 3);
    await user.click(screen.getByRole('button', { name: 'Remove Rare' }));
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ options: [{ value: 'Common' }] });
  });

  it('checks a formula against the other fields', () => {
    const onChange = vi.fn();
    const attack = field({ id: 'attack', kind: 'number', label: 'Attack' });
    const broken = field({ id: 'p', kind: 'formula', label: 'Power', expression: 'attack *' });
    const { rerender } = render(
      <Providers>
        <FieldSettings field={broken} fields={[attack, broken]} onChange={onChange} />
      </Providers>,
    );
    expect(screen.getByText('Check the formula')).toBeInTheDocument();
    expect(screen.getByText('attack', { selector: 'code' })).toBeInTheDocument();
    const fine = { ...broken, expression: 'attack * 2' };
    rerender(
      <Providers>
        <FieldSettings field={fine} fields={[attack, fine]} onChange={onChange} />
      </Providers>,
    );
    expect(screen.queryByText('Check the formula')).not.toBeInTheDocument();
    const formula = screen.getByRole('textbox', { name: 'Formula' });
    fireEvent.change(formula, { target: { value: 'attack + 1' } });
    fireEvent.blur(formula);
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ expression: 'attack + 1' });
  });

  it('sets a rule for when the field shows', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const role = field({ id: 'role', kind: 'select', label: 'Role', options: ['Hero', 'Boss'] });
    const phase = field({ id: 'phase', kind: 'text', label: 'Phase' });
    const { rerender } = render(
      <Providers>
        <FieldSettings field={phase} fields={[role, phase]} onChange={onChange} />
      </Providers>,
    );
    await user.click(screen.getByRole('button', { name: 'Advanced' }));
    await user.click(screen.getByRole('combobox', { name: 'Show when' }));
    expect(screen.queryByRole('option', { name: 'Phase' })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('option', { name: 'Role' }));
    expect(onChange.mock.lastCall?.[0]).toMatchObject({
      visibleWhen: { field: 'role', op: 'filled', value: '' },
    });
    const ruled = field({ ...phase, visibleWhen: { field: 'role', op: 'equals', value: '' } });
    rerender(
      <Providers>
        <FieldSettings field={ruled} fields={[role, ruled]} onChange={onChange} />
      </Providers>,
    );
    const value = screen.getByRole('textbox', { name: 'Value' });
    fireEvent.change(value, { target: { value: 'Boss' } });
    fireEvent.blur(value);
    expect(onChange.mock.lastCall?.[0]).toMatchObject({
      visibleWhen: { field: 'role', op: 'equals', value: 'Boss' },
    });
    await user.click(screen.getByRole('combobox', { name: 'Show when' }));
    await user.click(await screen.findByRole('option', { name: 'Always' }));
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ visibleWhen: null });
  });

  it('edits attribute rows, rating size, static text and spacing', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      settings(field({ id: 'a', kind: 'attributes', rows: [{ id: 'str', label: 'Strength' }] }), onChange),
    );
    const rows = screen.getByRole('textbox', { name: /Attributes/ });
    fireEvent.change(rows, { target: { value: 'Strength\nMax Health' } });
    fireEvent.blur(rows);
    expect(onChange.mock.lastCall?.[0]).toMatchObject({
      rows: [
        { id: 'str', label: 'Strength' },
        { id: 'max_health', label: 'Max Health' },
      ],
    });
    rerender(settings(field({ id: 'r', kind: 'rating' }), onChange));
    const max = screen.getByRole('spinbutton', { name: 'Maximum' });
    fireEvent.change(max, { target: { value: '20' } });
    fireEvent.blur(max);
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ max: 10 });
    rerender(settings(field({ id: 't', kind: 'staticText' }), onChange));
    const text = screen.getByRole('textbox', { name: 'Text' });
    fireEvent.change(text, { target: { value: 'Rules' } });
    fireEvent.blur(text);
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ text: 'Rules' });
    rerender(settings(field({ id: 's', kind: 'spacer' }), onChange));
    const size = screen.getByRole('spinbutton', { name: 'Height' });
    fireEvent.change(size, { target: { value: '40' } });
    fireEvent.blur(size);
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ size: 40 });
  });
});
