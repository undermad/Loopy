import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TicketsEditor } from '@renderer/components/editors/Tickets/TicketsEditor';
import { AreaContext } from '@renderer/components/Shell/AreaContext';
import { ticketActions } from '@renderer/lib/tickets';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

let api: FakeApi;

function rect(x: number, y: number, width: number, height: number): DOMRect {
  return {
    x,
    y,
    left: x,
    top: y,
    width,
    height,
    right: x + width,
    bottom: y + height,
    toJSON: () => undefined,
  };
}

function layoutRect(element: Element): DOMRect {
  const columns = Array.from(document.querySelectorAll('section[aria-label]')).filter((section) =>
    section.querySelector('h3'),
  );
  const section = element.closest('section[aria-label]');
  const column = section ? columns.indexOf(section) : -1;
  if (!section || column < 0) {
    const source = element.closest('[style*="position: fixed"]')
      ? document.querySelector('[class*="dragging"]')
      : null;
    return source ? layoutRect(source) : rect(0, 0, 0, 0);
  }
  const x = column * 300;
  if (element === section) return rect(x, 0, 280, 600);
  const sortable = element.getAttribute('aria-roledescription') === 'sortable';
  if (sortable && element.tagName === 'BUTTON') return rect(x + 4, 4, 24, 24);
  if (sortable) {
    const cards = Array.from(section.querySelectorAll('div[aria-roledescription="sortable"]'));
    return rect(x + 8, 48 + cards.indexOf(element) * 60, 264, 50);
  }
  if (element.className.includes('body')) return rect(x, 40, 280, 400);
  return rect(x, 0, 280, 600);
}

function Harness() {
  return (
    <TooltipProvider>
      <ToastProvider closeLabel="Dismiss" regionLabel="Notifications">
        <AreaContext value={{ areaId: 'a', headerSlot: null }}>
          <TicketsEditor areaId="a" state={{ mode: 'board', search: '' }} setState={() => undefined} />
        </AreaContext>
      </ToastProvider>
    </TooltipProvider>
  );
}

const tick = () =>
  act(
    () =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      }),
  );

async function press(target: Element | Document, code: string) {
  await act(async () => {
    fireEvent.keyDown(target, { code, key: code === 'Space' ? ' ' : code });
    await Promise.resolve();
  });
  await tick();
}

beforeEach(async () => {
  api = await bootTestApp();
  const project = makeProject('Space Game');
  api.projects = [project];
  api.current = project;
  api.emitProject();
  await ticketActions.create({ title: 'Alpha', stateId: 'todo' });
  await ticketActions.create({ title: 'Beta', stateId: 'doing' });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return layoutRect(this);
  });
});

describe('board drag and drop', () => {
  it('moves a ticket into the next column with the keyboard and previews it there', async () => {
    render(<Harness />);
    const todo = await screen.findByRole('region', { name: 'To do' });
    const doing = screen.getByRole('region', { name: 'In progress' });
    const card = within(todo).getByRole('button', { name: 'SPA-1 Alpha' });
    card.focus();

    await press(card, 'Space');
    expect(screen.getAllByRole('button', { name: 'SPA-1 Alpha' })).toHaveLength(2);

    await press(document, 'ArrowRight');
    expect(within(doing).getByRole('button', { name: 'SPA-1 Alpha' })).toBeInTheDocument();
    expect(within(todo).queryByRole('button', { name: 'SPA-1 Alpha' })).not.toBeInTheDocument();

    await press(document, 'Space');
    expect(api.moveTicket).toHaveBeenCalledWith({
      id: 'ticket-1',
      stateId: 'doing',
      position: expect.any(String) as string,
    });
    expect(screen.getAllByRole('button', { name: 'SPA-1 Alpha' })).toHaveLength(1);
  });

  it('cancels a ticket drag with Escape and keeps Enter for selection', async () => {
    render(<Harness />);
    const todo = await screen.findByRole('region', { name: 'To do' });
    const card = within(todo).getByRole('button', { name: 'SPA-1 Alpha' });
    card.focus();

    await press(card, 'Space');
    expect(screen.getAllByRole('button', { name: 'SPA-1 Alpha' })).toHaveLength(2);
    await press(document, 'Escape');
    expect(screen.getAllByRole('button', { name: 'SPA-1 Alpha' })).toHaveLength(1);
    expect(api.moveTicket).not.toHaveBeenCalled();

    await press(card, 'Enter');
    expect(card).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('button', { name: 'SPA-1 Alpha' })).toHaveLength(1);
  });

  it('reorders columns by dragging the grip with the keyboard', async () => {
    render(<Harness />);
    const todo = await screen.findByRole('region', { name: 'To do' });
    const grip = within(todo).getByRole('button', { name: 'Drag to reorder states' });
    grip.focus();

    await press(grip, 'Space');
    expect(screen.getAllByText('To do')).toHaveLength(2);
    await press(document, 'ArrowRight');
    await press(document, 'Space');
    expect(api.moveState).toHaveBeenCalledWith('todo', expect.any(String) as string);
    expect(screen.getAllByText('To do')).toHaveLength(1);
  });
});
