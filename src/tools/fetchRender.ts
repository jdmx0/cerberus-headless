import { type BrowserPool } from '../browser/pool.js';
import { isAllowlistedBypass, isBlocklisted, isProtocolAllowed, checkRobots } from '../browser/policies.js';
import { sanitizeHtml } from '../utils/sanitize.js';
import { waitForNetworkIdle } from '../utils/timing.js';
import { createStorage } from '../utils/storage.js';
import { gzipText, sha256, timestampIso } from '../utils/evidence.js';
import type { AppConfig } from '../config.js';
import { FetchRenderInput, FetchRenderOutput } from './types.js';
import pino from 'pino';

export const createFetchRenderTool = (config: AppConfig, pool: BrowserPool, logger: pino.Logger) => {
  return {
    name: 'headless.fetch_render',
    inputSchema: FetchRenderInput,
    outputSchema: FetchRenderOutput,
    call: async (rawInput: unknown, correlationId: string) => {
      const start = Date.now();
      const input = FetchRenderInput.parse(rawInput);
      if (input.dry_run) {
        return { correlation_id: correlationId, status: 0, headers: {}, final_url: input.url, html: '', text_snippet: '', timing: { nav_ms: 0, total_ms: 0 }, policy: { robots_allowed: true }, meta: {} };
      }

      const proto = isProtocolAllowed(input.url);
      if (!proto.allowed) {
        throw structuredError('POLICY_BLOCKED', `Protocol not allowed: ${proto.reason}`, { url: input.url });
      }

      const block = isBlocklisted(config, input.url);
      if (!block.allowed) {
        throw structuredError(block.reason || 'BLOCKLISTED_DOMAIN', 'Blocklisted target', { url: input.url });
      }

      const host = new URL(input.url).host;
      const shouldRespect = input.respect_robots ?? config.RESPECT_ROBOTS;
      let robotsAllowed = true;
      let robotsRule: string | undefined;
      if (shouldRespect && !isAllowlistedBypass(config, input.url)) {
        const rc = await checkRobots(config, input.url);
        robotsAllowed = rc.allowed;
        robotsRule = rc.matchedRule;
        if (!robotsAllowed) {
          return FetchRenderOutput.parse({
            correlation_id: correlationId,
            status: 0,
            headers: {},
            final_url: input.url,
            html: '',
            text_snippet: '',
            lang: 'und',
            timing: { nav_ms: 0, total_ms: Date.now() - start },
            evidence: undefined,
            policy: { robots_allowed: false, rule_source: robotsRule, blocked_reason: 'ROBOTS_DISALLOWED' },
            meta: {},
          });
        }
      }

      const navStart = Date.now();
      const result = await pool.withPage(host, async (page, context) => {
        if (input.user_agent || input.extra_headers) {
          const headers: Record<string, string> = { ...(input.extra_headers || {}) };
          if (input.user_agent) headers['User-Agent'] = input.user_agent;
          await context.setExtraHTTPHeaders(headers);
        }
        if (input.cookies) await context.addCookies(input.cookies as any);

        // Security hardening
        await page.route('**/*', (route) => {
          const req = route.request();
          const url = req.url();
          if (/^(blob:|data:|file:)/i.test(url)) return route.abort();
          return route.continue();
        });

        const response = await page.goto(input.url, { waitUntil: input.wait_until, timeout: input.timeout_ms });

        if (input.wait_until === 'networkidle') {
          await waitForNetworkIdle(page, { idleMs: 500, maxInflight: 2, timeoutMs: 10_000 });
        }

        const status = response?.status() ?? 0;
        const headers: Record<string, string> = {};
        if (response) {
          const h = await response.allHeaders();
          for (const [k, v] of Object.entries(h)) headers[k] = String(v);
        }
        const finalUrl = page.url();

        const rawHtml = await page.content();
        const title = await page.title().catch(() => undefined);
        const meta = await page.evaluate(() => {
          const metas: Record<string, string> = {};
          document.querySelectorAll('meta[name],meta[property]').forEach((m) => {
            const key = (m.getAttribute('name') || m.getAttribute('property'))!;
            const val = m.getAttribute('content') || '';
            metas[key] = val;
          });
          const og: Record<string, string> = {};
          Object.keys(metas)
            .filter((k) => k.startsWith('og:'))
            .forEach((k) => (og[k] = metas[k]));
          const canonical = (document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null)?.href || undefined;
          const description = metas['description'];
          const htmlLang = document.documentElement.getAttribute('lang') || undefined;
          return { metas, og, canonical, description, htmlLang };
        });

        const { sanitized, textSnippet } = sanitizeHtml(rawHtml, {
          maxBytes: input.max_html_bytes ?? config.MAX_HTML_BYTES,
          redactPatterns: input.redact_patterns,
        });

        let evidence: { html_url?: string; screenshot_url?: string } | undefined;
        if (input.persist_artifacts) {
          const storage = createStorage(config);
          const htmlHash = sha256(rawHtml);
          const png = await page.screenshot({ fullPage: true });
          const pngHash = sha256(png);
          const createdAt = timestampIso();
          const prefix = `${createdAt.slice(0, 10)}/`;
          const uploaded = await storage.upload(prefix, [
            { name: `${htmlHash}.html.gz`, mime: 'application/gzip', bytes: gzipText(rawHtml) },
            { name: `${pngHash}.png`, mime: 'image/png', bytes: png },
          ]);
          evidence = { html_url: uploaded[`${htmlHash}.html.gz`], screenshot_url: uploaded[`${pngHash}.png`] };
        }

        return { status, headers, finalUrl, sanitized, textSnippet, title, meta, evidence };
      });

      const out = FetchRenderOutput.parse({
        correlation_id: correlationId,
        status: result.status,
        headers: result.headers,
        final_url: result.finalUrl,
        html: result.sanitized,
        text_snippet: result.textSnippet,
        lang: result.meta.htmlLang || result.meta.metas['og:locale'] || 'und',
        timing: { nav_ms: Date.now() - navStart, total_ms: Date.now() - start },
        evidence: result.evidence,
        policy: { robots_allowed: robotsAllowed, rule_source: robotsRule },
        meta: { title: result.title, description: result.meta.description, og: result.meta.og, canonical: result.meta.canonical },
      });

      logger.info({ correlation_id: correlationId, tool: 'fetch_render', url: input.url, status: out.status }, 'fetch_render completed');
      return { ...out };
    },
  };
};

const structuredError = (code: string, message: string, details?: Record<string, unknown>) => {
  const err = new Error(message) as Error & { code?: string; details?: Record<string, unknown> };
  err.code = code;
  err.details = details;
  return err;
};



