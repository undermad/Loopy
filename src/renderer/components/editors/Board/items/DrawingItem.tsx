import { memo, useEffect, useRef } from 'react';
import { useStore as useFlowStore, type NodeProps } from '@xyflow/react';
import type { ItemStyle } from '@shared/board';
import { resolveItemStyle } from '@renderer/lib/board';
import {
  TILE,
  drawingData,
  inRange,
  levelKeys,
  parseCoord,
  peekTile,
  requestLod,
  subscribeLayer,
  useLayerCoords,
  visibleRange,
  type LayerChange,
} from '@renderer/lib/drawing';
import { cx } from '@renderer/ui';
import type { ItemFlowNode } from './TextItem';
import styles from './DrawingItem.module.scss';

interface TileViewProps {
  nodeId: string;
  boardId: string;
  level: number;
  coord: string;
  left: number;
  top: number;
  size: number;
}

function affects(change: LayerChange, level: number, coord: string): boolean {
  if (change.coords === null) return true;
  const { tx, ty } = parseCoord(coord);
  return change.coords.some((child) => {
    const position = parseCoord(child);
    return Math.floor(position.tx / 2 ** level) === tx && Math.floor(position.ty / 2 ** level) === ty;
  });
}

const TileView = memo(function TileView({ nodeId, boardId, level, coord, left, top, size }: TileViewProps) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let current = true;
    const drawing = canvas.current?.getContext('2d') ?? null;
    if (!drawing) return;
    const redraw = () => {
      void requestLod(nodeId, level, coord).then((source) => {
        if (!current) return;
        drawing.clearRect(0, 0, TILE, TILE);
        if (source) drawing.drawImage(source, 0, 0);
      });
    };
    redraw();
    const stop = subscribeLayer(nodeId, boardId, (change) => {
      if (!affects(change, level, coord)) return;
      const source = level === 0 && change.rect ? peekTile(nodeId, coord) : null;
      if (!source || !change.rect) {
        redraw();
        return;
      }
      const { x0, y0, x1, y1 } = change.rect;
      drawing.clearRect(x0, y0, x1 - x0, y1 - y0);
      drawing.drawImage(source, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
    });
    return () => {
      current = false;
      stop();
    };
  }, [boardId, coord, level, nodeId]);

  return (
    <canvas
      ref={canvas}
      className={styles['tile']}
      width={TILE}
      height={TILE}
      style={{ left, top, width: size, height: size }}
    />
  );
});

export function DrawingItem({
  data,
  selected,
  positionAbsoluteX,
  positionAbsoluteY,
}: NodeProps<ItemFlowNode>) {
  const { node } = data;
  const { resolution, offsetX, offsetY } = drawingData(node);
  const coords = useLayerCoords(node.id, node.boardId);
  const originX = positionAbsoluteX - offsetX;
  const originY = positionAbsoluteY - offsetY;
  const range = useFlowStore((store) => {
    const [x, y, zoom] = store.transform;
    const visible = visibleRange(
      { x, y, zoom },
      { width: store.width, height: store.height },
      { originX, originY, resolution },
    );
    return [visible.level, visible.x0, visible.y0, visible.x1, visible.y1].join(',');
  });
  const [level = 0, x0 = 0, y0 = 0, x1 = 0, y1 = 0] = range.split(',').map(Number);
  const span = (TILE * 2 ** level) / resolution;
  const style = resolveItemStyle('drawing', node.data['style'] as ItemStyle | undefined);
  const shown = levelKeys(coords, level).filter((coord) => inRange(coord, { level, x0, y0, x1, y1 }));

  return (
    <div
      className={cx(styles['drawing'], selected && styles['selected'])}
      style={{ opacity: style.opacity }}
      data-testid="drawing-layer"
      data-tiles={coords.length}
    >
      {shown.map((coord) => {
        const { tx, ty } = parseCoord(coord);
        return (
          <TileView
            key={`${String(level)}:${coord}`}
            nodeId={node.id}
            boardId={node.boardId}
            level={level}
            coord={coord}
            left={tx * span - offsetX}
            top={ty * span - offsetY}
            size={span}
          />
        );
      })}
    </div>
  );
}
