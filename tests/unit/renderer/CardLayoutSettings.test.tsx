import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cardFieldSchema, type CardField } from '@shared/cards';
import { CardView } from '@renderer/components/editors/Cards/CardView';
import { FieldSettings } from '@renderer/components/editors/Cards/settings';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject } from './helpers/api';

function field(input: Record<string, unknown> & { id: string }): CardField {
  return cardFieldSchema.parse({ kind: 'text', ...input });
}

function settings(next: CardField, onChange = vi.fn()) {
  return render(
    <TooltipProvider>
      <ToastProvider closeLabel="Dismiss" regionLabel="Notifications">
        <FieldSettings field={next} onChange={onChange} />
      </ToastProvider>
    </TooltipProvider>,
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

describe('field layout settings', () => {
  it('sets any number of columns and keeps it between 1 and 12', () => {
    const onChange = vi.fn();
    settings(field({ id: 'a', span: 12 }), onChange);
    const columns = screen.getByRole('spinbutton', { name: 'Columns' });
    fireEvent.change(columns, { target: { value: '5' } });
    fireEvent.blur(columns);
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ span: 5 });
    fireEvent.change(columns, { target: { value: '30' } });
    fireEvent.blur(columns);
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ span: 12 });
  });

  it('picks a width preset', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    settings(field({ id: 'a', span: 12 }), onChange);
    await user.click(screen.getByRole('radio', { name: 'Half' }));
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ span: 6 });
  });

  it('starts a new row and sets or clears a minimum height', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    settings(field({ id: 'a', height: 40 }), onChange);
    await user.click(screen.getByRole('switch', { name: 'Start a new row' }));
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ newRow: true });
    const height = screen.getByRole('spinbutton', { name: 'Minimum height' });
    fireEvent.change(height, { target: { value: '81' } });
    fireEvent.blur(height);
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ height: 80 });
    fireEvent.change(height, { target: { value: '0' } });
    fireEvent.blur(height);
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ height: null });
  });
});

describe('field placement on the card', () => {
  it('spans columns, starts new rows and keeps a minimum height', () => {
    const { container } = render(
      <CardView
        layout={{
          fields: [field({ id: 'a', span: 5 }), field({ id: 'b', span: 3, newRow: true, height: 96 })],
          gap: 4,
        }}
        values={{}}
        editable={false}
      />,
    );
    const a = container.querySelector<HTMLElement>('[data-field-id="a"]');
    const b = container.querySelector<HTMLElement>('[data-field-id="b"]');
    expect(a?.style.gridColumn).toBe('span 5');
    expect(b?.style.gridColumn).toBe('1 / span 3');
    expect(b?.style.minHeight).toBe('96px');
  });
});
