# Spesifikasi Workflow JSON (`json_config`)

```jsonc
{
  "name": "Jadwal 22:00 - Test KNK",
  "description": "...",
  "trigger": { "type": "schedule", "config": { "cron": "0 22 * * *", "timezone": "Asia/Jakarta" } },
  "nodes": [
    {
      "id": "kirim_wa",
      "type": "send_waha",
      "name": "Kirim WA test",
      "config": {
        "connector_id": "{{connector.WAHA}}",
        "to": "6281541148547@c.us",
        "text": "test knk"
      },
      "next": "step_end"
    }
  ]
}
```

Aturan umum:

- `nodes` 1–50, `id` unik (`[A-Za-z0-9_-]`), maks 64 char.
- `next` / `next_true` / `next_false` menunjuk ke id node lain atau `"step_end"`.
- `next_all` (opsional): array maks 10 id — SEMUA cabang dijalankan berurutan setelah node sukses (fan-out). Tiap node jalan maks 1x per execution agar cabang yang bergabung tak dieksekusi ganda.
- `disabled: true` (opsional): node dilewati executor (tercatat `skipped`), alur lanjut ke koneksi keluarnya.
- `on_error` (opsional): id node yang dijalankan bila node ini gagal. Tanpa ini, 1 node gagal = execution `failed`.
- `retry` (opsional): `{ "max": 0–3, "delay_ms": 0–30000 }`, backoff `delay × (attempt+1)`.
- Siklus (A → B → A) ditolak saat save; guard maks 100 langkah per execution.

## Trigger

| type | config | Cara jalan |
|---|---|---|
| `manual` | `{}` | Tombol Test saja |
| `webhook` | `{ methods?: ["POST"], secret?: "..." }` | `POST /wh/:path` default; method lain + secret opsional (`x-webhook-secret` / `?secret=`). Path auto-generate, lihat `GET /api/workflows/:id/webhook` |
| `schedule` | `{ cron: "m h d M dow", timezone?: "Asia/Jakarta" }` | Cron 5 field, tanpa `@syntax`. Butuh workflow aktif |
| `telegram_event` | `{ connector_id?, filter? }` | Tiap pesan ke bot via `POST /wh/telegram/:connectorId` |
| `waha_event` | `{ connector_id?, filter? }` | Tiap pesan WA via `POST /wh/waha/:connectorId` |

`connector_id` top-level mengikat trigger ke satu konektor (disarankan; UI form mengisinya). `filter.connector_id` lama tetap didukung.

Filter event (semua opsional, kosong = semua cocok):

```jsonc
{ "chats": ["62812@c.us"], "is_group": false }
```

> `filter.text_contains` / `text_equals` lawas tetap jalan, tapi JANGAN dipakai di workflow baru — pakai node IF setelah trigger.

Pesan dari bot sendiri (`fromMe`) selalu diabaikan kecuali `allow_from_me: true`.

## Node

| type | config penting | output |
|---|---|---|
| `http_request` | `url` (https publik saja — IP privat diblokir anti-SSRF), `method`, `headers`, `body`, `timeout_ms` (1–15 dtk) | `{ status, headers, body }`. HTTP ≥ 400 = gagal |
| `condition` | `conditions: [{field, operator, value}]` + `combinator: "all"`/`"any"`, atau `expression` lawas mis. `{{trigger.count}} > 5` | `{ conditionMet }` → lanjut `next_true` / `next_false` |
| `transform` | `code` JS (`return {...}`, akses via `input`), timeout 5 dtk, tanpa `require`/`fetch`/`process` | object hasil (atau `{ result }`) |
| `delay` | `delay_ms` (maks 600 dtk; saat Test di-clamp 30 dtk) | `{ delayed_ms, clamped }` |
| `log` | `message` | `{ message, logged_at }` |
| `send_telegram` | `connector_id`, `chat_id`, `text` (maks 4000), `parse_mode?` | `{ message_id, chat_id }` |
| `send_waha` | `connector_id`, `to`/`chat_id`, `text` (maks 4000), `session?` | `{ sent, connector, id }` |
| `send_waha_media` | `connector_id`, `to`/`chat_id`, `media_url` (http(s) publik), `media_type`: `image`/`file`, `caption?`, `session?` | `{ sent, connector, kind, id }` |
| `ai_chat` | — | Belum didukung (placeholder) |

## Kondisi terstruktur (IF)

```jsonc
{
  "conditions": [
    { "field": "{{trigger.message.text}}", "operator": "contains", "value": "order" },
    { "field": "{{trigger.chat.id}}", "operator": "equals", "value": "62812@c.us" }
  ],
  "combinator": "all"
}
```

Operator: `equals`, `not_equals`, `contains`, `not_contains`, `starts_with`, `ends_with`, `is_empty`, `is_not_empty`, `gt`, `gte`, `lt`, `lte`, `is_true`, `is_false`, `exists`, `not_exists`. Nilai `value` bertipe: tulis `10`/`true` (tanpa kutip) untuk angka/boolean — `"10"` string TIDAK sama dengan angka `10`. Operator `gt/gte/lt/lte` hanya untuk angka. Bila `conditions` ada, ia dipakai (ekspresi lawas diabaikan).

## Variabel `{{...}}`

| Pola | Arti |
|---|---|
| `{{trigger.*}}` | Data pemicu (mis. `{{trigger.text}}`, `{{trigger.chat_id}}`, `{{trigger.body.halo}}`) |
| `{{<node_id>.*}}` | Output node sebelumnya (mis. `{{step_2.doubled}}`) |
| `{{execution.id}}` | ID execution berjalan |
| `{{error.message}}` | Pesan error (hanya di jalur `on_error`) |
| `{{secrets.NAMA}}` | Secret milik user. Key tidak ada = gagal jelas |
| `{{connector.nama}}` | ID connector by name. Nama tidak ada = gagal jelas |

String penuh `"{{step_2}}"` mengembalikan tipe asli (object/number); di dalam kalimat jadi string. Referensi `secrets`/`connector` yang hilang selalu gagal eksplisit, tidak pernah jadi string kosong diam-diam.

## Data trigger per tipe (yang bisa dipakai di `{{trigger.*}}`)

- `manual`: persis `input` dari Test.
- `webhook`: `{ method, headers (authorization di-redact), query, body, path, received_at }`.
- `schedule`: `{ scheduled_at, cron }`.
- `telegram_event`: flat lawas + `source`, `connector { id, name }`, `event`, `chat { id, type }`, `sender { id, name }`, `message { id, text, type }`, `raw`.
- `waha_event`: flat lawas + struktur `source/connector/event/chat/sender/message/raw` yang sama.
- Test manual: struktur di atas + `simulated: true` (terlihat sebagai label "Tes manual" di UI).

## Batasan eksekusi

- Test via API: timeout 35 detik (504). Eksekusi asli (webhook/schedule/event): async tanpa timeout, fire-and-forget.
- `delay` + `retry` menahan eksekusi; schedule yang tumpang tindih dibiarkan jalan paralel.
- Log execution disimpan sesuai `EXECUTION_RETENTION_DAYS` (default 30 hari), yang `running` tidak pernah dihapus otomatis.
