import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cardFieldSchema, type CardField } from '@shared/cards';
import { CardView } from '@renderer/components/editors/Cards/CardView';
import { FieldSettings } from '@renderer/components/editors/Cards/settings';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject } from './helpers/api';

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

function view(fields: CardField[], values: Record<string, unknown>, onChange = vi.fn(), editable = true) {
  return render(
    <Providers>
      <CardView
        layout={{ fields, gap: 4 }}
        values={values as never}
        editable={editable}
        onChange={onChange}
      />
    </Providers>,
  );
}

function settings(next: CardField, onChange = vi.fn()) {
  return render(
    <Providers>
      <FieldSettings field={next} onChange={onChange} />
    </Providers>,
  );
}

beforeEach(async () => {
  const api = await bootTestApp();
  api.current = makeProject('Space Game');
  api.emitProject();
  await act(async () => {
    await Promise.resolve();
  });
});

describe('dice field', () => {
  it('builds notation from a count, a die and a modifier', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    view([field({ id: 'dmg', kind: 'dice', label: 'Damage', sides: [6, 8] })], { dmg: '2d6+1' }, onChange);
    expect(screen.getByRole('spinbutton', { name: 'Damage: dice' })).toHaveValue(2);
    expect(screen.getByRole('combobox', { name: 'Damage: die' })).toHaveValue('6');
    expect(screen.getByRole('spinbutton', { name: 'Damage: modifier' })).toHaveValue(1);
    expect(screen.getByText('3–13, average 8')).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Damage: die' }), '8');
    expect(onChange).toHaveBeenLastCalledWith('dmg', '2d8+1');
    const count = screen.getByRole('spinbutton', { name: 'Damage: dice' });
    fireEvent.change(count, { target: { value: '4' } });
    fireEvent.blur(count);
    expect(onChange).toHaveBeenLastCalledWith('dmg', '4d6+1');
  });

  it('keeps free notation in free mode and hides the odds when asked', () => {
    view([field({ id: 'dmg', kind: 'dice', label: 'Damage', mode: 'free', showOdds: false })], {
      dmg: '2d6+1d4',
    });
    expect(screen.getByRole('textbox', { name: 'Damage' })).toHaveValue('2d6+1d4');
    expect(screen.queryByText(/average/)).not.toBeInTheDocument();
  });

  it('rolls the dice when the card has a roll button, even when not editable', async () => {
    const user = userEvent.setup();
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    view([field({ id: 'dmg', kind: 'dice', label: 'Damage', roll: true })], { dmg: '2d6+1' }, vi.fn(), false);
    await user.click(screen.getByRole('button', { name: 'Roll Damage' }));
    expect(screen.getByRole('status')).toHaveTextContent('Rolled 13 (6, 6)');
    vi.restoreAllMocks();
  });

  it('edits the builder, sides, odds and roll button in settings', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    settings(field({ id: 'dmg', kind: 'dice' }), onChange);
    await user.click(screen.getByRole('radio', { name: 'Free notation' }));
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ mode: 'free' });
    const sides = screen.getByRole('textbox', { name: 'Dice sides' });
    fireEvent.change(sides, { target: { value: '6, 20, x, 1' } });
    fireEvent.blur(sides);
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ sides: [6, 20] });
    await user.click(screen.getByRole('switch', { name: 'Show range and average' }));
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ showOdds: false });
    await user.click(screen.getByRole('switch', { name: 'Roll button' }));
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ roll: true });
  });
});

describe('options of other kinds', () => {
  it('shows attribute totals and checkbox labels', () => {
    view(
      [
        field({
          id: 'a',
          kind: 'attributes',
          showTotal: true,
          rows: [
            { id: 'str', label: 'Str' },
            { id: 'dex', label: 'Dex' },
          ],
        }),
        field({ id: 'own', kind: 'checkbox', label: 'Owned', onLabel: 'In the bag', offLabel: 'Missing' }),
      ],
      { a: { str: 3, dex: 4 }, own: true },
      vi.fn(),
      false,
    );
    expect(screen.getByText('Total').nextElementSibling).toHaveTextContent('7');
    expect(screen.getByText('In the bag')).toBeInTheDocument();
  });

  it('formats dates and hides checklist progress when asked', () => {
    const { container } = view(
      [
        field({ id: 'd', kind: 'date', format: 'long' }),
        field({ id: 'l', kind: 'checklist', showProgress: false }),
      ],
      { d: '2026-03-04', l: [{ text: 'Go', done: true }] },
      vi.fn(),
      false,
    );
    expect(container.querySelector('[data-field-id="d"]')?.textContent).toContain(
      new Date('2026-03-04T00:00:00').toLocaleDateString(undefined, { dateStyle: 'long' }),
    );
    expect(screen.queryByText('1/1')).not.toBeInTheDocument();
  });

  it('shows a single choice as chips or radio buttons', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    view(
      [
        field({ id: 'r', kind: 'choice', label: 'Role', display: 'chips', options: ['Hero', 'Foe'] }),
        field({ id: 's', kind: 'choice', label: 'Size', display: 'radio', options: ['S', 'L'] }),
      ],
      { r: 'Hero' },
      onChange,
    );
    expect(screen.getByRole('button', { name: 'Hero' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Foe' }));
    expect(onChange).toHaveBeenLastCalledWith('r', 'Foe');
    await user.click(
      within(screen.getByRole('radiogroup', { name: 'Size' })).getByRole('radio', { name: 'L' }),
    );
    expect(onChange).toHaveBeenLastCalledWith('s', 'L');
  });

  it('edits the new options in settings', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = settings(field({ id: 'a', kind: 'attributes' }), onChange);
    await user.click(screen.getByRole('switch', { name: 'Show total' }));
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ showTotal: true });
    const swap = (next: CardField) => {
      rerender(
        <Providers>
          <FieldSettings field={next} onChange={onChange} />
        </Providers>,
      );
    };
    swap(field({ id: 'c', kind: 'checkbox' }));
    const on = screen.getByRole('textbox', { name: 'Label when ticked' });
    fireEvent.change(on, { target: { value: 'Yes!' } });
    fireEvent.blur(on);
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ onLabel: 'Yes!' });
    swap(field({ id: 'd', kind: 'date' }));
    await user.click(screen.getByRole('radio', { name: 'Long' }));
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ format: 'long' });
    swap(field({ id: 'l', kind: 'checklist' }));
    await user.click(screen.getByRole('switch', { name: 'Show progress' }));
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ showProgress: false });
    swap(field({ id: 'n', kind: 'number' }));
    const step = screen.getByRole('textbox', { name: 'Step' });
    fireEvent.change(step, { target: { value: '5' } });
    fireEvent.blur(step);
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ step: 5 });
    swap(field({ id: 'o', kind: 'choice', options: ['A'] }));
    await user.click(screen.getByRole('radio', { name: 'Chips' }));
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ display: 'chips' });
    swap(field({ id: 't', kind: 'text' }));
    const max = screen.getByRole('textbox', { name: 'Maximum length' });
    fireEvent.change(max, { target: { value: '12' } });
    fireEvent.blur(max);
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ maxLength: 12 });
  });
});
