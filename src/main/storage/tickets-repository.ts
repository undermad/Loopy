import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { keyBetween } from '@shared/ordering';
import {
  STATE_COLORS,
  labelInputSchema,
  labelPatchSchema,
  stateInputSchema,
  statePatchSchema,
  ticketInputSchema,
  ticketMoveSchema,
  ticketPatchSchema,
  ticketsSnapshotSchema,
  type StateCategory,
  type TicketsSnapshot,
} from '@shared/tickets';

function now(): string {
  return new Date().toISOString();
}

export function transaction<T>(db: DatabaseSync, work: () => T): T {
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

function lastTicketPosition(db: DatabaseSync, stateId: string | null): string | null {
  const row = db
    .prepare('SELECT position FROM tickets WHERE state_id IS ? ORDER BY position DESC LIMIT 1')
    .get(stateId) as { position: string } | undefined;
  return row?.position ?? null;
}

function lastStatePosition(db: DatabaseSync): string | null {
  const row = db.prepare('SELECT position FROM ticket_states ORDER BY position DESC LIMIT 1').get() as
    { position: string } | undefined;
  return row?.position ?? null;
}

function categoryOf(db: DatabaseSync, stateId: string | null): StateCategory | null {
  if (stateId === null) return null;
  const row = db.prepare('SELECT category FROM ticket_states WHERE id = ?').get(stateId) as
    { category: StateCategory } | undefined;
  if (!row) throw new Error(`Unknown state ${stateId}`);
  return row.category;
}

function firstTodoStateId(db: DatabaseSync): string | null {
  const row = db
    .prepare(
      "SELECT id FROM ticket_states ORDER BY CASE category WHEN 'todo' THEN 0 ELSE 1 END, position LIMIT 1",
    )
    .get() as { id: string } | undefined;
  return row?.id ?? null;
}

function assertSprintOpen(db: DatabaseSync, sprintId: string | null): void {
  if (sprintId === null) return;
  const row = db.prepare('SELECT status FROM sprints WHERE id = ?').get(sprintId) as
    { status: string } | undefined;
  if (!row) throw new Error(`Unknown sprint ${sprintId}`);
  if (row.status === 'completed') throw new Error(`Sprint ${sprintId} is completed`);
}

export function readSnapshot(db: DatabaseSync): TicketsSnapshot {
  const states = db
    .prepare('SELECT id, name, position, category, color FROM ticket_states ORDER BY position')
    .all();
  const tickets = db
    .prepare(
      `SELECT id, number, title, description, type, priority, state_id AS stateId, sprint_id AS sprintId,
        estimate, due_at AS dueAt, position,
        created_at AS createdAt, updated_at AS updatedAt, resolved_at AS resolvedAt
       FROM tickets ORDER BY position`,
    )
    .all();
  const labels = db.prepare('SELECT id, name, color FROM labels ORDER BY name').all();
  const ticketLabels = db
    .prepare('SELECT ticket_id AS ticketId, label_id AS labelId FROM ticket_labels')
    .all();
  const sprints = db
    .prepare(
      `SELECT id, name, goal, status, position, started_at AS startedAt, completed_at AS completedAt,
        created_at AS createdAt, updated_at AS updatedAt FROM sprints ORDER BY position`,
    )
    .all();
  const comments = db
    .prepare(
      'SELECT id, ticket_id AS ticketId, body, created_at AS createdAt, updated_at AS updatedAt FROM ticket_comments ORDER BY created_at',
    )
    .all();
  const templates = db
    .prepare(
      `SELECT id, name, title, description, type, priority, estimate, label_ids AS labelIds,
        created_at AS createdAt, updated_at AS updatedAt FROM ticket_templates ORDER BY name`,
    )
    .all()
    .map((row) => ({
      ...(row as Record<string, unknown>),
      labelIds: JSON.parse((row as { labelIds: string }).labelIds) as unknown,
    }));
  return ticketsSnapshotSchema.parse({ states, tickets, labels, ticketLabels, sprints, comments, templates });
}

export function createTicket(db: DatabaseSync, raw: unknown): TicketsSnapshot {
  const input = ticketInputSchema.parse(raw);
  return transaction(db, () => {
    assertSprintOpen(db, input.sprintId);
    const stateId = input.stateId ?? (input.sprintId ? firstTodoStateId(db) : null);
    const category = categoryOf(db, stateId);
    const next = db.prepare('SELECT COALESCE(MAX(number), 0) + 1 AS number FROM tickets').get() as {
      number: number;
    };
    const position = keyBetween(lastTicketPosition(db, stateId), null);
    const stamp = now();
    const id = randomUUID();
    db.prepare(
      `INSERT INTO tickets (id, number, title, description, type, priority, state_id, sprint_id, estimate, due_at, position, created_at, updated_at, resolved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      next.number,
      input.title,
      input.description,
      input.type,
      input.priority,
      stateId,
      input.sprintId,
      input.estimate,
      input.dueAt,
      position,
      stamp,
      stamp,
      category === 'done' ? stamp : null,
    );
    const link = db.prepare('INSERT OR IGNORE INTO ticket_labels (ticket_id, label_id) VALUES (?, ?)');
    for (const labelId of new Set(input.labelIds)) link.run(id, labelId);
    return readSnapshot(db);
  });
}

export function updateTicket(db: DatabaseSync, id: string, raw: unknown): TicketsSnapshot {
  const patch = ticketPatchSchema.parse(raw);
  return transaction(db, () => {
    const current = db
      .prepare('SELECT state_id AS stateId, sprint_id AS sprintId FROM tickets WHERE id = ?')
      .get(id) as { stateId: string | null; sprintId: string | null } | undefined;
    if (!current) throw new Error(`Unknown ticket ${id}`);
    const stamp = now();
    const sets: string[] = ['updated_at = ?'];
    const values: (string | number | null)[] = [stamp];
    for (const key of ['title', 'description', 'type', 'priority', 'estimate', 'dueAt'] as const) {
      const value = patch[key];
      if (value !== undefined) {
        sets.push(`${key === 'dueAt' ? 'due_at' : key} = ?`);
        values.push(value);
      }
    }
    let nextState = patch.stateId;
    if (patch.sprintId !== undefined && patch.sprintId !== current.sprintId) {
      assertSprintOpen(db, patch.sprintId);
      sets.push('sprint_id = ?');
      values.push(patch.sprintId);
      if (patch.sprintId !== null && current.stateId === null && nextState === undefined) {
        nextState = firstTodoStateId(db);
      }
    }
    if (nextState !== undefined && nextState !== current.stateId) {
      const category = categoryOf(db, nextState);
      sets.push('state_id = ?', 'position = ?', 'resolved_at = ?');
      values.push(
        nextState,
        keyBetween(lastTicketPosition(db, nextState), null),
        category === 'done' ? stamp : null,
      );
    }
    db.prepare(`UPDATE tickets SET ${sets.join(', ')} WHERE id = ?`).run(...values, id);
    return readSnapshot(db);
  });
}

export function moveTicket(db: DatabaseSync, raw: unknown): TicketsSnapshot {
  const move = ticketMoveSchema.parse(raw);
  return transaction(db, () => {
    const stateId = move.stateId ?? (move.sprintId ? firstTodoStateId(db) : null);
    const category = categoryOf(db, stateId);
    const stamp = now();
    if (move.sprintId !== undefined) assertSprintOpen(db, move.sprintId);
    const result = db
      .prepare(
        `UPDATE tickets SET state_id = ?, position = ?, updated_at = ?,
          sprint_id = CASE WHEN ? THEN ? ELSE sprint_id END,
          resolved_at = CASE WHEN ? THEN COALESCE(resolved_at, ?) ELSE NULL END
         WHERE id = ?`,
      )
      .run(
        stateId,
        move.position,
        stamp,
        move.sprintId === undefined ? 0 : 1,
        move.sprintId ?? null,
        category === 'done' ? 1 : 0,
        stamp,
        move.id,
      );
    if (result.changes === 0) throw new Error(`Unknown ticket ${move.id}`);
    return readSnapshot(db);
  });
}

export function deleteTicket(db: DatabaseSync, id: string): TicketsSnapshot {
  db.prepare('DELETE FROM tickets WHERE id = ?').run(id);
  return readSnapshot(db);
}

export function setTicketLabels(db: DatabaseSync, id: string, labelIds: string[]): TicketsSnapshot {
  return transaction(db, () => {
    db.prepare('DELETE FROM ticket_labels WHERE ticket_id = ?').run(id);
    const insert = db.prepare('INSERT OR IGNORE INTO ticket_labels (ticket_id, label_id) VALUES (?, ?)');
    for (const labelId of new Set(labelIds)) insert.run(id, labelId);
    return readSnapshot(db);
  });
}

export function createState(db: DatabaseSync, raw: unknown): TicketsSnapshot {
  const input = stateInputSchema.parse(raw);
  return transaction(db, () => {
    const count = (db.prepare('SELECT COUNT(*) AS count FROM ticket_states').get() as { count: number })
      .count;
    const color = input.color ?? STATE_COLORS[count % STATE_COLORS.length] ?? '#64748b';
    db.prepare('INSERT INTO ticket_states (id, name, position, category, color) VALUES (?, ?, ?, ?, ?)').run(
      randomUUID(),
      input.name,
      keyBetween(lastStatePosition(db), null),
      input.category,
      color,
    );
    return readSnapshot(db);
  });
}

export function updateState(db: DatabaseSync, id: string, raw: unknown): TicketsSnapshot {
  const patch = statePatchSchema.parse(raw);
  return transaction(db, () => {
    const sets: string[] = [];
    const values: string[] = [];
    for (const key of ['name', 'category', 'color'] as const) {
      const value = patch[key];
      if (value !== undefined) {
        sets.push(`${key} = ?`);
        values.push(value);
      }
    }
    if (sets.length > 0)
      db.prepare(`UPDATE ticket_states SET ${sets.join(', ')} WHERE id = ?`).run(...values, id);
    if (patch.category === 'done') {
      db.prepare('UPDATE tickets SET resolved_at = COALESCE(resolved_at, ?) WHERE state_id = ?').run(
        now(),
        id,
      );
    } else if (patch.category !== undefined) {
      db.prepare('UPDATE tickets SET resolved_at = NULL WHERE state_id = ?').run(id);
    }
    return readSnapshot(db);
  });
}

export function moveState(db: DatabaseSync, id: string, position: string): TicketsSnapshot {
  const result = db.prepare('UPDATE ticket_states SET position = ? WHERE id = ?').run(position, id);
  if (result.changes === 0) throw new Error(`Unknown state ${id}`);
  return readSnapshot(db);
}

export function deleteState(db: DatabaseSync, id: string, moveTo: string | null): TicketsSnapshot {
  return transaction(db, () => {
    const category = categoryOf(db, moveTo);
    const stamp = now();
    db.prepare(
      `UPDATE tickets SET state_id = ?, updated_at = ?,
        resolved_at = CASE WHEN ? THEN COALESCE(resolved_at, ?) ELSE NULL END
       WHERE state_id = ?`,
    ).run(moveTo, stamp, category === 'done' ? 1 : 0, stamp, id);
    db.prepare('DELETE FROM ticket_states WHERE id = ?').run(id);
    return readSnapshot(db);
  });
}

export function createLabel(db: DatabaseSync, raw: unknown): TicketsSnapshot {
  const input = labelInputSchema.parse(raw);
  db.prepare('INSERT INTO labels (id, name, color) VALUES (?, ?, ?)').run(
    randomUUID(),
    input.name,
    input.color,
  );
  return readSnapshot(db);
}

export function updateLabel(db: DatabaseSync, id: string, raw: unknown): TicketsSnapshot {
  const patch = labelPatchSchema.parse(raw);
  if (patch.name !== undefined) db.prepare('UPDATE labels SET name = ? WHERE id = ?').run(patch.name, id);
  if (patch.color !== undefined) db.prepare('UPDATE labels SET color = ? WHERE id = ?').run(patch.color, id);
  return readSnapshot(db);
}

export function deleteLabel(db: DatabaseSync, id: string): TicketsSnapshot {
  db.prepare('DELETE FROM labels WHERE id = ?').run(id);
  return readSnapshot(db);
}
