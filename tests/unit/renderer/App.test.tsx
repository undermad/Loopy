import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '@renderer/App';

beforeEach(() => {
  window.loopy = { getAppVersion: vi.fn(() => Promise.resolve({ app: '0.1.0', electron: '44.8.0' })) };
});

describe('App', () => {
  it('renders the heading and the version badge', async () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Loopy');
    expect(await screen.findByRole('button', { name: 'Loopy v0.1.0' })).toBeInTheDocument();
  });

  it('matches the stable layout snapshot', async () => {
    const { container } = render(<App />);
    await screen.findByRole('button', { name: 'Loopy v0.1.0' });

    expect(container.firstChild).toMatchSnapshot();
  });
});
