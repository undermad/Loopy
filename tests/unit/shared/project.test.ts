import { describe, expect, it } from 'vitest';
import { projectInfoSchema, projectNameSchema } from '@shared/project';

describe('project schemas', () => {
  it('trims a name and rejects a blank or overlong one', () => {
    expect(projectNameSchema.parse('  Demo ')).toBe('Demo');
    expect(projectNameSchema.safeParse('   ').success).toBe(false);
    expect(projectNameSchema.safeParse('x'.repeat(201)).success).toBe(false);
  });

  it('requires a uuid and ISO timestamps for project info', () => {
    const info = {
      id: '0b5d1a8e-2c4f-4e7a-9b3c-1d2e3f4a5b6c',
      name: 'Demo',
      createdAt: '2026-10-17T09:00:00.000Z',
      updatedAt: '2026-10-17T09:00:00.000Z',
    };
    expect(projectInfoSchema.parse(info)).toEqual(info);
    expect(projectInfoSchema.safeParse({ ...info, id: '1' }).success).toBe(false);
    expect(projectInfoSchema.safeParse({ ...info, createdAt: 'yesterday' }).success).toBe(false);
  });
});
