import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Inbox } from 'lucide-react';
import {
  Button,
  ColorPicker,
  ColorSwatch,
  EmptyState,
  Kbd,
  Popover,
  ScrollArea,
  Separator,
  Spinner,
  Tag,
  Toolbar,
} from '@renderer/ui';
import { expectNoViolations } from '../../../setup/axe';

describe('static primitives', () => {
  it('render without accessibility violations', async () => {
    const { container } = render(
      <div>
        <Kbd>Ctrl</Kbd>
        <Separator />
        <Separator orientation="vertical" decorative={false} />
        <Spinner label="Loading" />
        <Spinner size="sm" />
        <Tag color="#ff0000">Bug</Tag>
        <Tag size="sm">Plain</Tag>
        <ColorSwatch color="#00ff00" />
        <Toolbar.Root aria-label="Board tools">
          <Toolbar.Group>
            <Toolbar.Button asChild>
              <Button size="sm">Fit</Button>
            </Toolbar.Button>
          </Toolbar.Group>
          <Toolbar.Separator />
        </Toolbar.Root>
        <ScrollArea orientation="both" className="scroll">
          <p>Scrollable content</p>
        </ScrollArea>
        <EmptyState
          icon={<Inbox />}
          title="No tickets"
          description="Create one"
          action={<Button>New</Button>}
        />
      </div>,
    );

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
    expect(screen.getByText('No tickets')).toBeInTheDocument();
    expect(screen.getAllByRole('separator').length).toBeGreaterThan(0);
    await expectNoViolations(container);
  });
});

describe('Popover', () => {
  it('opens its content from the trigger', async () => {
    const user = userEvent.setup();
    render(
      <Popover.Root>
        <Popover.Trigger asChild>
          <Button>Labels</Button>
        </Popover.Trigger>
        <Popover.Content>Pick labels</Popover.Content>
      </Popover.Root>,
    );

    await user.click(screen.getByRole('button', { name: 'Labels' }));

    expect(await screen.findByText('Pick labels')).toBeInTheDocument();
  });
});

describe('ColorPicker', () => {
  it('opens a picker and accepts a typed hex value', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ColorPicker value="#112233" onChange={onChange} label="Background colour" />);

    await user.click(screen.getByRole('button', { name: 'Background colour' }));
    const input = await screen.findByRole('textbox', { name: 'Background colour' });
    await user.clear(input);
    await user.type(input, 'abcdef');

    expect(onChange).toHaveBeenLastCalledWith('#abcdef');
  });
});
