## Containers

- Dockerfile builds a minimal runtime on top of Playwright base image.
- Runs as non-root `pwuser`.
- Healthcheck pings `/health`.
- Optional docker-compose can add OTLP collector and stub Supabase.



