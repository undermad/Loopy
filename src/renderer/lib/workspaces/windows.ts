import type { LoopyApi } from '@shared/ipc';
import type { LayoutNode } from '@shared/layout';
import { areaActions } from './areas';
import { workspacesStore } from './store';

export type WindowsApi = Pick<
  LoopyApi,
  'detachArea' | 'getDetachedLayout' | 'returnLayout' | 'onLayoutReturned'
>;

export interface DetachBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

let windowsApi: WindowsApi | null = null;
let detached = false;

export async function bootWindows(api: WindowsApi): Promise<void> {
  windowsApi = api;
  const layout = await api.getDetachedLayout();
  if (layout) {
    detached = true;
    workspacesStore.setState({
      api: null,
      workspaces: [{ id: 'detached', name: 'Window', root: layout }],
      activeId: 'detached',
    });
    return;
  }
  detached = false;
  api.onLayoutReturned((returned) => {
    areaActions.receive(returned);
  });
}

export function isDetachedWindow(): boolean {
  return detached;
}

export async function detachArea(areaId: string, bounds: DetachBounds): Promise<void> {
  const area = areaActions.take(areaId);
  if (area && windowsApi) await windowsApi.detachArea({ layout: area, ...bounds });
}

export async function returnToMainWindow(): Promise<void> {
  const { workspaces, activeId } = workspacesStore.getState();
  const root: LayoutNode | undefined = workspaces.find((item) => item.id === activeId)?.root;
  if (root && windowsApi) await windowsApi.returnLayout(root);
}
