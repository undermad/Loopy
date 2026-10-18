import { useState } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ColoursEditor } from '@renderer/components/editors/Colours/ColoursEditor';
import { AreaContext } from '@renderer/components/Shell/AreaContext';
import { harmonyColours } from '@renderer/lib/colour';
import { createPalette } from '@renderer/lib/palettes';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

let api: FakeApi;

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

function palette(name: string, base: string, harmony: 'monochromatic' | 'triad' = 'monochromatic') {
  return createPalette({ name, harmony, colours: harmonyColours(base, harmony).map((hex) => ({ hex })) });
}

async function openPaletteMenu(user: ReturnType<typeof userEvent.setup>, name: string) {
  const item = (await screen.findByRole('button', { name: `Select palette ${name}` })).closest('li');
  if (!item) throw new Error('missing item');
  await user.click(within(item).getByRole('button', { name: 'Palette menu' }));
}

async function openClusterMenu(user: ReturnType<typeof userEvent.setup>, name: string) {
  const header = screen.getByRole('button', { name: `Show or hide ${name}` }).parentElement;
  if (!header) throw new Error('missing header');
  await user.click(within(header).getByRole('button', { name: 'Cluster menu' }));
}

async function chooseSubmenuItem(name: string) {
  fireEvent.click(await screen.findByRole('menuitem', { name }));
  await act(async () => {
    await Promise.resolve();
  });
}

function firstOf(items: HTMLElement[]): HTMLElement {
  const [item] = items;
  if (!item) throw new Error('missing element');
  return item;
}

const nameField = (index: number) =>
  screen.getByRole('textbox', { name: `Name of palette ${String(index)}` });

beforeEach(async () => {
  api = await bootTestApp();
  const project = makeProject('Space Game');
  api.current = project;
  api.emitProject();
  await act(async () => {
    await Promise.resolve();
  });
});

describe('palette clusters', () => {
  it('stays on the cluster tab when another palette is picked', async () => {
    const user = userEvent.setup();
    const fire = await palette('Fire', '#e2361b');
    await palette('Sea', '#1b6ee2');
    render(<Harness initial={{ tab: 'cluster', paletteId: fire.id }} />);
    expect(await screen.findByRole('heading', { name: 'Palette cluster' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Select palette Sea' }));
    expect(screen.getByRole('radio', { name: 'Cluster' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('heading', { name: 'Palette cluster' })).toBeInTheDocument();
  });

  it('asks for a seed when no saved palette is selected', async () => {
    render(<Harness initial={{ tab: 'cluster' }} />);
    expect(await screen.findByText('Select a seed palette')).toBeInTheDocument();
  });

  it('generates companion palettes from the seed and creates the cluster', async () => {
    const user = userEvent.setup();
    const fire = await palette('Fire', '#e2361b');
    render(<Harness initial={{ tab: 'cluster', paletteId: fire.id }} />);

    expect(await screen.findByRole('heading', { name: 'Palette cluster' })).toBeInTheDocument();
    expect(nameField(1)).toBeInTheDocument();
    expect(nameField(2)).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Name of palette 3' })).not.toBeInTheDocument();

    const count = screen.getByRole('spinbutton', { name: 'New palettes' });
    fireEvent.change(count, { target: { value: '3' } });
    fireEvent.blur(count);
    expect(nameField(3)).toBeInTheDocument();
    expect(
      screen.getByText('Complementary for one, triad for two, square for three, then evenly spaced.'),
    ).toBeInTheDocument();
    expect(screen.getByText('180° from the seed')).toBeInTheDocument();

    await user.clear(nameField(1));
    await user.type(nameField(1), 'Water');
    const third = (nameField(3) as HTMLInputElement).value;
    await user.click(screen.getByRole('switch', { name: `Include ${third}` }));
    fireEvent.change(screen.getByRole('slider', { name: 'Lightness balance' }), { target: { value: '0' } });
    expect(screen.getByText('Lightness balance · 0%')).toBeInTheDocument();

    const clusterName = screen.getByRole('textbox', { name: 'Cluster name' });
    await user.clear(clusterName);
    await user.type(clusterName, 'Magic');
    await user.click(screen.getByRole('button', { name: 'Create cluster' }));

    expect(api.createPaletteCluster).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Magic',
        paletteIds: [fire.id],
        palettes: [
          expect.objectContaining({ name: 'Water', harmony: 'monochromatic', source: 'wheel' }),
          expect.objectContaining({ harmony: 'monochromatic' }),
        ],
      }) as object,
    );
    expect(await screen.findByRole('button', { name: 'Show or hide Magic' })).toBeInTheDocument();
    const group = screen.getByRole('list', { name: 'Magic' });
    expect(within(group).getByRole('button', { name: 'Select palette Fire' })).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'Select palette Water' })).toBeInTheDocument();
    expect(await screen.findByText('Cluster "Magic" created with 3 palettes.')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Cluster' }));
    expect(await screen.findByText('Adding to Magic')).toBeInTheDocument();
    expect(screen.getByText('Already in the cluster')).toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: 'Hue scheme' }));
    await user.click(await screen.findByRole('option', { name: 'Fill the gaps' }));
    await user.click(screen.getByRole('button', { name: 'Add to cluster' }));
    const cluster = api.palettesData.clusters[0];
    await vi.waitFor(() => {
      expect(api.palettesData.palettes.filter((item) => item.clusterId === cluster?.id)).toHaveLength(6);
    });
  });

  it('turns a planned palette from the wheel, resets it and refuses an empty plan', async () => {
    const user = userEvent.setup();
    const fire = await palette('Fire', '#e2361b');
    render(
      <Harness
        initial={{ tab: 'cluster', paletteId: fire.id, cluster: { count: 1, scheme: 'complementary' } }}
      />,
    );

    expect(await screen.findByText('180° from the seed')).toBeInTheDocument();
    const marker = screen.getByRole('button', { name: 'Colour 2 marker' });
    marker.focus();
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');
    expect(screen.queryByText('180° from the seed')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reset hue' }));
    expect(screen.getByText('180° from the seed')).toBeInTheDocument();

    const name = (nameField(1) as HTMLInputElement).value;
    await user.click(screen.getByRole('switch', { name: `Include ${name}` }));
    expect(screen.getByRole('button', { name: 'Create cluster' })).toBeDisabled();
    expect(screen.getByText('Include at least one palette.')).toBeInTheDocument();
  });

  it('groups, moves, collapses, renames and deletes clusters from the library', async () => {
    const user = userEvent.setup();
    const sea = await palette('Sea', '#2266aa', 'triad');
    await palette('Sky', '#66aaff', 'triad');
    render(<Harness initial={{ paletteId: sea.id }} />);

    await openPaletteMenu(user, 'Sea');
    await user.click(await screen.findByRole('menuitem', { name: 'Move to cluster' }));
    await chooseSubmenuItem('New cluster…');
    const clusterName = await screen.findByRole('textbox', { name: 'Cluster name' });
    await user.clear(clusterName);
    await user.type(clusterName, 'Water{Enter}');
    expect(await screen.findByRole('button', { name: 'Show or hide Water' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ungrouped' })).toBeInTheDocument();

    await openPaletteMenu(user, 'Sky');
    await user.click(await screen.findByRole('menuitem', { name: 'Move to cluster' }));
    await chooseSubmenuItem('Water');
    await vi.waitFor(() => {
      expect(within(screen.getByRole('list', { name: 'Water' })).getAllByRole('listitem')).toHaveLength(2);
    });
    expect(screen.queryByRole('heading', { name: 'Ungrouped' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show or hide Water' }));
    expect(screen.queryByRole('button', { name: 'Select palette Sea' })).not.toBeInTheDocument();
    await user.type(screen.getByRole('searchbox', { name: 'Search palettes' }), 'wat');
    expect(screen.getByRole('button', { name: 'Select palette Sea' })).toBeInTheDocument();
    await user.clear(screen.getByRole('searchbox', { name: 'Search palettes' }));
    await user.click(screen.getByRole('button', { name: 'Show or hide Water' }));

    await openPaletteMenu(user, 'Sky');
    await user.click(await screen.findByRole('menuitem', { name: 'Move to cluster' }));
    await chooseSubmenuItem('Remove from cluster');
    expect(await screen.findByRole('heading', { name: 'Ungrouped' })).toBeInTheDocument();

    await openClusterMenu(user, 'Water');
    await user.click(await screen.findByRole('menuitem', { name: 'Rename cluster' }));
    const rename = await screen.findByRole('textbox', { name: 'Cluster name' });
    await user.clear(rename);
    await user.type(rename, 'Ocean{Enter}');
    expect(await screen.findByRole('button', { name: 'Show or hide Ocean' })).toBeInTheDocument();

    await openClusterMenu(user, 'Ocean');
    await user.click(await screen.findByRole('menuitem', { name: 'Add palettes to cluster' }));
    expect(await screen.findByText('Adding to Ocean')).toBeInTheDocument();

    await openClusterMenu(user, 'Ocean');
    await user.click(await screen.findByRole('menuitem', { name: 'Delete cluster' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await vi.waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Show or hide Ocean' })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Select palette Sea' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select palette Sky' })).toBeInTheDocument();
  });

  it('deletes a cluster together with its palettes and starts a cluster from a palette menu', async () => {
    const user = userEvent.setup();
    const fire = await palette('Fire', '#e2361b');
    await palette('Rock', '#806040');
    render(<Harness initial={{ paletteId: fire.id }} />);

    await openPaletteMenu(user, 'Fire');
    await user.click(await screen.findByRole('menuitem', { name: 'Generate cluster from this palette' }));
    await user.click(await screen.findByRole('button', { name: 'Create cluster' }));
    expect(await screen.findByRole('button', { name: 'Show or hide Fire cluster' })).toBeInTheDocument();

    await openClusterMenu(user, 'Fire cluster');
    await user.click(await screen.findByRole('menuitem', { name: 'Delete cluster and palettes' }));
    expect(
      await screen.findByText(
        'Delete the cluster "Fire cluster" and its 3 palettes? Items using their colours keep their last colour.',
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await vi.waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Select palette Fire' })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Select palette Rock' })).toBeInTheDocument();
    expect(api.palettesData.palettes.map((item) => item.name)).toEqual(['Rock']);
  });

  it('groups palettes by cluster in the contrast checker menus and swatch picker', async () => {
    const user = userEvent.setup();
    const fire = await palette('Fire', '#e2361b');
    await palette('Rock', '#806040');
    const { createCluster } = await import('@renderer/lib/palettes');
    await createCluster({ name: 'Magic', paletteIds: [fire.id] });
    render(<Harness initial={{ tab: 'contrast' }} />);

    await user.click(await screen.findByRole('button', { name: 'Add whole palette' }));
    const magic = await screen.findByRole('group', { name: 'Magic' });
    expect(within(magic).getByRole('menuitem', { name: 'Fire' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('group', { name: 'Ungrouped' })).getByRole('menuitem', { name: 'Rock' }),
    ).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(firstOf(screen.getAllByRole('button', { name: 'From palette' })));
    expect(
      within(await screen.findByRole('group', { name: 'Magic' })).getByRole('menuitem', { name: 'Fire' }),
    ).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(firstOf(screen.getAllByRole('button', { name: 'Choose colour' })));
    const swatches = await screen.findByRole('group', { name: 'Magic' });
    expect(within(swatches).getAllByRole('button', { name: /^Fire: / }).length).toBeGreaterThan(0);
    expect(
      within(screen.getByRole('group', { name: 'Ungrouped' })).getAllByRole('button', { name: /^Rock: / })
        .length,
    ).toBeGreaterThan(0);
  });

  it('selects a cluster, then modifies, renames, trims and extends it', async () => {
    const user = userEvent.setup();
    const { createCluster } = await import('@renderer/lib/palettes');
    const fire = await palette('Fire', '#e2361b');
    const water = await palette('Water', '#1b6be2');
    await createCluster({ name: 'Magic', paletteIds: [fire.id, water.id] });
    render(<Harness initial={{ paletteId: fire.id }} />);

    const labels = ['Colour wheel', 'Cluster', 'From image', 'Contrast', 'Explore'];
    const radios = (await screen.findAllByRole('radio')).map((radio) => radio.textContent);
    expect(radios.filter((text) => labels.includes(text))).toEqual(labels);

    await user.click(screen.getByRole('button', { name: 'Open cluster Magic' }));
    expect(screen.getByRole('heading', { name: 'Magic' })).toBeInTheDocument();
    expect(screen.getByText(/Press Modify to rename the cluster/)).toBeInTheDocument();
    await user.click(firstOf(screen.getAllByRole('button', { name: 'Open' })));
    expect(await screen.findByRole('button', { name: 'Modify' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Magic' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open cluster Magic' }));
    await user.click(screen.getByRole('button', { name: 'Modify' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Modify' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Modify' }));
    const name = screen.getByRole('textbox', { name: 'Cluster name' });
    await user.clear(name);
    await user.type(name, 'Elements');
    await user.click(screen.getByRole('switch', { name: 'Keep Water in the cluster' }));
    await user.click(firstOf(screen.getAllByRole('switch', { name: /^Include / })));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Saved cluster Elements')).toBeInTheDocument();
    expect(api.updatePaletteCluster).toHaveBeenCalledWith(expect.any(String), { name: 'Elements' });
    expect(api.createPalette).toHaveBeenLastCalledWith(
      expect.objectContaining({ clusterId: expect.any(String) as string }),
    );
    expect(screen.getByRole('heading', { name: 'Elements' })).toBeInTheDocument();
  });

  it('starts a new cluster from the library menu', async () => {
    const user = userEvent.setup();
    const fire = await palette('Fire', '#e2361b');
    render(<Harness initial={{ paletteId: fire.id }} />);
    await user.click(await screen.findByRole('button', { name: 'New palette' }));
    await user.click(await screen.findByRole('menuitem', { name: 'New cluster from the selected palette' }));
    expect(await screen.findByRole('heading', { name: 'Palette cluster' })).toBeInTheDocument();
  });
});
