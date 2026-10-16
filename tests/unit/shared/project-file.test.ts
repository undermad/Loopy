import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, createProjectFile, projectFileSchema } from '@shared/project-file';

describe('project file schema', () => {
  it('creates a valid file at the current schema version', () => {
    const now = new Date('2026-10-16T10:00:00.000Z');
    const file = createProjectFile('Demo', now);

    expect(file).toEqual({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      name: 'Demo',
      createdAt: '2026-10-16T10:00:00.000Z',
      updatedAt: '2026-10-16T10:00:00.000Z',
    });
    expect(projectFileSchema.safeParse(file).success).toBe(true);
  });

  it('rejects an empty name and an unknown schema version', () => {
    expect(projectFileSchema.safeParse({ ...createProjectFile('Demo'), name: '' }).success).toBe(false);
    expect(projectFileSchema.safeParse({ ...createProjectFile('Demo'), schemaVersion: 99 }).success).toBe(
      false,
    );
  });
});
