import { DEFAULT_DRAWING_RESOLUTION, type BoardNode } from '@shared/board';
import { effectiveZ, isDrawing } from '@renderer/lib/board';
import { rgbToHex } from '@renderer/lib/colour';
import { hitLayer, sampleLayer } from './cache';
import { layerFrame, toRaster } from './geometry';

function canPaint(node: BoardNode | undefined): node is BoardNode {
  return Boolean(node && isDrawing(node) && node.data['hidden'] !== true && node.data['locked'] !== true);
}

export function pickLayer(
  nodes: BoardNode[],
  selectedIds: string[],
  rememberedId: string | null,
): BoardNode | null {
  const selected = selectedIds.length === 1 ? nodes.find((node) => node.id === selectedIds[0]) : undefined;
  if (canPaint(selected)) return selected;
  const remembered = nodes.find((node) => node.id === rememberedId);
  return canPaint(remembered) ? remembered : null;
}

export function newLayer(options: {
  boardId: string;
  name: string;
  z: number;
  at: { x: number; y: number };
}): BoardNode {
  return {
    id: crypto.randomUUID(),
    boardId: options.boardId,
    parentId: null,
    type: 'drawing',
    x: options.at.x,
    y: options.at.y,
    width: 1,
    height: 1,
    z: options.z,
    data: {
      name: options.name,
      style: {},
      resolution: DEFAULT_DRAWING_RESOLUTION,
      offsetX: options.at.x,
      offsetY: options.at.y,
    },
  };
}

function drawingsAt(point: { x: number; y: number }, nodes: BoardNode[]): BoardNode[] {
  return nodes
    .filter(
      (node) =>
        isDrawing(node) &&
        node.data['hidden'] !== true &&
        point.x >= node.x &&
        point.y >= node.y &&
        point.x <= node.x + node.width &&
        point.y <= node.y + node.height,
    )
    .sort((a, b) => effectiveZ(b, nodes) - effectiveZ(a, nodes));
}

export function drawingAt(point: { x: number; y: number }, nodes: BoardNode[]): BoardNode | null {
  for (const node of drawingsAt(point, nodes)) {
    const raster = toRaster(point, layerFrame(node));
    if (hitLayer(node.id, raster.x, raster.y)) return node;
  }
  return null;
}

export function colourAt(point: { x: number; y: number }, nodes: BoardNode[]): string | null {
  for (const node of drawingsAt(point, nodes)) {
    const raster = toRaster(point, layerFrame(node));
    const pixel = sampleLayer(node.id, raster.x, raster.y);
    if (pixel && pixel[3] > 0) return rgbToHex({ r: pixel[0], g: pixel[1], b: pixel[2] });
  }
  return null;
}
