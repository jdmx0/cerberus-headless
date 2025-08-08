import { chromium, type Browser, type BrowserContext, type LaunchOptions } from 'playwright';
import type { AppConfig } from '../config.js';

let browserPromise: Promise<Browser> | null = null;

export const getBrowser = async (config: AppConfig): Promise<Browser> => {
  if (!browserPromise) {
    const launchOptions: LaunchOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
      ],
    };
    browserPromise = chromium.launch(launchOptions);
  }
  return browserPromise;
};

export type ContextOptions = {
  userAgent?: string;
  proxy?: { server: string } | undefined;
  jsEnabled?: boolean;
  blockMedia?: boolean;
  viewport?: { width: number; height: number };
  referer?: string;
  extraHeaders?: Record<string, string>;
};

export const newContext = async (
  config: AppConfig,
  options: ContextOptions,
): Promise<BrowserContext> => {
  const browser = await getBrowser(config);
  const context = await browser.newContext({
    userAgent: options.userAgent,
    javaScriptEnabled: options.jsEnabled ?? true,
    viewport: options.viewport ?? { width: 1366, height: 768 },
    proxy: options.proxy,
    extraHTTPHeaders: options.extraHeaders,
    timezoneId: 'UTC',
    locale: 'en-US',
  });

  if (options.referer) {
    context.setExtraHTTPHeaders({ ...(options.extraHeaders ?? {}), Referer: options.referer });
  }

  if (options.blockMedia) {
    await context.route('**/*', (route) => {
      const req = route.request();
      const url = req.url();
      const type = req.resourceType();
      if (['image', 'media', 'font'].includes(type) || /\.(png|jpg|jpeg|gif|webp|svg|woff2?)$/i.test(url)) {
        return route.abort();
      }
      return route.continue();
    });
  }

  // Security hardening
  await context.addInitScript(() => {
    // Block dangerous APIs
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: 4 });
    // Disable service worker registration during our session
    try {
      if (navigator.serviceWorker && typeof navigator.serviceWorker.register === 'function') {
        // @ts-ignore
        navigator.serviceWorker.register = function () {
          return Promise.reject(new Error('ServiceWorker disabled by policy')) as any;
        } as any;
      }
    } catch {}
  });

  return context;
};



