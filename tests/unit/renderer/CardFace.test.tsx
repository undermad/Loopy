import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cardFieldSchema, cardLayoutSchema, type CardField, type CardLayout } from '@shared/cards';
import type { TemplateDraft } from '@renderer/components/editors/Cards/CardDesigner';
import { CardPreview } from '@renderer/components/editors/Cards/CardPreview';
import { CardView } from '@renderer/components/editors/Cards/CardView';
import { CardSettings, FieldSettings } from '@renderer/components/editors/Cards/settings';
import { fontStack } from '@renderer/lib/board';
import { CARD_SIZES, cardAccent } from '@renderer/lib/cards';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

let api: FakeApi;

const field = (input: Record<string, unknown> & { id: string; kind: CardField['kind'] }) =>
  cardFieldSchema.parse(input);

const layout = (input: Record<string, unknown> = {}): CardLayout => cardLayoutSchema.parse(input);

const rarity = field({
  id: 'rarity',
  kind: 'choice',
  label: 'Rarity',
  options: ['Common', { value: 'Rare', colour: { hex: '#3b82f6', ref: null } }],
});

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <ToastProvider closeLabel="Dismiss" regionLabel="Notifications">
        {children}
      </ToastProvider>
    </TooltipProvider>
  );
}

async function pick(user: ReturnType<typeof userEvent.setup>, name: string, option: string) {
  await user.click(screen.getByRole('combobox', { name }));
  await user.click(await screen.findByRole('option', { name: option }));
}

beforeEach(async () => {
  api = await bootTestApp();
  api.current = makeProject('Space Game');
  api.emitProject();
  await act(async () => {
    await Promise.resolve();
  });
});

describe('card layout model', () => {
  it('gives a layout a background, accent placement, font and fixed height by default', () => {
    expect(layout()).toMatchObject({
      background: { image: null, fit: 'cover', overlay: 0, gradient: null },
      accentPlacement: 'top',
      accentField: null,
      font: 'default',
      autoHeight: false,
    });
    expect(field({ id: 'a', kind: 'text' })).toMatchObject({ zone: 'body' });
  });

  it('takes the accent from the chosen option when asked', () => {
    const base = layout({ accent: { hex: '#111111', ref: null }, accentField: 'rarity', fields: [rarity] });
    expect(cardAccent(base, { rarity: 'Rare' })).toEqual({ hex: '#3b82f6', ref: null });
    expect(cardAccent(base, { rarity: 'Common' })).toEqual({ hex: '#111111', ref: null });
    expect(cardAccent(base, {})).toEqual({ hex: '#111111', ref: null });
    expect(cardAccent({ ...base, accentField: 'missing' }, { rarity: 'Rare' })).toEqual({
      hex: '#111111',
      ref: null,
    });
  });

  it('names card sizes and font stacks', () => {
    expect(CARD_SIZES.find((size) => size.id === 'poker')).toMatchObject({ width: 250, height: 350 });
    expect(fontStack('default')).toBeUndefined();
    expect(fontStack('serif')).toContain('serif');
    expect(fontStack('mono')).toContain('mono');
  });
});

describe('card face', () => {
  it('puts fields in header, body and footer zones', () => {
    const fields = [
      field({ id: 'title', kind: 'text', zone: 'header' }),
      field({ id: 'bio', kind: 'text', lines: 'multi' }),
      field({ id: 'cost', kind: 'number', zone: 'footer' }),
    ];
    const { container } = render(<CardView layout={{ fields, gap: 4 }} values={{}} editable={false} />);
    expect(container.querySelector('[data-zone="header"] [data-field-id="title"]')).not.toBeNull();
    expect(container.querySelector('[data-zone="body"] [data-field-id="bio"]')).not.toBeNull();
    expect(container.querySelector('[data-zone="footer"] [data-field-id="cost"]')).not.toBeNull();
  });

  it('draws the accent where the layout asks and from the chosen option', () => {
    const own = layout({
      accent: { hex: '#ff0000', ref: null },
      accentPlacement: 'left',
      accentField: 'rarity',
      fields: [rarity],
    });
    const { container, rerender } = render(
      <Providers>
        <CardPreview layout={own} values={{ rarity: 'Rare' }} selectedFieldId={null} onValue={vi.fn()} />
      </Providers>,
    );
    const accent = container.querySelector<HTMLElement>('[data-accent]');
    expect(accent?.dataset['accent']).toBe('left');
    expect(accent?.style.backgroundColor).toBe('rgb(59, 130, 246)');
    rerender(
      <Providers>
        <CardPreview
          layout={{ ...own, accentPlacement: 'none' }}
          values={{}}
          selectedFieldId={null}
          onValue={vi.fn()}
        />
      </Providers>,
    );
    expect(container.querySelector('[data-accent]')).toBeNull();
  });

  it('paints a background image, gradient and font, and grows with auto height', () => {
    const own = layout({
      background: {
        image: 'a1',
        fit: 'contain',
        overlay: 0.4,
        gradient: { colour: { hex: '#000000', ref: null }, angle: 90 },
      },
      font: 'serif',
      autoHeight: true,
      height: 300,
    });
    const { container } = render(
      <Providers>
        <CardPreview layout={own} values={{}} selectedFieldId={null} onValue={vi.fn()} />
      </Providers>,
    );
    const image = container.querySelector<HTMLImageElement>('[data-backdrop] img');
    expect(image?.getAttribute('src')).toContain('a1');
    expect(image).toHaveStyle({ objectFit: 'contain' });
    const gradient = container.querySelector<HTMLElement>('[data-gradient]');
    expect(gradient?.style.backgroundImage).toContain('linear-gradient(90deg');
    const card = container.querySelector<HTMLElement>('[data-card-face]');
    expect(card?.style.fontFamily).toContain('serif');
    const frame = card?.parentElement;
    expect(frame?.style.height).toBe('auto');
    expect(frame?.style.minHeight).toBe('300px');
  });
});

describe('card settings sections', () => {
  function draft(input: Record<string, unknown> = {}): TemplateDraft {
    return { ...layout({ fields: [rarity], ...input }), name: 'Item' };
  }

  it('sets size presets, auto height and font', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Providers>
        <CardSettings draft={draft()} onChange={onChange} />
      </Providers>,
    );
    await pick(user, 'Size', 'Poker');
    expect(onChange).toHaveBeenLastCalledWith({ width: 250, height: 350 });
    await user.click(screen.getByRole('switch', { name: 'Grow to fit fields' }));
    expect(onChange).toHaveBeenLastCalledWith({ autoHeight: true });
    await pick(user, 'Font', 'Serif');
    expect(onChange).toHaveBeenLastCalledWith({ font: 'serif' });
  });

  it('places the accent and takes it from a choice field', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Providers>
        <CardSettings draft={draft()} onChange={onChange} />
      </Providers>,
    );
    await pick(user, 'Accent placement', 'Left stripe');
    expect(onChange).toHaveBeenLastCalledWith({ accentPlacement: 'left' });
    await pick(user, 'Accent from', 'Rarity');
    expect(onChange).toHaveBeenLastCalledWith({ accentField: 'rarity' });
  });

  it('adds a gradient and sets the image overlay', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <Providers>
        <CardSettings draft={draft()} onChange={onChange} />
      </Providers>,
    );
    await user.click(screen.getByRole('switch', { name: 'Gradient' }));
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ background: { gradient: { angle: 180 } } });
    rerender(
      <Providers>
        <CardSettings draft={draft({ background: { image: 'a1' } })} onChange={onChange} />
      </Providers>,
    );
    await pick(user, 'Image fit', 'Fit inside');
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ background: { image: 'a1', fit: 'contain' } });
  });

  it('moves a field to the header zone', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Providers>
        <FieldSettings field={field({ id: 'title', kind: 'text' })} onChange={onChange} />
      </Providers>,
    );
    await pick(user, 'Zone', 'Header');
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ zone: 'header' });
  });
});
