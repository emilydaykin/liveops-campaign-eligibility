import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { clearCampaignRules } from "./stores/campaigns.js";
import { clearEvaluations } from "./stores/evaluations.js";

const app = createApp();

beforeEach(() => {
  clearCampaignRules();
  clearEvaluations();
});

describe("GET reflects updated campaign rules", () => {
  it("recomputes an earlier evaluation after the same campaign's rules change", async () => {
    const campaignId = "integration-summer-boost";

    const first = await request(app)
      .post("/campaign-evaluations")
      .send({
        evaluationId: "integration-batch-a",
        campaign: {
          campaignId,
          minimumLevel: 10,
          countries: ["ES", "SE"],
        },
        playerIds: ["p-42", "p-77"],
      });

    expect(first.status).toBe(201);
    expect(first.body.results).toEqual([
      { playerId: "p-42", eligible: true },
      { playerId: "p-77", eligible: false },
    ]);

    await request(app)
      .post("/campaign-evaluations")
      .send({
        evaluationId: "integration-batch-b",
        campaign: {
          campaignId,
          minimumLevel: 5,
          countries: ["ES", "SE"],
        },
        playerIds: ["p-99"],
      });

    const updated = await request(app).get(
      "/campaign-evaluations/integration-batch-a"
    );

    expect(updated.status).toBe(200);
    expect(updated.body).toEqual({
      evaluationId: "integration-batch-a",
      campaignId,
      results: [
        { playerId: "p-42", eligible: true },
        { playerId: "p-77", eligible: true },
      ],
    });
  });
});
