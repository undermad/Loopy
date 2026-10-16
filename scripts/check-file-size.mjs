import { statSync } from 'node:fs';

const limitBytes = 1024 * 1024;
const offenders = process.argv.slice(2).filter((file) => statSync(file).size > limitBytes);

if (offenders.length > 0) {
  console.error(`Files over 1 MB are not allowed in the repository:\n${offenders.join('\n')}`);
  process.exit(1);
}
