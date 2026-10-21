import { useState } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardTemplateInput } from '@shared/cards';
import { CardDesigner } from '@renderer/components/editors/Cards/CardDesigner';
import { createCardTemplate } from '@renderer/lib/cards';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject } from './helpers/api';

const TEMPLATE: CardTemplateInput = {
  name: 'Hero',
  width: 300,
  height: 400,
  fields: [
    { id: 'name', kind: 'text', label: 'Name' },
    { id: 'attack', kind: 'number', label: 'Attack', span: 6 },
  ],
};

function Designer({ initial }: { initial: Record<string, unknown> }) {
  const [state, setState] = useState(initial);
  return (
    <TooltipProvider>
      <ToastProvider closeLabel="Dismiss" regionLabel="Notifications">
        <CardDesigner
          areaId="cards"
          state={state}
          setState={(patch) => {
            setState((current) => ({ ...current, ...patch }));
          }}
        />
      </ToastProvider>
    </TooltipProvider>
  );
}

async function openTemplate() {
  const template = await act(() => createCardTemplate(TEMPLATE));
  render(<Designer initial={{ target: { kind: 'template', id: template.id } }} />);
  await screen.findByRole('group', { name: 'Card canvas' });
}

const canvas = () => screen.getByRole('group', { name: 'Card canvas' });
const fieldOnCanvas = (name: string) => within(canvas()).getByRole('group', { name });
const fieldIds = () =>
  [...canvas().querySelectorAll('[data-field-id]')].map((item) => item.getAttribute('data-field-id') ?? '');
const card = () => {
  const element = canvas().querySelector<HTMLElement>('[data-preview-card]');
  if (!element) throw new Error('no card');
  return element;
};

const SLOW = 15_000;

beforeEach(async () => {
  const api = await bootTestApp();
  api.current = makeProject('Space Game');
  api.emitProject();
  await act(async () => {
    await Promise.resolve();
  });
});

describe('field corner handle', { timeout: SLOW }, () => {
  it('resizes width and height together from the keyboard and by dragging', async () => {
    const user = userEvent.setup();
    await openTemplate();
    await user.click(fieldOnCanvas('Attack'));
    const corner = screen.getByRole('slider', { name: 'Resize Attack' });
    expect(corner).toHaveAttribute('aria-valuetext', '6 columns, auto height');
    fireEvent.keyDown(corner, { key: 'ArrowRight' });
    fireEvent.keyDown(corner, { key: 'ArrowDown' });
    expect(fieldOnCanvas('Attack').style.gridColumn).toBe('span 7');
    expect(fieldOnCanvas('Attack').style.minHeight).toBe('24px');

    const zone = within(canvas()).getByRole('region', { name: 'Body zone' });
    vi.spyOn(zone, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 240, 400));
    vi.spyOn(fieldOnCanvas('Attack'), 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 140, 24));
    fireEvent.pointerDown(corner, { pointerId: 4, clientX: 140, clientY: 24, button: 0 });
    fireEvent.pointerMove(corner, { pointerId: 4, clientX: 200, clientY: 80 });
    expect(screen.getByText('10/12 · 80 px')).toBeInTheDocument();
    fireEvent.pointerUp(corner, { pointerId: 4, clientX: 200, clientY: 80 });
    expect(fieldOnCanvas('Attack').style.gridColumn).toBe('span 10');
    expect(fieldOnCanvas('Attack').style.minHeight).toBe('80px');
  });
});

describe('field palette', { timeout: SLOW }, () => {
  it('adds a field by clicking a preset, after the selection or at the end of the body', async () => {
    const user = userEvent.setup();
    await openTemplate();
    const palette = screen.getByRole('toolbar', { name: 'Field palette' });
    await user.click(within(palette).getByRole('button', { name: 'Rating' }));
    expect(fieldIds()).toEqual(['name', 'attack', 'rating']);
    await user.click(fieldOnCanvas('Name'));
    await user.click(within(palette).getByRole('button', { name: 'Dice' }));
    expect(fieldIds()).toEqual(['name', 'dice', 'attack', 'rating']);
    expect(fieldOnCanvas('Dice')).toHaveAttribute('data-selected', 'true');
  });

  it('hides the palette while filling in', async () => {
    const user = userEvent.setup();
    await openTemplate();
    await user.click(screen.getByRole('radio', { name: 'Fill in' }));
    expect(screen.queryByRole('toolbar', { name: 'Field palette' })).not.toBeInTheDocument();
  });
});

describe('card size and selection', { timeout: SLOW }, () => {
  it('shows card settings when the card is clicked away from fields', async () => {
    const user = userEvent.setup();
    await openTemplate();
    await user.click(fieldOnCanvas('Attack'));
    expect(screen.getByRole('heading', { name: 'Field' })).toBeInTheDocument();
    await user.click(card());
    expect(screen.getByRole('heading', { name: 'Card' })).toBeInTheDocument();
  });

  it('resizes the card with its handles from the keyboard', async () => {
    await openTemplate();
    const width = screen.getByRole('slider', { name: 'Resize card width' });
    expect(width).toHaveAttribute('aria-valuenow', '300');
    fireEvent.keyDown(width, { key: 'ArrowRight' });
    expect(card().style.width).toBe('310px');
    fireEvent.keyDown(width, { key: 'ArrowLeft', shiftKey: true });
    expect(card().style.width).toBe('309px');
    const height = screen.getByRole('slider', { name: 'Resize card height' });
    fireEvent.keyDown(height, { key: 'ArrowDown' });
    expect(card().style.height).toBe('410px');
    const corner = screen.getByRole('slider', { name: 'Resize card' });
    fireEvent.keyDown(corner, { key: 'ArrowUp' });
    fireEvent.keyDown(corner, { key: 'ArrowRight' });
    expect(card().style.height).toBe('400px');
    expect(card().style.width).toBe('319px');
    expect(screen.getByRole('spinbutton', { name: 'Width' })).toHaveValue(319);
  });

  it('resizes the card by dragging and snaps to 10 pixels', async () => {
    await openTemplate();
    const corner = screen.getByRole('slider', { name: 'Resize card' });
    fireEvent.pointerDown(corner, { pointerId: 5, clientX: 300, clientY: 400, button: 0 });
    fireEvent.pointerMove(corner, { pointerId: 5, clientX: 347, clientY: 461 });
    expect(card().style.width).toBe('350px');
    expect(screen.getByText('350 × 460')).toBeInTheDocument();
    fireEvent.pointerUp(corner, { pointerId: 5, clientX: 347, clientY: 461 });
    expect(card().style.width).toBe('350px');
    expect(card().style.height).toBe('460px');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(card().style.width).toBe('300px');
  });
});

describe('grid', { timeout: SLOW }, () => {
  it('draws cells with rows as well as columns', async () => {
    const user = userEvent.setup();
    await openTemplate();
    await user.click(screen.getByRole('switch', { name: 'Show grid' }));
    const overlay = canvas().querySelector<HTMLElement>('[data-grid-overlay]');
    expect(overlay).toHaveAttribute('data-grid-rows', '16');
    expect(overlay?.style.getPropertyValue('--grid-row')).toBe('16px');
  });
});
