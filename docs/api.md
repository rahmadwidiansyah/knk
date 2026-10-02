# LightFlow API

Base URL: `http://localhost:4000` (atur via `BASE_URL`).

Semua endpoint `/api/*` (kecuali login) butuh header:

```
Authorization: Bearer <JWT>
```

Error selalu berbentuk `{ "error": "..." }`, plus `details` untuk validation error (400).

Rate limit: endpoint publik `/wh/*` dibatasi `WEBHOOK_RATE_LIMIT` request/IP/menit (default 60).

## Auth

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/auth/login` | — | `{ username, password }` | `{ token, user }` |
| POST | `/api/auth/register` | admin | `{ username, password, role?: "admin"\|"user" }` | `{ user }` (201) |
| GET | `/api/auth/me` | user | — | `{ user }` |

## Workflows

| Method | Path | Auth | Keterangan |
|---|---|---|---|
| GET | `/api/workflows?all=1` | user (`all` khusus admin) | List milik user |
| POST | `/api/workflows` | user | `{ name, description?, json_config }` → `{ id, name }` (201) |
| GET | `/api/workflows/:id` | owner/admin | `{ workflow }` |
| PUT | `/api/workflows/:id` | owner/admin | `{ name?, description?, json_config?, is_active? }` |
| DELETE | `/api/workflows/:id` | owner/admin | `{ ok: true }` |
| POST | `/api/workflows/:id/toggle` | owner/admin | `{ is_active: 0\|1 }` → `{ workflow }` |
| POST | `/api/workflows/:id/test` | owner/admin | `{ input? }` → `{ execution, steps }`. Trigger non-manual disimulasikan (`simulated: true` di input). Timeout 35 dtk (504) |
| POST | `/api/workflows/:id/nodes/:nodeId/test` | owner/admin | Uji SATU node (eksekusi asli untuk send/http). `{ input? }` → `{ node_id, output, duration_ms }` |

Aktifkan workflow (`toggle` ke 1) menjalankan validasi aktivasi: konektor ada & aktif, field wajib terisi, cabang IF lengkap. Gagal → `400 { error, details: { issues: [{ nodeId, message }] } }`.
| GET | `/api/workflows/:id/webhook` | owner/admin | `{ webhook: { path, url, ... } \| null, scheduled }` |
| POST | `/api/workflows/:id/webhook/regenerate` | owner/admin | Path lama langsung mati |

## Executions

| Method | Path | Auth | Keterangan |
|---|---|---|---|
| GET | `/api/executions?workflow_id=&status=&from=&to=&limit=&offset=` | user | Filter milik user; `limit` maks 200. Response `{ executions, total, limit, offset }`. Tiap item ada flag `simulated` (hasil tombol Test) |
| GET | `/api/executions/:id` | owner/admin | `{ execution, steps }` |

`status`: `success` \| `failed` \| `running`. Execution `running` yang tersisa saat restart ditandai `failed` saat boot.

## Connectors (Telegram / WAHA)

| Method | Path | Auth | Keterangan |
|---|---|---|---|
| GET | `/api/connectors?all=1` | user | Config sensitif di-redact (`***abcd`) |
| POST | `/api/connectors` | user | `{ type: "telegram"\|"waha", name, config }` |
| PUT | `/api/connectors/:id` | owner/admin | `{ name?, config?, is_active? }` |
| DELETE | `/api/connectors/:id` | owner/admin | `{ ok: true }` |
| POST | `/api/connectors/:id/test` | owner/admin | Telegram → `{ username }`; WAHA → `{ session, session_status }` |

- Telegram `config`: `{ bot_token, secret_token? }`
- WAHA `config`: `{ base_url, api_key?, session? }` (`base_url` boleh IP privat/LAN karena didaftarkan eksplisit)

## Secrets (terenkripsi AES-256-GCM)

| Method | Path | Auth | Keterangan |
|---|---|---|---|
| GET | `/api/secrets` | user | Cuma key (`has_value: true`), value tidak pernah keluar |
| POST | `/api/secrets` | user | `{ key: "A-Z0-9_", value }` (upsert) |
| DELETE | `/api/secrets/:id` | owner/admin | `{ ok: true }` |

Dipakai di workflow sebagai `{{secrets.NAMA}}`.

## Webhook publik (tanpa auth)

| Method | Path | Keterangan |
|---|---|---|
| POST | `/wh/:path` | Trigger workflow tipe `webhook`. Response `202 { status: "accepted", workflow_id }` |
| POST | `/wh/telegram/:connectorId` | Update Bot API (manual `setWebhook`). Response `{ ok, fired }` |
| POST | `/wh/waha/:connectorId` | Event WAHA (`message`). Response `{ ok, fired }` |

Nonaktif (workflow/connector mati atau path salah) → `404`. Telegram cek `X-Telegram-Bot-Api-Secret-Token` bila diisi.

## Admin

| Method | Path | Auth | Keterangan |
|---|---|---|---|
| POST | `/api/admin/cleanup` | admin | Hapus log eksekusi lebih tua dari `EXECUTION_RETENTION_DAYS` → `{ executionsDeleted, stepsDeleted, ... }` |

## System

| Method | Path | Auth | Keterangan |
|---|---|---|---|
| GET | `/health` | — | `{ status: "ok"\|"degraded", uptime_seconds, db, version, time }` |
| GET | `/api/stats` | — | `{ users, workflows, workflows_active, executions, executions_24h, success_rate_24h, retention_days }` |
