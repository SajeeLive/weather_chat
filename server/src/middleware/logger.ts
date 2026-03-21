import pino from 'pino';

const isDev = process.env['NODE_ENV'] === 'development';

export const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard' },
        },
      }
    : {}),
});

/**
 * Create a child logger bound to a specific session's correlation ID.
 * All log entries from this logger will include the correlationId field.
 *
 * Location data (city names, coordinates) MUST NOT be logged at INFO level
 * or above — use DEBUG level or omit entirely.
 */
export function createSessionLogger(correlationId: string): pino.Logger {
  return logger.child({ correlationId });
}
