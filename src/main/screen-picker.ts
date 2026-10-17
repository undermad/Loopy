import { z } from 'zod';
import { IpcChannel } from '@shared/ipc';
import { hexColorSchema } from '@shared/theme';

export const PICKER_PROTOCOL = 'loopy-picker';
export const PICKER_URL = `${PICKER_PROTOCOL}://picker/`;

export const pickerSchemePrivileges = {
  scheme: PICKER_PROTOCOL,
  privileges: { standard: true, secure: true },
};

export interface PickerDisplay {
  id: number;
  bounds: { x: number; y: number; width: number; height: number };
  scaleFactor: number;
}

export const pickerPointSchema = z
  .object({
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })
  .refine((point) => point.x < point.width && point.y < point.height);

export type PickerPoint = z.infer<typeof pickerPointSchema>;

export interface PickerWindow {
  webContentsId: number;
  loadURL: (url: string) => Promise<void>;
  show: () => void;
  hide: () => void;
  send: (channel: string, payload: unknown) => void;
  close: () => void;
  on: (event: 'closed', listener: () => void) => void;
}

export interface PickerEvent {
  sender: { id: number };
}

export interface PickerIpc {
  on: (channel: string, listener: (event: PickerEvent, payload: unknown) => void) => void;
  removeAllListeners: (channel: string) => void;
}

export interface ScreenPickerDeps {
  displays: () => PickerDisplay[];
  sourceIds: (displays: PickerDisplay[]) => Promise<Map<number, string>>;
  cursorDisplayId: () => number;
  colourAt: (display: PickerDisplay, point: PickerPoint) => Promise<string | null>;
  createWindow: (display: PickerDisplay) => PickerWindow;
  ipc: PickerIpc;
}

export interface ScreenSource {
  id: string;
  display_id: string;
}

export function sourceForDisplay<T extends ScreenSource>(
  sources: T[],
  displayId: number,
  displayIndex: number,
): T | null {
  return sources.find((source) => source.display_id === String(displayId)) ?? sources[displayIndex] ?? null;
}

export function scalePoint(
  point: PickerPoint,
  size: { width: number; height: number },
): { x: number; y: number } {
  return {
    x: Math.min(size.width - 1, Math.floor((point.x * size.width) / point.width)),
    y: Math.min(size.height - 1, Math.floor((point.y * size.height) / point.height)),
  };
}

export function hexFromBgra(bytes: Uint8Array): string | null {
  if (bytes.length < 3) return null;
  const [b = 0, g = 0, r = 0] = bytes;
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

export function pickerHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'" />
<title>Pick a colour</title>
<style>
html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: rgba(0,0,0,.01); cursor: none; }
video { display: none; }
#cross, #loupe, #label { position: fixed; left: 0; top: 0; pointer-events: none; will-change: transform; visibility: hidden; }
#cross { width: 21px; height: 21px; }
#cross::before, #cross::after { content: ''; position: absolute; background: #fff; box-shadow: 0 0 0 1px #000; }
#cross::before { left: 10px; top: 0; width: 1px; height: 21px; }
#cross::after { top: 10px; left: 0; width: 21px; height: 1px; }
#loupe { width: 120px; height: 120px; border: 2px solid #fff; border-radius: 50%; box-shadow: 0 0 0 1px rgba(0,0,0,.6), 0 4px 16px rgba(0,0,0,.4); overflow: hidden; background: #000; }
#zoom { width: 120px; height: 120px; image-rendering: pixelated; }
#label { padding: 4px 8px; border-radius: 4px; background: rgba(0,0,0,.75); color: #fff; font: 13px ui-monospace, monospace; }
</style>
</head>
<body>
<video id="screen" muted></video>
<div id="loupe"><canvas id="zoom" width="120" height="120"></canvas></div>
<div id="label"></div>
<div id="cross"></div>
<script>
(() => {
  const video = document.getElementById('screen');
  const cross = document.getElementById('cross');
  const loupe = document.getElementById('loupe');
  const label = document.getElementById('label');
  const zoom = document.getElementById('zoom').getContext('2d', { alpha: false });
  zoom.imageSmoothingEnabled = false;
  let pointer = null;
  let scheduled = false;
  let hex = '';
  let readAt = 0;
  let trailing = 0;
  let picked = false;
  let stream = null;
  const place = (element, x, y) => { element.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)'; };
  const show = (visible) => { for (const element of [cross, loupe, label]) element.style.visibility = visible ? 'visible' : 'hidden'; };
  const toFrame = (clientX, clientY) => {
    const width = video.videoWidth;
    const height = video.videoHeight;
    return {
      x: Math.min(width - 1, Math.max(0, Math.floor((clientX * width) / window.innerWidth))),
      y: Math.min(height - 1, Math.max(0, Math.floor((clientY * height) / window.innerHeight))),
      width,
      height,
    };
  };
  const render = () => {
    scheduled = false;
    if (!pointer || picked) return;
    place(cross, pointer.x - 10, pointer.y - 10);
    if (video.videoWidth === 0) return;
    const point = toFrame(pointer.x, pointer.y);
    zoom.fillStyle = '#000';
    zoom.fillRect(0, 0, 120, 120);
    zoom.drawImage(video, point.x - 7, point.y - 7, 15, 15, 0, 0, 120, 120);
    const now = performance.now();
    if (now - readAt < 50) {
      trailing ||= setTimeout(() => { trailing = 0; schedule(); }, 50);
    } else {
      readAt = now;
      const [r, g, b] = zoom.getImageData(60, 60, 1, 1).data;
      const next = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
      if (next !== hex) { hex = next; label.textContent = hex; }
    }
    zoom.strokeStyle = '#fff';
    zoom.strokeRect(56, 56, 8, 8);
    const left = Math.min(pointer.x + 20, window.innerWidth - 130);
    const top = Math.min(pointer.y + 20, window.innerHeight - 160);
    place(loupe, left, top);
    place(label, left, top + 128);
    show(true);
  };
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(render);
  };
  const onFrame = () => { schedule(); video.requestVideoFrameCallback(onFrame); };
  video.requestVideoFrameCallback(onFrame);
  let source = null;
  const start = () => {
    if (stream || !source) return;
    stream = navigator.mediaDevices
      .getUserMedia({ audio: false, video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: source } } })
      .then((media) => { video.srcObject = media; return video.play(); })
      .catch(() => { window.picker.cancel(); });
  };
  window.picker.onStart((value) => {
    if (!value || typeof value.id !== 'string' || value.id === '') { window.picker.cancel(); return; }
    source = value.id;
    if (value.active || pointer) start();
  });
  window.addEventListener('mousemove', (event) => {
    pointer = { x: event.clientX, y: event.clientY };
    start();
    schedule();
  });
  window.addEventListener('mouseleave', () => { pointer = null; show(false); });
  window.addEventListener('click', (event) => {
    if (video.videoWidth === 0) return;
    picked = true;
    loupe.style.visibility = 'hidden';
    label.style.visibility = 'hidden';
    window.picker.done(toFrame(event.clientX, event.clientY));
  });
  window.addEventListener('contextmenu', (event) => { event.preventDefault(); window.picker.cancel(); });
  window.addEventListener('keydown', (event) => { if (event.key === 'Escape') window.picker.cancel(); });
})();
</script>
</body>
</html>`;
}

export function handlePickerRequest(request: Request): Response {
  if (request.url !== PICKER_URL) return new Response(null, { status: 404 });
  return new Response(pickerHtml(), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

export interface ScreenPicker {
  pick: () => Promise<string | null>;
  dispose: () => void;
}

interface Overlay {
  key: string;
  window: PickerWindow;
  ready: Promise<void>;
}

function displayKey(display: PickerDisplay): string {
  const { x, y, width, height } = display.bounds;
  return [x, y, width, height, display.scaleFactor].join(',');
}

function load(window: PickerWindow): Promise<void> {
  return window.loadURL(PICKER_URL).catch(() => undefined);
}

export function createScreenPicker(deps: ScreenPickerDeps): ScreenPicker {
  const overlays = new Map<number, Overlay>();
  let onClosed: (() => void) | null = null;
  let active: Promise<string | null> | null = null;
  let cached: { key: string; ids: Promise<Map<number, string>> } | null = null;

  const sourcesFor = (displays: PickerDisplay[]): Promise<Map<number, string>> => {
    const key = displays.map((display) => `${String(display.id)}:${displayKey(display)}`).join('|');
    if (cached?.key === key) return cached.ids;
    const ids = deps.sourceIds(displays).catch(() => new Map<number, string>());
    const entry = { key, ids };
    cached = entry;
    void ids.then((found) => {
      if (found.size < displays.length && cached === entry) cached = null;
    });
    return ids;
  };

  const discard = (id: number) => {
    const overlay = overlays.get(id);
    if (!overlay) return;
    overlays.delete(id);
    overlay.window.close();
  };

  const acquire = (display: PickerDisplay): Overlay => {
    const key = displayKey(display);
    const existing = overlays.get(display.id);
    if (existing?.key === key) return existing;
    discard(display.id);
    const window = deps.createWindow(display);
    const overlay: Overlay = { key, window, ready: load(window) };
    window.on('closed', () => {
      if (overlays.get(display.id) !== overlay) return;
      overlays.delete(display.id);
      onClosed?.();
    });
    overlays.set(display.id, overlay);
    return overlay;
  };

  const run = (): Promise<string | null> => {
    const displays = deps.displays();
    const present = new Set(displays.map((display) => display.id));
    for (const id of [...overlays.keys()]) if (!present.has(id)) discard(id);
    if (displays.length === 0) return Promise.resolve(null);
    const activeId = deps.cursorDisplayId();
    const used = displays.map((display) => ({ display, overlay: acquire(display) }));
    const sources = Promise.all(used.map(({ overlay }) => overlay.ready))
      .then(() => new Promise((resolve) => setTimeout(resolve, 0)))
      .then(() => sourcesFor(displays));
    return session(deps, sources, activeId, used, (finish) => {
      onClosed = () => {
        finish(null);
      };
    }).finally(() => {
      onClosed = null;
      for (const { overlay } of used) {
        if (![...overlays.values()].includes(overlay)) continue;
        overlay.window.hide();
        overlay.ready = load(overlay.window);
      }
    });
  };

  return {
    pick: () => {
      if (active) return active;
      active = run().finally(() => {
        active = null;
      });
      return active;
    },
    dispose: () => {
      onClosed?.();
      for (const id of [...overlays.keys()]) discard(id);
    },
  };
}

function session(
  deps: ScreenPickerDeps,
  sources: Promise<Map<number, string>>,
  activeId: number,
  used: { display: PickerDisplay; overlay: Overlay }[],
  bind: (finish: (value: string | null) => void) => void,
): Promise<string | null> {
  const byWebContents = new Map(used.map(({ display, overlay }) => [overlay.window.webContentsId, display]));
  return new Promise<string | null>((resolve) => {
    let settled = false;
    const open = () => !settled;
    let sampling = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      deps.ipc.removeAllListeners(IpcChannel.pickerDone);
      resolve(value);
    };
    bind(finish);
    deps.ipc.on(IpcChannel.pickerDone, (event, payload) => {
      const display = byWebContents.get(event.sender.id);
      if (!display || sampling) return;
      const point = pickerPointSchema.nullable().safeParse(payload);
      if (!point.success || point.data === null) {
        finish(null);
        return;
      }
      sampling = true;
      deps.colourAt(display, point.data).then(
        (hex) => {
          const parsed = hexColorSchema.safeParse(hex);
          finish(parsed.success ? parsed.data.toLowerCase() : null);
        },
        () => {
          finish(null);
        },
      );
    });
    for (const { display, overlay } of used) {
      void overlay.ready.then(async () => {
        if (!open()) return;
        overlay.window.show();
        const id = (await sources).get(display.id);
        if (open())
          overlay.window.send(IpcChannel.pickerStart, id ? { id, active: display.id === activeId } : null);
      });
    }
  });
}
