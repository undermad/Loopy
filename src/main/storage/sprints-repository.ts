import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { keyBetween } from '@shared/ordering';
import {
  commentInputSchema,
  sprintCompleteSchema,
  sprintInputSchema,
  sprintPatchSchema,
  templateInputSchema,
  templatePatchSchema,
  type TicketsSnapshot,
} from '@shared/tickets';
import { readSnapshot, transaction } from './tickets-repository';

function now(): string {
  return new Date().toISOString();
}

function lastSprintPosition(db: DatabaseSync): string | null {
  const row = db.prepare('SELECT position FROM sprints ORDER BY position DESC LIMIT 1').get() as
    { position: string } | undefined;
  return row?.position ?? null;
}

function sprintStatus(db: DatabaseSync, id: string): string {
  const row = db.prepare('SELECT status FROM sprints WHERE id = ?').get(id) as { status: string } | undefined;
  if (!row) throw new Error(`Unknown sprint ${id}`);
  return row.status;
}

export function createSprint(db: DatabaseSync, raw: unknown): TicketsSnapshot {
  const input = sprintInputSchema.parse(raw);
  const stamp = now();
  db.prepare(
    `INSERT INTO sprints (id, name, goal, status, position, started_at, completed_at, created_at, updated_at)
     VALUES (?, ?, ?, 'planned', ?, NULL, NULL, ?, ?)`,
  ).run(randomUUID(), input.name, input.goal, keyBetween(lastSprintPosition(db), null), stamp, stamp);
  return readSnapshot(db);
}

export function updateSprint(db: DatabaseSync, id: string, raw: unknown): TicketsSnapshot {
  const patch = sprintPatchSchema.parse(raw);
  const sets = ['updated_at = ?'];
  const values: string[] = [now()];
  for (const key of ['name', 'goal'] as const) {
    const value = patch[key];
    if (value !== undefined) {
      sets.push(`${key} = ?`);
      values.push(value);
    }
  }
  const result = db.prepare(`UPDATE sprints SET ${sets.join(', ')} WHERE id = ?`).run(...values, id);
  if (result.changes === 0) throw new Error(`Unknown sprint ${id}`);
  return readSnapshot(db);
}

export function startSprint(db: DatabaseSync, id: string): TicketsSnapshot {
  return transaction(db, () => {
    if (sprintStatus(db, id) !== 'planned') throw new Error(`Sprint ${id} is not planned`);
    const active = db.prepare("SELECT id FROM sprints WHERE status = 'active'").get();
    if (active) throw new Error('Another sprint is already active');
    const stamp = now();
    db.prepare("UPDATE sprints SET status = 'active', started_at = ?, updated_at = ? WHERE id = ?").run(
      stamp,
      stamp,
      id,
    );
    return readSnapshot(db);
  });
}

export function completeSprint(db: DatabaseSync, raw: unknown): TicketsSnapshot {
  const input = sprintCompleteSchema.parse(raw);
  return transaction(db, () => {
    if (sprintStatus(db, input.id) !== 'active') throw new Error(`Sprint ${input.id} is not active`);
    if (input.moveTo !== null && sprintStatus(db, input.moveTo) === 'completed') {
      throw new Error(`Sprint ${input.moveTo} is completed`);
    }
    const stamp = now();
    db.prepare(
      'UPDATE tickets SET sprint_id = ?, updated_at = ? WHERE sprint_id = ? AND resolved_at IS NULL',
    ).run(input.moveTo, stamp, input.id);
    db.prepare("UPDATE sprints SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?").run(
      stamp,
      stamp,
      input.id,
    );
    return readSnapshot(db);
  });
}

export function deleteSprint(db: DatabaseSync, id: string): TicketsSnapshot {
  return transaction(db, () => {
    db.prepare('UPDATE tickets SET sprint_id = NULL, updated_at = ? WHERE sprint_id = ?').run(now(), id);
    const result = db.prepare('DELETE FROM sprints WHERE id = ?').run(id);
    if (result.changes === 0) throw new Error(`Unknown sprint ${id}`);
    return readSnapshot(db);
  });
}

export function createComment(db: DatabaseSync, raw: unknown): TicketsSnapshot {
  const input = commentInputSchema.parse(raw);
  const stamp = now();
  db.prepare(
    'INSERT INTO ticket_comments (id, ticket_id, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
  ).run(randomUUID(), input.ticketId, input.body, stamp, stamp);
  return readSnapshot(db);
}

export function updateComment(db: DatabaseSync, id: string, body: string): TicketsSnapshot {
  const result = db
    .prepare('UPDATE ticket_comments SET body = ?, updated_at = ? WHERE id = ?')
    .run(body, now(), id);
  if (result.changes === 0) throw new Error(`Unknown comment ${id}`);
  return readSnapshot(db);
}

export function deleteComment(db: DatabaseSync, id: string): TicketsSnapshot {
  db.prepare('DELETE FROM ticket_comments WHERE id = ?').run(id);
  return readSnapshot(db);
}

export function createTemplate(db: DatabaseSync, raw: unknown): TicketsSnapshot {
  const input = templateInputSchema.parse(raw);
  const stamp = now();
  db.prepare(
    `INSERT INTO ticket_templates (id, name, title, description, type, priority, estimate, label_ids, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    randomUUID(),
    input.name,
    input.title,
    input.description,
    input.type,
    input.priority,
    input.estimate,
    JSON.stringify(input.labelIds),
    stamp,
    stamp,
  );
  return readSnapshot(db);
}

export function updateTemplate(db: DatabaseSync, id: string, raw: unknown): TicketsSnapshot {
  const patch = templatePatchSchema.parse(raw);
  const sets = ['updated_at = ?'];
  const values: (string | number | null)[] = [now()];
  for (const key of ['name', 'title', 'description', 'type', 'priority', 'estimate'] as const) {
    const value = patch[key];
    if (value !== undefined) {
      sets.push(`${key} = ?`);
      values.push(value);
    }
  }
  if (patch.labelIds !== undefined) {
    sets.push('label_ids = ?');
    values.push(JSON.stringify(patch.labelIds));
  }
  const result = db.prepare(`UPDATE ticket_templates SET ${sets.join(', ')} WHERE id = ?`).run(...values, id);
  if (result.changes === 0) throw new Error(`Unknown template ${id}`);
  return readSnapshot(db);
}

export function deleteTemplate(db: DatabaseSync, id: string): TicketsSnapshot {
  db.prepare('DELETE FROM ticket_templates WHERE id = ?').run(id);
  return readSnapshot(db);
}
