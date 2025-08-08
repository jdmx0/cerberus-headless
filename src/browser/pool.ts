import Bottleneck from 'bottleneck';
import type { AppConfig } from '../config.js';
import { newContext } from './playwright.js';
import type { BrowserContext, Page } from 'playwright';

type PooledContext = {
  context: BrowserContext;
  busy: boolean;
  createdAt: number;
};

export class BrowserPool {
  private readonly config: AppConfig;
  private readonly contexts: PooledContext[] = [];
  private readonly maxContexts: number;
  private readonly globalLimiter: Bottleneck;
  private readonly hostLimiters: Map<string, Bottleneck> = new Map();

  public constructor(config: AppConfig) {
    this.config = config;
    this.maxContexts = 4;
    this.globalLimiter = new Bottleneck({
      maxConcurrent: this.config.GLOBAL_MAX_CONCURRENCY,
    });
    setInterval(() => this.reapIdle(), 30_000).unref();
  }

  public getHealth(): { total: number; busy: number } {
    const total = this.contexts.length;
    const busy = this.contexts.filter((c) => c.busy).length;
    return { total, busy };
  }

  private getLimiterForHost(host: string): Bottleneck {
    let lim = this.hostLimiters.get(host);
    if (!lim) {
      lim = new Bottleneck({ maxConcurrent: this.config.PER_HOST_MAX_CONCURRENCY });
      this.hostLimiters.set(host, lim);
    }
    return lim;
  }

  private async acquireContext(): Promise<PooledContext> {
    const free = this.contexts.find((c) => !c.busy);
    if (free) {
      free.busy = true;
      return free;
    }
    if (this.contexts.length < this.maxContexts) {
      const context = await newContext(this.config, {
        blockMedia: true,
        jsEnabled: true,
      });
      const pooled: PooledContext = { context, busy: true, createdAt: Date.now() };
      this.contexts.push(pooled);
      return pooled;
    }
    // Wait for a context to free up
    await new Promise((r) => setTimeout(r, 50));
    return this.acquireContext();
  }

  private releaseContext(pooled: PooledContext): void {
    pooled.busy = false;
  }

  private async reapIdle(): Promise<void> {
    const now = Date.now();
    const toClose = this.contexts.filter((c) => !c.busy && now - c.createdAt > 120_000);
    for (const c of toClose) {
      await c.context.close().catch(() => undefined);
      const idx = this.contexts.indexOf(c);
      if (idx >= 0) this.contexts.splice(idx, 1);
    }
  }

  public async withPage<T>(host: string, fn: (page: Page, context: BrowserContext) => Promise<T>): Promise<T> {
    const hostLimiter = this.getLimiterForHost(host);
    return this.globalLimiter.schedule(() => hostLimiter.schedule(async () => {
      const pooled = await this.acquireContext();
      try {
        const page = await pooled.context.newPage();
        const result = await fn(page, pooled.context);
        await page.close().catch(() => undefined);
        return result;
      } finally {
        this.releaseContext(pooled);
      }
    }));
  }
}



