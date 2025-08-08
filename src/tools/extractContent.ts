import type pino from 'pino';
import type { AppConfig } from '../config.js';
import type { BrowserPool } from '../browser/pool.js';
import { ExtractContentInput, ExtractContentOutput } from './types.js';
import { extractFields } from '../utils/extract.js';

export const createExtractContentTool = (config: AppConfig, pool: BrowserPool, logger: pino.Logger) => ({
  name: 'headless.extract_content',
  inputSchema: ExtractContentInput,
  outputSchema: ExtractContentOutput,
  call: async (raw: unknown, correlationId: string) => {
    const input = ExtractContentInput.parse(raw);
    if (input.dry_run) return { correlation_id: correlationId, fields: {}, confidence: 0.0 };
    let html = input.html;
    const notes: string[] = [];
    if ((!html || input.re_render) && input.url) {
      const host = new URL(input.url).host;
      const content = await pool.withPage(host, async (page) => {
        await page.goto(input.url!, { waitUntil: 'domcontentloaded', timeout: config.NAV_TIMEOUT_MS });
        return page.content();
      });
      html = content;
      notes.push('re_rendered');
    }
    if (!html) throw structuredError('INPUT_INVALID', 'Either html or url must be provided');
    const fields = extractFields(html, input.selectors, input.normalize_whitespace);
    const density = Object.values(fields).filter(Boolean).length / Math.max(1, input.selectors.length);
    const confidence = Math.round(density * 100) / 100;
    return ExtractContentOutput.parse({ correlation_id: correlationId, fields, confidence, notes: notes.length ? notes : undefined });
  },
});

const structuredError = (code: string, message: string) => {
  const e = new Error(message) as Error & { code?: string };
  e.code = code;
  return e;
};



