import { useState } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ColoursEditor } from '@renderer/components/editors/Colours/ColoursEditor';
import { AreaContext } from '@renderer/components/Shell/AreaContext';
import { syntheticPixels } from '@renderer/lib/colour';
import { createPalette } from '@renderer/lib/palettes';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import type * as ColourLib from '@renderer/lib/colour';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

vi.mock('@renderer/lib/colour', async (original) => {
  const actual = await original<typeof ColourLib>();
  const pixels = () =>
    actual.syntheticPixels(['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#101010', '#808080'], 24, 24);
  return {
    ...actual,
    loadPixels: vi.fn(() => Promise.resolve(pixels())),
    fetchPixels: vi.fn(() => Promise.resolve(pixels())),
  };
});

let api: FakeApi;

function first(items: HTMLElement[], index = 0): HTMLElement {
  const item = items[index];
  if (!item) throw new Error('missing element');
  return item;
}

function Harness({ initial = {} }: { initial?: Record<string, unknown> }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [state, setState] = useState<Record<string, unknown>>(initial);
  return (
    <TooltipProvider>
      <ToastProvider closeLabel="Dismiss" regionLabel="Notifications">
        <div ref={setSlot} />
        <AreaContext value={{ areaId: 'a', headerSlot: slot }}>
          <ColoursEditor
            areaId="a"
            state={state}
            setState={(patch) => {
              setState((current) => ({ ...current, ...patch }));
            }}
          />
        </AreaContext>
      </ToastProvider>
    </TooltipProvider>
  );
}

beforeEach(async () => {
  api = await bootTestApp();
  const project = makeProject('Space Game');
  api.projects = [project];
  api.current = project;
  api.emitProject();
  await act(async () => {
    await Promise.resolve();
  });
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:preview');
  globalThis.URL.revokeObjectURL = vi.fn();
});

describe('Colours image tab', () => {
  it('extracts a palette from a dropped image, saves it to assets and as a palette', async () => {
    const user = userEvent.setup();
    expect(syntheticPixels(['#ff0000'], 1, 1).width).toBe(1);
    render(<Harness initial={{ tab: 'image' }} />);
    const zone = await screen.findByTestId('image-drop');
    const file = new File([new Uint8Array([1, 2, 3])], 'hero.png', { type: 'image/png' });
    fireEvent.drop(zone, { dataTransfer: { files: [file], types: ['Files'] } });

    expect(await screen.findByRole('img', { name: 'Image preview' })).toBeInTheDocument();
    expect(api.importAssets).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('button', { name: /sample point/ })).toHaveLength(5);
    const list = () => within(screen.getByRole('list', { name: 'Palette' }));
    expect(list().getAllByRole('listitem')).toHaveLength(5);

    await user.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(list().getAllByRole('listitem')[0]).toHaveTextContent('#101010');

    const marker = first(screen.getAllByRole('button', { name: /sample point/ }), 0);
    fireEvent.pointerDown(marker, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(marker, { pointerId: 1, clientX: 5, clientY: 5 });
    fireEvent.pointerUp(marker, { pointerId: 1 });

    await user.click(screen.getByRole('button', { name: 'Save as palette' }));
    const name = await screen.findByRole('textbox', { name: 'Palette name' });
    expect(name).toHaveValue('hero');
    await user.type(name, '{Enter}');
    await vi.waitFor(() => {
      expect(api.createPalette).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'hero', source: 'image', harmony: 'custom' }) as object,
      );
    });
    expect(await screen.findByRole('button', { name: 'Select palette hero' })).toBeInTheDocument();
  });

  it('builds a gradient with a chosen stop count and applies colours to the selected palette', async () => {
    const user = userEvent.setup();
    const palette = await createPalette({ name: 'Target', colours: [{ hex: '#123456' }] });
    api.assetsData.pickQueue.push([{ name: 'pick.png', mime: 'image/png', bytes: new Uint8Array([1]) }]);
    render(<Harness initial={{ tab: 'image', paletteId: palette.id }} />);

    await user.click(await screen.findByRole('button', { name: 'Choose file…' }));
    expect(await screen.findByRole('img', { name: 'Image preview' })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Gradient' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Gradient stops' }), { target: { value: '3' } });
    expect(within(screen.getByRole('list', { name: 'Palette' })).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText(/linear-gradient\(90deg/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Apply to Target' }));
    await vi.waitFor(() => {
      expect(api.updatePalette).toHaveBeenCalledWith(
        palette.id,
        expect.objectContaining({ harmony: 'custom' }) as object,
      );
    });

    await user.click(screen.getByRole('radio', { name: 'From image' }));
    await user.click(screen.getByRole('button', { name: 'From assets' }));
    await user.click(await screen.findByRole('menuitem', { name: 'pick.png' }));
    expect(await screen.findByRole('img', { name: 'Image preview' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear image' }));
    expect(screen.getByText('Drop an image here')).toBeInTheDocument();

    const zone = screen.getByTestId('image-drop');
    fireEvent.drop(zone, {
      dataTransfer: { files: [new File(['x'], 'notes.txt', { type: 'text/plain' })], types: ['Files'] },
    });
    expect(await screen.findByText('Only image files can be dropped here.')).toBeInTheDocument();
  });
});
