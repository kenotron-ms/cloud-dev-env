import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';
import { SandboxManager, SandboxProcess } from '../sandbox/manager.js';

interface TerminalMessage {
  type: 'input' | 'resize';
  data?: string;
  cols?: number;
  rows?: number;
}

interface ConnectionState {
  sandboxManager: SandboxManager;
  sandboxProcess: SandboxProcess | null;
}

const connections = new Map<WebSocket, ConnectionState>();

export function setupWebSocketServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({
    server,
    path: '/terminal'
  });

  wss.on('connection', async (ws: WebSocket) => {
    console.log('[WebSocket] New connection established');

    const state: ConnectionState = {
      sandboxManager: new SandboxManager(),
      sandboxProcess: null,
    };
    connections.set(ws, state);

    ws.send(JSON.stringify({ type: 'status', message: 'Initializing sandbox...' }));

    try {
      const sandboxProcess = await state.sandboxManager.create(
        (data: string) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'output', data }));
          }
        },
        (code: number) => {
          console.log(`[WebSocket] Sandbox process exited with code ${code}`);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'status',
              message: `Process exited with code ${code}`
            }));
            ws.close();
          }
        }
      );

      state.sandboxProcess = sandboxProcess;
      ws.send(JSON.stringify({ type: 'ready' }));
      console.log('[WebSocket] Sandbox ready for input');
    } catch (error) {
      console.error('[WebSocket] Error creating sandbox:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: `Failed to create sandbox: ${error instanceof Error ? error.message : 'Unknown error'}`
      }));
      ws.close();
      connections.delete(ws);
      return;
    }

    ws.on('message', async (message: Buffer) => {
      try {
        const messageStr = message.toString();

        // Ignore empty or non-JSON messages (e.g., ping/pong)
        if (!messageStr || messageStr.trim().length === 0) {
          return;
        }

        const msg: TerminalMessage = JSON.parse(messageStr);

        if (msg.type === 'input' && msg.data !== undefined) {
          if (state.sandboxProcess) {
            state.sandboxProcess.write(msg.data);
          }
        } else if (msg.type === 'resize' && msg.cols !== undefined && msg.rows !== undefined) {
          if (state.sandboxProcess) {
            state.sandboxProcess.resize(msg.cols, msg.rows);
          }
        }
      } catch (error) {
        // Only log if it's not a simple parsing error (could be ping/pong)
        if (error instanceof Error && !error.message.includes('Unexpected end of JSON input')) {
          console.error('[WebSocket] Error processing message:', error);
        }
      }
    });

    ws.on('close', async () => {
      console.log('[WebSocket] Connection closed');
      const state = connections.get(ws);
      if (state?.sandboxProcess) {
        await state.sandboxProcess.kill();
      }
      connections.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('[WebSocket] WebSocket error:', error);
    });
  });

  wss.on('error', (error) => {
    console.error('[WebSocket] WebSocketServer error:', error);
  });

  console.log('[WebSocket] WebSocket server initialized on /terminal');

  return wss;
}

export async function cleanupAllConnections(): Promise<void> {
  console.log('[WebSocket] Cleaning up all connections...');
  const cleanupPromises: Promise<void>[] = [];

  for (const [ws, state] of connections.entries()) {
    if (state.sandboxProcess) {
      cleanupPromises.push(state.sandboxProcess.kill());
    }
    ws.close();
  }

  await Promise.all(cleanupPromises);
  connections.clear();
  console.log('[WebSocket] All connections cleaned up');
}
