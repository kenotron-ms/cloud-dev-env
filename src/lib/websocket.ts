/**
 * WebSocket Manager
 *
 * Purpose: Manage WebSocket connection to backend terminal service
 * Contract: Connect, send data, receive data, auto-reconnect
 *
 * This module is self-contained and handles all WebSocket lifecycle:
 * - Connection state management
 * - Automatic reconnection with exponential backoff
 * - Message sending/receiving
 * - Error handling
 */

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface WebSocketManagerConfig {
  url: string;
  maxReconnectDelay?: number;
  onStateChange?: (state: ConnectionState) => void;
  onData?: (data: string) => void;
  onError?: (error: Error) => void;
}

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectDelay = 1000;
  private reconnectTimeout: number | null = null;
  private shouldReconnect = true;
  private state: ConnectionState = 'disconnected';
  private config: WebSocketManagerConfig;

  constructor(config: WebSocketManagerConfig) {
    this.config = config;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.setState('connecting');

    try {
      this.ws = new WebSocket(this.config.url);

      this.ws.onopen = () => {
        this.setState('connected');
        this.reconnectDelay = 1000; // Reset delay on successful connection
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'output' && message.data) {
            this.config.onData?.(message.data);
          } else if (message.type === 'status') {
            console.log('[WebSocket]', message.message);
          } else if (message.type === 'error') {
            console.error('[WebSocket]', message.message);
          }
        } catch (e) {
          // If not JSON, pass through as-is
          this.config.onData?.(event.data);
        }
      };

      this.ws.onerror = () => {
        const error = new Error('WebSocket error');
        this.config.onError?.(error);
        this.setState('error');
      };

      this.ws.onclose = () => {
        this.setState('disconnected');
        this.scheduleReconnect();
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to create WebSocket');
      this.config.onError?.(err);
      this.setState('error');
      this.scheduleReconnect();
    }
  }

  send(data: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      // Send as JSON message matching backend's TerminalMessage interface
      this.ws.send(JSON.stringify({ type: 'input', data }));
    }
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimeout !== null) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.ws?.close();
    this.ws = null;
    this.setState('disconnected');
  }

  getState(): ConnectionState {
    return this.state;
  }

  private setState(state: ConnectionState): void {
    this.state = state;
    this.config.onStateChange?.(state);
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) {
      return;
    }

    if (this.reconnectTimeout !== null) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = window.setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);

    // Exponential backoff with max limit
    const maxDelay = this.config.maxReconnectDelay ?? 30000;
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, maxDelay);
  }
}
