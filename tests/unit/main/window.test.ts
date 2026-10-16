import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const electronMock = vi.hoisted(() => {
  const instances: Record<string, unknown>[] = [];
  const BrowserWindow = vi.fn(function (this: Record<string, unknown>, options: unknown) {
    this['options'] = options;
    this['on'] = vi.fn();
    this['show'] = vi.fn();
    this['loadURL'] = vi.fn(() => Promise.resolve());
    this['loadFile'] = vi.fn(() => Promise.resolve());
    this['webContents'] = { setWindowOpenHandler: vi.fn() };
    instances.push(this);
  });
  return { BrowserWindow, instances, shell: { openExternal: vi.fn(() => Promise.resolve()) } };
});

vi.mock('electron', () => ({ BrowserWindow: electronMock.BrowserWindow, shell: electronMock.shell }));

const { createMainWindow, createWindowOptions } = await import('../../../src/main/window');

type MockFn = ReturnType<typeof vi.fn>;

describe('createWindowOptions', () => {
  it('applies the Electron hardening settings', () => {
    const options = createWindowOptions('/preload.js');

    expect(options.webPreferences).toMatchObject({
      preload: '/preload.js',
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    });
  });
});

describe('renderer index.html', () => {
  it('declares a Content Security Policy without remote sources', () => {
    const html = readFileSync(resolve(import.meta.dirname, '../../../src/renderer/index.html'), 'utf8');
    const match = /Content-Security-Policy"\s+content="([^"]+)"/.exec(html);

    expect(match?.[1]).toContain("default-src 'self'");
    expect(match?.[1]).not.toContain('http');
  });
});

describe('createMainWindow', () => {
  beforeEach(() => {
    electronMock.instances.length = 0;
    vi.unstubAllEnvs();
  });

  it('loads the dev server URL when electron-vite provides one', () => {
    vi.stubEnv('ELECTRON_RENDERER_URL', 'http://localhost:5173');
    createMainWindow();

    const window = electronMock.instances[0];
    expect(window?.['loadURL']).toHaveBeenCalledWith('http://localhost:5173');
    expect(window?.['loadFile']).not.toHaveBeenCalled();
  });

  it('loads the built renderer file otherwise and opens external links outside the app', () => {
    vi.stubEnv('ELECTRON_RENDERER_URL', '');
    createMainWindow();

    const window = electronMock.instances[0];
    expect(window?.['loadFile']).toHaveBeenCalledWith(expect.stringContaining('index.html'));

    const webContents = window?.['webContents'] as { setWindowOpenHandler: MockFn };
    const handler = webContents.setWindowOpenHandler.mock.calls[0]?.[0] as (details: { url: string }) => {
      action: string;
    };
    expect(handler({ url: 'https://example.com' })).toEqual({ action: 'deny' });
    expect(electronMock.shell.openExternal).toHaveBeenCalledWith('https://example.com');
  });

  it('shows the window once it is ready', () => {
    createMainWindow();

    const window = electronMock.instances[0];
    const on = window?.['on'] as MockFn;
    const readyHandler = on.mock.calls.find((call) => call[0] === 'ready-to-show')?.[1] as () => void;
    readyHandler();

    expect(window?.['show']).toHaveBeenCalled();
  });
});
