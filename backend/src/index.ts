import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { config } from './config/env.js';
import { setupWebSocketServer, cleanupAllConnections } from './websocket/handler.js';

const app = express();

app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

const server = createServer(app);

setupWebSocketServer(server);

const shutdown = async () => {
  console.log('\n[Server] Shutdown signal received, cleaning up...');

  await cleanupAllConnections();

  server.close(() => {
    console.log('[Server] HTTP server closed');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('[Server] Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

server.listen(config.port, () => {
  console.log(`[Server] Backend server running on port ${config.port}`);
  console.log(`[Server] Health check: http://localhost:${config.port}/health`);
  console.log(`[Server] WebSocket endpoint: ws://localhost:${config.port}/terminal`);
  console.log(`[Server] CORS enabled for: ${config.frontendUrl}`);
});
