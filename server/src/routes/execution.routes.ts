import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import * as ex from "../services/execution.service";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const data = await ex.listExecutions(req.user!, {
      workflowId: (req.query.workflow_id as string) || undefined,
      status: (req.query.status as string) || undefined,
      from: (req.query.from as string) || undefined,
      to: (req.query.to as string) || undefined,
      limit: req.query.limit ? Number(req.query.limit) : 50,
      offset: req.query.offset ? Number(req.query.offset) : 0,
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    res.json(await ex.getExecutionDetail(req.user!, req.params.id));
  } catch (e) {
    next(e);
  }
});

export default router;
