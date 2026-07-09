# HKL-SOP-KKS

HKL Standards — a self-contained single-page web app for browsing **and editing** HKL /
SOP / KKS standards on mobile. The frontend (`index.html`) loads its content from
`data/hkl_standards_export.json`. Edits made in the web interface (categories, corrections,
renames, sub-categories, display settings, material care) are kept in the browser's
`localStorage` **and** persisted **server-side** so they survive redeploys and are shared
across all devices (see [Server-side state](#server-side-state)). Per-device state
(checklists, theme) stays local.

The backend is a tiny **zero-dependency Node server** ([`server.js`](server.js)) that serves
the static app *and* exposes a `/api/state` persistence endpoint, packaged as a single
Docker image.

## Architecture

```
GitHub push (main)
      │
      ▼
GitHub Actions ──build──▶ ghcr.io/bosock/hkl-sop-kks:latest   (GHCR)
      │
      └──deploy (SSH)──▶ 162.19.250.88
                             docker compose pull && up -d
                             node server.js :80  ◀── host :${HOST_PORT:-8080}
                                   │
                                   └── /api/state ⇄ state.json  (Docker volume: hkl-state)
```

- **Image**: `node:22-alpine` running [`server.js`](server.js) — serves the static app with
  gzip + cache + security headers and a `/healthz` endpoint (everything the old `nginx.conf`
  did), plus the `/api/state` persistence API. No npm dependencies.
- **Persistence**: shared state is written to `/app/state/state.json` inside the container,
  backed by the named Docker volume **`hkl-state`** so it survives `docker compose pull && up -d`.
- **Registry**: GitHub Container Registry (GHCR), `ghcr.io/bosock/hkl-sop-kks`.
- **Orchestration on the host**: [`docker-compose.yml`](docker-compose.yml).
- **CI/CD**: [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds & pushes
  the image, then deploys over SSH.

## Server-side state

Previously all edits lived only in one browser's `localStorage`. Now the app is
**offline-first with a shared server state**:

- **On load** the client fetches `GET /api/state`, adopts the server's values, and — on a
  fresh server — seeds it with any edits that only existed locally.
- **On every change** only the changed top-level keys are pushed via `PUT /api/state`
  (a small debounced request). The server does a **per-key last-write-wins merge**, so two
  people editing *different* things don't clobber each other. A sync dot in the header shows
  the status (green = saved on server, amber = local only / offline).
- **Polling** (every 15 s, and on tab focus / reconnect) pulls in changes other devices made.
- **Offline / no backend**: everything keeps working from `localStorage`; queued changes are
  retried with exponential backoff and flushed once the server is reachable again.

Shared keys: `hkl_natcfg`, `hkl_overrides`, `hkl_qedits`, `hkl_reviewed`, `hkl_reassign`,
`hkl_ukmap`, `hkl_ukmeta`, `hkl_settings`, `hkl_care`. Per-device keys that stay local:
`hkl_checks` (daily checklist), `hkl_theme`.

### API

| Method | Path                    | Purpose                                                        |
|--------|-------------------------|----------------------------------------------------------------|
| `GET`  | `/api/state`            | Return `{rev, updatedAt, state}`.                              |
| `GET`  | `/api/state?since=<rev>`| Return `{rev, unchanged:true}` if unchanged, else full state.  |
| `PUT`  | `/api/state`            | Body `{state:{…}}` → per-key merge, `rev++`, returns full state.|
| `GET`  | `/healthz`              | Liveness probe → `ok`.                                         |

> **Note:** last-write-wins is per top-level key, not per field. Two people editing the
> *same* key at the same second can still overwrite one another — fine for this small tool.
> Care photos are stored as base64 in the state blob; the request body limit is 32 MiB
> (`MAX_BODY`).

## Local development / preview

```bash
# Run the backend directly (no Docker, no build step — needs Node ≥ 18):
PUBLIC_DIR="$PWD" STATE_DIR=./.state PORT=8080 node server.js
# open http://localhost:8080  (state persists to ./.state/state.json)

# Or build and run the container:
docker build -t hkl-sop-kks:local .
docker run --rm -p 8080:80 -v hkl-state:/app/state hkl-sop-kks:local
# open http://localhost:8080

# Or with compose (uses the published image; set HOST_PORT to taste):
HOST_PORT=8080 docker compose up
```

Health check: `curl http://localhost:8080/healthz` → `ok`.
Try the API: `curl http://localhost:8080/api/state`.

## Deployment

Deployment is fully automated: **every push to `main` builds a new image and deploys it
to `162.19.250.88`**. You can also trigger it manually via the *Actions → Build and Deploy
→ Run workflow* button (`workflow_dispatch`).

### One-time server preparation (162.19.250.88)

The target host needs Docker Engine + the Compose plugin, and a user whose SSH key is
registered as a GitHub Actions secret (below).

```bash
# On 162.19.250.88, as the deploy user:
curl -fsSL https://get.docker.com | sh          # installs Docker + compose plugin
sudo usermod -aG docker "$USER"                 # allow non-root docker (re-login after)
```

The pipeline creates `~/hkl-sop-kks/` and drops `docker-compose.yml` there on first run;
no manual checkout on the server is required.

> **Port**: the container listens on `80`; the host publishes `${HOST_PORT:-8080}`.
> To serve on port 80 directly, create `~/hkl-sop-kks/.env` with `HOST_PORT=80`
> (see [`.env.example`](.env.example)), or put a reverse proxy (nginx/Caddy/Traefik)
> in front for TLS.

### Required GitHub Actions secrets

The SSH login credentials must be stored as repository secrets under
**Settings → Secrets and variables → Actions** in `Bosock/HKL-SOP-KKS`:

| Secret            | Required | Description                                                        |
|-------------------|----------|--------------------------------------------------------------------|
| `DEPLOY_SSH_KEY`  | **yes**  | Private SSH key (PEM) whose public key is in the deploy user's `~/.ssh/authorized_keys` on 162.19.250.88. |
| `DEPLOY_USER`     | **yes**  | SSH username on the server (e.g. `deploy` or `root`).              |
| `DEPLOY_HOST`     | no       | Server host/IP. Defaults to `162.19.250.88` if unset.              |
| `DEPLOY_PORT`     | no       | SSH port. Defaults to `22` if unset.                               |

`GITHUB_TOKEN` is provided automatically by Actions and is used both to push the image to
GHCR and to authenticate the `docker pull` on the server — no personal access token needed.

Generate a dedicated deploy key:

```bash
ssh-keygen -t ed25519 -f deploy_key -C "gh-actions-deploy" -N ""
# → put deploy_key.pub into the server's ~/.ssh/authorized_keys
# → paste the contents of deploy_key (the private key) into the DEPLOY_SSH_KEY secret
```

### GHCR package visibility

On the first successful build the image is pushed to GHCR as a **private** package linked
to this repo; the workflow's `GITHUB_TOKEN` can pull it during deploy. If you later pull
from other machines, either add a read token there or set the package to **Public** under
*Packages → hkl-sop-kks → Package settings → Change visibility*.

## Files

| Path                              | Purpose                                             |
|-----------------------------------|-----------------------------------------------------|
| `index.html`                      | The single-page frontend (offline-first + server sync). |
| `server.js`                       | Zero-dependency Node backend: static serving + `/api/state`. |
| `data/hkl_standards_export.json`  | Standards content loaded at runtime.                |
| `Dockerfile`                      | Builds the `node:22-alpine` app image.              |
| `docker-compose.yml`              | Host deployment definition (with the `hkl-state` volume). |
| `.env.example`                    | Sample host config (`HOST_PORT`).                   |
| `.github/workflows/deploy.yml`    | CI/CD: build → push → SSH deploy.                   |
