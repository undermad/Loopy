import { describe, expect, it, vi } from 'vitest';
import { IpcChannel, type LoopyApi } from '@shared/ipc';
import { lightTheme } from '@shared/theme';

const electronMock = vi.hoisted(() => ({
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: { invoke: vi.fn(), on: vi.fn(), removeListener: vi.fn() },
}));

vi.mock('electron', () => electronMock);

await import('../../../src/preload/index');

const [exposedName, api] = electronMock.contextBridge.exposeInMainWorld.mock.calls[0] as [string, LoopyApi];

describe('preload API', () => {
  it('is exposed to the renderer as window.loopy', () => {
    expect(exposedName).toBe('loopy');
  });

  it('forwards getAppVersion over the IPC channel and validates the reply', async () => {
    electronMock.ipcRenderer.invoke.mockResolvedValueOnce({ app: '0.1.0', electron: '44.0.0' });

    await expect(api.getAppVersion()).resolves.toEqual({ app: '0.1.0', electron: '44.0.0' });
    expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith(IpcChannel.getAppVersion);
  });

  it('rejects a malformed reply from the main process', async () => {
    electronMock.ipcRenderer.invoke.mockResolvedValueOnce({ app: 123 });

    await expect(api.getAppVersion()).rejects.toThrow();
  });

  it('passes arguments through for setSettings and saveTheme', async () => {
    electronMock.ipcRenderer.invoke.mockResolvedValueOnce({
      schemaVersion: 2,
      theme: { mode: 'dark', light: 'light', dark: 'dark' },
      language: 'en',
      uiFont: 'Inter',
      fontSize: 14,
      defaultLayoutId: 'default',
    });
    await api.setSettings({ fontSize: 14 });
    expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith(IpcChannel.settingsSet, { fontSize: 14 });

    electronMock.ipcRenderer.invoke.mockResolvedValueOnce(lightTheme);
    await expect(api.saveTheme(lightTheme)).resolves.toEqual(lightTheme);
  });

  it('subscribes to pushed events, validates payloads and unsubscribes', () => {
    const listener = vi.fn();
    const unsubscribe = api.onNativeThemeChanged(listener);

    const [channel, handler] = electronMock.ipcRenderer.on.mock.calls.at(-1) as [
      string,
      (event: unknown, payload: unknown) => void,
    ];
    expect(channel).toBe(IpcChannel.shellNativeThemeChanged);

    handler({}, 'dark');
    expect(listener).toHaveBeenCalledWith('dark');
    expect(() => {
      handler({}, 'sepia');
    }).toThrow();

    unsubscribe();
    expect(electronMock.ipcRenderer.removeListener).toHaveBeenCalledWith(channel, handler);
  });
});

describe('preload API coverage', () => {
  const settings = {
    schemaVersion: 2,
    theme: { mode: 'dark', light: 'light', dark: 'dark' },
    language: 'en',
    uiFont: 'Inter',
    fontSize: 14,
    defaultLayoutId: 'default',
  };
  const project = {
    id: '0b5d1a8e-2c4f-4e7a-9b3c-1d2e3f4a5b6c',
    name: 'Demo',
    createdAt: '2026-10-17T09:00:00.000Z',
    updatedAt: '2026-10-17T09:00:00.000Z',
  };
  const snapshot = { states: [], tickets: [], labels: [], ticketLabels: [] };
  const board = {
    id: 'b',
    name: 'Board',
    backgroundColor: '#ffffff',
    unit: 'm',
    unitScale: 100,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
  const layout = {
    schemaVersion: 1,
    id: 'l',
    name: 'Layout',
    workspaces: [{ id: 'w', name: 'W', root: { kind: 'area', id: 'a', editor: 'empty', state: {} } }],
  };
  const cases: [keyof LoopyApi, unknown[], unknown][] = [
    ['getSettings', [], settings],
    ['getNativeTheme', [], 'dark'],
    ['getLocale', [], 'en-GB'],
    ['toggleFullscreen', [], true],
    ['editCommand', ['copy'], undefined],
    ['listThemes', [], [lightTheme]],
    ['deleteTheme', ['x'], undefined],
    ['exportTheme', ['x'], { status: 'exported' }],
    ['importTheme', [], { status: 'cancelled' }],
    ['listProjects', [], [project]],
    ['createProject', ['Demo'], project],
    ['openProject', [project.id], { status: 'opened', project }],
    ['closeProject', [], undefined],
    ['getProjectState', [], { current: null, recent: [] }],
    ['importProject', [], { status: 'cancelled' }],
    ['exportProject', [], { status: 'cancelled' }],
    ['deleteProject', [project.id], undefined],
    ['revealProject', [project.id], undefined],
    ['removeRecentProject', [project.id], { current: null, recent: [] }],
    ['getShellState', [], { workspaces: null, statusBar: true }],
    ['setShellState', [{ statusBar: false }], { workspaces: null, statusBar: false }],
    ['listLayouts', [], [layout]],
    ['saveLayout', [layout], layout],
    ['deleteLayout', ['l'], undefined],
    ['exportLayout', [layout], { status: 'exported' }],
    ['importLayout', [], { status: 'invalid' }],
    ['getTickets', [], snapshot],
    ['createTicket', [{ title: 'T' }], snapshot],
    ['updateTicket', ['t', { title: 'U' }], snapshot],
    ['moveTicket', [{ id: 't', stateId: null, position: 'a' }], snapshot],
    ['deleteTicket', ['t'], snapshot],
    ['setTicketLabels', ['t', ['l']], snapshot],
    ['createState', [{ name: 'S' }], snapshot],
    ['updateState', ['s', { name: 'S2' }], snapshot],
    ['moveState', ['s', 'b'], snapshot],
    ['deleteState', ['s', null], snapshot],
    ['createLabel', [{ name: 'L', color: '#ff0000' }], snapshot],
    ['updateLabel', ['l', { name: 'L2' }], snapshot],
    ['deleteLabel', ['l'], snapshot],
    ['listBoards', [], [board]],
    ['createBoard', [{ name: 'B' }], board],
    ['updateBoard', ['b', { name: 'B2' }], board],
    ['deleteBoard', ['b'], []],
    ['readBoard', ['b'], { board, nodes: [], edges: [] }],
    ['applyBoardChanges', ['b', {}], { board, nodes: [], edges: [] }],
  ];

  it.each(cases)('%s forwards its arguments and validates the reply', async (method, args, reply) => {
    electronMock.ipcRenderer.invoke.mockResolvedValueOnce(reply);
    const fn = api[method] as (...input: unknown[]) => Promise<unknown>;
    await expect(fn(...args)).resolves.toEqual(reply);
    const call = electronMock.ipcRenderer.invoke.mock.calls.at(-1) as unknown[];
    expect(call.slice(1)).toEqual(args);
  });

  it('subscribes to settings and project pushes', () => {
    const listener = vi.fn();
    api.onSettingsChanged(listener);
    api.onProjectChanged(listener);
    const registered = (electronMock.ipcRenderer.on.mock.calls as unknown[][])
      .slice(-2)
      .map((call) => call[0]);
    expect(registered).toEqual([IpcChannel.settingsChanged, IpcChannel.projectChanged]);
  });
});
