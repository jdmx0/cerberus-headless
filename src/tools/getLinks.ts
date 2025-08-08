import type pino from 'pino';
import type { AppConfig } from '../config.js';
import type { BrowserPool } from '../browser/pool.js';
import { GetLinksInput, GetLinksOutput } from './types.js';

export const createGetLinksTool = (config: AppConfig, pool: BrowserPool, logger: pino.Logger) => ({
  name: 'headless.get_links',
  inputSchema: GetLinksInput,
  outputSchema: GetLinksOutput,
  call: async (raw: unknown, correlationId: string) => {
    const input = GetLinksInput.parse(raw);
    if (input.dry_run) {
      return { correlation_id: correlationId, links: [], counts: { total: 0, unique: 0 } };
    }
    const origin = new URL(input.url).origin;
    const host = new URL(input.url).host;
    const res = await pool.withPage(host, async (page) => {
      await page.goto(input.url, { waitUntil: 'domcontentloaded', timeout: config.NAV_TIMEOUT_MS });
      const links = await page.evaluate(() => {
        const out: { href: string; text?: string; rel?: string }[] = [];
        document.querySelectorAll('a[href]').forEach((a) => {
          out.push({ href: (a as HTMLAnchorElement).href, text: (a.textContent || '').trim(), rel: a.getAttribute('rel') || undefined });
        });
        const canonical = (document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null)?.href;
        if (canonical) out.push({ href: canonical, rel: 'canonical' });
        document.querySelectorAll('meta[property^="og:"]').forEach((m) => {
          if (m.getAttribute('property') === 'og:url' && m.getAttribute('content')) {
            out.push({ href: m.getAttribute('content')!, rel: 'og:url' });
          }
        });
        return out;
      });
      return links;
    });
    let filtered = res;
    if (input.scope === 'same_origin') filtered = res.filter((l) => safeUrl(l.href)?.origin === origin);
    else if (input.scope === 'same_host') filtered = res.filter((l) => safeUrl(l.href)?.host === host);
    if (!input.include_rel_nofollow) filtered = filtered.filter((l) => (l.rel || '').toLowerCase() !== 'nofollow');
    if (input.unique) {
      const seen = new Set<string>();
      filtered = filtered.filter((l) => (seen.has(l.href) ? false : (seen.add(l.href), true)));
    }
    filtered = filtered.slice(0, input.max_count);
    return GetLinksOutput.parse({ correlation_id: correlationId, links: filtered, counts: { total: res.length, unique: filtered.length } });
  },
});

const safeUrl = (u: string): URL | null => {
  try {
    return new URL(u);
  } catch {
    return null;
  }
};



