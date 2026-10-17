import { describe, expect, it, vi } from 'vitest';
import { IpcChannel } from '@shared/ipc';
import { registerColourHandlers } from '../../../src/main/ipc/colour';
import {
  createScreenPicker,
  handlePickerRequest,
  hexFromBgra,
  PICKER_URL,
  pickerHtml,
  scalePoint,
  sourceForDisplay,
  type PickerDisplay,
  type PickerEvent,
  type PickerIpc,
  type PickerWindow,
  type ScreenPickerDeps,
} from '../../../src/main/screen-picker';

type Handler = (event: unknown, ...args: unknown[]) => unknown;

function fakeIpc() {
  const listeners = new Map<string, (event: PickerEvent, payload: unknown) => void>();
  const ipc: PickerIpc = {
    on: vi.fn((channel: string, listener: (event: PickerEvent, payload: unknown) => void) =>
      listeners.set(channel, listener),
    ),
    removeAllListeners: vi.fn((channel: string) => listeners.delete(channel)),
  };
  const done = (sender: number, payload: unknown) => {
    listeners.get(IpcChannel.pickerDone)?.({ sender: { id: sender } }, payload);
  };
  return { ipc, done };
}

function fakeWindow(webContentsId: number) {
  const closed: (() => void)[] = [];
  const window: PickerWindow & { sent: unknown[]; closedCount: number } = {
    webContentsId,
    sent: [],
    closedCount: 0,
    loadURL: vi.fn(() => Promise.resolve()),
    show: vi.fn(),
    hide: vi.fn(),
    send: vi.fn((channel: string, payload: unknown) => {
      if (channel === IpcChannel.pickerStart) window.sent.push(payload);
    }),
    close: vi.fn(() => {
      window.closedCount += 1;
      closed.forEach((listener) => {
        listener();
      });
    }),
    on: vi.fn((_event: 'closed', listener: () => void) => {
      closed.push(listener);
    }),
  };
  return window;
}

function at<T>(list: T[], index: number): T {
  const item = list[index];
  if (item === undefined) throw new Error(`No item at ${String(index)}`);
  return item;
}

const display = { id: 1, bounds: { x: 0, y: 0, width: 800, height: 600 }, scaleFactor: 1 };
const second = { id: 2, bounds: { x: 800, y: 0, width: 800, height: 600 }, scaleFactor: 2 };
const point = { x: 10, y: 20, width: 1600, height: 1200 };

function setup(overrides: Partial<ScreenPickerDeps> = {}) {
  const { ipc, done } = fakeIpc();
  const windows: ReturnType<typeof fakeWindow>[] = [];
  let displays: PickerDisplay[] = [display, second];
  const deps: ScreenPickerDeps = {
    displays: () => displays,
    sourceIds: vi.fn((items: PickerDisplay[]) =>
      Promise.resolve(new Map(items.map((item) => [item.id, `screen:${String(item.id)}`]))),
    ),
    cursorDisplayId: () => 2,
    colourAt: vi.fn(() => Promise.resolve('#ABCDEF')),
    createWindow: vi.fn(() => {
      const window = fakeWindow(windows.length + 1);
      windows.push(window);
      return window;
    }),
    ipc,
    ...overrides,
  };
  const picker = createScreenPicker(deps);
  const setDisplays = (next: PickerDisplay[]) => {
    displays = next;
  };
  return { deps, picker, windows, done, setDisplays };
}

describe('screen picker', () => {
  it('shows one overlay per display, starts each with its source and samples the clicked point', async () => {
    const { deps, picker, windows, done } = setup();
    const pending = picker.pick();
    await vi.waitFor(() => {
      expect(windows.every((window) => window.sent.length === 1)).toBe(true);
    });
    expect(windows).toHaveLength(2);
    expect(vi.mocked(at(windows, 0).loadURL).mock.calls[0]?.[0]).toBe(PICKER_URL);
    expect(at(windows, 0).show).toHaveBeenCalled();
    expect(at(windows, 0).sent[0]).toEqual({ id: 'screen:1', active: false });
    expect(at(windows, 1).sent[0]).toEqual({ id: 'screen:2', active: true });
    done(9, point);
    done(2, point);
    done(1, point);
    await expect(pending).resolves.toBe('#abcdef');
    expect(deps.colourAt).toHaveBeenCalledTimes(1);
    expect(deps.colourAt).toHaveBeenCalledWith(second, point);
    expect(windows.every((window) => vi.mocked(window.hide).mock.calls.length === 1)).toBe(true);
    expect(windows.every((window) => window.closedCount === 0)).toBe(true);
  });

  it('reuses hidden overlays and cached sources, and rebuilds them when displays change', async () => {
    const { deps, picker, windows, done, setDisplays } = setup();
    for (let run = 0; run < 2; run++) {
      const pending = picker.pick();
      await vi.waitFor(() => {
        expect(windows[0]?.sent).toHaveLength(run + 1);
      });
      done(1, null);
      await expect(pending).resolves.toBeNull();
    }
    expect(deps.createWindow).toHaveBeenCalledTimes(2);
    expect(deps.sourceIds).toHaveBeenCalledTimes(1);
    expect(vi.mocked(at(windows, 0).loadURL)).toHaveBeenCalledTimes(3);

    setDisplays([{ ...display, bounds: { ...display.bounds, width: 1024 } }]);
    const moved = picker.pick();
    await vi.waitFor(() => {
      expect(windows[2]?.sent).toHaveLength(1);
    });
    expect(at(windows, 0).closedCount).toBe(1);
    expect(at(windows, 1).closedCount).toBe(1);
    expect(deps.sourceIds).toHaveBeenCalledTimes(2);
    done(3, null);
    await expect(moved).resolves.toBeNull();
  });

  it('looks sources up again when a display had none, and starts that overlay with nothing', async () => {
    const sourceIds = vi.fn(() => Promise.resolve(new Map([[1, 'screen:1']])));
    const { picker, windows, done } = setup({ sourceIds });
    for (let run = 0; run < 2; run++) {
      const pending = picker.pick();
      await vi.waitFor(() => {
        expect(windows[1]?.sent).toHaveLength(run + 1);
      });
      expect(at(windows, 1).sent[run]).toBeNull();
      done(1, null);
      await pending;
    }
    expect(sourceIds).toHaveBeenCalledTimes(2);
  });

  it('resolves null on close, cancel, bad points or a failed sample and runs one pick at a time', async () => {
    let sample: () => Promise<string | null> = () => Promise.resolve('#112233');
    const { picker, windows, done } = setup({ colourAt: () => sample() });
    const first = picker.pick();
    expect(picker.pick()).toBe(first);
    await vi.waitFor(() => {
      expect(windows[0]?.show).toHaveBeenCalled();
    });
    at(windows, 0).close();
    await expect(first).resolves.toBeNull();

    for (const payload of [null, { x: 5, y: 5, width: 5, height: 5 }, '#000000']) {
      const run = picker.pick();
      done(2, payload);
      await expect(run).resolves.toBeNull();
    }

    sample = () => Promise.reject(new Error('capture failed'));
    const failed = picker.pick();
    done(2, point);
    await expect(failed).resolves.toBeNull();

    sample = () => Promise.resolve('not a colour');
    const invalid = picker.pick();
    done(2, point);
    await expect(invalid).resolves.toBeNull();
  });

  it('closes every overlay on dispose and resolves a pick in progress', async () => {
    const { picker, windows } = setup();
    const pending = picker.pick();
    await vi.waitFor(() => {
      expect(windows[1]?.show).toHaveBeenCalled();
    });
    picker.dispose();
    await expect(pending).resolves.toBeNull();
    expect(windows.every((window) => window.closedCount === 1)).toBe(true);
  });

  it('resolves null without displays', async () => {
    const { picker, windows, setDisplays } = setup();
    setDisplays([]);
    await expect(picker.pick()).resolves.toBeNull();
    expect(windows).toHaveLength(0);
  });

  it('serves a live overlay page from its own secure scheme', async () => {
    const html = pickerHtml();
    expect(html).toContain('window.picker.onStart(');
    expect(html).toContain("chromeMediaSource: 'desktop'");
    expect(html).toContain('requestVideoFrameCallback');
    expect(html).toContain('requestAnimationFrame');
    expect(html).toContain('window.picker.done(');
    expect(html).toContain('window.picker.cancel()');
    expect(html).toContain('Content-Security-Policy');
    const page = handlePickerRequest(new Request(PICKER_URL));
    expect(page.status).toBe(200);
    expect(page.headers.get('content-type')).toContain('text/html');
    await expect(page.text()).resolves.toBe(html);
    expect(handlePickerRequest(new Request(`${PICKER_URL}other`)).status).toBe(404);
  });

  it('matches sources to displays, scales points and reads BGRA pixels', () => {
    const sources = [
      { id: 'a', display_id: '7' },
      { id: 'b', display_id: '' },
    ];
    expect(sourceForDisplay(sources, 7, 1)?.id).toBe('a');
    expect(sourceForDisplay(sources, 3, 1)?.id).toBe('b');
    expect(sourceForDisplay(sources, 3, 5)).toBeNull();
    expect(scalePoint({ x: 1599, y: 600, width: 1600, height: 1200 }, { width: 800, height: 600 })).toEqual({
      x: 799,
      y: 300,
    });
    expect(hexFromBgra(new Uint8Array([0x66, 0x33, 0xff, 0xff]))).toBe('#ff3366');
    expect(hexFromBgra(new Uint8Array([]))).toBeNull();
  });
});

describe('colour IPC handlers', () => {
  it('forwards the screen pick', async () => {
    const handlers = new Map<string, Handler>();
    const ipc = { handle: vi.fn((channel: string, handler: Handler) => handlers.set(channel, handler)) };
    registerColourHandlers(ipc, { pickScreenColour: () => Promise.resolve('#112233') });
    await expect(handlers.get(IpcChannel.colourPickScreen)?.({})).resolves.toBe('#112233');
  });
});
