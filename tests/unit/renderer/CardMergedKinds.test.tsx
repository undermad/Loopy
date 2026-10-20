import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cardFieldSchema, type CardField } from '@shared/cards';
import { CardView } from '@renderer/components/editors/Cards/CardView';
import { FieldPicker } from '@renderer/components/editors/Cards/FieldPicker';
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

describe('add field menu', () => {
  it('offers presets and reports the preset picked', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(
      <Providers>
        <FieldPicker label="Add field" onPick={onPick} />
      </Providers>,
    );
    await user.click(screen.getByRole('button', { name: 'Add field' }));
    for (const name of ['Heading', 'Stat bar', 'Rating', 'Range', 'Tags', 'Divider', 'Spacer']) {
      expect(screen.getByRole('menuitem', { name })).toBeInTheDocument();
    }
    await user.click(screen.getByRole('menuitem', { name: 'Tags' }));
    expect(onPick).toHaveBeenCalledWith('tags');
  });
});

describe('merged field views', () => {
  it('shows fixed text without an input and a multi-line text as a text area', () => {
    view(
      [
        field({ id: 'rules', kind: 'text', fixed: true, text: 'Draw two cards', showLabel: false }),
        field({ id: 'bio', kind: 'text', lines: 'multi', label: 'Bio' }),
      ],
      {},
    );
    expect(screen.getByText('Draw two cards')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Bio' }).tagName).toBe('TEXTAREA');
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
  });

  it('draws a number as a bar, as symbols or as a low and high pair', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    view(
      [
        field({ id: 'hp', kind: 'number', display: 'bar', label: 'Health', min: 0, max: 200 }),
        field({ id: 'stars', kind: 'number', display: 'symbols', label: 'Stars', max: 3 }),
        field({ id: 'dmg', kind: 'number', range: true, label: 'Damage' }),
      ],
      { hp: 50, stars: 2, dmg: { min: 2, max: 6 } },
      onChange,
    );
    expect(screen.getByRole('meter', { name: 'Health' })).toHaveAttribute('aria-valuemax', '200');
    expect(screen.getAllByRole('button', { name: /^Stars:/ })).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Stars: 3 of 3' }));
    expect(onChange).toHaveBeenCalledWith('stars', 3);
    expect(screen.getByRole('spinbutton', { name: 'Damage: from' })).toHaveValue(2);
    expect(screen.getByRole('spinbutton', { name: 'Damage: to' })).toHaveValue(6);
  });

  it('picks one choice from a list and several as toggles', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    view(
      [
        field({ id: 'role', kind: 'choice', label: 'Role', options: ['Hero', 'Villain'] }),
        field({ id: 'traits', kind: 'choice', label: 'Traits', multiple: true, options: ['Brave', 'Sly'] }),
      ],
      { traits: ['Sly'] },
      onChange,
    );
    fireEvent.change(screen.getByRole('combobox', { name: 'Role' }), { target: { value: 'Villain' } });
    expect(onChange).toHaveBeenCalledWith('role', 'Villain');
    await user.click(screen.getByRole('button', { name: 'Brave' }));
    expect(onChange).toHaveBeenLastCalledWith('traits', ['Sly', 'Brave']);
  });

  it('adds new entries to a choice that allows them', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    view(
      [
        field({
          id: 'tags',
          kind: 'choice',
          label: 'Tags',
          multiple: true,
          allowNew: true,
          options: ['Fire'],
        }),
      ],
      { tags: ['Ice'] },
      onChange,
    );
    expect(screen.getByRole('button', { name: 'Fire' })).toHaveAttribute('aria-pressed', 'false');
    await user.type(screen.getByRole('textbox', { name: 'Tags: Add a tag…' }), 'Wind{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('tags', ['Ice', 'Wind']);
    await user.click(screen.getByRole('button', { name: 'Remove Ice' }));
    expect(onChange).toHaveBeenLastCalledWith('tags', null);
  });

  it('draws a separator as a line or as empty space', () => {
    const { container } = view(
      [
        field({ id: 'line', kind: 'separator' }),
        field({ id: 'gap', kind: 'separator', line: false, size: 24 }),
      ],
      {},
    );
    expect(container.querySelector('[data-field-id="line"] hr')).not.toBeNull();
    expect(container.querySelector('[data-field-id="gap"] hr')).toBeNull();
    expect(container.querySelector<HTMLElement>('[data-field-id="gap"] [data-spacer]')?.style.height).toBe(
      '24px',
    );
  });
});

describe('merged field settings', () => {
  it('switches text between one line, several lines and fixed text', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = settings(field({ id: 'bio', kind: 'text', label: 'Bio' }), onChange);
    await user.click(screen.getByRole('radio', { name: 'Several lines' }));
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ lines: 'multi' });
    await user.click(screen.getByRole('switch', { name: 'Same text on every card' }));
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ fixed: true });
    rerender(
      <Providers>
        <FieldSettings field={field({ id: 'bio', kind: 'text', fixed: true })} onChange={onChange} />
      </Providers>,
    );
    const text = screen.getByRole('textbox', { name: 'Text' });
    fireEvent.change(text, { target: { value: 'Rules' } });
    fireEvent.blur(text);
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ text: 'Rules' });
    expect(screen.queryByRole('textbox', { name: 'Placeholder' })).not.toBeInTheDocument();
  });

  it('switches a number display and shows the symbol only for symbols', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = settings(field({ id: 'n', kind: 'number' }), onChange);
    expect(screen.queryByRole('combobox', { name: 'Symbol' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Symbols' }));
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ display: 'symbols' });
    rerender(
      <Providers>
        <FieldSettings field={field({ id: 'n', kind: 'number', display: 'symbols' })} onChange={onChange} />
      </Providers>,
    );
    expect(screen.getByRole('combobox', { name: 'Symbol' })).toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: 'Low and high' }));
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ range: true, display: 'number', defaultValue: null });
  });

  it('turns on several values and new entries for a choice', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    settings(field({ id: 'c', kind: 'choice', options: ['A'], defaultValue: 'A' }), onChange);
    await user.click(screen.getByRole('switch', { name: 'Allow several' }));
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ multiple: true, defaultValue: ['A'] });
    await user.click(screen.getByRole('switch', { name: 'Allow new entries' }));
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ allowNew: true });
  });

  it('toggles the separator line and sets its height', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    settings(field({ id: 's', kind: 'separator' }), onChange);
    await user.click(screen.getByRole('switch', { name: 'Draw a line' }));
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ line: false });
    expect(screen.getByRole('spinbutton', { name: 'Height' })).toHaveValue(16);
  });

  it('lists the fourteen field types', async () => {
    const user = userEvent.setup();
    settings(field({ id: 'n', kind: 'number' }));
    await user.click(screen.getByRole('combobox', { name: 'Field type' }));
    expect(screen.getAllByRole('option')).toHaveLength(14);
  });
});
