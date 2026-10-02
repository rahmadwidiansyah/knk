import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import * as authService from "../services/auth.service";

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(128),
});

const registerSchema = z.object({
  username: z.string().min(3).max(64).regex(/^[a-zA-Z0-9._-]+$/),
  password: z.string().min(6).max(128),
  role: z.enum(["admin", "user"]).optional().default("user"),
});

router.post("/login", validateBody(loginSchema), async (req, res, next) => {
  try {
    const result = await authService.login(req.body.username, req.body.password);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

// Hanya admin yang bisa buat user baru (sesuai blueprint)
router.post(
  "/register",
  requireAuth,
  requireAdmin,
  validateBody(registerSchema),
  async (req, res, next) => {
    try {
      const user = await authService.register(req.user!, req.body);
      res.status(201).json({ user });
    } catch (e) {
      next(e);
    }
  }
);

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await authService.getMe(req.user!.id);
    res.json({ user });
  } catch (e) {
    next(e);
  }
});

export default router;
