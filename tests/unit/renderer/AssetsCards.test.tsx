import { useState } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssetsEditor } from '@renderer/components/editors/Assets/AssetsEditor';
import { AreaContext } from '@renderer/components/Shell/AreaContext';
import { createSavedCard } from '@renderer/lib/cards';
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
  api.current = makeProject('Space Game');
  api.emitProject();
  await createSavedCard({ name: 'Knight' });
});

describe('saved cards as internal assets', () => {
  it('lists saved cards in their own Cards tree', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const cards = await screen.findByRole('tree', { name: 'Cards' });
    await user.click(within(cards).getByRole('treeitem', { name: /Cards/ }));
    expect(patches).toHaveBeenLastCalledWith({ scope: 'cards', folderId: '' });
    expect(screen.getByRole('button', { name: 'Knight' })).toHaveAttribute('data-internal', 'card');
  });

  it('shows cards from the file type list', async () => {
    render(<Harness initial={{ view: 'types', kind: 'card' }} />);
    expect(await screen.findByRole('button', { name: 'Knight' })).toHaveAttribute('data-internal', 'card');
  });

  it('deletes a saved card from its menu', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ scope: 'cards', folderId: '' }} />);
    const card = await screen.findByRole('button', { name: 'Knight' });
    await user.pointer({ keys: '[MouseRight]', target: card });
    await user.click(await screen.findByRole('menuitem', { name: 'Delete card' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(api.deleteCard).toHaveBeenCalled();
    });
  });
});
