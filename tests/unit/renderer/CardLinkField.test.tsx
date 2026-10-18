import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardValue } from '@shared/board';
import { cardFieldSchema } from '@shared/cards';
import { CardView } from '@renderer/components/editors/Cards/CardView';
import { reportAssetDrag } from '@renderer/lib/assets';
import { createBoard } from '@renderer/lib/board';
import { createSavedCard } from '@renderer/lib/cards';
import { useActiveWorkspace } from '@renderer/lib/workspaces';
import { TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject } from './helpers/api';

let boardId = '';
let cardId = '';

beforeEach(async () => {
  const api = await bootTestApp();
  api.current = makeProject('Space Game');
  api.emitProject();
  boardId = (await createBoard({ name: 'Castle' })).id;
  cardId = (await createSavedCard({ name: 'Knight' })).id;
});

function renderField(value: CardValue, editable: boolean, options: Record<string, unknown> = {}) {
  const onChange = vi.fn();
  const field = cardFieldSchema.parse({ id: 'home', kind: 'link', label: 'Home', ...options });
  render(
    <TooltipProvider>
      <CardView
        layout={{ fields: [field], gap: 8 }}
        values={{ home: value }}
        editable={editable}
        onChange={onChange}
      />
    </TooltipProvider>,
  );
  return onChange;
}

describe('link fields on a card', () => {
  it('shows linked assets by name and opens them', async () => {
    const user = userEvent.setup();
    renderField(
      [
        { kind: 'board', id: boardId },
        { kind: 'card', id: cardId },
      ],
      false,
      { multiple: true },
    );
    expect(screen.getByRole('button', { name: /Knight/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Castle/ }));
    const { result } = renderHook(() => useActiveWorkspace());
    expect(JSON.stringify(result.current?.root)).toContain(boardId);
  });

  it('removes a link and accepts dropped assets of the allowed kinds', () => {
    const onChange = renderField({ kind: 'board', id: boardId }, true, { linkKinds: ['board', 'card'] });
    act(() => {
      screen.getByRole('button', { name: 'Remove Castle' }).click();
    });
    expect(onChange).toHaveBeenLastCalledWith('home', null);

    const zone = screen.getByRole('group', { name: 'Home' });
    vi.spyOn(document, 'elementsFromPoint').mockReturnValue([zone]);
    act(() => {
      reportAssetDrag([], 10, 10, 'move', [{ kind: 'palette', id: 'p1' }]);
      reportAssetDrag([], 10, 10, 'drop', [
        { kind: 'palette', id: 'p1' },
        { kind: 'card', id: cardId },
      ]);
    });
    expect(onChange).toHaveBeenLastCalledWith('home', { kind: 'card', id: cardId });
  });

  it('adds to a list when the field takes many and hints when empty', () => {
    const onChange = renderField([{ kind: 'board', id: boardId }], true, { multiple: true });
    const zone = screen.getByRole('group', { name: 'Home' });
    vi.spyOn(document, 'elementsFromPoint').mockReturnValue([zone]);
    act(() => {
      reportAssetDrag([], 10, 10, 'drop', [{ kind: 'card', id: cardId }]);
    });
    expect(onChange).toHaveBeenLastCalledWith('home', [
      { kind: 'board', id: boardId },
      { kind: 'card', id: cardId },
    ]);
  });

  it('explains how to link when there is nothing yet', () => {
    renderField(null, true);
    expect(screen.getByText('Drop a board, palette, note or card here')).toBeInTheDocument();
  });
});
