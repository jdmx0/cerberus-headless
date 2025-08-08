import type pino from 'pino';
import type { AppConfig } from '../config.js';
import { checkRobots } from '../browser/policies.js';
import { RobotsInput, RobotsOutput } from './types.js';

export const createRobotsTool = (config: AppConfig, logger: pino.Logger) => ({
  name: 'headless.robots',
  inputSchema: RobotsInput,
  outputSchema: RobotsOutput,
  call: async (raw: unknown, correlationId: string) => {
    const input = RobotsInput.parse(raw);
    if (input.dry_run) return { correlation_id: correlationId, robots_url: '', allowed: true };
    const rc = await checkRobots(config, input.url);
    return RobotsOutput.parse({ correlation_id: correlationId, robots_url: rc.robotsUrl, allowed: rc.allowed, matched_rule: rc.matchedRule });
  },
});



