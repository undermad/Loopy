import { useEffect } from 'react';
import { useStoreApi } from '@xyflow/react';

export function SelectionGuard() {
  const store = useStoreApi();

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (event.buttons !== 0) return;
      const { userSelectionRect, userSelectionActive, domNode } = store.getState();
      if (!userSelectionRect && !userSelectionActive) return;
      store.setState({ userSelectionRect: null, userSelectionActive: false });
      domNode
        ?.querySelector('.react-flow__pane')
        ?.dispatchEvent(
          new PointerEvent('pointerup', { button: 0, bubbles: true, pointerId: event.pointerId }),
        );
    };
    window.addEventListener('pointermove', onPointerMove, true);
    return () => {
      window.removeEventListener('pointermove', onPointerMove, true);
    };
  }, [store]);

  return null;
}
