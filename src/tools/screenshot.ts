import type pino from 'pino';
import type { AppConfig } from '../config.js';
import type { BrowserPool } from '../browser/pool.js';
import { ScreenshotInput, ScreenshotOutput } from './types.js';
import { createStorage } from '../utils/storage.js';
import { sha256 } from '../utils/evidence.js';

export const createScreenshotTool = (config: AppConfig, pool: BrowserPool, logger: pino.Logger) => ({
  name: 'headless.screenshot',
  inputSchema: ScreenshotInput,
  outputSchema: ScreenshotOutput,
  call: async (raw: unknown, correlationId: string) => {
    const input = ScreenshotInput.parse(raw);
    if (input.dry_run) {
      return { correlation_id: correlationId, final_url: input.url, dimensions: { width: 0, height: 0 }, timing_ms: 0 };
    }
    const host = new URL(input.url).host;
    const t0 = Date.now();
    const res = await pool.withPage(host, async (page) => {
      await page.goto(input.url, { waitUntil: input.wait_until, timeout: config.NAV_TIMEOUT_MS });
      const finalUrl = page.url();
      let bytes: Buffer;
      if (input.selector) {
        const el = await page.waitForSelector(input.selector, { timeout: 5000 });
        if (!el) throw structuredError('ELEMENT_NOT_FOUND', `Selector not found: ${input.selector}`);
        bytes = await el.screenshot({ omitBackground: input.omit_background });
      } else if (input.clip) {
        bytes = await page.screenshot({ clip: input.clip, omitBackground: input.omit_background });
      } else {
        bytes = await page.screenshot({ fullPage: input.full_page, omitBackground: input.omit_background });
      }
      const dims = await page.evaluate(() => ({ width: window.innerWidth, height: document.body.scrollHeight }));
      return { finalUrl, bytes, dims };
    });

    if (input.persist_artifacts) {
      const storage = createStorage(config);
      const hash = sha256(res.bytes);
      const uploaded = await storage.upload(`${new Date().toISOString().slice(0, 10)}/`, [
        { name: `${hash}.png`, mime: 'image/png', bytes: res.bytes },
      ]);
      return ScreenshotOutput.parse({
        correlation_id: correlationId,
        final_url: res.finalUrl,
        screenshot_url: uploaded[`${hash}.png`],
        dimensions: res.dims,
        timing_ms: Date.now() - t0,
      });
    }
    return ScreenshotOutput.parse({
      correlation_id: correlationId,
      final_url: res.finalUrl,
      bytes_base64: Buffer.from(res.bytes).toString('base64'),
      dimensions: res.dims,
      timing_ms: Date.now() - t0,
    });
  },
});

const structuredError = (code: string, message: string) => {
  const e = new Error(message) as Error & { code?: string };
  e.code = code;
  return e;
};



