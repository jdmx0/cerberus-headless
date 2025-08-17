# Cerberus MCP Headless

Playwright-powered headless browser MCP server for OSINT ingestion and verification. Provides rate-limited, observable browsing primitives with optional artifact storage.

## Getting Started

1. Install Node.js 20+ and npm
2. `npm install`
3. `npm run dev`

The server logs registered tools and exposes a health endpoint on `PORT` (default `7801`).

## Tools

Registered tools include:

- headless.fetch_render
- headless.extract_content
- headless.screenshot
- headless.pdf
- headless.video
- headless.get_links
- headless.evaluate
- headless.meta
- headless.robots
- headless.save_artifacts

## Example Request

All tools are invoked via a single HTTP endpoint:

```bash
curl -X POST http://localhost:7801/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "headless.screenshot",
    "input": { "url": "https://example.com", "full_page": true }
  }'
```

Set `persist_artifacts=false` to receive inline `bytes_base64`; when `true`, artifact URLs are returned.

## Environment

Copy `.env.example` to `.env` and adjust as needed. Variables are validated at start and secrets are never logged.

## Scripts

```
npm run dev       # start in watch mode
npm run build     # bundle with tsup
npm run start     # run built server
npm test          # unit tests
npm run test:e2e  # e2e (headless chromium)
npm run lint      # eslint
npm run typecheck # tsc --noEmit
```

## Docker

```
docker build -t cerberus/mcp-headless .
docker run --rm -p 7801:7801 --env-file .env cerberus/mcp-headless
```

## License

Apache-2.0

