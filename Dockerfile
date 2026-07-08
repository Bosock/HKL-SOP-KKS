# HKL Standards — static web app served by nginx.
# The app is a single-page frontend (index.html) that fetches data/hkl_standards_export.json.
# There is no server-side state: user edits persist in the browser via localStorage.
# The "backend" is therefore a hardened static file server.
FROM nginx:1.27-alpine

LABEL org.opencontainers.image.source="https://github.com/Bosock/HKL-SOP-KKS" \
      org.opencontainers.image.title="HKL Standards" \
      org.opencontainers.image.description="HKL / SOP / KKS Standards static web app"

# Site config (gzip, cache headers, /healthz).
COPY nginx.conf /etc/nginx/conf.d/default.conf

# App content.
COPY index.html /usr/share/nginx/html/index.html
COPY data/ /usr/share/nginx/html/data/

EXPOSE 80

# Container-level health probe used by docker/compose orchestration.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null 2>&1 || exit 1
