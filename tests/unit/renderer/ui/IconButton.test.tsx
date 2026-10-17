import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Plus } from 'lucide-react';
import { IconButton, TooltipProvider } from '@renderer/ui';
import { expectNoViolations } from '../../../setup/axe';

describe('IconButton', () => {
  it('exposes its label and shows it as a tooltip on hover', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <TooltipProvider>
        <IconButton label="Add item">
          <Plus />
        </IconButton>
      </TooltipProvider>,
    );

    const button = screen.getByRole('button', { name: 'Add item' });
    await user.hover(button);

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Add item');
    await expectNoViolations(container);
  });

  it('reports the active state as pressed', () => {
    render(
      <IconButton label="Bold" active tooltip={false}>
        <Plus />
      </IconButton>,
    );

    expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true');
  });
});
