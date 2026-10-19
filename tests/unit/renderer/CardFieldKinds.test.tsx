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
