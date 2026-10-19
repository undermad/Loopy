import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PropertySection } from '@renderer/ui';

describe('PropertySection', () => {
  it('collapses and expands its content from the heading', async () => {
    const user = userEvent.setup();
    render(
      <PropertySection title="Appearance">
        <p>Fill</p>
      </PropertySection>,
    );
    const toggle = screen.getByRole('button', { name: 'Appearance' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Fill')).toBeVisible();
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Fill')).not.toBeInTheDocument();
  });

  it('starts closed when asked and reports changes when controlled', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <PropertySection title="Advanced" open={false} onOpenChange={onOpenChange}>
        <p>Help</p>
      </PropertySection>,
    );
    expect(screen.queryByText('Help')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Advanced' }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    rerender(
      <PropertySection title="Advanced" open onOpenChange={onOpenChange}>
        <p>Help</p>
      </PropertySection>,
    );
    expect(screen.getByText('Help')).toBeVisible();
  });

  it('keeps advanced settings behind a More toggle', async () => {
    const user = userEvent.setup();
    render(
      <PropertySection title="Appearance" more={<p>Blend</p>} moreLabel="More" lessLabel="Less">
        <p>Fill</p>
      </PropertySection>,
    );
    expect(screen.queryByText('Blend')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByText('Blend')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Less' }));
    expect(screen.queryByText('Blend')).not.toBeInTheDocument();
  });
});
