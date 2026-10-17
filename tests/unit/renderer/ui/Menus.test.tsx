import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button, ContextMenu, DropdownMenu, Menubar } from '@renderer/ui';

describe('DropdownMenu', () => {
  it('opens from the trigger and fires onSelect for an item', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button>Area</Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Label>Split</DropdownMenu.Label>
          <DropdownMenu.Item onSelect={onSelect}>
            Horizontal
            <DropdownMenu.Shortcut>Ctrl+H</DropdownMenu.Shortcut>
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
          <DropdownMenu.CheckboxItem checked>Show header</DropdownMenu.CheckboxItem>
          <DropdownMenu.RadioGroup value="a">
            <DropdownMenu.RadioItem value="a">Option A</DropdownMenu.RadioItem>
          </DropdownMenu.RadioGroup>
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger>More</DropdownMenu.SubTrigger>
            <DropdownMenu.SubContent>
              <DropdownMenu.Item>Nested</DropdownMenu.Item>
            </DropdownMenu.SubContent>
          </DropdownMenu.Sub>
        </DropdownMenu.Content>
      </DropdownMenu.Root>,
    );

    await user.click(screen.getByRole('button', { name: 'Area' }));
    await user.click(await screen.findByRole('menuitem', { name: /Horizontal/ }));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});

describe('ContextMenu', () => {
  it('opens on right click', async () => {
    render(
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>
          <div>Card</div>
        </ContextMenu.Trigger>
        <ContextMenu.Content>
          <ContextMenu.Label>Card</ContextMenu.Label>
          <ContextMenu.Item>Rename</ContextMenu.Item>
          <ContextMenu.Separator />
          <ContextMenu.CheckboxItem checked>Pinned</ContextMenu.CheckboxItem>
          <ContextMenu.RadioGroup value="a">
            <ContextMenu.RadioItem value="a">A</ContextMenu.RadioItem>
          </ContextMenu.RadioGroup>
          <ContextMenu.Sub>
            <ContextMenu.SubTrigger>More</ContextMenu.SubTrigger>
            <ContextMenu.SubContent>
              <ContextMenu.Item>Nested</ContextMenu.Item>
            </ContextMenu.SubContent>
          </ContextMenu.Sub>
        </ContextMenu.Content>
      </ContextMenu.Root>,
    );

    fireEvent.contextMenu(screen.getByText('Card'));

    expect(await screen.findByRole('menuitem', { name: 'Rename' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemcheckbox', { name: 'Pinned' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'A' })).toBeInTheDocument();
  });
});

describe('Menubar', () => {
  it('opens a menu from its trigger', async () => {
    const user = userEvent.setup();
    render(
      <Menubar.Root>
        <Menubar.Menu>
          <Menubar.Trigger>File</Menubar.Trigger>
          <Menubar.Content>
            <Menubar.Item>New project</Menubar.Item>
          </Menubar.Content>
        </Menubar.Menu>
      </Menubar.Root>,
    );

    await user.click(screen.getByRole('menuitem', { name: 'File' }));

    expect(await screen.findByRole('menuitem', { name: 'New project' })).toBeInTheDocument();
  });
});
