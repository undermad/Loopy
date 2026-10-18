import { describe, expect, it, vi } from 'vitest';
import { syncingIpc } from '../../../src/main/ipc/sync';

type Handler = (event: unknown, ...args: unknown[]) => unknown;

describe('project data sync', () => {
  it('tells other windows after a change but not after a read', async () => {
    const handlers = new Map<string, Handler>();
    const ipc = { handle: vi.fn((channel: string, handler: Handler) => handlers.set(channel, handler)) };
    const notify = vi.fn();
    const wrapped = syncingIpc(ipc, 'boards', notify);
    wrapped.handle('boards:list', () => ['a']);
    wrapped.handle('boards:applyChanges', (_event, value: unknown) => value);
    const event = { sender: { id: 1 } };

    await expect(handlers.get('boards:list')?.(event)).resolves.toEqual(['a']);
    expect(notify).not.toHaveBeenCalled();
    await expect(handlers.get('boards:applyChanges')?.(event, 5)).resolves.toBe(5);
    expect(notify).toHaveBeenCalledWith(event, 'boards');
  });
});
