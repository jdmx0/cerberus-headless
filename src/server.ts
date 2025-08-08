import { loadConfig } from './config.js';
import pino from 'pino';
import { BrowserPool } from './browser/pool.js';
import http from 'node:http';
import { createFetchRenderTool } from './tools/fetchRender.js';
import { createExtractContentTool } from './tools/extractContent.js';
import { createScreenshotTool } from './tools/screenshot.js';
import { createPdfTool } from './tools/pdf.js';
import { createVideoTool } from './tools/video.js';
import { createGetLinksTool } from './tools/getLinks.js';
import { createEvaluateTool } from './tools/evaluate.js';
import { createMetaTool } from './tools/meta.js';
import { createRobotsTool } from './tools/robots.js';
import { createSaveArtifactsTool } from './tools/saveArtifacts.js';
import { randomUUID } from 'node:crypto';

type ToolSpec = {
  name: string;
  inputSchema: { parse: (v: unknown) => any };
  outputSchema: { parse: (v: unknown) => any };
  call: (input: unknown, correlationId: string) => Promise<unknown>;
};

const config = loadConfig();
const logger = pino({
  level: config.LOG_LEVEL,
  redact: { paths: ['headers.authorization', 'SUPABASE_SERVICE_ROLE'], censor: '[REDACTED]' },
});
const pool = new BrowserPool(config);

// Register tools
const tools: ToolSpec[] = [];
tools.push(createFetchRenderTool(config, pool, logger));
tools.push(createExtractContentTool(config, pool, logger));
tools.push(createScreenshotTool(config, pool, logger));
tools.push(createPdfTool(config, pool, logger));
tools.push(createVideoTool(config, pool, logger));
tools.push(createGetLinksTool(config, pool, logger));
tools.push(createEvaluateTool(config, pool, logger));
tools.push(createMetaTool(config, pool, logger));
tools.push(createRobotsTool(config, logger));
tools.push(createSaveArtifactsTool(config, logger));

// MCP-like JSON-RPC over stdio
const normalizeMethod = (method: string): string => {
  // Accept both slash and dot variants for compatibility with different MCP clients
  const m = method.replace(/\./g, '/');
  if (
    m === 'tools/list' ||
    m === 'tools/describe' ||
    m === 'tools/call' ||
    m === 'initialize' ||
    m === 'notifications/initialized'
  ) {
    return m;
  }
  return method; // fallback
};

process.stdin.setEncoding('utf8');
let buffer = '';
process.stdin.on('data', async (chunk) => {
  buffer += chunk;
  try {
    const lastNewline = buffer.lastIndexOf('\n');
    if (lastNewline === -1) return; // wait for a full line
    const toProcess = buffer.slice(0, lastNewline);
    buffer = buffer.slice(lastNewline + 1);
    const messages = toProcess.split('\n').filter((l) => l.trim().length > 0);
    for (const msg of messages) {
      const req = JSON.parse(msg);
      const id = req.id ?? null;
      const method = normalizeMethod(req.method as string);
      const params = req.params ?? {};
      const correlationId = params.correlation_id || randomUUID();
      try {
        let result: unknown;
        if (method === 'initialize') {
          result = {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: 'cerberus-mcp-headless',
              version: '0.1.0',
            },
          };
        } else if (method === 'tools/list' || method === 'tools.list') {
          result = {
            tools: tools.map((t) => ({
              name: t.name,
              description: `${t.name} tool for headless browser operations`,
            })),
          };
        } else if (method === 'tools/describe' || method === 'tools.describe') {
          const name = params.name as string;
          const t = tools.find((x) => x.name === name);
          if (!t) throw new Error(`Tool not found: ${name}`);
          result = {
            name: t.name,
            description: `${t.name} tool for headless browser operations`,
            inputSchema: {
              type: 'object',
              properties: {},
              required: [],
            },
          };
        } else if (method === 'tools/call' || method === 'tools.call') {
          const name = params.name as string;
          const input = params.input;
          const t = tools.find((x) => x.name === name);
          if (!t) throw new Error(`Tool not found: ${name}`);
          result = await t.call(input, correlationId);
        } else if (method === 'notifications/initialized') {
          // Notification - no response needed
          continue;
        } else {
          throw new Error(`Method not found: ${method}`);
        }
        const resp = JSON.stringify({ jsonrpc: '2.0', id, result });
        process.stdout.write(resp + '\n');
      } catch (err: any) {
        const error = { code: err.code || -32000, message: err.message, data: err.details };
        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error }) + '\n');
      }
    }
  } catch {
    // Wait for complete JSON lines
  }
});

// Minimal local HTTP interface for testing
const send = (res: http.ServerResponse, status: number, body: unknown) => {
  const json = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
  });
  res.end(json);
};

const readBody = async (req: http.IncomingMessage): Promise<any> => {
  return await new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(new Error('INVALID_JSON'));
      }
    });
    req.on('error', reject);
  });
};

// Health + Tools endpoints
const server = http.createServer(async (req, res) => {
  if (!req.url) return;
  if (req.method === 'GET' && req.url === '/health') {
    const health = pool.getHealth();
    const body = JSON.stringify({ ok: true, pool: health, version: '0.1.0' });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(body);
    return;
  } else if (req.method === 'GET' && (req.url === '/' || req.url === '/tools')) {
    return send(res, 200, { tools: tools.map((t) => ({ name: t.name })) });
  } else if (req.method === 'GET' && req.url.startsWith('/tools/describe')) {
    const url = new URL(req.url, 'http://local');
    const name = url.searchParams.get('name') || '';
    const t = tools.find((x) => x.name === name);
    if (!t) return send(res, 404, { error: `Tool not found: ${name}` });
    return send(res, 200, {
      name: t.name,
      description: `${t.name} tool for headless browser operations`,
    });
  } else if (
    req.method === 'POST' &&
    (req.url === '/tools/call' || req.url?.startsWith('/tools/call'))
  ) {
    try {
      const body = await readBody(req);
      const name = body.name as string;
      const input = body.input;
      const correlationId = body.correlation_id || randomUUID();
      const t = tools.find((x) => x.name === name);
      if (!t) return send(res, 404, { error: `Tool not found: ${name}` });
      const result = await t.call(input, correlationId);
      return send(res, 200, { correlation_id: correlationId, result });
    } catch (e: any) {
      return send(res, 400, { error: e?.message || String(e) });
    }
  }
  res.statusCode = 404;
  res.end('not found');
});
server.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, 'mcp-headless listening');
  logger.info({ tools: tools.map((t) => t.name) }, 'registered tools');
});
