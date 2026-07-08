# HKL-SOP-KKS

HKL Standards — a self-contained single-page web app for browsing HKL / SOP / KKS
standards on mobile. The frontend (`index.html`) loads its content from
`data/hkl_standards_export.json`; all user edits (checklists, care notes, category
config) persist locally in the browser via `localStorage`. There is **no server-side
state**, so the "backend" is a hardened static file server packaged as a Docker image.

## Architecture

```
GitHub push (main)
      │
      ▼
GitHub Actions ──build──▶ ghcr.io/bosock/hkl-sop-kks:latest   (GHCR)
      │
      └──deploy (SSH)──▶ 162.19.250.88
                             docker compose pull && up -d
                             nginx :80  ◀── host :${HOST_PORT:-8080}
```

- **Image**: `nginx:1.27-alpine` serving the static app with gzip + cache headers and a
  `/healthz` endpoint (see [`Dockerfile`](Dockerfile) and [`nginx.conf`](nginx.conf)).
- **Registry**: GitHub Container Registry (GHCR), `ghcr.io/bosock/hkl-sop-kks`.
- **Orchestration on the host**: [`docker-compose.yml`](docker-compose.yml).
- **CI/CD**: [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds & pushes
  the image, then deploys over SSH.

## Local development / preview

```bash
# Build and run the container locally.
docker build -t hkl-sop-kks:local .
docker run --rm -p 8080:80 hkl-sop-kks:local
# open http://localhost:8080

# Or with compose (uses the published image; set HOST_PORT to taste):
HOST_PORT=8080 docker compose up
```

Health check: `curl http://localhost:8080/healthz` → `ok`.

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
| `index.html`                      | The single-page frontend.                           |
| `data/hkl_standards_export.json`  | Standards content loaded at runtime.                |
| `Dockerfile`                      | Builds the nginx-based static image.                |
| `nginx.conf`                      | Server config: gzip, cache headers, `/healthz`.     |
| `docker-compose.yml`              | Host deployment definition.                         |
| `.env.example`                    | Sample host config (`HOST_PORT`).                   |
| `.github/workflows/deploy.yml`    | CI/CD: build → push → SSH deploy.                   |
