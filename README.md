# LightFlow

Lightweight Workflow Automation Engine (Telegram, WAHA) — Backend + SQLite + Auth + Docker, 1 container.

## Quickstart (lokal)

```bash
cd server
npm install
cp ../.env.example ../.env  # atau set env manual
npm run db:migrate
npm run seed
npm run dev
```

Frontend dev terpisah: `cd web && npm install && npm run dev` (port 3000, proxy ke 4000).

- Health: `GET http://localhost:4000/health`
- Login: `POST http://localhost:4000/api/auth/login` `{ "username":"admin","password":"admin123" }`

## Docker (homelab)

```bash
cp .env.example .env
# WAJIB edit: JWT_SECRET, ENCRYPTION_KEY, SEED_ADMIN_PASSWORD
docker compose up --build -d
```

DB di volume `lightflow_data` (`/app/data/lightflow.db`). Healthcheck otomatis ke `/health`.

## Dokumentasi

- `docs/api.md` — semua endpoint + auth + rate limit
- `docs/workflow-json-spec.md` — format workflow, trigger, node, variabel `{{...}}`
- `docs/backup.md` — backup & restore SQLite

## Operasional

- Retensi log: `EXECUTION_RETENTION_DAYS` (default 30, cleanup tiap boot + jam 03:00). Manual: `POST /api/admin/cleanup` (admin).
- Rate limit webhook: `WEBHOOK_RATE_LIMIT`/IP/menit (default 60). Di balik reverse proxy: set `TRUST_PROXY=1`.
- Backup online: `docker compose exec lightflow node dist/db/backup.js` (simpan 7 terakhir).

## Struktur

- `server/src/db/` — Drizzle schema (7 tabel) + `node:sqlite` + seed + backup
- `server/src/routes/` — auth, workflows, executions, connectors, secrets, webhooks, admin, system
- `server/src/services/` — auth, workflow, execution, scheduler, maintenance, crypto, connector, secret
- `server/src/engine/` — executor, context, interpolator, retry, handlers
- `server/src/integrations/` — telegram & waha client + webhook receiver
- `web/` — React + Vite + Material 3 (single-container serve via Express)
