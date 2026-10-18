import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import {
  DEFAULT_BOARD_BACKGROUND,
  DEFAULT_BOARD_GRID,
  DEFAULT_BOARD_UNIT,
  DEFAULT_BOARD_UNIT_SCALE,
  boardChangesSchema,
  boardInputSchema,
  boardListSchema,
  boardPatchSchema,
  boardSchema,
  boardSnapshotSchema,
  boardTileListSchema,
  type Board,
  type BoardNode,
  type BoardSnapshot,
  type BoardTile,
} from '@shared/board';
import { assertFolderScope } from './assets-repository';

function now(): string {
  return new Date().toISOString();
}

function transaction<T>(db: DatabaseSync, work: () => T): T {
  db.exec('BEGIN');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

const BOARD_COLUMNS =
  'id, name, background_color AS backgroundColor, grid_color AS gridColor, background_ref AS backgroundRef, grid_ref AS gridRef, unit, unit_scale AS unitScale, folder_id AS folderId, created_at AS createdAt, updated_at AS updatedAt';

function parseJson(value: unknown): unknown {
  return typeof value === 'string' ? JSON.parse(value) : {};
}

function parseRef(value: unknown): unknown {
  return typeof value === 'string' && value.length > 0 ? JSON.parse(value) : null;
}

function boardRow(row: unknown): unknown {
  const record = row as Record<string, unknown>;
  return {
    ...record,
    backgroundRef: parseRef(record['backgroundRef']),
    gridRef: parseRef(record['gridRef']),
  };
}

function serialiseRef(ref: unknown): string | null {
  return ref ? JSON.stringify(ref) : null;
}

export function listBoards(db: DatabaseSync): Board[] {
  return boardListSchema.parse(
    db.prepare(`SELECT ${BOARD_COLUMNS} FROM boards ORDER BY created_at`).all().map(boardRow),
  );
}

export function createBoard(db: DatabaseSync, raw: unknown): Board {
  const input = boardInputSchema.parse(raw);
  const stamp = now();
  const id = randomUUID();
  db.prepare(
    'INSERT INTO boards (id, name, background_color, grid_color, background_ref, grid_ref, unit, unit_scale, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(
    id,
    input.name,
    input.backgroundColor ?? DEFAULT_BOARD_BACKGROUND,
    input.gridColor ?? DEFAULT_BOARD_GRID,
    serialiseRef(input.backgroundRef),
    serialiseRef(input.gridRef),
    input.unit ?? DEFAULT_BOARD_UNIT,
    input.unitScale ?? DEFAULT_BOARD_UNIT_SCALE,
    stamp,
    stamp,
  );
  return readBoardRow(db, id);
}

function readBoardRow(db: DatabaseSync, id: string): Board {
  const row = db.prepare(`SELECT ${BOARD_COLUMNS} FROM boards WHERE id = ?`).get(id);
  if (!row) throw new Error(`Unknown board ${id}`);
  return boardSchema.parse(boardRow(row));
}

export function updateBoard(db: DatabaseSync, id: string, raw: unknown): Board {
  const patch = boardPatchSchema.parse(raw);
  const sets = ['updated_at = ?'];
  const values: (string | number | null)[] = [now()];
  if (patch.name !== undefined) {
    sets.push('name = ?');
    values.push(patch.name);
  }
  if (patch.backgroundColor !== undefined) {
    sets.push('background_color = ?');
    values.push(patch.backgroundColor);
  }
  if (patch.gridColor !== undefined) {
    sets.push('grid_color = ?');
    values.push(patch.gridColor);
  }
  if (patch.backgroundRef !== undefined) {
    sets.push('background_ref = ?');
    values.push(serialiseRef(patch.backgroundRef));
  }
  if (patch.gridRef !== undefined) {
    sets.push('grid_ref = ?');
    values.push(serialiseRef(patch.gridRef));
  }
  if (patch.unit !== undefined) {
    sets.push('unit = ?');
    values.push(patch.unit);
  }
  if (patch.unitScale !== undefined) {
    sets.push('unit_scale = ?');
    values.push(patch.unitScale);
  }
  if (patch.folderId !== undefined) {
    assertFolderScope(db, patch.folderId, 'boards');
    sets.push('folder_id = ?');
    values.push(patch.folderId);
  }
  db.prepare(`UPDATE boards SET ${sets.join(', ')} WHERE id = ?`).run(...values, id);
  return readBoardRow(db, id);
}

export function deleteBoard(db: DatabaseSync, id: string): Board[] {
  db.prepare('DELETE FROM boards WHERE id = ?').run(id);
  return listBoards(db);
}

export function readBoard(db: DatabaseSync, id: string): BoardSnapshot {
  const board = readBoardRow(db, id);
  const nodes = db
    .prepare(
      'SELECT id, board_id AS boardId, parent_id AS parentId, type, x, y, width, height, z, data FROM board_nodes WHERE board_id = ? ORDER BY z, created_at',
    )
    .all(id)
    .map((row) => ({
      ...(row as Record<string, unknown>),
      data: parseJson((row as { data: unknown }).data),
    }));
  const edges = db
    .prepare(
      'SELECT id, board_id AS boardId, source_id AS sourceId, target_id AS targetId, data FROM board_edges WHERE board_id = ?',
    )
    .all(id)
    .map((row) => ({
      ...(row as Record<string, unknown>),
      data: parseJson((row as { data: unknown }).data),
    }));
  return boardSnapshotSchema.parse({ board, nodes, edges });
}

function parentsFirst(db: DatabaseSync, boardId: string, nodes: BoardNode[]): BoardNode[] {
  const batch = new Map(nodes.map((node) => [node.id, node]));
  const stored = db.prepare(
    'SELECT parent_id AS parentId, board_id AS boardId FROM board_nodes WHERE id = ?',
  );
  const parentOf = (id: string): { parentId: string | null; boardId: string } | null => {
    const queued = batch.get(id);
    if (queued) return { parentId: queued.parentId, boardId: queued.boardId };
    const row = stored.get(id) as { parentId: string | null; boardId: string } | undefined;
    return row ?? null;
  };
  for (const node of nodes) {
    if (node.boardId !== boardId) throw new Error(`Node ${node.id} belongs to another board`);
    const seen = new Set([node.id]);
    let current = node.parentId;
    while (current) {
      if (seen.has(current)) throw new Error(`Node ${node.id} would contain itself`);
      seen.add(current);
      const parent = parentOf(current);
      if (parent?.boardId !== boardId) {
        throw new Error(`Unknown parent ${current} for node ${node.id}`);
      }
      current = parent.parentId;
    }
  }
  const ordered: BoardNode[] = [];
  const placed = new Set<string>();
  const place = (node: BoardNode) => {
    if (placed.has(node.id)) return;
    placed.add(node.id);
    const parent = node.parentId ? batch.get(node.parentId) : undefined;
    if (parent) place(parent);
    ordered.push(node);
  };
  for (const node of nodes) place(node);
  return ordered;
}

export function applyChanges(db: DatabaseSync, boardId: string, raw: unknown): BoardSnapshot {
  const changes = boardChangesSchema.parse(raw);
  return transaction(db, () => {
    const stamp = now();
    const upsertNode = db.prepare(
      `INSERT INTO board_nodes (id, board_id, parent_id, type, x, y, width, height, z, data, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET parent_id = excluded.parent_id, type = excluded.type, x = excluded.x, y = excluded.y, width = excluded.width,
         height = excluded.height, z = excluded.z, data = excluded.data, updated_at = excluded.updated_at`,
    );
    for (const node of parentsFirst(db, boardId, changes.upsertNodes)) {
      upsertNode.run(
        node.id,
        boardId,
        node.parentId,
        node.type,
        node.x,
        node.y,
        node.width,
        node.height,
        node.z,
        JSON.stringify(node.data),
        stamp,
        stamp,
      );
    }
    const removeNode = db.prepare('DELETE FROM board_nodes WHERE id = ? AND board_id = ?');
    for (const id of changes.removeNodeIds) removeNode.run(id, boardId);
    const upsertEdge = db.prepare(
      `INSERT INTO board_edges (id, board_id, source_id, target_id, data) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET source_id = excluded.source_id, target_id = excluded.target_id, data = excluded.data`,
    );
    for (const edge of changes.upsertEdges) {
      if (edge.boardId !== boardId) throw new Error(`Edge ${edge.id} belongs to another board`);
      upsertEdge.run(edge.id, boardId, edge.sourceId, edge.targetId, JSON.stringify(edge.data));
    }
    const removeEdge = db.prepare('DELETE FROM board_edges WHERE id = ? AND board_id = ?');
    for (const id of changes.removeEdgeIds) removeEdge.run(id, boardId);
    const drawing = db.prepare(
      "SELECT 1 FROM board_nodes WHERE id = ? AND board_id = ? AND type = 'drawing'",
    );
    const removeTile = db.prepare('DELETE FROM board_tiles WHERE node_id = ? AND tx = ? AND ty = ?');
    for (const tile of changes.removeTiles) {
      if (drawing.get(tile.nodeId, boardId)) removeTile.run(tile.nodeId, tile.tx, tile.ty);
    }
    const upsertTile = db.prepare(
      `INSERT INTO board_tiles (node_id, tx, ty, bytes, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(node_id, tx, ty) DO UPDATE SET bytes = excluded.bytes, updated_at = excluded.updated_at`,
    );
    for (const tile of changes.upsertTiles) {
      if (!drawing.get(tile.nodeId, boardId)) throw new Error(`Tile for unknown drawing ${tile.nodeId}`);
      upsertTile.run(tile.nodeId, tile.tx, tile.ty, tile.bytes, stamp);
    }
    db.prepare('UPDATE boards SET updated_at = ? WHERE id = ?').run(stamp, boardId);
    return readBoard(db, boardId);
  });
}

export function readTiles(db: DatabaseSync, boardId: string): BoardTile[] {
  readBoardRow(db, boardId);
  const rows = db
    .prepare(
      `SELECT t.node_id AS nodeId, t.tx, t.ty, t.bytes FROM board_tiles t
       JOIN board_nodes n ON n.id = t.node_id WHERE n.board_id = ? ORDER BY t.node_id, t.ty, t.tx`,
    )
    .all(boardId);
  return boardTileListSchema.parse(rows);
}
