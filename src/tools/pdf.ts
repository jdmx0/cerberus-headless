import type pino from 'pino';
import type { AppConfig } from '../config.js';
import type { BrowserPool } from '../browser/pool.js';
import { PdfInput, PdfOutput } from './types.js';
import { createStorage } from '../utils/storage.js';
import { sha256 } from '../utils/evidence.js';

export const createPdfTool = (config: AppConfig, pool: BrowserPool, logger: pino.Logger) => ({
  name: 'headless.pdf',
  inputSchema: PdfInput,
  outputSchema: PdfOutput,
  call: async (raw: unknown, correlationId: string) => {
    const input = PdfInput.parse(raw);
    if (input.dry_run) {
      return { correlation_id: correlationId, final_url: input.url, size_bytes: 0 };
    }
    const host = new URL(input.url).host;
    const res = await pool.withPage(host, async (page) => {
      await page.goto(input.url, { waitUntil: 'load', timeout: config.NAV_TIMEOUT_MS });
      const pdf = await page.pdf({ format: input.format, printBackground: input.print_background, margin: { top: `${input.margin_mm}mm`, bottom: `${input.margin_mm}mm`, left: `${input.margin_mm}mm`, right: `${input.margin_mm}mm` } });
      const finalUrl = page.url();
      return { finalUrl, pdf };
    });
    if (input.persist_artifacts) {
      const storage = createStorage(config);
      const hash = sha256(res.pdf);
      const uploaded = await storage.upload(`${new Date().toISOString().slice(0, 10)}/`, [
        { name: `${hash}.pdf`, mime: 'application/pdf', bytes: res.pdf },
      ]);
      return PdfOutput.parse({ correlation_id: correlationId, final_url: res.finalUrl, pdf_url: uploaded[`${hash}.pdf`], size_bytes: res.pdf.byteLength });
    }
    return PdfOutput.parse({ correlation_id: correlationId, final_url: res.finalUrl, bytes_base64: Buffer.from(res.pdf).toString('base64'), size_bytes: res.pdf.byteLength });
  },
});



