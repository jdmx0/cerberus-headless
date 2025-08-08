import Bottleneck from 'bottleneck';

export type RateLimiterConfig = {
  globalMaxConcurrent: number;
  perHostMaxConcurrent: number;
};

export class RateLimiter {
  private readonly globalLimiter: Bottleneck;
  private readonly hostLimiters: Map<string, Bottleneck> = new Map();
  private readonly perHostMaxConcurrent: number;

  public constructor(config: RateLimiterConfig) {
    this.perHostMaxConcurrent = config.perHostMaxConcurrent;
    this.globalLimiter = new Bottleneck({ maxConcurrent: config.globalMaxConcurrent });
  }

  private getHostLimiter(host: string): Bottleneck {
    let lim = this.hostLimiters.get(host);
    if (!lim) {
      lim = new Bottleneck({ maxConcurrent: this.perHostMaxConcurrent });
      this.hostLimiters.set(host, lim);
    }
    return lim;
  }

  public async schedule<T>(host: string, task: () => Promise<T>): Promise<T> {
    const hostLimiter = this.getHostLimiter(host);
    return this.globalLimiter.schedule(() => hostLimiter.schedule(task));
  }
}



