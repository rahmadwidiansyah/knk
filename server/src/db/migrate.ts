import { runMigrations, closeDb } from "./connection";

runMigrations();
console.log("[migrate] SQLite tables ensured.");
closeDb();
