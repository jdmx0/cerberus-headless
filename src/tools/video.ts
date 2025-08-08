import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type pino from 'pino';
import type { AppConfig } from '../config.js';
import type { BrowserPool } from '../browser/pool.js';
import { VideoInput, VideoOutput } from './types.js';
import { createStorage } from '../utils/storage.js';
import { sha256 } from '../utils/evidence.js';
import { getBrowser } from '../browser/playwright.js';

export const createVideoTool = (config: AppConfig, pool: BrowserPool, logger: pino.Logger) => ({
  name: 'headless.video',
  inputSchema: VideoInput,
  outputSchema: VideoOutput,
  call: async (raw: unknown, correlationId: string) => {
    const input = VideoInput.parse(raw);
    if (input.dry_run) {
      return {
        correlation_id: correlationId,
        final_url: input.url,
        size_bytes: 0,
        duration_ms: input.duration_ms,
        timing_ms: 0,
      };
    }
    const host = new URL(input.url).host;
    const t0 = Date.now();
    const res = await pool.withPage(host, async () => {
      const browser = await getBrowser(config);
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'video-'));
      const context = await browser.newContext({
        viewport: { width: input.width, height: input.height },
        recordVideo: { dir: tmpDir, size: { width: input.width, height: input.height } },
      });
      const page = await context.newPage();
      await page.goto(input.url, { waitUntil: input.wait_until, timeout: config.NAV_TIMEOUT_MS });
      await page.waitForTimeout(input.duration_ms);
      const finalUrl = page.url();
      const video = await page.video();
      await page.close();
      await context.close();
      const videoPath = await video?.path();
      const bytes = videoPath ? await fs.readFile(videoPath) : Buffer.from([]);
      return { finalUrl, bytes };
    });

    if (input.persist_artifacts) {
      const storage = createStorage(config);
      const hash = sha256(res.bytes);
      const uploaded = await storage.upload(`${new Date().toISOString().slice(0, 10)}/`, [
        { name: `${hash}.webm`, mime: 'video/webm', bytes: res.bytes },
      ]);
      return VideoOutput.parse({
        correlation_id: correlationId,
        final_url: res.finalUrl,
        video_url: uploaded[`${hash}.webm`],
        size_bytes: res.bytes.byteLength,
        duration_ms: input.duration_ms,
        timing_ms: Date.now() - t0,
      });
    }
    return VideoOutput.parse({
      correlation_id: correlationId,
      final_url: res.finalUrl,
      bytes_base64: Buffer.from(res.bytes).toString('base64'),
      size_bytes: res.bytes.byteLength,
      duration_ms: input.duration_ms,
      timing_ms: Date.now() - t0,
    });
  },
});
