import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import {
  DEFAULT_BOARD_BACKGROUND,
  DEFAULT_BOARD_UNIT,
  DEFAULT_BOARD_UNIT_SCALE,
  boardChangesSchema,
  boardInputSchema,
  boardListSchema,
  boardPatchSchema,
  boardSchema,
  boardSnapshotSchema,
  type Board,
  type BoardSnapshot,
} from '@shared/board';

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
  'id, name, background_color AS backgroundColor, unit, unit_scale AS unitScale, created_at AS createdAt, updated_at AS updatedAt';

function parseJson(value: unknown): unknown {
  return typeof value === 'string' ? JSON.parse(value) : {};
}

export function listBoards(db: DatabaseSync): Board[] {
  return boardListSchema.parse(db.prepare(`SELECT ${BOARD_COLUMNS} FROM boards ORDER BY created_at`).all());
}

export function createBoard(db: DatabaseSync, raw: unknown): Board {
  const input = boardInputSchema.parse(raw);
  const stamp = now();
  const id = randomUUID();
  db.prepare(
    'INSERT INTO boards (id, name, background_color, unit, unit_scale, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(
    id,
    input.name,
    input.backgroundColor ?? DEFAULT_BOARD_BACKGROUND,
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
  return boardSchema.parse(row);
}

export function updateBoard(db: DatabaseSync, id: string, raw: unknown): Board {
  const patch = boardPatchSchema.parse(raw);
  const sets = ['updated_at = ?'];
  const values: (string | number)[] = [now()];
  if (patch.name !== undefined) {
    sets.push('name = ?');
    values.push(patch.name);
  }
  if (patch.backgroundColor !== undefined) {
    sets.push('background_color = ?');
    values.push(patch.backgroundColor);
  }
  if (patch.unit !== undefined) {
    sets.push('unit = ?');
    values.push(patch.unit);
  }
  if (patch.unitScale !== undefined) {
    sets.push('unit_scale = ?');
    values.push(patch.unitScale);
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
      'SELECT id, board_id AS boardId, type, x, y, width, height, z, data FROM board_nodes WHERE board_id = ? ORDER BY z, created_at',
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

export function applyChanges(db: DatabaseSync, boardId: string, raw: unknown): BoardSnapshot {
  const changes = boardChangesSchema.parse(raw);
  return transaction(db, () => {
    const stamp = now();
    const upsertNode = db.prepare(
      `INSERT INTO board_nodes (id, board_id, type, x, y, width, height, z, data, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET type = excluded.type, x = excluded.x, y = excluded.y, width = excluded.width,
         height = excluded.height, z = excluded.z, data = excluded.data, updated_at = excluded.updated_at`,
    );
    for (const node of changes.upsertNodes) {
      if (node.boardId !== boardId) throw new Error(`Node ${node.id} belongs to another board`);
      upsertNode.run(
        node.id,
        boardId,
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
    db.prepare('UPDATE boards SET updated_at = ? WHERE id = ?').run(stamp, boardId);
    return readBoard(db, boardId);
  });
}
