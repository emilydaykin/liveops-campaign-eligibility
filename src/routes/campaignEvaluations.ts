import { Router, type Response } from "express";
import {
  createCampaignEvaluation,
  getCampaignEvaluation,
  type ServiceFailure,
} from "../services/campaignEvaluationService.js";

function sendFailure(res: Response, failure: ServiceFailure): void {
  res.status(failure.status).json({
    error: failure.error,
    ...(failure.playerIds ? { playerIds: failure.playerIds } : {}),
  });
}

export function createCampaignEvaluationRouter(): Router {
  const router = Router();

  router.post("/", (req, res) => {
    const result = createCampaignEvaluation(req.body);
    if (!result.ok) {
      sendFailure(res, result);
      return;
    }
    res.status(result.value.created ? 201 : 200).json(result.value.evaluation);
  });

  router.get("/:evaluationId", (req, res) => {
    const result = getCampaignEvaluation(req.params.evaluationId);
    if (!result.ok) {
      sendFailure(res, result);
      return;
    }
    res.status(200).json(result.value);
  });

  return router;
}
