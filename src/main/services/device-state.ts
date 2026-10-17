import type { DeviceState } from '@shared/device-state';
import type { JsonStore } from '../storage/json-store';

export interface DeviceStateService {
  get(): DeviceState;
  update(patch: Partial<DeviceState>): Promise<DeviceState>;
}

export async function createDeviceStateService(
  store: JsonStore<DeviceState>,
  onLoadError?: (error: unknown) => void,
): Promise<DeviceStateService> {
  let current: DeviceState;
  try {
    current = await store.load();
  } catch (error) {
    onLoadError?.(error);
    current = store.defaults();
  }
  let queue: Promise<unknown> = Promise.resolve();

  return {
    get: () => current,
    update: (patch) => {
      current = { ...current, ...patch };
      const snapshot = current;
      const write = queue.then(() => store.save(snapshot)).then(() => snapshot);
      queue = write.catch(() => undefined);
      return write;
    },
  };
}
