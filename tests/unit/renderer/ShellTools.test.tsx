import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '@renderer/App';
import { PreferencesDialog } from '@renderer/components/Preferences/PreferencesDialog';
import { ScrollStrip, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

let api: FakeApi;

function areas(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[data-area-id]')];
}

beforeEach(async () => {
  api = await bootTestApp();
  const project = makeProject('Space Game');
  api.current = project;
  api.emitProject();
  await act(async () => {
    await Promise.resolve();
  });
});

describe('shell tools', () => {
  it('previews a corner split with a separator in either direction', async () => {
    render(<App />);
    await screen.findByRole('tab', { name: 'Planning' });
    const [area] = areas();
    if (!area) throw new Error('missing area');
    const corner = within(area).getAllByRole('button', { name: 'Drag to split or join' })[0];
    if (!corner) throw new Error('missing corner');

    fireEvent.pointerDown(corner, { button: 0, clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(corner, { clientX: 40, clientY: 2, pointerId: 1 });
    expect(area.querySelector('[data-direction="row"]')).not.toBeNull();
    fireEvent.pointerMove(corner, { clientX: 2, clientY: 40, pointerId: 1 });
    expect(area.querySelector('[data-direction="column"]')).not.toBeNull();
    expect(within(area).getByText('Split horizontally')).toBeInTheDocument();
    fireEvent.pointerCancel(corner, { pointerId: 1 });
    expect(area.querySelector('[data-direction]')).toBeNull();
  });

  it('groups editors by workspace and lists shortcuts by category', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('tab', { name: 'Planning' });
    const [area] = areas();
    if (!area) throw new Error('missing area');
    await user.click(within(area).getByRole('button', { name: 'Editor type' }));
    const menu = await screen.findByRole('menu');
    for (const label of ['Planning', 'Design', 'Palette', 'Assets', 'General']) {
      expect(within(menu).getAllByText(label).length).toBeGreaterThan(0);
    }
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('menuitem', { name: 'Help' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Keyboard shortcuts' }));
    const dialog = await screen.findByRole('dialog', { name: 'Keyboard shortcuts' });
    for (const heading of ['Application', 'Editing', 'Board tools', 'Board alignment', 'Board mouse']) {
      expect(within(dialog).getByRole('heading', { name: heading })).toBeInTheDocument();
    }
    expect(within(dialog).getByText('Quick create at the pointer')).toBeInTheDocument();
  });

  it('saves editor defaults from Preferences', async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <PreferencesDialog open onOpenChange={vi.fn()} />
      </TooltipProvider>,
    );
    await user.click(screen.getByRole('tab', { name: 'Editors' }));
    await user.click(screen.getByRole('switch', { name: 'Snap to the grid' }));
    expect(api.setSettings).toHaveBeenLastCalledWith({
      editors: expect.objectContaining({
        board: expect.objectContaining({ snap: true }) as unknown,
      }) as unknown,
    });
    await user.click(screen.getByRole('radio', { name: 'Pans' }));
    await user.click(screen.getByRole('radio', { name: 'List' }));
    await user.click(screen.getByRole('switch', { name: 'Show the grid' }));
    await user.click(screen.getByRole('switch', { name: 'Show the minimap' }));
    await user.click(screen.getByRole('switch', { name: 'Show + buttons around the selected item' }));
    await user.click(screen.getByRole('switch', { name: 'Show the details panel' }));
    expect(api.setSettings).toHaveBeenLastCalledWith({
      editors: expect.objectContaining({
        assets: expect.objectContaining({ details: false }) as unknown,
      }) as unknown,
    });
  });
});

describe('scroll strip', () => {
  function overflow(element: HTMLElement, size: number, client: number) {
    Object.defineProperty(element, 'scrollWidth', { value: size, configurable: true });
    Object.defineProperty(element, 'clientWidth', { value: client, configurable: true });
    Object.defineProperty(element, 'scrollHeight', { value: size, configurable: true });
    Object.defineProperty(element, 'clientHeight', { value: client, configurable: true });
  }

  it('scrolls with the wheel and a middle drag and marks hidden content', () => {
    const ref = vi.fn();
    const { rerender } = render(
      <ScrollStrip ref={ref} aria-label="Tools">
        <span>Wide</span>
      </ScrollStrip>,
    );
    const strip = screen.getByLabelText('Tools');
    overflow(strip, 300, 100);
    expect(ref).toHaveBeenCalledWith(strip);

    fireEvent.wheel(strip, { deltaY: 60 });
    expect(strip.scrollLeft).toBe(60);
    expect(strip.dataset['more']).toBe('both');
    fireEvent.wheel(strip, { deltaX: 500, deltaY: 0 });
    expect(strip.scrollLeft).toBe(200);
    expect(strip.dataset['more']).toBe('start');
    fireEvent.wheel(strip, { deltaY: 10, ctrlKey: true });
    expect(strip.scrollLeft).toBe(200);

    fireEvent.pointerDown(strip, { button: 1, clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(strip, { clientX: 250, pointerId: 1 });
    expect(strip.scrollLeft).toBe(50);
    fireEvent.pointerUp(strip, { pointerId: 1 });
    fireEvent.pointerMove(strip, { clientX: 0, pointerId: 1 });
    expect(strip.scrollLeft).toBe(50);
    fireEvent.scroll(strip);

    const objectRef = { current: null as HTMLDivElement | null };
    rerender(
      <ScrollStrip ref={objectRef} orientation="vertical" aria-label="Tools">
        <span>Tall</span>
      </ScrollStrip>,
    );
    const column = screen.getByLabelText('Tools');
    expect(objectRef.current).toBe(column);
    overflow(column, 300, 100);
    fireEvent.wheel(column, { deltaY: 40 });
    expect(column.scrollTop).toBe(40);
    fireEvent.pointerDown(column, { button: 1, clientY: 100, pointerId: 2 });
    fireEvent.pointerMove(column, { clientY: 80, pointerId: 2 });
    expect(column.scrollTop).toBe(60);
    fireEvent.pointerCancel(column, { pointerId: 2 });
    overflow(column, 100, 100);
    fireEvent.wheel(column, { deltaY: 40 });
    expect(column.scrollTop).toBe(60);
  });
});
