# HKL Standards — single-container backend (Node, zero npm dependencies).
#
# The app is a single-page frontend (index.html) that fetches
# data/hkl_standards_export.json. Unlike the previous static-only nginx image,
# this backend ALSO persists user edits server-side (see server.js): the shared
# state lives in STATE_DIR/state.json on a Docker volume and is exposed via the
# /api/state endpoint, so edits made in the web interface survive redeploys and
# are shared across devices — not just kept in one browser's localStorage.
FROM node:22-alpine

LABEL org.opencontainers.image.source="https://github.com/Bosock/HKL-SOP-KKS" \
      org.opencontainers.image.title="HKL Standards" \
      org.opencontainers.image.description="HKL / SOP / KKS Standards web app with server-side state"

ENV NODE_ENV=production \
    PORT=80 \
    PUBLIC_DIR=/app/public \
    STATE_DIR=/app/state

WORKDIR /app

# Backend (no dependencies, so no npm install step).
COPY server.js ./server.js

# App content served as static files.
COPY index.html ./public/index.html
COPY data/ ./public/data/

# State is persisted here; mount a volume at /app/state to keep it across
# container recreations (see docker-compose.yml).
RUN mkdir -p /app/state
VOLUME ["/app/state"]

EXPOSE 80

# Container-level health probe used by docker/compose orchestration.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null 2>&1 || exit 1

CMD ["node", "server.js"]
