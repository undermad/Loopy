import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactFlowProvider } from '@xyflow/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NoteNode } from '@renderer/components/editors/Board/NoteNode';
import { PropertiesEditor } from '@renderer/components/editors/Properties/PropertiesEditor';
import { ProjectColourPicker } from '@renderer/components/ProjectColourPicker/ProjectColourPicker';
import {
  commitChanges,
  createBoard,
  loadBoard,
  setActiveBoard,
  setBoardSelection,
} from '@renderer/lib/board';
import { createPalette, updatePalette } from '@renderer/lib/palettes';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

let api: FakeApi;

beforeEach(async () => {
  api = await bootTestApp();
  const project = makeProject('Space Game');
  api.projects = [project];
  api.current = project;
  api.emitProject();
  await act(async () => {
    await Promise.resolve();
  });
});

describe('ProjectColourPicker', () => {
  it('offers palette swatches and a custom colour, and follows palette edits', async () => {
    const user = userEvent.setup();
    const palette = await createPalette({ name: 'Sea', colours: [{ hex: '#112233', name: 'Deep' }] });
    const colour = palette.colours[0];
    if (!colour) throw new Error('missing colour');
    const onChange = vi.fn();
    const { rerender } = render(
      <TooltipProvider>
        <ProjectColourPicker value={{ hex: '#ffffff', ref: null }} onChange={onChange} label="Fill" />
      </TooltipProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Fill' }));
    await user.click(await screen.findByRole('button', { name: 'Sea: Deep' }));
    expect(onChange).toHaveBeenCalledWith({
      hex: '#112233',
      ref: { paletteId: palette.id, colourId: colour.id },
    });

    rerender(
      <TooltipProvider>
        <ProjectColourPicker
          value={{ hex: '#112233', ref: { paletteId: palette.id, colourId: colour.id } }}
          onChange={onChange}
          label="Fill"
        />
      </TooltipProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Fill' }));
    expect(await screen.findByRole('button', { name: 'Sea: Deep' })).toHaveAttribute('aria-pressed', 'true');
    const hex = screen.getByRole('textbox', { name: 'Fill' });
    expect(hex).toHaveValue('#112233');
    await act(async () => {
      await updatePalette(palette.id, { colours: [{ id: colour.id, name: 'Deep', hex: '#445566' }] });
    });
    expect(screen.getByRole('textbox', { name: 'Fill' })).toHaveValue('#445566');
    await user.clear(hex);
    await user.type(hex, 'abcdef');
    expect(onChange).toHaveBeenLastCalledWith({ hex: '#abcdef', ref: null });
  });

  it('shows a hint when no palettes exist', async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <ProjectColourPicker value={{ hex: '#ffffff', ref: null }} onChange={vi.fn()} label="Fill" />
      </TooltipProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Fill' }));
    expect(await screen.findByText(/No palettes yet/)).toBeInTheDocument();
  });
});

describe('note fill', () => {
  it('paints the note with the live palette colour and resets to default from properties', async () => {
    const user = userEvent.setup();
    const palette = await createPalette({ name: 'Sea', colours: [{ hex: '#112233' }] });
    const colour = palette.colours[0];
    if (!colour) throw new Error('missing colour');
    const ref = { paletteId: palette.id, colourId: colour.id };
    const board = await createBoard({ name: 'Ideas' });
    await loadBoard(board.id);
    setActiveBoard(board.id);
    const note = {
      id: 'n1',
      boardId: board.id,
      type: 'note' as const,
      x: 0,
      y: 0,
      width: 200,
      height: 120,
      z: 1,
      data: { text: 'hi', fill: { hex: '#112233', ref } },
    };
    await commitChanges(board.id, { upsertNodes: [note] });
    setBoardSelection(board.id, ['n1']);

    render(
      <TooltipProvider>
        <ToastProvider closeLabel="Dismiss" regionLabel="Notifications">
          <ReactFlowProvider>
            <NoteNode
              id="n1"
              type="note"
              selected={false}
              dragging={false}
              zIndex={1}
              isConnectable
              positionAbsoluteX={0}
              positionAbsoluteY={0}
              deletable
              selectable
              draggable
              data={{ text: 'hi', fill: { hex: '#112233', ref }, onChange: vi.fn() }}
            />
          </ReactFlowProvider>
          <PropertiesEditor areaId="p" state={{}} setState={() => undefined} />
        </ToastProvider>
      </TooltipProvider>,
    );

    const painted = () => document.querySelector('[data-fill]');
    expect(painted()).toHaveAttribute('data-fill', '#112233');
    await act(async () => {
      await updatePalette(palette.id, { colours: [{ id: colour.id, hex: '#aabbcc' }] });
    });
    expect(painted()).toHaveAttribute('data-fill', '#aabbcc');

    await user.click(await screen.findByRole('button', { name: 'Default' }));
    expect(api.applyBoardChanges).toHaveBeenLastCalledWith(board.id, {
      upsertNodes: [expect.objectContaining({ data: { text: 'hi', fill: null } }) as object],
    });
  });
});
