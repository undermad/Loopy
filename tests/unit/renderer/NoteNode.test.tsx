import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactFlowProvider } from '@xyflow/react';
import { describe, expect, it, vi } from 'vitest';
import { NoteNode } from '@renderer/components/editors/Board/NoteNode';
import { bootTestApp } from './helpers/api';

const props = {
  id: 'n1',
  type: 'note',
  selected: false,
  dragging: false,
  zIndex: 1,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  deletable: true,
  selectable: true,
  draggable: true,
};

describe('NoteNode', () => {
  it('shows its text, edits on double-click and reports the change on blur', async () => {
    await bootTestApp();
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ReactFlowProvider>
        <NoteNode {...props} data={{ text: 'hello', onChange }} />
      </ReactFlowProvider>,
    );

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await user.dblClick(screen.getByText('hello'));
    const area = await screen.findByRole('textbox', { name: 'Add note' });
    expect(area).toHaveFocus();
    await user.clear(area);
    await user.type(area, 'changed');
    await user.keyboard('{Escape}');
    expect(onChange).toHaveBeenCalledWith('changed');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('shows the placeholder for an empty note and enters editing with Enter', async () => {
    await bootTestApp();
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ReactFlowProvider>
        <NoteNode {...props} data={{ text: '', onChange }} />
      </ReactFlowProvider>,
    );
    const display = screen.getByText('Write something…');
    display.parentElement?.focus();
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('textbox')).toBeInTheDocument();
  });
});
