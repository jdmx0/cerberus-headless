# Cerberus mcp-headless

Playwright-powered Headless Browser MCP server for OSINT ingestion, enrichment, and verification. Provides safe, rate-limited, observable headless browsing primitives and optional artifact persistence to Supabase Storage.

Quick start

1. Requirements: Node 20+, npm

2. Install

```
npm install
```

3. Dev run

```
npm run dev
```

On start, the server logs registered MCP tools and exposes a health endpoint on PORT (default 7801).

Tool catalog

See `docs/tools.md` for full schemas, example requests/responses, and notes.

Registered tools:

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

### PowerShell one-liners (local HTTP)

Prereq: server running on `http://localhost:7801` (e.g., `npm run dev`).

Screenshot → `page.png` (bytes_base64)

```powershell
$resp = Invoke-RestMethod -Method Post -Uri 'http://localhost:7801/tools/call' -ContentType 'application/json' -Body (@{ name='headless.screenshot'; input=@{ url='https://example.com'; full_page=$true; persist_artifacts=$false; wait_until='domcontentloaded' } } | ConvertTo-Json -Depth 8); [IO.File]::WriteAllBytes((Join-Path (Get-Location).Path 'page.png'), [Convert]::FromBase64String($resp.result.bytes_base64))
```

PDF → `page.pdf` (bytes_base64)

```powershell
$resp = Invoke-RestMethod -Method Post -Uri 'http://localhost:7801/tools/call' -ContentType 'application/json' -Body (@{ name='headless.pdf'; input=@{ url='https://example.com'; print_background=$false; persist_artifacts=$false } } | ConvertTo-Json -Depth 8); [IO.File]::WriteAllBytes((Join-Path (Get-Location).Path 'page.pdf'), [Convert]::FromBase64String($resp.result.bytes_base64))
```

Video → `page.webm` (bytes_base64)

```powershell
$resp = Invoke-RestMethod -Method Post -Uri 'http://localhost:7801/tools/call' -ContentType 'application/json' -Body (@{ name='headless.video'; input=@{ url='https://example.com'; duration_ms=5000; persist_artifacts=$false } } | ConvertTo-Json -Depth 8); [IO.File]::WriteAllBytes((Join-Path (Get-Location).Path 'page.webm'), [Convert]::FromBase64String($resp.result.bytes_base64))
```

Fetch+Render → `page.html`

```powershell
$resp = Invoke-RestMethod -Method Post -Uri 'http://localhost:7801/tools/call' -ContentType 'application/json' -Body (@{ name='headless.fetch_render'; input=@{ url='https://example.com'; wait_until='networkidle'; persist_artifacts=$false } } | ConvertTo-Json -Depth 8); ($resp.result.html) | Set-Content -Encoding UTF8 'page.html'
```

Extract content → `extracted.json`

```powershell
$resp = Invoke-RestMethod -Method Post -Uri 'http://localhost:7801/tools/call' -ContentType 'application/json' -Body (@{ name='headless.extract_content'; input=@{ url='https://example.com'; re_render=$true; selectors=@(@{ name='title'; css='h1' }, @{ name='paragraphs'; css='article p'; all=$true }) } } | ConvertTo-Json -Depth 8); ($resp.result.fields | ConvertTo-Json -Depth 8) | Set-Content -Encoding UTF8 'extracted.json'
```

Get links → `links.json`

```powershell
$resp = Invoke-RestMethod -Method Post -Uri 'http://localhost:7801/tools/call' -ContentType 'application/json' -Body (@{ name='headless.get_links'; input=@{ url='https://example.com'; scope='same_origin'; unique=$true } } | ConvertTo-Json -Depth 8); ($resp.result.links | ConvertTo-Json -Depth 8) | Set-Content -Encoding UTF8 'links.json'
```

Notes

- Set `persist_artifacts=$false` to receive inline `bytes_base64`; when `true`, URLs like `screenshot_url`/`pdf_url` are returned instead.
- For advanced inputs and outputs, see `docs/tools.md` and `src/tools/types.ts`.

Environment

Configure via `.env` (see `.env.example`). All variables validated at start. Secrets are never logged.

Scripts

```
npm run dev       # start in watch
npm run build     # bundle with tsup
npm run start     # run built server
npm run test      # unit tests
npm run test:e2e  # e2e (headless chromium)
npm run lint      # eslint
npm run typecheck # tsc --noEmit
```

Docker

```
docker build -t cerberus/mcp-headless .
docker run --rm -p 7801:7801 --env-file .env cerberus/mcp-headless
```

License

Apache-2.0
