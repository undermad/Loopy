import { useState } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ColoursEditor } from '@renderer/components/editors/Colours/ColoursEditor';
import { AreaContext } from '@renderer/components/Shell/AreaContext';
import { contrastRatio, harmonyColours, hexToHsv, toWheelHue } from '@renderer/lib/colour';
import { createPalette } from '@renderer/lib/palettes';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

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

async function triadPalette(name = 'Sea') {
  return createPalette({
    name,
    harmony: 'triad',
    colours: harmonyColours('#2266aa', 'triad').map((hex) => ({ hex })),
  });
}

const hexField = (index: number) => screen.getByRole('textbox', { name: `Hex of colour ${String(index)}` });
const hexValue = (index: number) => (hexField(index) as HTMLInputElement).value;

beforeEach(async () => {
  api = await bootTestApp();
  const project = makeProject('Space Game');
  api.current = project;
  api.emitProject();
  await act(async () => {
    await Promise.resolve();
  });
});

describe('ColoursEditor', () => {
  it('starts an unsaved palette, shows it live in the list and saves it on request', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(await screen.findByText('No palettes yet')).toBeInTheDocument();
    await user.click(first(screen.getAllByRole('button', { name: 'New palette' }), 1));

    expect(await screen.findByRole('button', { name: 'Select palette Palette 1' })).toBeInTheDocument();
    expect(screen.getByText('Unsaved')).toBeInTheDocument();
    expect(api.createPalette).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save palette' })).toBeInTheDocument();

    const name = screen.getByRole('textbox', { name: 'Palette name' });
    await user.clear(name);
    await user.type(name, 'Dawn');
    expect(screen.getByRole('button', { name: 'Select palette Dawn' })).toBeInTheDocument();

    const before = hexValue(1);
    await user.clear(hexField(1));
    await user.type(hexField(1), '#ff0000{Enter}');
    expect(hexField(1)).toHaveValue('#ff0000');
    expect(before).not.toBe('#ff0000');
    const styles = Array.from(
      screen.getByRole('button', { name: 'Select palette Dawn' }).querySelectorAll('span[style]'),
    ).map((span) => span.getAttribute('style') ?? '');
    expect(styles.some((style) => /#ff0000|rgb\(255, 0, 0\)/.test(style))).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Save palette' }));
    await vi.waitFor(() => {
      expect(api.createPalette).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Dawn', harmony: 'analogous' }) as object,
      );
    });
    expect(await screen.findByRole('button', { name: 'Modify' })).toBeInTheDocument();
    expect(screen.queryByText('Unsaved')).not.toBeInTheDocument();
  });

  it('keeps stored palettes read-only until Modify and rotates the harmony as colours move', async () => {
    const user = userEvent.setup();
    const palette = await triadPalette();
    render(<Harness initial={{ paletteId: palette.id }} />);

    expect(await screen.findByRole('button', { name: 'Modify' })).toBeInTheDocument();
    expect(hexField(1)).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Colour harmony' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Modify' }));
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
    expect(screen.getByText('Unsaved')).toBeInTheDocument();
    expect(hexField(1)).toBeEnabled();

    const baseBefore = hexValue(1);
    await user.clear(hexField(2));
    await user.type(hexField(2), '#ff0000{Enter}');
    expect(hexField(2)).toHaveValue('#ff0000');
    const baseAfter = hexValue(1);
    expect(baseAfter).not.toBe(baseBefore);
    const delta = toWheelHue(hexToHsv(baseAfter).h) - toWheelHue(hexToHsv('#ff0000').h);
    expect(((delta % 360) + 360) % 360).toBeCloseTo(120, 0);
    expect(api.updatePalette).not.toHaveBeenCalled();

    await user.click(screen.getByRole('combobox', { name: 'Colour harmony' }));
    await user.click(await screen.findByRole('option', { name: 'Complementary' }));
    expect(hexField(2)).toHaveValue(harmonyColours(baseAfter, 'complementary')[1] ?? '');

    const radios = screen.getAllByRole('radio', { name: 'Set as base colour' });
    await user.click(first(radios, 1));
    expect(first(screen.getAllByRole('radio', { name: 'Set as base colour' }), 1)).toBeChecked();

    const beforeRandom = hexValue(1);
    await user.click(screen.getByRole('button', { name: 'Random palette' }));
    expect(hexField(1)).not.toHaveValue(beforeRandom);

    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await vi.waitFor(() => {
      expect(api.updatePalette).toHaveBeenCalledWith(
        palette.id,
        expect.objectContaining({ harmony: 'complementary', baseIndex: 1 }) as object,
      );
    });
    expect(await screen.findByRole('button', { name: 'Modify' })).toBeInTheDocument();
  });

  it('discards a modification with Cancel and an unsaved palette from the list', async () => {
    const user = userEvent.setup();
    const palette = await triadPalette();
    render(<Harness initial={{ paletteId: palette.id }} />);
    await user.click(await screen.findByRole('button', { name: 'Modify' }));
    await user.clear(hexField(1));
    await user.type(hexField(1), '#000000{Enter}');
    expect(hexField(1)).toHaveValue('#000000');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(hexField(1)).toHaveValue(palette.colours[0]?.hex ?? '');
    expect(api.updatePalette).not.toHaveBeenCalled();

    await user.click(first(screen.getAllByRole('button', { name: 'New palette' }), 0));
    await user.click(await screen.findByRole('menuitem', { name: 'New palette' }));
    expect(await screen.findByText('Unsaved')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Discard unsaved palette' }));
    expect(screen.queryByText('Unsaved')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select palette Sea' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('edits a custom palette with add, remove, names, keyboard and brightness', async () => {
    const user = userEvent.setup();
    const palette = await createPalette({
      name: 'Custom',
      harmony: 'custom',
      colours: [{ hex: '#111111' }, { hex: '#222222' }],
    });
    render(<Harness initial={{ paletteId: palette.id }} />);
    await user.click(await screen.findByRole('button', { name: 'Modify' }));

    await user.click(screen.getByRole('button', { name: 'Add colour' }));
    expect(screen.getAllByRole('textbox', { name: /Hex of colour/ })).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Remove colour 1' }));
    expect(screen.getAllByRole('textbox', { name: /Hex of colour/ })).toHaveLength(2);

    await user.type(screen.getByRole('textbox', { name: 'Name of colour 1' }), 'Ink');
    expect(screen.getByRole('button', { name: '1: Ink' })).toBeInTheDocument();

    const marker = screen.getByRole('button', { name: 'Colour 2 marker' });
    const before = hexValue(2);
    marker.focus();
    await user.keyboard('{ArrowRight}');
    fireEvent.pointerDown(marker, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(marker, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(marker, { pointerId: 1, clientX: 10, clientY: 10 });

    fireEvent.change(screen.getByRole('slider', { name: 'Brightness' }), { target: { value: '50' } });
    expect(hexField(2)).not.toHaveValue(before);
    await user.click(screen.getByRole('button', { name: 'Random palette' }));
    expect(screen.getAllByRole('textbox', { name: /Hex of colour/ })).toHaveLength(2);
    await user.click(first(screen.getAllByRole('button', { name: 'Copy hex' })));
    expect(await screen.findByText(/Copied #/)).toBeInTheDocument();
  });

  it('renames, duplicates and deletes palettes from the list', async () => {
    const user = userEvent.setup();
    const palette = await triadPalette('First');
    await triadPalette('Second');
    render(<Harness initial={{ paletteId: palette.id }} />);

    const item = (await screen.findByRole('button', { name: 'Select palette First' })).closest('li');
    if (!item) throw new Error('missing item');
    await user.click(within(item).getByRole('button', { name: 'Palette menu' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Rename palette' }));
    const name = await screen.findByRole('textbox', { name: 'Palette name' });
    await user.clear(name);
    await user.type(name, 'Renamed{Enter}');
    expect(await screen.findByRole('button', { name: 'Select palette Renamed' })).toBeInTheDocument();

    await user.click(within(item).getByRole('button', { name: 'Palette menu' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Duplicate palette' }));
    expect(await screen.findByRole('button', { name: 'Select palette Renamed copy' })).toBeInTheDocument();

    await user.click(within(item).getByRole('button', { name: 'Palette menu' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete palette' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await vi.waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Select palette Renamed' })).not.toBeInTheDocument();
    });

    await user.type(screen.getByRole('searchbox', { name: 'Search palettes' }), 'zzz');
    expect(screen.getByText('No palettes match')).toBeInTheDocument();
  });

  it('checks contrast against colours and whole palettes with the swatch picker and eyedropper', async () => {
    const user = userEvent.setup();
    await triadPalette('Sea');
    vi.mocked(api.pickScreenColour).mockResolvedValueOnce('#123456');
    render(<Harness initial={{ tab: 'contrast' }} />);

    expect(await screen.findByText('21.00:1')).toBeInTheDocument();
    const draft = screen.getByRole('textbox', { name: 'Hex colour' });
    await user.clear(draft);
    await user.type(draft, '#777777{Enter}');
    await user.click(screen.getByRole('button', { name: 'Add colour' }));
    const ratio = `${contrastRatio('#000000', '#777777').toFixed(2)}:1`;
    expect(await screen.findByText(ratio)).toBeInTheDocument();
    expect(screen.getAllByText('AAA text: Fail').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Add whole palette' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Sea' }));
    expect(within(screen.getByRole('list', { name: 'Check against' })).getAllByRole('listitem')).toHaveLength(
      7,
    );

    await user.click(screen.getByRole('button', { name: 'Remove #777777' }));
    expect(screen.queryByText(ratio)).not.toBeInTheDocument();
    await user.click(first(screen.getAllByRole('button', { name: 'Use as source' }), 0));
    expect(screen.getByRole('textbox', { name: 'Source colour' })).toHaveValue('#ffffff');

    await user.click(first(screen.getAllByRole('button', { name: 'Pick from screen' }), 0));
    await vi.waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Source colour' })).toHaveValue('#123456');
    });

    await user.click(first(screen.getAllByRole('button', { name: 'Choose colour' }), 0));
    await user.click(await screen.findByRole('button', { name: 'Sea: #2266aa' }));
    expect(screen.getByRole('textbox', { name: 'Source colour' })).toHaveValue('#2266aa');
    await user.keyboard('{Escape}');

    await user.click(first(screen.getAllByRole('button', { name: 'From palette' }), 0));
    expect(await screen.findByRole('menuitem', { name: 'Sea' })).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(screen.getByText(/Add colours to compare/)).toBeInTheDocument();
  });

  it('adds presets from the explore tab as custom palettes', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ tab: 'explore' }} />);
    await user.type(await screen.findByRole('searchbox', { name: 'Search presets' }), 'sunset');
    const card = screen.getByRole('article', { name: 'Sunset drive' });
    await user.click(within(card).getByRole('button', { name: 'Add to project' }));
    expect(api.createPalette).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Sunset drive', source: 'preset', harmony: 'custom' }) as object,
    );
    expect(await screen.findByRole('button', { name: 'Select palette Sunset drive' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Modify' })).toBeInTheDocument();
  });

  it('switches tabs and hides the library', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(await screen.findByRole('radio', { name: 'Contrast' }));
    expect(screen.getByText('Source colour')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Palettes' }));
    expect(screen.queryByRole('complementary', { name: 'Palettes' })).not.toBeInTheDocument();
  });
});
