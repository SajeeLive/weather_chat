import { initTRPC, TRPCError } from '@trpc/server';
import { observable } from '@trpc/server/observable';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { createSessionLogger } from '../middleware/logger.js';
import { runAIQuery } from '../services/aiService.js';
import type {
  Session,
  ChatEvent,
  HealthResponse,
  WeatherServiceError,
  AIServiceError,
  ClarificationNeededError,
} from '../types/index.js';

// ─── Active sessions (in-memory) ──────────────────────────────────────────

const sessions = new Map<string, Session>();

// ─── tRPC initialisation ──────────────────────────────────────────────────

const t = initTRPC.create({
  errorFormatter({ shape, error }) {
    // Strip internal error details — never expose stack traces to the client
    return {
      ...shape,
      data: {
        code: shape.data.code,
        httpStatus: shape.data.httpStatus,
      },
    };
  },
});

const router = t.router;
const publicProcedure = t.procedure;

// ─── Zod schemas ──────────────────────────────────────────────────────────

const SelectLocationSchema = z.object({
  displayName: z.string().min(1),
  lat: z.number(),
  lon: z.number(),
  originalQuery: z.string().min(1),
});

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeErrorEvent(err: unknown): ChatEvent {
  if ((err as WeatherServiceError).name === 'WeatherServiceError') {
    const e = err as WeatherServiceError;
    return { type: 'error', payload: { message: e.message, retryable: e.retryable } };
  }
  if ((err as AIServiceError).name === 'AIServiceError') {
    return { type: 'error', payload: { message: (err as AIServiceError).message, retryable: false } };
  }
  return { type: 'error', payload: { message: 'Something went wrong. Please try again.', retryable: true } };
}

/**
 * Core query pipeline.
 * The AI agent handles city extraction from natural language via tool calls.
 * For selectLocation, an overrideLocation pins the resolved city coordinates.
 */
async function runQueryPipeline(
  session: Session,
  queryText: string,
  overrideLocation?: { lat: number; lon: number; displayName: string },
): Promise<void> {
  const log = createSessionLogger(session.correlationId);

  try {
    log.info({ event: 'query_received' }, 'Processing query');
    session.emit({ type: 'loading' });

    const result = await runAIQuery(queryText, log, overrideLocation);
    session.emit({ type: 'message', payload: result });
  } catch (err) {
    if ((err as ClarificationNeededError).name === 'ClarificationNeededError') {
      const e = err as ClarificationNeededError;
      session.emit({
        type: 'clarification_needed',
        payload: {
          question: 'Which location did you mean?',
          candidates: e.candidates,
          originalQuery: e.originalQuery,
        },
      });
      return;
    }
    log.error({ err }, 'Query pipeline error');
    session.emit(makeErrorEvent(err));
  }
}

// ─── Router ───────────────────────────────────────────────────────────────

export const appRouter = router({
  health: publicProcedure.query((): HealthResponse => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  sendQuery: publicProcedure
    .input(z.object({ text: z.string().min(1).max(500) }))
    .mutation(async ({ input, ctx }): Promise<{ queued: true }> => {
      const socketId = (ctx as { socketId?: string }).socketId;
      if (!socketId) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'No active session' });

      const session = sessions.get(socketId);
      if (!session) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Session not found' });

      void runQueryPipeline(session, input.text);
      return { queued: true };
    }),

  selectLocation: publicProcedure
    .input(SelectLocationSchema)
    .mutation(async ({ input, ctx }): Promise<{ queued: true }> => {
      const socketId = (ctx as { socketId?: string }).socketId;
      if (!socketId) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'No active session' });

      const session = sessions.get(socketId);
      if (!session) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Session not found' });

      void runQueryPipeline(session, input.originalQuery, {
        lat: input.lat,
        lon: input.lon,
        displayName: input.displayName,
      });
      return { queued: true };
    }),

  chatStream: publicProcedure.subscription(({ ctx }) => {
    const socketId = (ctx as { socketId?: string }).socketId ?? uuidv4();
    const correlationId = uuidv4();
    const log = createSessionLogger(correlationId);

    return observable<ChatEvent>((emit) => {
      const session: Session = {
        socketId,
        messages: [],
        correlationId,
        emit: (event) => emit.next(event),
      };

      sessions.set(socketId, session);
      log.info({ event: 'session_connected', socketId }, 'Session connected');

      return () => {
        sessions.delete(socketId);
        log.info({ event: 'session_disconnected', socketId }, 'Session disconnected');
      };
    });
  }),
});

export type AppRouter = typeof appRouter;

export const createCaller = t.createCallerFactory(appRouter);
