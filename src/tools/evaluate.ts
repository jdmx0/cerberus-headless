import type pino from 'pino';
import type { AppConfig } from '../config.js';
import type { BrowserPool } from '../browser/pool.js';
import { EvaluateInput, EvaluateOutput } from './types.js';

export const createEvaluateTool = (config: AppConfig, pool: BrowserPool, logger: pino.Logger) => ({
  name: 'headless.evaluate',
  inputSchema: EvaluateInput,
  outputSchema: EvaluateOutput,
  call: async (raw: unknown, correlationId: string) => {
    const input = EvaluateInput.parse(raw);
    if (input.dry_run) {
      return { correlation_id: correlationId, result: null, logs: [], warnings: [] };
    }
    const host = new URL(input.url).host;
    const res = await pool.withPage(host, async (page) => {
      await page.addInitScript(() => {
        // Block dangerous constructs
        // @ts-ignore
        window.eval = () => {
          throw new Error('eval blocked');
        };
        // @ts-ignore
        window.Function = function () {
          throw new Error('Function constructor blocked');
        } as any;
        // @ts-ignore
        window.Worker = function () {
          throw new Error('Worker blocked');
        } as any;
      });
      await page.route('**/*', (route) => {
        // Block network during evaluation window
        if (page.isClosed()) return route.abort();
        if (route.request().resourceType() === 'document') return route.continue();
        return route.abort();
      });
      const logs: string[] = [];
      page.on('console', (m) => logs.push(m.text()));
      await page.goto(input.url, { waitUntil: 'domcontentloaded', timeout: config.NAV_TIMEOUT_MS });
      const result = await page.evaluate(
        ({ src, timeout }) => {
          const fn = new Function(`"use strict";return (${src});`)();
          return new Promise((resolve, reject) => {
            let done = false;
            const timer = setTimeout(() => {
              if (!done) reject(new Error('EVAL_TIMEOUT'));
            }, timeout);
            Promise.resolve()
              .then(() => fn())
              .then((r: any) => {
                done = true;
                clearTimeout(timer);
                resolve(r);
              })
              .catch((e: any) => {
                done = true;
                clearTimeout(timer);
                reject(e);
              });
          });
        },
        { src: input.function_source, timeout: input.timeout_ms },
      );
      return { result, logs };
    });
    return EvaluateOutput.parse({ correlation_id: correlationId, result: res.result, logs: res.logs, warnings: [] });
  },
});



