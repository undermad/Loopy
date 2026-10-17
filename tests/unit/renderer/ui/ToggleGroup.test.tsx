import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Columns, List } from 'lucide-react';
import { ToggleGroup } from '@renderer/ui';
import { expectNoViolations } from '../../../setup/axe';

const items = [
  { value: 'board', label: 'Board', icon: <Columns /> },
  { value: 'backlog', label: 'Backlog', icon: <List /> },
];

describe('ToggleGroup', () => {
  it('reports the newly selected value and ignores deselecting', async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <ToggleGroup items={items} value="board" onValueChange={onValueChange} aria-label="Mode" />,
    );

    await user.click(screen.getByRole('radio', { name: 'Backlog' }));
    await user.click(screen.getByRole('radio', { name: 'Board' }));

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('backlog');
    await expectNoViolations(container);
  });

  it('keeps labels accessible in icons-only mode', () => {
    render(
      <ToggleGroup
        items={items}
        value="board"
        onValueChange={vi.fn()}
        aria-label="Mode"
        iconsOnly
        size="sm"
      />,
    );

    expect(screen.getByRole('radio', { name: 'Backlog' })).toBeInTheDocument();
  });
});
