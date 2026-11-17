import { defineConfig, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'fs';
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import type { IncomingMessage, ServerResponse } from 'http';

function evalIrDev() {
  let child: ChildProcessWithoutNullStreams | null = null;
  const pending = new Map<string, (line: string) => void>();
  let buffer = '';

  const ensure = () => {
    if (child) return child;
    const venv = path.resolve(process.cwd(), '.venv/bin/python3');
    const python = fs.existsSync(venv) ? venv : 'python3';
    child = spawn(python, ['-u', 'src/engine/sympyWorker.py'], { cwd: process.cwd() });
    child.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      let newline = buffer.indexOf('\n');
      while (newline >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
        try {
          const message = JSON.parse(line) as { id?: string };
          const resolve = message.id ? pending.get(message.id) : undefined;
          if (resolve && message.id) {
            pending.delete(message.id);
            resolve(line);
          }
        } catch {
          // The worker's ready line and logs are not a result.
        }
      }
    });
    child.on('exit', () => {
      child = null;
      buffer = '';
    });
    return child;
  };

  const handle = (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.end();
      return;
    }
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      let body: { id?: string; statements?: unknown[] } = {};
      try {
        body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
      } catch {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
        return;
      }
      const id = body.id || `dev-${Date.now()}`;
      const worker = ensure();
      const timer = setTimeout(() => {
        if (!pending.has(id)) return;
        pending.delete(id);
        res.statusCode = 504;
        res.end(JSON.stringify({ success: false, error: 'The engine timed out.' }));
      }, 20000);
      pending.set(id, (line) => {
        clearTimeout(timer);
        res.setHeader('content-type', 'application/json');
        res.end(line);
      });
      worker.stdin.write(JSON.stringify({ id, action: 'eval-ir', statements: body.statements ?? [] }) + '\n');
    });
  };

  return {
    name: 'eval-ir',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/eval-ir', handle);
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    evalIrDev(),
    {
      name: 'remove-crossorigin',
      transformIndexHtml(html: string) {
        return html.replace(/ crossorigin/g, '');
      },
    },
  ],
  base: './',
  root: '.',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'monaco-editor-css': path.resolve(__dirname, 'node_modules/monaco-editor/min/vs/editor/editor.main.css'),
    },
  },
  optimizeDeps: {
    include: ['monaco-editor/editor/editor.api'],
  },
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
    modulePreload: false,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
