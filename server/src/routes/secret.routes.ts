import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import * as svc from "../services/secret.service";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    res.json({ secrets: await svc.listSecrets(req.user!) });
  } catch (e) {
    next(e);
  }
});

router.post(
  "/",
  validateBody(z.object({ key: z.string().min(1).max(64), value: z.string().min(1).max(8192) })),
  async (req, res, next) => {
    try {
      const out = await svc.upsertSecret(req.user!, req.body.key.trim().toUpperCase(), req.body.value);
      res.status(201).json(out);
    } catch (e) {
      next(e);
    }
  }
);

router.delete("/:id", async (req, res, next) => {
  try {
    res.json(await svc.deleteSecret(req.user!, req.params.id));
  } catch (e) {
    next(e);
  }
});

export default router;
