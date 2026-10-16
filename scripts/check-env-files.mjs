import { basename } from 'node:path';

const offenders = process.argv.slice(2).filter((file) => {
  const name = basename(file);
  return name.startsWith('.env') && name !== '.env.example';
});

if (offenders.length > 0) {
  console.error(`Environment files must not be committed:\n${offenders.join('\n')}`);
  process.exit(1);
}
