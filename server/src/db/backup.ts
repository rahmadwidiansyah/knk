import fs from "node:fs";
import path from "node:path";
import { config } from "../config";
import { getSqlite } from "./connection";

/**
 * Backup online SQLite yang aman via VACUUM INTO (tidak perlu stop server).
 * Hasil: <db-dir>/backups/lightflow-YYYYMMDD-HHmmss.db
 * Hanya simpan BACKUP_KEEP file terbaru (default 7).
 *
 * Pakai: npm run backup  (di container: docker compose exec lightflow node dist/db/backup.js)
 */
async function main() {
  const keep = Math.max(Number(process.env.BACKUP_KEEP || 7), 1);
  const dbPath = path.resolve(config.dbPath);
  if (!fs.existsSync(dbPath)) {
    throw new Error(`DB tidak ditemukan: ${dbPath}`);
  }
  const dir = path.join(path.dirname(dbPath), "backups");
  fs.mkdirSync(dir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 13).replace("T", "-");
  const dest = path.join(dir, `lightflow-${stamp}.db`);

  const db = getSqlite();
  try {
    const literal = `'${dest.replace(/'/g, "''")}'`;
    db.exec(`VACUUM INTO ${literal}`);
  } finally {
    db.close();
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("lightflow-") && f.endsWith(".db"))
    .sort();
  while (files.length > keep) {
    const old = files.shift()!;
    fs.unlinkSync(path.join(dir, old));
    console.log(`[backup] hapus lama: ${old}`);
  }
  const size = fs.statSync(dest).size;
  console.log(`[backup] tersimpan: ${dest} (${(size / 1024).toFixed(1)} KB)`);
}

main().catch((e) => {
  console.error("[backup] gagal:", e?.message || e);
  process.exit(1);
});
