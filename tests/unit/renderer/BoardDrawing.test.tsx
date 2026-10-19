import { useState, type ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoardChanges, BoardNode } from '@shared/board';
import { presetSettings } from '@shared/brushes';
import { BoardEditor } from '@renderer/components/editors/Board/BoardEditor';
import { BrushesEditor } from '@renderer/components/editors/Brushes/BrushesEditor';
import { LayersEditor } from '@renderer/components/editors/Layers/LayersEditor';
import { PropertiesEditor } from '@renderer/components/editors/Properties/PropertiesEditor';
import { AreaContext } from '@renderer/components/Shell/AreaContext';
import {
  commitChanges,
  createBoard,
  getBoardNodes,
  loadBoard,
  setActiveBoard,
  setBoardSelection,
} from '@renderer/lib/board';
import { getBrushState, newLayer } from '@renderer/lib/drawing';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';
import { elementPixels, encodeTile, inked, installCanvasFake } from './helpers/canvas-fake';

let api: FakeApi;
let canvas: ReturnType<typeof installCanvasFake>;
let latest: Record<string, unknown> = {};
let patches: Record<string, unknown>[] = [];

function Providers({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider>
      <ToastProvider closeLabel="Dismiss" regionLabel="Notifications">
        {children}
      </ToastProvider>
    </TooltipProvider>
  );
}

function Board({ initial = {} }: { initial?: Record<string, unknown> }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [state, setState] = useState<Record<string, unknown>>(initial);
  latest = state;
  return (
    <Providers>
      <div ref={setSlot} />
      <AreaContext value={{ areaId: 'a', headerSlot: slot }}>
        <BoardEditor
          areaId="a"
          state={state}
          setState={(patch) => {
            patches.push(patch);
            setState((current) => ({ ...current, ...patch }));
          }}
        />
      </AreaContext>
    </Providers>
  );
}

function lastChange(): BoardChanges {
  return vi.mocked(api.applyBoardChanges).mock.calls.at(-1)?.[1] ?? {};
}

function paintCommits(): number {
  return vi
    .mocked(api.applyBoardChanges)
    .mock.calls.filter(
      ([, changes]) => (changes.upsertTiles?.length ?? 0) + (changes.removeTiles?.length ?? 0) > 0,
    ).length;
}

function drawings(): BoardNode[] {
  return getBoardNodes('board-1').filter((node) => node.type === 'drawing');
}

async function stroke(target: HTMLElement, from: [number, number], to: [number, number], extra = {}) {
  fireEvent.pointerDown(target, {
    button: 0,
    buttons: 1,
    clientX: from[0],
    clientY: from[1],
    pointerId: 1,
    ...extra,
  });
  fireEvent.pointerMove(target, {
    buttons: 1,
    clientX: (from[0] + to[0]) / 2,
    clientY: (from[1] + to[1]) / 2,
    pointerId: 1,
  });
  fireEvent.pointerMove(target, { buttons: 1, clientX: to[0], clientY: to[1], pointerId: 1 });
  act(() => {
    canvas.frames();
  });
  fireEvent.pointerUp(target, { clientX: to[0], clientY: to[1], pointerId: 1 });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function storedDrawing(boardId: string, name = 'Sketch'): Promise<BoardNode> {
  const layer = { ...newLayer({ boardId, name, z: 1, at: { x: 0, y: 0 } }), width: 256, height: 256 };
  layer.data = { ...layer.data, offsetX: 0, offsetY: 0 };
  await commitChanges(boardId, {
    upsertNodes: [layer],
    upsertTiles: [
      {
        nodeId: layer.id,
        tx: 0,
        ty: 0,
        bytes: encodeTile((context) => {
          context.fillStyle = '#ff0000';
          context.fillRect(0, 0, 100, 100);
        }),
      },
    ],
  });
  return layer;
}

async function paintedTile() {
  await waitFor(() => {
    const tile = screen.getByTestId('drawing-layer').querySelector('canvas');
    expect(tile && inked(elementPixels(tile))).toBeGreaterThan(0);
  });
}

beforeEach(async () => {
  canvas = installCanvasFake();
  patches = [];
  api = await bootTestApp();
  const project = makeProject('Space Game');
  api.current = project;
  api.emitProject();
  await act(async () => {
    await Promise.resolve();
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('drawing on the board', () => {
  it('creates a layer on the first stroke, reuses it and returns to select on Escape', async () => {
    const user = userEvent.setup();
    await createBoard({ name: 'Ideas' });
    render(<Board />);
    await user.click(await screen.findByRole('button', { name: 'Brush (B)' }));
    expect(latest['tool']).toBe('brush');
    expect(screen.getByRole('toolbar', { name: 'Brush options' })).toBeInTheDocument();
    const overlay = screen.getByTestId('drawing-overlay');

    await stroke(overlay, [40, 40], [160, 60]);
    await waitFor(() => {
      expect(paintCommits()).toBe(1);
    });
    const [layer] = drawings();
    expect(layer?.data).toMatchObject({ name: 'Drawing 1' });
    expect(latest['drawingLayer']).toBe(layer?.id);
    expect(await screen.findByTestId('drawing-layer')).toHaveAttribute('data-tiles', '1');
    await paintedTile();

    await stroke(overlay, [40, 120], [160, 120]);
    await waitFor(() => {
      expect(paintCommits()).toBe(2);
    });
    expect(drawings()).toHaveLength(1);

    fireEvent.keyDown(overlay, { key: 'Escape' });
    expect(latest['tool']).toBe('select');
  });

  it('keeps the browser from starting a native drag mid-stroke', async () => {
    await createBoard({ name: 'Ideas' });
    render(<Board initial={{ tool: 'brush' }} />);
    const overlay = await screen.findByTestId('drawing-overlay');
    expect(fireEvent.pointerDown(overlay, { button: 0, buttons: 1, pointerId: 7 })).toBe(false);
    expect(fireEvent.dragStart(overlay)).toBe(false);
    fireEvent.pointerUp(overlay, { pointerId: 7 });
    expect(fireEvent.pointerDown(overlay, { button: 2, buttons: 2, pointerId: 8 })).toBe(true);
  });

  it('erases with the eraser tool or the pen eraser and does nothing without a layer', async () => {
    const user = userEvent.setup();
    const board = await createBoard({ name: 'Ideas' });
    render(<Board />);
    await user.click(await screen.findByRole('button', { name: 'Eraser (E)' }));
    await stroke(screen.getByTestId('drawing-overlay'), [10, 10], [50, 10]);
    expect(drawings()).toHaveLength(0);

    const layer = await storedDrawing(board.id);
    await paintedTile();
    await stroke(screen.getByTestId('drawing-overlay'), [0, 0], [60, 60]);
    await waitFor(() => {
      expect(paintCommits()).toBe(2);
    });
    expect(lastChange().upsertTiles?.[0]?.nodeId).toBe(layer.id);

    await user.click(screen.getByRole('button', { name: 'Brush (B)' }));
    await stroke(screen.getByTestId('drawing-overlay'), [0, 20], [60, 20], { button: 5, buttons: 32 });
    await waitFor(() => {
      expect(paintCommits()).toBe(3);
    });
    expect(drawings()).toHaveLength(1);
  });

  it('pans with the middle button, changes size with brackets and picks colours with Alt', async () => {
    const board = await createBoard({ name: 'Ideas' });
    await loadBoard(board.id);
    await storedDrawing(board.id);
    render(<Board initial={{ tool: 'brush' }} />);
    const overlay = await screen.findByTestId('drawing-overlay');
    await paintedTile();
    fireEvent.pointerDown(overlay, { button: 0, altKey: true, clientX: 20, clientY: 20, pointerId: 4 });
    expect(getBrushState().colour.hex).toBe('#ff0000');
    fireEvent.pointerDown(overlay, { button: 0, altKey: true, clientX: 200, clientY: 200, pointerId: 4 });
    expect(getBrushState().colour.hex).toBe('#ff0000');
    fireEvent.pointerDown(overlay, { button: 1, clientX: 0, clientY: 0, pointerId: 2 });
    fireEvent.pointerMove(overlay, { clientX: 30, clientY: 10, pointerId: 2 });
    fireEvent.pointerUp(overlay, { clientX: 30, clientY: 10, pointerId: 2 });
    fireEvent.wheel(overlay, { deltaY: 100, clientX: 10, clientY: 10 });
    fireEvent.pointerDown(overlay, { button: 2, clientX: 0, clientY: 0, pointerId: 3 });
    expect(paintCommits()).toBe(1);

    fireEvent.keyDown(overlay, { key: ']' });
    expect(getBrushState().brush.settings.size).toBeCloseTo(4.6);
    fireEvent.keyDown(overlay, { key: '[' });
    expect(getBrushState().brush.settings.size).toBeCloseTo(4);

    expect(paintCommits()).toBe(1);
  });

  it('pans once per frame with the cursor following and saves the view once', async () => {
    await createBoard({ name: 'Ideas' });
    const { container } = render(<Board initial={{ tool: 'brush' }} />);
    const overlay = await screen.findByTestId('drawing-overlay');
    const ring = overlay.querySelector<HTMLElement>('[aria-hidden="true"]');
    const viewport = () =>
      container.querySelector<HTMLElement>('.react-flow__viewport')?.style.transform ?? '';
    const before = viewport();
    const saves = () => patches.filter((patch) => 'viewport' in patch);

    fireEvent.pointerDown(overlay, { button: 1, buttons: 4, clientX: 100, clientY: 100, pointerId: 2 });
    expect(overlay).toHaveAttribute('data-panning');
    for (const [x, y] of [
      [110, 105],
      [130, 120],
      [150, 140],
    ] as const) {
      fireEvent.pointerMove(overlay, { buttons: 4, clientX: x, clientY: y, pointerId: 2 });
    }
    expect(viewport()).toBe(before);
    act(() => {
      canvas.frames();
    });
    expect(ring?.style.transform).toBe('translate(150px, 140px)');
    expect(viewport()).toContain('translate(50px,40px)');

    fireEvent.pointerMove(overlay, { buttons: 4, clientX: 160, clientY: 150, pointerId: 2 });
    fireEvent.pointerUp(overlay, { clientX: 170, clientY: 160, pointerId: 2 });
    expect(overlay).not.toHaveAttribute('data-panning');
    expect(viewport()).toContain('translate(70px,60px)');
    await waitFor(() => {
      expect(saves()).toHaveLength(1);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
    });
    expect(saves()).toEqual([{ viewport: { x: 70, y: 60, zoom: 1 } }]);
  });

  it('measures the overlay once per hover and moves the ring once per frame', async () => {
    await createBoard({ name: 'Ideas' });
    render(<Board initial={{ tool: 'brush' }} />);
    const overlay = await screen.findByTestId('drawing-overlay');
    const ring = overlay.querySelector<HTMLElement>('[aria-hidden="true"]');
    const measure = vi.spyOn(overlay, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 20, 800, 600));
    const root = document.querySelector<HTMLElement>('.react-flow');
    if (!root) throw new Error('missing canvas');
    const rootMeasure = vi.spyOn(root, 'getBoundingClientRect');
    fireEvent.pointerEnter(overlay, { clientX: 50, clientY: 60 });
    for (let step = 0; step < 6; step += 1) {
      fireEvent.pointerMove(overlay, { clientX: 50 + step * 10, clientY: 60, pointerId: 1 });
    }
    expect(ring?.style.transform).toBe('');
    expect(rootMeasure).not.toHaveBeenCalled();
    act(() => {
      canvas.frames();
    });
    expect(ring?.style.transform).toBe('translate(90px, 40px)');
    await stroke(overlay, [40, 40], [160, 60]);
    expect(measure).toHaveBeenCalledTimes(2);
    await waitFor(() => {
      expect(paintCommits()).toBe(1);
    });
  });

  it('shows new paint on a zoomed out tile in the same frame', async () => {
    const board = await createBoard({ name: 'Ideas' });
    await loadBoard(board.id);
    const layer = await storedDrawing(board.id);
    render(
      <Board initial={{ tool: 'brush', drawingLayer: layer.id, viewport: { x: 0, y: 0, zoom: 0.25 } }} />,
    );
    await paintedTile();
    const tile = screen.getByTestId('drawing-layer').querySelector('canvas');
    if (!tile) throw new Error('missing tile');
    const before = inked(elementPixels(tile));
    const overlay = screen.getByTestId('drawing-overlay');
    fireEvent.pointerDown(overlay, { button: 0, buttons: 1, clientX: 40, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(overlay, { buttons: 1, clientX: 60, clientY: 10, pointerId: 1 });
    act(() => {
      canvas.frames();
    });
    expect(inked(elementPixels(tile))).toBeGreaterThan(before);
    fireEvent.pointerUp(overlay, { clientX: 60, clientY: 10, pointerId: 1 });
    await waitFor(() => {
      expect(paintCommits()).toBe(2);
    });
    expect(drawings()).toHaveLength(1);
  });

  it('edits the brush from the options bar', async () => {
    const user = userEvent.setup();
    await createBoard({ name: 'Ideas' });
    render(<Board initial={{ tool: 'brush' }} />);
    await user.click(await screen.findByRole('button', { name: 'Brush settings' }));
    const options = screen.getByRole('toolbar', { name: 'Brush options' });
    const opacity = within(options).getByLabelText('Opacity');
    await user.clear(opacity);
    await user.type(opacity, '50{Enter}');
    expect(getBrushState().brush.settings.opacity).toBe(0.5);
    await user.click(within(options).getByRole('combobox', { name: 'Preset' }));
    await user.click(await screen.findByRole('option', { name: 'Marker' }, { timeout: 4000 }));
    expect(getBrushState().brush.preset).toBe('marker');
  });

  it('lets the select tool grab a drawing only where it is painted', async () => {
    const board = await createBoard({ name: 'Ideas' });
    await loadBoard(board.id);
    const layer = await storedDrawing(board.id);
    const { container } = render(<Board />);
    await paintedTile();
    const surface = container.querySelector<HTMLElement>('[data-tool]');
    const node = () => container.querySelector<HTMLElement>(`.react-flow__node[data-id="${layer.id}"]`);
    if (!surface) throw new Error('missing surface');
    expect(node()?.style.pointerEvents).toBe('none');
    fireEvent.pointerMove(surface, { clientX: 20, clientY: 20 });
    expect(node()?.style.pointerEvents).not.toBe('none');
    fireEvent.pointerMove(surface, { clientX: 200, clientY: 200 });
    expect(node()?.style.pointerEvents).toBe('none');
  });
});

describe('drawing panels', () => {
  it('lists drawings in Layers and shows their own section in Properties', async () => {
    const user = userEvent.setup();
    const board = await createBoard({ name: 'Ideas' });
    await loadBoard(board.id);
    setActiveBoard(board.id);
    const layer = await storedDrawing(board.id, '');
    render(
      <Providers>
        <LayersEditor areaId="l" state={{}} setState={() => undefined} />
        <PropertiesEditor areaId="p" state={{}} setState={() => undefined} />
      </Providers>,
    );
    expect(await screen.findByText('Drawing')).toBeInTheDocument();
    act(() => {
      setBoardSelection(board.id, [layer.id]);
    });
    expect(await screen.findByRole('heading', { name: 'Drawing' })).toBeInTheDocument();
    expect(screen.getByText('1 tile')).toBeInTheDocument();
    expect(screen.getByText('2× board pixels')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Width/)).toBeDisabled();
    expect(screen.getByLabelText(/^Rotation/)).toBeDisabled();
    const opacity = screen.getByLabelText('Opacity');
    await user.clear(opacity);
    await user.type(opacity, '40{Enter}');
    expect(lastChange().upsertNodes?.[0]?.data['style']).toEqual({ opacity: 0.4 });
  });

  it('edits brushes, presets and the eraser in the Brushes editor', async () => {
    const user = userEvent.setup();
    const setState = vi.fn();
    const { rerender } = render(
      <Providers>
        <BrushesEditor areaId="b" state={{}} setState={setState} />
      </Providers>,
    );
    expect(screen.getByRole('img', { name: 'Stroke preview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset to preset' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /Pencil/ }));
    expect(getBrushState().brush.preset).toBe('pencil');
    expect(screen.getByRole('button', { name: /Pencil/ })).toHaveAttribute('aria-pressed', 'true');

    const hardness = screen.getByLabelText('Hardness');
    await user.clear(hardness);
    await user.type(hardness, '20{Enter}');
    expect(getBrushState().brush.settings.hardness).toBe(0.2);
    const scatter = screen.getByLabelText('Scatter');
    await user.clear(scatter);
    await user.type(scatter, '150{Enter}');
    expect(getBrushState().brush.settings.scatter.amount).toBe(1.5);
    await user.click(screen.getByRole('combobox', { name: 'Grain' }));
    await user.click(await screen.findByRole('option', { name: 'None' }));
    expect(getBrushState().brush.settings.grain).toBe('none');
    expect(screen.getByLabelText('Grain depth')).toBeDisabled();
    await user.click(screen.getByRole('combobox', { name: 'Tip shape' }));
    await user.click(await screen.findByRole('option', { name: 'Square' }));
    expect(getBrushState().brush.settings.tip).toBe('square');

    await user.click(screen.getByRole('button', { name: 'Reset to preset' }));
    expect(getBrushState().brush.settings).toEqual(presetSettings('pencil'));

    await user.click(screen.getByRole('radio', { name: 'Eraser' }));
    expect(setState).toHaveBeenCalledWith({ tool: 'eraser' });
    rerender(
      <Providers>
        <BrushesEditor areaId="b" state={{ tool: 'eraser' }} setState={setState} />
      </Providers>,
    );
    expect(screen.getByRole('button', { name: /Soft eraser/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pencil/ })).not.toBeInTheDocument();
  });
});
