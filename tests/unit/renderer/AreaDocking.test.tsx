import { act, fireEvent, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LayoutNode } from '@shared/layout';
import { AreaMoveHandle } from '@renderer/components/Shell/AreaMoveHandle';
import { TooltipProvider } from '@renderer/ui';
import {
  areaActions,
  bootWindows,
  detachArea,
  dockZoneAt,
  isDetachedWindow,
  returnToMainWindow,
  setHoveredArea,
  useActiveWorkspace,
  useAreaDrag,
} from '@renderer/lib/workspaces';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

let api: FakeApi;

function areasOf(node: LayoutNode): { id: string; editor: string }[] {
  return node.kind === 'area' ? [node] : node.children.flatMap(areasOf);
}

function activeRoot(): LayoutNode {
  const root = renderHook(() => useActiveWorkspace()).result.current?.root;
  if (!root) throw new Error('No workspace');
  return root;
}

function areaElement(id: string, left: number, top: number, width: number, height: number): HTMLElement {
  const element = document.createElement('div');
  element.dataset['areaId'] = id;
  element.getBoundingClientRect = () => ({
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => undefined,
  });
  document.body.append(element);
  return element;
}

beforeEach(async () => {
  api = await bootTestApp();
  const project = makeProject('Space Game');
  api.current = project;
  api.emitProject();
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('dock zones', () => {
  it('picks the nearest edge, the centre, the outside or nothing', () => {
    const target = areaElement('target', 0, 0, 400, 400);
    const source = areaElement('source', 400, 0, 400, 400);
    const spy = vi.spyOn(document, 'elementsFromPoint');

    spy.mockReturnValue([target]);
    expect(dockZoneAt(20, 200, 'source')).toEqual({ targetId: 'target', zone: 'left' });
    expect(dockZoneAt(380, 200, 'source')).toEqual({ targetId: 'target', zone: 'right' });
    expect(dockZoneAt(200, 20, 'source')).toEqual({ targetId: 'target', zone: 'top' });
    expect(dockZoneAt(200, 380, 'source')).toEqual({ targetId: 'target', zone: 'bottom' });
    expect(dockZoneAt(200, 200, 'source')).toEqual({ targetId: 'target', zone: 'centre' });

    spy.mockReturnValue([source]);
    expect(dockZoneAt(500, 200, 'source')).toEqual({ targetId: null, zone: null });
    spy.mockReturnValue([document.body]);
    expect(dockZoneAt(500, 200, 'source')).toEqual({ targetId: null, zone: null });
    expect(dockZoneAt(-5, 200, 'source')).toEqual({ targetId: null, zone: 'outside' });
    expect(dockZoneAt(200, window.innerHeight + 5, 'source')).toEqual({ targetId: null, zone: 'outside' });

    const flat = areaElement('flat', 0, 0, 0, 0);
    spy.mockReturnValue([flat]);
    expect(dockZoneAt(0, 0, 'source')).toEqual({ targetId: 'flat', zone: 'centre' });
  });
});

describe('moving areas', () => {
  it('docks beside, swaps, takes out and receives areas', () => {
    const [tickets, ticket] = areasOf(activeRoot());
    if (!tickets || !ticket) throw new Error('Expected two areas');

    act(() => {
      areaActions.move(ticket.id, tickets.id, 'top');
    });
    let root = activeRoot();
    expect(root.kind === 'split' && root.direction).toBe('column');
    expect(areasOf(root).map((area) => area.id)).toEqual([ticket.id, tickets.id]);

    act(() => {
      areaActions.move(ticket.id, tickets.id, 'centre');
    });
    expect(areasOf(activeRoot()).map((area) => area.editor)).toEqual(['tickets', 'ticket']);

    const [first, second] = areasOf(activeRoot());
    if (!first || !second) throw new Error('Expected two areas');
    let taken: LayoutNode | null = null;
    act(() => {
      taken = areaActions.take(second.id);
    });
    expect(taken).toMatchObject({ id: second.id, editor: 'ticket' });
    expect(areasOf(activeRoot()).map((area) => area.id)).toEqual([first.id]);
    expect(areaActions.take('missing')).toBeNull();

    act(() => {
      areaActions.take(first.id);
    });
    root = activeRoot();
    expect(areasOf(root).map((area) => [area.id, area.editor])).toEqual([[first.id, 'empty']]);

    act(() => {
      setHoveredArea(first.id);
      areaActions.receive({ kind: 'area', id: 'back', editor: 'board', state: {} });
    });
    expect(areasOf(activeRoot()).map((area) => area.id)).toEqual([first.id, 'back']);
  });
});

describe('separate windows', () => {
  it('detaches an area into a new window and returns the window layout', async () => {
    const [, ticket] = areasOf(activeRoot());
    await act(() => detachArea(ticket?.id ?? '', { x: 1, y: 2, width: 300, height: 200 }));
    expect(api.detachArea).toHaveBeenCalledWith({
      layout: expect.objectContaining({ id: ticket?.id }) as unknown,
      x: 1,
      y: 2,
      width: 300,
      height: 200,
    });
    await act(() => detachArea('missing', { x: 0, y: 0, width: 10, height: 10 }));
    expect(api.detachArea).toHaveBeenCalledTimes(1);

    await act(() => returnToMainWindow());
    expect(api.returnLayout).toHaveBeenCalledWith(activeRoot());

    act(() => {
      api.emitLayoutReturned({ kind: 'area', id: 'home', editor: 'colours', state: {} });
    });
    expect(areasOf(activeRoot()).map((area) => area.id)).toContain('home');
    expect(isDetachedWindow()).toBe(false);
  });

  it('boots a detached window with only the layout it was given', async () => {
    api.detachedLayout = { kind: 'area', id: 'solo', editor: 'board', state: {} };
    await act(() => bootWindows(api));
    expect(isDetachedWindow()).toBe(true);
    expect(areasOf(activeRoot()).map((area) => area.id)).toEqual(['solo']);
  });
});

describe('area grip', () => {
  function renderGrip(id: string) {
    const host = areaElement(id, 400, 0, 400, 300);
    return render(
      <TooltipProvider>
        <AreaMoveHandle areaId={id} />
      </TooltipProvider>,
      { container: host },
    );
  }

  it('drags an area onto another to dock it, and out of the window to detach it', async () => {
    const [tickets, ticket] = areasOf(activeRoot());
    if (!tickets || !ticket) throw new Error('Expected two areas');
    const target = areaElement(tickets.id, 0, 0, 400, 300);
    vi.spyOn(document, 'elementsFromPoint').mockReturnValue([target]);
    const view = renderGrip(ticket.id);
    const grip = view.getByRole('button', { name: /Drag to move this area/ });
    const drag = renderHook(() => useAreaDrag());

    fireEvent.pointerDown(grip, { button: 2, clientX: 500, clientY: 10, pointerId: 9 });
    fireEvent.pointerMove(grip, { clientX: 20, clientY: 150, pointerId: 9 });
    drag.rerender();
    expect(drag.result.current).toBeNull();

    fireEvent.pointerDown(grip, { button: 0, clientX: 500, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(grip, { clientX: 501, clientY: 11, pointerId: 1 });
    fireEvent.pointerMove(grip, { clientX: 20, clientY: 150, pointerId: 2 });
    drag.rerender();
    expect(drag.result.current).toBeNull();
    fireEvent.pointerMove(grip, { clientX: 20, clientY: 150, pointerId: 1 });
    drag.rerender();
    expect(drag.result.current).toEqual({ sourceId: ticket.id, targetId: tickets.id, zone: 'left' });
    act(() => {
      fireEvent.pointerUp(grip, { clientX: 20, clientY: 150, pointerId: 1 });
    });
    drag.rerender();
    expect(drag.result.current).toBeNull();
    expect(areasOf(activeRoot()).map((area) => area.id)).toEqual([ticket.id, tickets.id]);

    fireEvent.pointerDown(grip, { button: 0, clientX: 500, clientY: 10, pointerId: 3 });
    fireEvent.pointerUp(grip, { clientX: 500, clientY: 10, pointerId: 3 });
    fireEvent.pointerDown(grip, { button: 0, clientX: 500, clientY: 10, pointerId: 4 });
    fireEvent.pointerMove(grip, { clientX: 20, clientY: 150, pointerId: 4 });
    fireEvent.pointerCancel(grip, { pointerId: 4 });
    expect(areasOf(activeRoot()).map((area) => area.id)).toEqual([ticket.id, tickets.id]);

    fireEvent.pointerDown(grip, { button: 0, clientX: 500, clientY: 10, pointerId: 5 });
    fireEvent.pointerMove(grip, { clientX: -40, clientY: 10, pointerId: 5 });
    await act(async () => {
      fireEvent.pointerUp(grip, { clientX: -40, clientY: 10, screenX: 900, screenY: 300, pointerId: 5 });
      await Promise.resolve();
    });
    expect(api.detachArea).toHaveBeenCalledWith(
      expect.objectContaining({ x: 860, y: 284, width: 400, height: 300 }),
    );
  });
});
