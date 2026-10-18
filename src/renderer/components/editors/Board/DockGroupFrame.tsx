import type { DockGroup, GroupTransform, Rect } from '@renderer/lib/board';
import { ItemResizer } from './items/ItemResizer';
import { RotateHandles } from './items/RotateHandles';
import styles from './BoardEditor.module.scss';

export interface DockGroupFrameProps {
  group: DockGroup;
  label: string;
  snapping: boolean;
  keepRatio: boolean;
  gridStep: (zoom: number) => number;
  onStart: () => void;
  onPreview: (next: GroupTransform | null) => void;
  onCommit: (next: GroupTransform) => void;
}

export function DockGroupFrame({
  group,
  label,
  snapping,
  keepRatio,
  gridStep,
  onStart,
  onPreview,
  onCommit,
}: DockGroupFrameProps) {
  const { rect, rotation } = group;
  return (
    <div
      className={styles['groupFrame']}
      role="group"
      aria-label={label}
      data-dock-group={group.dock}
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        transform: rotation ? `rotate(${String(rotation)}deg)` : undefined,
      }}
    >
      <ItemResizer
        rect={rect}
        rotation={rotation}
        keepRatio={keepRatio}
        snapping={snapping}
        gridStep={gridStep}
        onStart={onStart}
        onPreview={(next: Rect | null) => {
          onPreview(next ? { rect: next, rotation } : null);
        }}
        onCommit={(next) => {
          onCommit({ rect: next, rotation });
        }}
      />
      <RotateHandles
        rotation={rotation}
        snapping={snapping}
        onPreview={(angle) => {
          if (angle !== null) onStart();
          onPreview(angle === null ? null : { rect, rotation: angle });
        }}
        onCommit={(angle) => {
          onCommit({ rect, rotation: angle });
        }}
      />
    </div>
  );
}
