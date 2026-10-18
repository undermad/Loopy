import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '@renderer/App';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

let api: FakeApi;

function areas(): HTMLElement[] {
  return screen.getAllByRole('region').filter((element) => element.hasAttribute('data-area-id'));
}

function at<T>(items: T[], index: number): T {
  const item = items[index];
  if (!item) throw new Error(`Missing item ${String(index)}`);
  return item;
}

beforeEach(async () => {
  api = await bootTestApp();
  const project = makeProject('Space Game');
  api.current = project;
  api.emitProject();
});

describe('areas', () => {
  it('maximises, joins and swaps through the header and keyboard', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('tab', { name: 'Planning' });
    expect(areas()).toHaveLength(2);

    await user.click(within(at(areas(), 0)).getByRole('button', { name: 'Maximise area' }));
    expect(areas()).toHaveLength(1);
    await user.click(within(at(areas(), 0)).getByRole('button', { name: 'Restore area' }));
    expect(areas()).toHaveLength(2);

    fireEvent.pointerEnter(at(areas(), 1));
    fireEvent.keyDown(window, { key: ' ', code: 'Space', ctrlKey: true });
    expect(areas()).toHaveLength(1);
    fireEvent.keyDown(window, { key: ' ', code: 'Space', ctrlKey: true });
    expect(areas()).toHaveLength(2);

    await user.click(within(at(areas(), 0)).getByRole('button', { name: 'Area' }));
    await user.hover(await screen.findByRole('menuitem', { name: 'Swap with' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Area to the right' }));
    expect(at(areas(), 0)).toHaveAttribute('aria-label', 'ticket');

    await user.click(within(at(areas(), 0)).getByRole('button', { name: 'Area' }));
    await user.hover(await screen.findByRole('menuitem', { name: 'Join with' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Area to the right' }));
    expect(areas()).toHaveLength(1);

    await user.click(within(at(areas(), 0)).getByRole('button', { name: 'Area' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Close area' }));
    expect(areas()).toHaveLength(1);

    fireEvent.keyDown(window, { key: 'PageDown', code: 'PageDown', ctrlKey: true });
    expect(screen.getByRole('tab', { name: 'Design' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(window, { key: 'PageUp', code: 'PageUp', ctrlKey: true });
    expect(screen.getByRole('tab', { name: 'Planning' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(window, { key: 'F11', code: 'F11' });
    expect(api.toggleFullscreen).toHaveBeenCalled();
  });

  it('swaps by ctrl-dragging a corner and cancels an interrupted drag', async () => {
    render(<App />);
    await screen.findByRole('tab', { name: 'Planning' });
    const second = at(areas(), 1);
    const corner = at(within(second).getAllByRole('button', { name: 'Drag to split or join' }), 0);

    fireEvent.pointerDown(corner, { button: 0, clientX: 100, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(corner, { clientX: 20, clientY: 1, pointerId: 1, ctrlKey: true });
    expect(screen.getByText('Swap')).toBeInTheDocument();
    fireEvent.pointerUp(corner, { clientX: 20, clientY: 1, pointerId: 1, ctrlKey: true });
    expect(at(areas(), 0)).toHaveAttribute('aria-label', 'ticket');

    fireEvent.pointerDown(corner, { button: 0, clientX: 100, clientY: 0, pointerId: 2 });
    fireEvent.pointerMove(corner, { clientX: 100, clientY: 1, pointerId: 2 });
    fireEvent.pointerCancel(corner, { pointerId: 2 });
    fireEvent.pointerDown(corner, { button: 2, clientX: 0, clientY: 0, pointerId: 3 });
    expect(areas()).toHaveLength(2);
  });
});
