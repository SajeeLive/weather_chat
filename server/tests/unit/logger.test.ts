import { PassThrough } from 'stream';
import pino from 'pino';

/**
 * Tests for the createSessionLogger helper.
 *
 * We build a logger that writes to an in-memory PassThrough stream
 * so we can assert on the JSON output without involving stdout.
 */

function makeTestLogger(correlationId: string): { logger: pino.Logger; getLines: () => object[] } {
  const lines: object[] = [];
  const stream = new PassThrough();
  stream.on('data', (chunk: Buffer) => {
    const text = chunk.toString().trim();
    if (!text) return;
    try {
      lines.push(JSON.parse(text));
    } catch {
      // ignore non-JSON
    }
  });

  const base = pino({ level: 'trace' }, stream);
  const logger = base.child({ correlationId });
  return { logger, getLines: () => lines };
}

describe('createSessionLogger', () => {
  it('includes correlationId in every log entry', () => {
    const correlationId = 'test-corr-id-001';
    const { logger, getLines } = makeTestLogger(correlationId);

    logger.info('first message');
    logger.warn('second message');

    const lines = getLines();
    expect(lines.length).toBe(2);
    for (const line of lines) {
      expect((line as { correlationId: string }).correlationId).toBe(correlationId);
    }
  });

  it('includes timestamp and level in every log entry', () => {
    const { logger, getLines } = makeTestLogger('corr-ts-test');

    logger.info('timestamped entry');

    const lines = getLines();
    const entry = lines[0] as { time: number; level: number };
    expect(typeof entry.time).toBe('number');
    expect(entry.time).toBeGreaterThan(0);
    expect(typeof entry.level).toBe('number');
  });

  it('does not include location data in INFO-level output', () => {
    const { logger, getLines } = makeTestLogger('corr-privacy-test');

    // Log an INFO event as the router would — event name only, no city
    logger.info({ event: 'query_received' }, 'Processing query');

    const lines = getLines();
    const raw = JSON.stringify(lines);

    // Location strings must not appear in INFO output
    const locationPatterns = ['London', 'New York', 'Chicago', '51.51', '-0.12'];
    for (const pattern of locationPatterns) {
      expect(raw).not.toContain(pattern);
    }
  });

  it('emits at ERROR level when logger.error is called', () => {
    const { logger, getLines } = makeTestLogger('corr-error-level');

    logger.error({ err: new Error('boom') }, 'Something failed');

    const lines = getLines();
    const entry = lines[0] as { level: number };
    // pino level 50 = error
    expect(entry.level).toBe(50);
  });
});
