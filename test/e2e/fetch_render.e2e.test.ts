import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { BrowserPool } from '../../src/browser/pool.js';
import { loadConfig } from '../../src/config.js';
import pino from 'pino';
import { createFetchRenderTool } from '../../src/tools/fetchRender.js';

let server: http.Server;
let base: string;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (!req.url) return;
    if (req.url === '/robots.txt') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('User-agent: *\nAllow: /');
      return;
    }
    if (req.url === '/slow') {
      setTimeout(() => {
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end('<html><body><div id="x">done</div></body></html>');
      }, 50);
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<html><head><title>T</title><meta name="description" content="d"></head><body>Hello</body></html>');
  });
  await new Promise<void>((r) => server.listen(0, r));
  const addr = server.address();
  if (typeof addr === 'object' && addr) base = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

describe('fetch_render e2e', () => {
  it('renders and returns sanitized html', async () => {
    const cfg = loadConfig();
    const pool = new BrowserPool(cfg);
    const tool = createFetchRenderTool(cfg, pool, pino({ level: 'silent' }));
    const out = (await tool.call({ url: `${base}/`, persist_artifacts: false }, 'cid')) as any;
    expect(out.status).toBe(200);
    expect(out.final_url).toContain(base);
    expect(out.html).toContain('<html');
    expect(out.text_snippet).toContain('Hello');
  }, 30000);
});



