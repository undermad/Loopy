import { render } from '@testing-library/react';
import { ReactFlowProvider, useStoreApi } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import { SelectionGuard } from '@renderer/components/editors/Board/SelectionGuard';

let api: ReturnType<typeof useStoreApi> | null = null;

function Probe() {
  api = useStoreApi();
  return <SelectionGuard />;
}

describe('SelectionGuard', () => {
  it('clears a selection box left behind when the pointer comes back without a button held', () => {
    render(
      <ReactFlowProvider>
        <Probe />
      </ReactFlowProvider>,
    );
    const store = api;
    if (!store) throw new Error('store missing');
    const rect = { startX: 0, startY: 0, x: 0, y: 0, width: 0, height: 0 };

    store.setState({ userSelectionRect: rect, userSelectionActive: true });
    window.dispatchEvent(new PointerEvent('pointermove', { buttons: 1 }));
    expect(store.getState().userSelectionRect).toEqual(rect);

    window.dispatchEvent(new PointerEvent('pointermove', { buttons: 0 }));
    expect(store.getState().userSelectionRect).toBeNull();
    expect(store.getState().userSelectionActive).toBe(false);
  });
});
