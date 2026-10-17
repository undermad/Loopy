import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { LAYOUT_SCHEMA_VERSION, type LayoutPreset } from '@shared/layout';
import { buildWorkspace } from '@shared/layout-presets';
import { App } from '@renderer/App';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

let api: FakeApi;
const preset: LayoutPreset = {
  schemaVersion: LAYOUT_SCHEMA_VERSION,
  id: 'mine',
  name: 'Mine',
  workspaces: [buildWorkspace('empty', 'Only')],
};

beforeEach(async () => {
  api = await bootTestApp({}, 'light', (fake) => {
    fake.layouts.push(preset);
  });
  const project = makeProject('Space Game');
  api.projects = [project];
  api.current = project;
  api.emitProject();
});

describe('saved layouts in the Window menu', () => {
  it('lists saved layouts next to the built-in ones', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('tab', { name: 'Planning' });

    await user.click(screen.getByRole('menuitem', { name: 'Window' }));
    await user.hover(await screen.findByRole('menuitem', { name: 'Load layout' }));

    expect(await screen.findByRole('menuitem', { name: 'Mine' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Default' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'No saved layouts' })).not.toBeInTheDocument();
  });
});
