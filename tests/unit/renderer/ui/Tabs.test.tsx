import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Tabs } from '@renderer/ui';
import { expectNoViolations } from '../../../setup/axe';

describe('Tabs', () => {
  it('switches the visible panel', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Tabs.Root defaultValue="appearance">
        <Tabs.List aria-label="Preferences">
          <Tabs.Trigger value="appearance">Appearance</Tabs.Trigger>
          <Tabs.Trigger value="language">Language</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="appearance">Appearance panel</Tabs.Content>
        <Tabs.Content value="language">Language panel</Tabs.Content>
      </Tabs.Root>,
    );

    expect(screen.getByText('Appearance panel')).toBeVisible();
    await user.click(screen.getByRole('tab', { name: 'Language' }));

    expect(screen.getByText('Language panel')).toBeVisible();
    expect(screen.queryByText('Appearance panel')).not.toBeInTheDocument();
    await expectNoViolations(container);
  });
});
