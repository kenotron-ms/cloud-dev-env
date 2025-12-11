/**
 * Terminal Component
 *
 * Purpose: Full-screen terminal emulator using xterm.js
 * Contract: Display terminal, handle user input, auto-resize
 *
 * Props:
 * - onData: Called when user types (sends input to backend)
 * - onResize: Called when terminal size changes
 */

import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

export interface TerminalProps {
  onData?: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
}

export function Terminal({ onData, onResize }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Create terminal instance
    const xterm = new XTerm({
      theme: {
        background: '#1a1a1a',
        foreground: '#00ff00',
        cursor: '#00ff00',
        cursorAccent: '#1a1a1a',
        selectionBackground: '#404040',
      },
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      cursorBlink: true,
      allowTransparency: false,
    });

    // Add addons
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);

    // Open terminal in DOM
    xterm.open(terminalRef.current);

    // Store xterm instance on the .xterm element for App.tsx to access
    requestAnimationFrame(() => {
      const xtermElement = terminalRef.current?.querySelector('.xterm');
      if (xtermElement) {
        (xtermElement as any).terminal = xterm;
      }
      fitAddon.fit();
    });

    // Handle user input
    xterm.onData((data) => {
      onData?.(data);
    });

    // Handle resize
    xterm.onResize(({ cols, rows }) => {
      onResize?.(cols, rows);
    });

    // Store refs
    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Expose xterm instance on the DOM element for parent component access
    if (terminalRef.current) {
      (terminalRef.current as any)._xterm = xterm;
    }

    // Handle window resize
    const handleResize = () => {
      fitAddon.fit();
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      xterm.dispose();
    };
  }, [onData, onResize]);

  // Public method to write to terminal
  useEffect(() => {
    if (xtermRef.current) {
      // Expose write method via ref (for parent component)
      (terminalRef.current as any)?.xterm?.write;
    }
  }, []);

  return (
    <div
      ref={terminalRef}
      style={{
        width: '100%',
        height: '100%',
      }}
    />
  );
}

// Helper function to write data to terminal (exported for use by parent)
export function writeToTerminal(terminalElement: HTMLDivElement | null, data: string) {
  const xterm = (terminalElement as any)?._xterm;
  if (xterm) {
    xterm.write(data);
  }
}
