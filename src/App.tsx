/**
 * Main App Component
 *
 * Purpose: Orchestrate terminal display and WebSocket connection
 * Contract: Display terminal, manage connection state, handle errors
 */

import { useEffect, useRef, useState } from 'react';
import { Terminal } from './components/Terminal';
import { WebSocketManager, type ConnectionState } from './lib/websocket';
import './App.css';

const WS_URL = 'ws://localhost:3000/terminal';

function App() {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const wsManagerRef = useRef<WebSocketManager | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  const startSession = () => {
    setSessionStarted(true);
    setError(null);

    const wsManager = new WebSocketManager({
      url: WS_URL,
      onStateChange: (state) => {
        setConnectionState(state);
      },
      onData: (data) => {
        // Write data to terminal
        const terminalContainer = terminalRef.current;
        if (terminalContainer) {
          const xtermElement = terminalContainer.querySelector('.xterm');
          const xterm = (xtermElement as any)?.terminal;
          if (xterm) {
            xterm.write(data);
          }
        }
      },
      onError: (err) => {
        setError(err.message);
      },
    });

    wsManagerRef.current = wsManager;
    wsManager.connect();
  };

  const handleTerminalData = (data: string) => {
    wsManagerRef.current?.send(data);
  };

  const handleTerminalResize = (cols: number, rows: number) => {
    // Send resize event to backend (for future implementation)
    wsManagerRef.current?.send(JSON.stringify({ type: 'resize', cols, rows }));
  };

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      wsManagerRef.current?.disconnect();
    };
  }, []);

  // Store terminal xterm instance on ref for later access
  const handleTerminalRef = (el: HTMLDivElement | null) => {
    if (el) {
      terminalRef.current = el;
      // Store xterm instance on the element for easy access
      const observer = new MutationObserver(() => {
        const xtermElement = el.querySelector('.xterm');
        if (xtermElement) {
          (el as any)._xterm = (xtermElement as any).terminal;
          observer.disconnect();
        }
      });
      observer.observe(el, { childList: true, subtree: true });
    }
  };

  return (
    <div className="app">
      {!sessionStarted ? (
        <div className="start-screen">
          <h1>Cloud Development Environment</h1>
          <button onClick={startSession} className="start-button">
            Start Session
          </button>
        </div>
      ) : (
        <>
          <div className="status-bar">
            <span className={`status-indicator status-${connectionState}`}>
              {connectionState === 'connected' && '● Connected'}
              {connectionState === 'connecting' && '○ Connecting...'}
              {connectionState === 'disconnected' && '○ Disconnected'}
              {connectionState === 'error' && '✕ Error'}
            </span>
            {error && <span className="error-message">{error}</span>}
          </div>
          <div className="terminal-container" ref={handleTerminalRef}>
            <Terminal onData={handleTerminalData} onResize={handleTerminalResize} />
          </div>
        </>
      )}
    </div>
  );
}

export default App;
