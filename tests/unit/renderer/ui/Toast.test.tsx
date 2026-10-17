import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Button, ToastProvider, useToast } from '@renderer/ui';

function Trigger() {
  const toast = useToast();
  return (
    <Button
      onClick={() => {
        toast.show({ title: 'Exported', description: 'Saved to disk', variant: 'success' });
      }}
    >
      Export
    </Button>
  );
}

describe('Toast', () => {
  it('shows a toast and lets the user dismiss it', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider closeLabel="Dismiss" regionLabel="Notifications">
        <Trigger />
      </ToastProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Export' }));
    expect(await screen.findByText('Exported')).toBeInTheDocument();
    expect(screen.getByText('Saved to disk')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Exported')).not.toBeInTheDocument();
  });

  it('throws when used outside the provider', () => {
    expect(() => render(<Trigger />)).toThrow(/ToastProvider/);
  });
});
