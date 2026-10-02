# Backup SQLite

Satu file: `/app/data/lightflow.db` (volume `lightflow_data`). Itu saja yang perlu diselamatkan
— berisi users, workflows, executions, connectors, webhooks, secrets.

## Cara backup (tanpa stop server)

```bash
docker compose exec lightflow node dist/db/backup.js
```

Menggunakan `VACUUM INTO` (backup online yang konsisten), hasil masuk
`/app/data/lightflow.db` → `/app/data/backups/lightflow-YYYYMMDD-HHmm.db`.
Hanya `BACKUP_KEEP` file terbaru yang disimpan (default 7).

Ambil file ke host:

```bash
docker cp lightflow:/app/data/backups/lightflow-20250101-00.db ./backup/
```

## Cara restore

1. Stop container: `docker compose stop lightflow`
2. Timpa DB: `docker cp ./backup/lightflow-20250101-00.db lightflow:/app/data/lightflow.db`
3. Hapus file WAL/SHM sisa bila ada, lalu start: `docker compose start lightflow`

PENTING: `ENCRYPTION_KEY` harus sama seperti saat backup dibuat, kalau tidak
secrets/connectors tidak bisa didekripsi. Simpan key di password manager.

## Strategi yang disarankan (homelab)

- **Harian:** cron di host menjalankan `docker compose exec` backup (atau andalkan volume snapshot).
- **Mingguan:** copy 1 file backup keluar dari server (NAS/laptop).
- **Sebelum upgrade:** backup manual 1x.
- Retensi log (`EXECUTION_RETENTION_DAYS`, default 30) menjaga DB tetap kecil; backup hanya butuh hitungan MB.

Alternatif paling simpel tanpa script: backup seluruh volume.

```bash
docker run --rm -v lightflow_data:/data -v $(pwd):/out alpine tar czf /out/lightflow-data.tgz /data
```
