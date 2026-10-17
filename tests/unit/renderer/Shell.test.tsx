import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '@renderer/App';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

let api: FakeApi;

function at<T>(items: T[], index: number): T {
  const item = items[index];
  if (!item) throw new Error(`Missing item ${String(index)}`);
  return item;
}

function areas(): HTMLElement[] {
  return screen.getAllByRole('region').filter((element) => element.hasAttribute('data-area-id'));
}

async function findAreas(): Promise<HTMLElement[]> {
  await screen.findAllByRole('region');
  return areas();
}

function rect(width: number, height: number): DOMRect {
  return {
    left: 0,
    top: 0,
    width,
    height,
    right: width,
    bottom: height,
    x: 0,
    y: 0,
    toJSON: () => undefined,
  };
}

beforeEach(async () => {
  api = await bootTestApp();
  const project = makeProject('Space Game');
  api.projects = [project];
  api.current = project;
  api.emitProject();
});

describe('AppShell', () => {
  it('shows the menus, workspace tabs and the areas of the active workspace', async () => {
    render(<App />);

    expect(screen.getByRole('menuitem', { name: 'File' })).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: 'Planning' })).toHaveAttribute('aria-selected', 'true');
    expect(await findAreas()).toHaveLength(2);
    expect(screen.getByText('Project: Space Game')).toBeInTheDocument();
  });

  it('switches workspaces from the tabs and adds one from the menu', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('tab', { name: 'Design' }));
    expect(screen.getByRole('tab', { name: 'Design' })).toHaveAttribute('aria-selected', 'true');

    await user.click(screen.getByRole('button', { name: 'Add workspace' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Empty' }));
    expect(screen.getByRole('tab', { name: 'Empty' })).toHaveAttribute('aria-selected', 'true');
    expect(areas()).toHaveLength(1);
  });

  it('splits an area from the area menu and changes its editor', async () => {
    const user = userEvent.setup();
    render(<App />);

    const first = at(await findAreas(), 0);
    await user.click(within(first).getByRole('button', { name: 'Area' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Split horizontally' }));
    expect(areas()).toHaveLength(3);

    await user.click(within(at(areas(), 0)).getByRole('button', { name: 'Editor type' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Properties' }));
    expect(screen.getByText('Nothing selected')).toBeInTheDocument();
  });

  it('splits an area by dragging a corner inwards and joins by dragging outwards', async () => {
    render(<App />);
    const area = at(await findAreas(), 0);
    const corner = at(within(area).getAllByRole('button', { name: 'Drag to split or join' }), 0);
    area.getBoundingClientRect = () => rect(400, 300);

    fireEvent.pointerDown(corner, { button: 0, clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(corner, { clientX: 120, clientY: 2, pointerId: 1 });
    expect(screen.getByText('Split vertically')).toBeInTheDocument();
    fireEvent.pointerUp(corner, { clientX: 120, clientY: 2, pointerId: 1 });
    expect(areas()).toHaveLength(3);

    const middle = at(areas(), 1);
    const leftCorner = at(within(middle).getAllByRole('button', { name: 'Drag to split or join' }), 0);
    fireEvent.pointerDown(leftCorner, { button: 0, clientX: 130, clientY: 0, pointerId: 2 });
    fireEvent.pointerMove(leftCorner, { clientX: 60, clientY: 1, pointerId: 2 });
    expect(screen.getByText('Join')).toBeInTheDocument();
    fireEvent.pointerUp(leftCorner, { clientX: 60, clientY: 1, pointerId: 2 });
    expect(areas()).toHaveLength(2);
  });

  it('opens dialogs from the menus', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('menuitem', { name: 'Help' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Keyboard shortcuts' }));
    expect(await screen.findByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('menuitem', { name: 'Window' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Save layout…' }));
    await user.type(await screen.findByLabelText(/Layout name/), 'Mine');
    await user.click(screen.getByRole('button', { name: 'Save layout…' }));
    expect(api.saveLayout).toHaveBeenCalled();
  });
});
