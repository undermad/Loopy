import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Field, Select } from '@renderer/ui';

const options = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

describe('Select', () => {
  it('opens, lists the options and reports the chosen value', async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Field label="Theme">
        <Select options={options} value="light" onValueChange={onValueChange} />
      </Field>,
    );

    await user.click(screen.getByRole('combobox', { name: 'Theme' }));
    await user.click(await screen.findByRole('option', { name: 'Dark' }));

    expect(onValueChange).toHaveBeenCalledWith('dark');
  });

  it('shows a placeholder when nothing is selected', () => {
    render(<Select options={options} placeholder="Pick one" aria-label="Theme" />);

    expect(screen.getByRole('combobox', { name: 'Theme' })).toHaveTextContent('Pick one');
  });
});
