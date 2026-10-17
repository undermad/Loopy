import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button, ConfirmDialog, Dialog } from '@renderer/ui';
import { expectNoViolations } from '../../../setup/axe';

describe('Dialog', () => {
  it('opens from its trigger and closes from the close button', async () => {
    const user = userEvent.setup();
    render(
      <Dialog.Root>
        <Dialog.Trigger asChild>
          <Button>Open</Button>
        </Dialog.Trigger>
        <Dialog.Content title="New project" description="Pick a name" closeLabel="Close">
          <p>Body</p>
        </Dialog.Content>
      </Dialog.Root>,
    );

    await user.click(screen.getByRole('button', { name: 'Open' }));
    const dialog = await screen.findByRole('dialog', { name: 'New project' });
    expect(dialog).toHaveAccessibleDescription('Pick a name');
    await expectNoViolations(dialog);

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('ConfirmDialog', () => {
  it('runs the confirm action and closes', async () => {
    const onConfirm = vi.fn(() => Promise.resolve());
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Delete project?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        closeLabel="Close"
        destructive
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
