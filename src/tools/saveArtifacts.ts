import type pino from 'pino';
import type { AppConfig } from '../config.js';
import { createStorage } from '../utils/storage.js';
import { SaveArtifactsInput, SaveArtifactsOutput } from './types.js';

export const createSaveArtifactsTool = (config: AppConfig, logger: pino.Logger) => ({
  name: 'headless.save_artifacts',
  inputSchema: SaveArtifactsInput,
  outputSchema: SaveArtifactsOutput,
  call: async (raw: unknown, correlationId: string) => {
    const input = SaveArtifactsInput.parse(raw);
    if (input.dry_run) return { correlation_id: correlationId, urls: {}, bucket: config.STORAGE_BUCKET };
    const storage = createStorage(config);
    const prefix = input.prefix ?? `${new Date().toISOString().slice(0, 10)}/`;
    const uploads = input.files.map((f) => ({ name: f.name, mime: f.mime, bytes: Buffer.from(f.bytes_base64, 'base64') }));
    const urls = await storage.upload(prefix, uploads);
    return SaveArtifactsOutput.parse({ correlation_id: correlationId, urls, bucket: storage.bucket });
  },
});



