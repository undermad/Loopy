import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Field, NumberInput } from '@renderer/ui';
import { expectNoViolations } from '../../../setup/axe';

function Controlled({
  initial,
  onChange,
  ...props
}: {
  initial: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  nullable?: boolean;
}) {
  const [value, setValue] = useState(initial);
  return (
    <Field label="Width">
      <NumberInput
        {...props}
        value={value}
        onValueChange={(next) => {
          setValue(next);
          onChange(next);
        }}
      />
    </Field>
  );
}

function drag(input: HTMLElement, distance: number, shiftKey = false) {
  fireEvent.pointerDown(input, { button: 0, clientX: 100, pointerId: 1 });
  fireEvent.pointerMove(input, { clientX: 100 + distance, pointerId: 1, shiftKey });
  fireEvent.pointerUp(input, { clientX: 100 + distance, pointerId: 1 });
}

describe('NumberInput', () => {
  it('scrubs the value when dragged left or right', () => {
    const onChange = vi.fn();
    render(<Controlled initial={2} step={1} onChange={onChange} />);
    const input = screen.getByRole('spinbutton', { name: 'Width' });

    drag(input, 40);
    expect(onChange).toHaveBeenLastCalledWith(12);
    drag(input, -20);
    expect(onChange).toHaveBeenLastCalledWith(7);
    drag(input, 40, true);
    expect(onChange).toHaveBeenLastCalledWith(8);
    expect(input).not.toHaveFocus();
  });

  it('clamps scrubbing to its range and ignores tiny movements', () => {
    const onChange = vi.fn();
    render(<Controlled initial={1} min={0} max={5} onChange={onChange} />);
    const input = screen.getByRole('spinbutton', { name: 'Width' });

    drag(input, 2);
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveFocus();
    input.blur();
    drag(input, -400);
    expect(onChange).toHaveBeenLastCalledWith(0);
    drag(input, 400);
    expect(onChange).toHaveBeenLastCalledWith(5);
  });

  it('types a value after a click and commits it on Enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled initial={3} max={50} onChange={onChange} />);
    const input = screen.getByRole('spinbutton', { name: 'Width' });

    await user.click(input);
    expect(input).toHaveFocus();
    await user.keyboard('80{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(50);
    expect(input).toHaveValue(50);

    await user.click(input);
    await user.keyboard('9{Escape}');
    await user.tab();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('clears to null only when nullable', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<Controlled initial={4} nullable onChange={onChange} />);
    const input = screen.getByRole('spinbutton', { name: 'Width' });

    await user.clear(input);
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith(null);
    drag(input, 8);
    expect(onChange).toHaveBeenLastCalledWith(2);
    await expectNoViolations(container);
  });
});
