import type { Env } from '../env';

const levels = ['debug', 'info', 'warn', 'error'] as const;
type LogLevel = (typeof levels)[number];

export interface Logger {
  debug: (message: string) => void;
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
}

export function createLogger(minimum: Env['LOOPY_LOG_LEVEL'], sink: Pick<Console, 'log'> = console): Logger {
  const threshold = levels.indexOf(minimum);
  const write = (level: LogLevel, message: string): void => {
    if (levels.indexOf(level) < threshold) return;
    sink.log(`[${level}] ${message}`);
  };
  return {
    debug: (message) => {
      write('debug', message);
    },
    info: (message) => {
      write('info', message);
    },
    warn: (message) => {
      write('warn', message);
    },
    error: (message) => {
      write('error', message);
    },
  };
}
