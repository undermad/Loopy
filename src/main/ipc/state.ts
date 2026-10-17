import type { IpcMain } from 'electron';
import { IpcChannel, shellStatePatchSchema, type ShellState } from '@shared/ipc';
import type { DeviceStateService } from '../services/device-state';

export interface StateHandlerDeps {
  deviceState: DeviceStateService;
}

export function shellStateOf(deviceState: DeviceStateService): ShellState {
  const device = deviceState.get();
  return { workspaces: device.workspaces ?? null, statusBar: device.statusBar };
}

export function registerStateHandlers(ipc: Pick<IpcMain, 'handle'>, deps: StateHandlerDeps): void {
  ipc.handle(IpcChannel.stateGet, () => shellStateOf(deps.deviceState));
  ipc.handle(IpcChannel.stateSet, async (_event, raw: unknown) => {
    const patch = shellStatePatchSchema.parse(raw);
    const next: Partial<ReturnType<DeviceStateService['get']>> = {};
    if (patch.workspaces !== undefined) next.workspaces = patch.workspaces ?? undefined;
    if (patch.statusBar !== undefined) next.statusBar = patch.statusBar;
    await deps.deviceState.update(next);
    return shellStateOf(deps.deviceState);
  });
}
