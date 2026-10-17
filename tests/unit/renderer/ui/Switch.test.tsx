import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Switch } from '@renderer/ui';
import { expectNoViolations } from '../../../setup/axe';

describe('Switch', () => {
  it('toggles through its visible label', async () => {
    const onCheckedChange = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<Switch label="Show minimap" onCheckedChange={onCheckedChange} />);

    await user.click(screen.getByText('Show minimap'));

    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole('switch', { name: 'Show minimap' })).toBeInTheDocument();
    await expectNoViolations(container);
  });

  it('accepts an aria-label when there is no visible label', () => {
    render(<Switch aria-label="Dark mode" checked size="sm" />);

    expect(screen.getByRole('switch', { name: 'Dark mode' })).toBeChecked();
  });
});
