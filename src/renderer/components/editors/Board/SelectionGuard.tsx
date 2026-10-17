import { useEffect } from 'react';
import { useStoreApi } from '@xyflow/react';

export function SelectionGuard() {
  const store = useStoreApi();

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (event.buttons !== 0) return;
      const { userSelectionRect, userSelectionActive } = store.getState();
      if (userSelectionRect || userSelectionActive) {
        store.setState({ userSelectionRect: null, userSelectionActive: false });
      }
    };
    window.addEventListener('pointermove', onPointerMove);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
    };
  }, [store]);

  return null;
}
