import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactFlowProvider } from '@xyflow/react';
import { describe, expect, it, vi } from 'vitest';
import { NoteNode } from '@renderer/components/editors/Board/NoteNode';
import { bootTestApp } from './helpers/api';

describe('NoteNode', () => {
  it('edits its text and reports the change on blur', async () => {
    await bootTestApp();
    const onChange = vi.fn();
    const user = userEvent.setup();
    const props = {
      id: 'n1',
      type: 'note',
      data: { text: 'hello', onChange },
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
    render(
      <ReactFlowProvider>
        <NoteNode {...props} />
      </ReactFlowProvider>,
    );

    const area = screen.getByRole('textbox', { name: 'Add note' });
    expect(area).toHaveValue('hello');
    await user.clear(area);
    await user.type(area, 'changed');
    area.blur();
    expect(onChange).toHaveBeenCalledWith('changed');
  });
});
