import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { applyWSSHandler } from '@trpc/server/adapters/ws';
import { appRouter } from './router/index.js';
import { logger } from './middleware/logger.js';

// ─── Startup environment validation ───────────────────────────────────────

function validateEnv(): void {
  const required = ['OPENWEATHERMAP_API_KEY', 'ANTHROPIC_API_KEY'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    logger.fatal({ missing }, `Missing required environment variables: ${missing.join(', ')}. Exiting.`);
    process.exit(1);
  }
}

validateEnv();

// ─── Express app ───────────────────────────────────────────────────────────

const app = express();

app.use(cors({
  origin: process.env['CLIENT_ORIGIN'] ?? 'http://localhost:5173',
  credentials: true,
  allowedHeaders: ['Content-Type', 'x-socket-id'],
}));
app.use(express.json());

// Health check — available over plain HTTP (no tRPC overhead)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// tRPC HTTP adapter (handles queries and mutations over HTTP)
app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext: ({ req }) => {
      // Client sends socketId via x-socket-id header to tie HTTP mutations to WS session
      const socketId = (req.headers['x-socket-id'] as string | undefined) ?? undefined;
      return { socketId };
    },
  }),
);

// ─── HTTP + WebSocket server ───────────────────────────────────────────────

const PORT = parseInt(process.env['PORT'] ?? '4000', 10);
const httpServer = createServer(app);

const wss = new WebSocketServer({ server: httpServer });

const wssHandler = applyWSSHandler({
  wss,
  router: appRouter,
  createContext: ({ req }) => {
    // Parse socketId from WebSocket URL query string: ws://host:4000?socketId=xxx
    const url = new URL(req.url ?? '/', `ws://localhost:${PORT}`);
    const socketId = url.searchParams.get('socketId') ?? undefined;
    return { socketId };
  },
});

// ─── Graceful shutdown ────────────────────────────────────────────────────

process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down');
  wssHandler.broadcastReconnectNotification();
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

// ─── Start ────────────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  logger.info({ port: PORT }, `SkyTalk server listening on port ${PORT}`);
});
