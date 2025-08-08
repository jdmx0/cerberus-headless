import type pino from 'pino';
import type { AppConfig } from '../config.js';
import type { BrowserPool } from '../browser/pool.js';
import { MetaInput, MetaOutput } from './types.js';

export const createMetaTool = (config: AppConfig, pool: BrowserPool, logger: pino.Logger) => ({
  name: 'headless.meta',
  inputSchema: MetaInput,
  outputSchema: MetaOutput,
  call: async (raw: unknown, correlationId: string) => {
    const input = MetaInput.parse(raw);
    if (input.dry_run) return { correlation_id: correlationId, metas: {}, og: {}, twitter: {} };
    const host = new URL(input.url).host;
    const res = await pool.withPage(host, async (page) => {
      await page.goto(input.url, { waitUntil: 'domcontentloaded', timeout: config.NAV_TIMEOUT_MS });
      const out = await page.evaluate(() => {
        const metas: Record<string, string> = {};
        const og: Record<string, string> = {};
        const tw: Record<string, string> = {};
        document.querySelectorAll('meta[name],meta[property]').forEach((m) => {
          const key = (m.getAttribute('name') || m.getAttribute('property'))!;
          const val = m.getAttribute('content') || '';
          metas[key] = val;
          if (key.startsWith('og:')) og[key] = val;
          if (key.startsWith('twitter:')) tw[key] = val;
        });
        const canonical = (document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null)?.href || undefined;
        return { metas, og, twitter: tw, canonical };
      });
      return out;
    });
    return MetaOutput.parse({ correlation_id: correlationId, ...res });
  },
});



