# LightFlow — Security Audit Report

Tanggal: 2026-10-01 · Target: single-container homelab (`lightflow`, Node 22, SQLite) · Metode: code review + live testing terhadap container production.

## Executive Summary

7 temuan diperbaiki dan di-retest (1 HIGH, 3 MEDIUM, 3 LOW). 3 advisory dependency diterima dengan alasan terdokumentasi (fix = breaking change berisiko regression). Tidak ada Critical terbuka. **GATE: LULUS bersyarat** — 1 tindakan wajib sebelum expose ke internet: ganti `JWT_SECRET`, `ENCRYPTION_KEY`, `SEED_ADMIN_PASSWORD` di `.env` (saat ini masih default).

## Architecture / Attack Surface

```
Internet → (opsional reverse proxy) → Express :4000 → SQLite (/app/data)
├── /api/auth (login, register admin-only) — rate limited
├── /api/users/me/* (profile/password/preferences) — JWT + rate limited
├── /api/workflows|executions|connectors|secrets — JWT + ownership check
├── /api/admin/cleanup — JWT + admin
├── /wh/:path, /wh/telegram/:id, /wh/waha/:id — publik, rate limited
├── /health, /api/stats, /robots.txt — publik (non-sensitif)
└── / (SPA statis)
Keluar: http_request node, Telegram Bot API, WAHA selfhost (base_url privat diizinkan eksplisit)
```

Trust boundary: semua input client tidak dipercaya; otorisasi selalu dari JWT server-side. Tanpa file upload, tanpa cookie/session, tanpa SSR, tanpa redirect eksternal.

## Temuan & Perbaikan (semua FIXED + retest)

### SEC-001 — HIGH — drizzle-orm SQL injection (GHSA-gpj5-g38j-94v9)
npm audit: `drizzle-orm <0.45.2`. Di app ini identifier selalu statis (tak ada input user ke identifier), tapi tetap di-upgrade ke **0.45.3**. Retest: typecheck + build + matriks live (login, CRUD, test run, scheduler resync) — tidak ada regression. Status: **FIXED**.

### SEC-002 — MEDIUM — SSRF via redirect, DNS rebinding, IP desimal, kredensial di URL
`assertPublicUrl` lama hanya regex hostname: lolos untuk `http://2130706433/` (=127.0.0.1), redirect 3xx ke IP privat tidak divalidasi ulang, tanpa batas ukuran respon, URL `user:pass@host` diteruskan ke axios.
Fix (`http-request.handler.ts`): resolve DNS via `dns.lookup` lalu cek IP (v4 privat + IPv6 mapped/ULA/link-local), redirect diikuti manual maks 3 hop dengan validasi ulang tiap hop, tolak kredensial di URL, `maxContentLength/Body 5MB`, timeout tetap 15 dtk. Retest live: loopback/desimal/metadata/kredensial diblokir; rantai `httpbin → 302 → 127.0.0.1` diblokir. Status: **FIXED**.

### SEC-003 — MEDIUM — Secret terdekripsi tersimpan di execution output
`ctx.secrets` (plaintext) ikut ke `output_data`. Fix: `succeed()` di executor mengecualikan key `secrets`. Interpolasi `{{secrets.X}}` di step log tetap bekerja (by design, milik owner). Retest: output tanpa key `secrets`, resolve tetap benar. Status: **FIXED**.

### SEC-004 — MEDIUM — Sandbox escape via `constructor` di transform node
`new Function` + denylist melewatkan `input.constructor.constructor(...)()`. Fix: tambah `constructor|__proto__|prototype` ke denylist (transform + condition) + input di-clone beku (read-only). Retest: 2 payload escape ditolak 400, transform normal tetap jalan. Catatan: fitur ini khusus user terautentikasi; residual risk didokumentasikan. Status: **FIXED**.

### SEC-005 — LOW — Telegram secret_token dibanding dengan `!==`
Timing-attackable (praktis tidak exploitable). Fix: `timingSafeEqual`. Retest: token salah tetap 401. Status: **FIXED**.

### SEC-006 — LOW — Endpoint pemicu kirim pesan tanpa rate limit per-user
`POST /workflows/:id/test` dan `POST /connectors/:id/test` bisa di-spam untuk membanjiri WA/Telegram. Fix: `userLimiter` (kunci = user id) 20/menit dan 10/menit. Retest: 25x cepat → 19×200 + 6×429; connector test analog. Status: **FIXED**.

### SEC-007 — LOW — `/robots.txt` serve index.html (200)
SPA fallback menjawab semua path tak dikenal. Fix: route `GET /robots.txt` (`Disallow: /`), `GET /.well-known/security.txt` (hanya bila `SECURITY_CONTACT` diisi), meta `noindex, nofollow` di index.html. Retest: robots 200 text/plain benar; security.txt 404 tanpa env. Status: **FIXED**.

## Diterima dengan alasan (bukan temuan terbuka exploitable)

- **uuid via node-cron (moderate):** butuh `buf` eksplisit yang tak pernah diberikan; fix = node-cron 4.x breaking. Tetap.
- **dompurify nested monaco (moderate):** butuh HTML + hook khusus via DOMPurify langsung; monaco tak mengekspos jalur itu ke konten user. Fix = upgrade monaco (regression risk editor). Tetap.
- **react-router 6 open-redirect/SSR (moderate):** route internal statis, tanpa SSR; upgrade 6→7 breaking. Tetap.
- **Docker root:** single-container homelab; `USER node` berisiko merusak volume existing. Tetap + terdokumentasi.
- **CORS `*`:** aman untuk arsitektur Bearer-token (tanpa cookie, CSRF tidak applicable); `CORS_ORIGIN` tersedia bila ingin dikunci.
- **JWT di localStorage:** satu-satunya storage yang ada; mitigasi = React escaping + tanpa `dangerouslySetInnerHTML` (terverifikasi via grep: nol match).

## Matriks test (live, container production)

| Area | Test | Expected | Actual | Status |
|---|---|---|---|---|
| Auth | tanpa token / token salah / malformed | 401 | 401 | PASS |
| Auth | register anonim | 401 | 401 | PASS |
| Auth | user biasa buka /register | 403 | 403 | PASS |
| Auth | brute force 25x login | 429 di ekor | 20×401 + 5×429 | PASS |
| IDOR | user B GET/PUT/DELETE/TEST workflow A | 403 | 403 ×4 | PASS |
| IDOR | user B list secrets (milik A) | kosong | `[]` | PASS |
| IDOR | user B hapus secret A | 403 | 403 | PASS |
| Validasi | body bukan JSON / array / nama 300char / 51 nodes | 400 | 400 | PASS |
| SQLi | `' OR '1'='1` di login & filter | tolak/kosong | 401 generik + `total:0` | PASS |
| Payload | 2MB JSON | 413 | 413 | PASS |
| Mass assignment | `role/id` di profile | diabaikan | diabaikan | PASS |
| SSRF | loopback/desimal/metadata/kredensial/redirect-chain | blokir | blokir ×5 | PASS |
| Sandbox | 2 payload escape | 400 | 400 | PASS |
| Rate limit | webhook 70x, workflow-test 25x | 429 di ekor | 429 di ekor | PASS |
| XSS stored | payload `<script>` tersimpan, render | escape | nol `dangerouslySetInnerHTML` (React escape) | PASS |
| Secrets | secret di output execution | hilang, resolve ok | hilang, resolve ok | PASS |
| Regression | login/CRUD/test/scheduler resync/stats | ok | ok (WA terkirim) | PASS |
| Headers | helmet defaults | hadir | HSTS/nosniff/SAMEORIGIN/no-referrer | PASS |
| Robots | /robots.txt, security.txt tanpa env | benar | benar | PASS |
| 500 masking prod | — | generik | CODE REVIEW ONLY (tidak bisa dipicu aman) | NOT TESTED |

## Authentication / Authorization / CSRF / CORS / Cookies

JWT Bearer + bcrypt(10); register admin-only; JWT secret di env (peringatan boot bila default). CSRF tidak applicable (tanpa cookie). Cookie: tidak dipakai. CORS `*` tanpa credentials — acceptable (lihat di atas).

## Rate Limiting / Abuse

Login+users 20/IP/mnt; webhook 60/IP/mnt; test workflow 20/user/mnt; test connector 10/user/mnt. Guardrail engine existing: node maks 50, retry maks 3, delay clamp, timeout 15 dtk (HTTP) / 5 dtk (transform), test 35 dtk, guard 100 langkah, cron 5-field tervalidasi, body 1 MB.

## Secrets / Logging / Docker / Deps

Secrets: AES-256-GCM (ENCRYPTION_KEY), redact di list, redact Authorization di webhook log, tak ada secret di repo/image (`.dockerignore` mengecualikan `.env`, `data`, `*.db*`). Logging: hanya pesan error, tanpa value secret. Docker: pin `node:22-alpine`, HEALTHCHECK `/health` (status: healthy terverifikasi), tanpa socket/host-mount/capability ekstra. Deps: audit di atas.

## SEO / Crawler / AI crawler

Keputusan: **aplikasi privat, auth adalah proteksi utama**. `robots.txt` Disallow all, meta noindex/nofollow, tanpa sitemap (tak ada konten publik). AI crawler (GPTBot/ClaudeBot/dll) tunduk pada robots yang sama + tetap terblokir auth. Tanpa landing publik.

## Remaining Risks

1. **WAJIB sebelum expose: ganti `JWT_SECRET`, `ENCRYPTION_KEY`, `SEED_ADMIN_PASSWORD`** (masih default di `.env`). Tanpa ini semua proteksi di atas runtuh.
2. HTTPS/HSTS: di luar scope container — pasang reverse proxy + TLS bila diakses dari internet.
3. Transform `new Function` bukan boundary keamanan keras — batasi akun editor hanya untuk orang dipercaya.
4. Backup `lightflow_data` + simpan `ENCRYPTION_KEY` di luar server (lihat `docs/backup.md`).

## Production Security Gate

[✓] Critical/High known exploitable: tidak ada (drizzle HIGH fixed) · [✓] auth/authz/IDOR/SQLi/XSS/SSRF tested · [✓] CSRF/CORS evaluated · [✓] rate limiting · [✓] abuse reviewed · [✓] secrets/logs redacted · [✓] deps audited · [✓] docker reviewed · [✓] headers reviewed · [✓] cookies N/A · [✓] error disclosure · [✓] no upload/path-traversal/open-redirect surface · [✓] workflow/scheduler limits · [✓] robots/sitemap/meta/AI-crawler · [✓] security.txt considered (env-driven) · [✓] build + regression pass · [✓] HTTPS: butuh reverse proxy (di luar container) · [!] secrets default HARUS diganti (gate bersyarat)
