import type { AreaNode, LayoutNode, SplitDirection, SplitNode } from '@shared/layout';

export type Side = 'left' | 'right' | 'top' | 'bottom';

export function createArea(editor: string, state: Record<string, unknown> = {}): AreaNode {
  return { kind: 'area', id: crypto.randomUUID(), editor, state };
}

export function collectAreas(node: LayoutNode): AreaNode[] {
  return node.kind === 'area' ? [node] : node.children.flatMap(collectAreas);
}

export function findArea(node: LayoutNode, id: string): AreaNode | null {
  return collectAreas(node).find((area) => area.id === id) ?? null;
}

export interface ParentMatch {
  parent: SplitNode;
  index: number;
}

export function findParent(node: LayoutNode, id: string): ParentMatch | null {
  if (node.kind === 'area') return null;
  const index = node.children.findIndex((child) => child.id === id);
  if (index >= 0) return { parent: node, index };
  for (const child of node.children) {
    const match = findParent(child, id);
    if (match) return match;
  }
  return null;
}

function normaliseSizes(sizes: number[]): number[] {
  const total = sizes.reduce((sum, size) => sum + size, 0);
  return total > 0 ? sizes.map((size) => size / total) : sizes.map(() => 1 / sizes.length);
}

export function normalise(node: LayoutNode): LayoutNode {
  if (node.kind === 'area') return node;
  const children: LayoutNode[] = [];
  const sizes: number[] = [];
  node.children.forEach((child, index) => {
    const size = node.sizes[index] ?? 1 / node.children.length;
    const clean = normalise(child);
    if (clean.kind === 'split' && clean.direction === node.direction) {
      clean.children.forEach((grandchild, grandIndex) => {
        children.push(grandchild);
        sizes.push(size * (clean.sizes[grandIndex] ?? 0));
      });
    } else {
      children.push(clean);
      sizes.push(size);
    }
  });
  const first = children[0];
  if (children.length === 1 && first) return first;
  return { ...node, children, sizes: normaliseSizes(sizes) };
}

function replaceNode(node: LayoutNode, id: string, replacement: LayoutNode): LayoutNode {
  if (node.id === id) return replacement;
  if (node.kind === 'area') return node;
  return { ...node, children: node.children.map((child) => replaceNode(child, id, replacement)) };
}

export interface SplitResult {
  root: LayoutNode;
  newAreaId: string;
}

export function splitArea(
  root: LayoutNode,
  areaId: string,
  direction: SplitDirection,
  ratio = 0.5,
  editor?: string,
  before = false,
): SplitResult {
  const area = findArea(root, areaId);
  if (!area) return { root, newAreaId: areaId };
  const fraction = Math.min(0.9, Math.max(0.1, ratio));
  const added = createArea(editor ?? area.editor, editor ? {} : { ...area.state });
  const match = findParent(root, areaId);
  if (match?.parent.direction === direction) {
    const { parent, index } = match;
    const size = parent.sizes[index] ?? 1 / parent.children.length;
    const children = [...parent.children];
    const sizes = [...parent.sizes];
    children.splice(before ? index : index + 1, 0, added);
    sizes.splice(
      index,
      1,
      ...(before ? [size * (1 - fraction), size * fraction] : [size * fraction, size * (1 - fraction)]),
    );
    return {
      root: normalise(replaceNode(root, parent.id, { ...parent, children, sizes })),
      newAreaId: added.id,
    };
  }
  const split: SplitNode = {
    kind: 'split',
    id: crypto.randomUUID(),
    direction,
    children: before ? [added, area] : [area, added],
    sizes: before ? [1 - fraction, fraction] : [fraction, 1 - fraction],
  };
  return { root: normalise(replaceNode(root, areaId, split)), newAreaId: added.id };
}

export function removeArea(root: LayoutNode, areaId: string, giveTo?: string): LayoutNode {
  const match = findParent(root, areaId);
  if (!match) return root;
  const { parent, index } = match;
  const size = parent.sizes[index] ?? 0;
  const children = parent.children.filter((_, childIndex) => childIndex !== index);
  const sizes = parent.sizes.filter((_, childIndex) => childIndex !== index);
  const receiver = Math.max(
    0,
    giveTo ? children.findIndex((child) => child.id === giveTo) : Math.min(index, children.length - 1),
  );
  sizes[receiver] = (sizes[receiver] ?? 0) + size;
  return normalise(replaceNode(root, parent.id, { ...parent, children, sizes }));
}

export function neighbours(root: LayoutNode, areaId: string): Partial<Record<Side, AreaNode>> {
  const match = findParent(root, areaId);
  if (!match) return {};
  const { parent, index } = match;
  const before = parent.children[index - 1];
  const after = parent.children[index + 1];
  const result: Partial<Record<Side, AreaNode>> = {};
  if (parent.direction === 'row') {
    if (before?.kind === 'area') result.left = before;
    if (after?.kind === 'area') result.right = after;
  } else {
    if (before?.kind === 'area') result.top = before;
    if (after?.kind === 'area') result.bottom = after;
  }
  return result;
}

export function joinAreas(root: LayoutNode, keepId: string, removeId: string): LayoutNode {
  const sides = neighbours(root, keepId);
  const allowed = Object.values(sides).some((area) => area.id === removeId);
  return allowed ? removeArea(root, removeId, keepId) : root;
}

export function swapAreas(root: LayoutNode, firstId: string, secondId: string): LayoutNode {
  const first = findArea(root, firstId);
  const second = findArea(root, secondId);
  if (!first || !second || firstId === secondId) return root;
  const swapped = replaceNode(root, firstId, { ...second, id: firstId });
  return replaceNode(swapped, secondId, { ...first, id: secondId });
}

export function resizeSplit(root: LayoutNode, splitId: string, sizes: number[]): LayoutNode {
  const update = (node: LayoutNode): LayoutNode => {
    if (node.kind === 'area') return node;
    if (node.id === splitId && sizes.length === node.children.length)
      return { ...node, sizes: normaliseSizes(sizes) };
    return { ...node, children: node.children.map(update) };
  };
  return update(root);
}

export function setAreaEditor(
  root: LayoutNode,
  areaId: string,
  editor: string,
  state: Record<string, unknown> = {},
) {
  const area = findArea(root, areaId);
  return area ? replaceNode(root, areaId, { ...area, editor, state }) : root;
}

export function patchAreaState(root: LayoutNode, areaId: string, patch: Record<string, unknown>): LayoutNode {
  const area = findArea(root, areaId);
  return area ? replaceNode(root, areaId, { ...area, state: { ...area.state, ...patch } }) : root;
}
