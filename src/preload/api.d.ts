import type { LoopyApi } from '@shared/ipc';

declare global {
  interface Window {
    loopy: LoopyApi;
  }
}

export {};
