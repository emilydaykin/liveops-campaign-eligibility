import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { createCampaignEvaluationRouter } from "./routes/campaignEvaluations.js";

function clientErrorStatus(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null || !("status" in err)) {
    return undefined;
  }
  const { status } = err;
  return typeof status === "number" && status >= 400 && status < 500
    ? status
    : undefined;
}

function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof SyntaxError && clientErrorStatus(err) === 400) {
    res.status(400).json({ error: "Malformed JSON body" });
    return;
  }
  const status = clientErrorStatus(err);
  if (status !== undefined) {
    res.status(status).json({ error: (err as Error).message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/campaign-evaluations", createCampaignEvaluationRouter());
  app.use(errorHandler);
  return app;
}
