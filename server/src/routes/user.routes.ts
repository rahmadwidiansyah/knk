import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import * as svc from "../services/user.service";

const router = Router();
router.use(requireAuth);

const USERNAME_RE = /^[a-zA-Z0-9._-]+$/;

const profileSchema = z.object({
  username: z.string().trim().min(3).max(64).regex(USERNAME_RE),
  displayName: z.string().trim().max(64).optional().default(""),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(6).max(128),
    confirmPassword: z.string().min(1).max(128),
  })
  .superRefine((v, ctx) => {
    if (v.newPassword !== v.confirmPassword) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Passwords do not match", path: ["confirmPassword"] });
    }
    if (v.newPassword === v.currentPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "New password must differ from current password",
        path: ["newPassword"],
      });
    }
  });

const preferencesSchema = z.object({
  themePreference: z.enum(["light", "dark", "system"]),
});

router.get("/me", async (req, res, next) => {
  try {
    res.json({ user: await svc.getProfile(req.user!.id) });
  } catch (e) {
    next(e);
  }
});

router.put("/me/profile", validateBody(profileSchema), async (req, res, next) => {
  try {
    // Allowlist eksplisit: id/role TIDAK PERNAH diambil dari body.
    const { username, displayName } = req.body as { username: string; displayName?: string };
    res.json({ user: await svc.updateProfile(req.user!.id, { username, displayName }) });
  } catch (e) {
    next(e);
  }
});

router.put("/me/password", validateBody(passwordSchema), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
    res.json(await svc.changePassword(req.user!.id, { currentPassword, newPassword }));
  } catch (e) {
    next(e);
  }
});

router.put("/me/preferences", validateBody(preferencesSchema), async (req, res, next) => {
  try {
    const { themePreference } = req.body as { themePreference: "light" | "dark" | "system" };
    res.json({ user: await svc.updatePreferences(req.user!.id, { themePreference }) });
  } catch (e) {
    next(e);
  }
});

export default router;
