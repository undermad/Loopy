import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Field, Input, TextArea } from '@renderer/ui';
import { expectNoViolations } from '../../../setup/axe';

describe('Field', () => {
  it('links the label, hint and error to the input', async () => {
    const { container } = render(
      <Field label="Name" hint="Shown in the title bar" error="Name is required" required>
        <Input placeholder="Project name" />
      </Field>,
    );

    const input = screen.getByLabelText(/Name/);
    expect(input).toHaveAccessibleDescription('Shown in the title bar Name is required');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Name is required');
    await expectNoViolations(container);
  });

  it('works with a text area and without a field', () => {
    render(
      <>
        <Field label="Notes">
          <TextArea />
        </Field>
        <Input aria-label="Search" invalid />
      </>,
    );

    expect(screen.getByLabelText('Notes').tagName).toBe('TEXTAREA');
    expect(screen.getByLabelText('Search')).toHaveAttribute('aria-invalid', 'true');
  });
});
