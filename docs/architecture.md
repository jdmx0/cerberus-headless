## Architecture

```mermaid
graph LR
  A[Caller (Agent/n8n/Verifier)] --> B[MCP Server]
  B --> C[Rate Limiter\n(global + per-host)]
  C --> D[Browser Pool\n(Chromium contexts)]
  D --> E[Page Navigation]
  E --> F[Sanitizer\n(HTML clamp + scrub)]
  F --> G{Persist?}
  G -- yes --> H[Supabase Storage]
  G -- no --> I[Skip]
  H --> J[Signed URLs]
  I --> J
  J --> K[Response]
```

### Notes
- Retries apply around navigation and storage upload.
- Policies (robots/blocklist/protocol) are enforced before navigation.
- Telemetry spans around browser launch, navigation, extraction, and uploads.



