import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { userLimiter } from "../middleware/rate-limit";
import * as svc from "../services/connector.service";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    res.json({ connectors: await svc.listConnectors(req.user!, req.query.all === "1") });
  } catch (e) {
    next(e);
  }
});

router.post(
  "/",
  validateBody(
    z.object({
      type: z.enum(["telegram", "waha"]),
      name: z.string().min(1).max(64),
      config: z.record(z.any()),
    })
  ),
  async (req, res, next) => {
    try {
      const out = await svc.createConnector(req.user!, req.body);
      res.status(201).json(out);
    } catch (e) {
      next(e);
    }
  }
);

router.put(
  "/:id",
  validateBody(
    z.object({
      name: z.string().min(1).max(64).optional(),
      config: z.record(z.any()).optional(),
      is_active: z.number().int().min(0).max(1).optional(),
    })
  ),
  async (req, res, next) => {
    try {
      res.json({ connector: await svc.updateConnector(req.user!, req.params.id, req.body) });
    } catch (e) {
      next(e);
    }
  }
);

router.delete("/:id", async (req, res, next) => {
  try {
    res.json(await svc.deleteConnector(req.user!, req.params.id));
  } catch (e) {
    next(e);
  }
});

router.post("/:id/test", userLimiter(10, "Terlalu banyak test connector, coba lagi sebentar."), async (req, res, next) => {
  try {
    res.json(await svc.testConnector(req.user!, req.params.id));
  } catch (e) {
    next(e);
  }
});

export default router;
