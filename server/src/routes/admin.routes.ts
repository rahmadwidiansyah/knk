import { Router } from "express";
import { requireAdmin, requireAuth } from "../middleware/auth";
import { cleanupOldExecutions } from "../services/maintenance.service";

const router = Router();
router.use(requireAuth, requireAdmin);

/** Jalankan cleanup log eksekusi manual (di luar jadwal otomatis). */
router.post("/cleanup", async (_req, res, next) => {
  try {
    res.json(await cleanupOldExecutions());
  } catch (e) {
    next(e);
  }
});

export default router;
