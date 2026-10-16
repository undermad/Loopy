export type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

export type MigrationMap = Readonly<Record<number, Migration>>;

export class UnsupportedVersionError extends Error {
  constructor(public readonly version: number) {
    super(`Unsupported project file schema version ${version}`);
    this.name = 'UnsupportedVersionError';
  }
}

function readSchemaVersion(data: Record<string, unknown>): number {
  const version = data['schemaVersion'];
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new UnsupportedVersionError(Number.NaN);
  }
  return version;
}

export function migrate(
  data: Record<string, unknown>,
  migrations: MigrationMap,
  target: number,
): Record<string, unknown> {
  let current = readSchemaVersion(data);
  if (current > target) throw new UnsupportedVersionError(current);

  let result = data;
  while (current < target) {
    const step = migrations[current];
    if (!step) throw new UnsupportedVersionError(current);
    result = { ...step(result), schemaVersion: current + 1 };
    current += 1;
  }
  return result;
}
