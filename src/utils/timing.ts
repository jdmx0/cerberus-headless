import type { Page } from 'playwright';

export const waitForNetworkIdle = async (
  page: Page,
  { idleMs = 500, maxInflight = 2, timeoutMs = 10_000 }: { idleMs?: number; maxInflight?: number; timeoutMs?: number },
): Promise<void> => {
  let inflight = 0;
  let idleResolve: (() => void) | null = null;
  let idleTimer: NodeJS.Timeout | null = null;
  const onReq = () => {
    inflight++;
    if (idleTimer) clearTimeout(idleTimer);
  };
  const onDone = () => {
    inflight = Math.max(0, inflight - 1);
    if (inflight <= maxInflight) {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => idleResolve && idleResolve(), idleMs);
    }
  };

  page.on('request', onReq);
  page.on('requestfinished', onDone);
  page.on('requestfailed', onDone);

  await Promise.race([
    new Promise<void>((resolve) => {
      idleResolve = resolve;
    }),
    page.waitForTimeout(timeoutMs),
  ]);

  page.off('request', onReq);
  page.off('requestfinished', onDone);
  page.off('requestfailed', onDone);
};



