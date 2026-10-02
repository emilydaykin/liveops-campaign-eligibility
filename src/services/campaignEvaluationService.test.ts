import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import type { CreateCampaignEvaluationRequest } from "../lib/types.js";
import { createApp } from "../app.js";
import { clearCampaignRules } from "../stores/campaigns.js";
import { clearEvaluations } from "../stores/evaluations.js";

const app = createApp();

beforeEach(() => {
  clearCampaignRules();
  clearEvaluations();
});

function evaluationBody(
  overrides: Partial<CreateCampaignEvaluationRequest> = {},
): CreateCampaignEvaluationRequest {
  return {
    evaluationId: "eval-1",
    campaign: {
      campaignId: "summer-boost",
      minimumLevel: 10,
      countries: ["ES", "SE"],
    },
    playerIds: ["p-42"],
    ...overrides,
  };
}

function withCampaign(campaign: Record<string, unknown>): unknown {
  return {
    ...evaluationBody(),
    campaign: { ...evaluationBody().campaign, ...campaign },
  };
}

describe("POST /campaign-evaluations", () => {
  it("returns 201 when a new evaluation is stored", async () => {
    const response = await request(app)
      .post("/campaign-evaluations")
      .send(evaluationBody({ playerIds: ["p-42", "p-77"] }));

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      evaluationId: "eval-1",
      campaignId: "summer-boost",
      results: [
        { playerId: "p-42", eligible: true },
        { playerId: "p-77", eligible: false },
      ],
    });
  });

  it("returns 422 and stores nothing when a player id is unknown", async () => {
    const response = await request(app)
      .post("/campaign-evaluations")
      .send(evaluationBody({ playerIds: ["p-42", "p-404"] }));

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      error: "Unknown player IDs: p-404",
      playerIds: ["p-404"],
    });

    const stored = await request(app).get("/campaign-evaluations/eval-1");
    expect(stored.status).toBe(404);
  });

  it.each([
    {
      name: "a body that is not a JSON object",
      body: ["p-42"],
      error: "Request body must be a JSON object",
    },
    {
      name: "a blank evaluationId",
      body: { ...evaluationBody(), evaluationId: "  " },
      error: "evaluationId is required",
    },
    {
      name: "a non-string evaluationId",
      body: { ...evaluationBody(), evaluationId: 123 },
      error: "evaluationId is required",
    },
    {
      name: "a missing campaign",
      body: { ...evaluationBody(), campaign: undefined },
      error: "campaign is required",
    },
    {
      name: "a blank campaignId",
      body: withCampaign({ campaignId: " " }),
      error: "campaign.campaignId is required",
    },
    {
      name: "a non-string campaignId",
      body: withCampaign({ campaignId: 5 }),
      error: "campaign.campaignId is required",
    },
    {
      name: "a non-integer minimumLevel",
      body: withCampaign({ minimumLevel: 9.5 }),
      error: "campaign.minimumLevel must be an integer >= 0",
    },
    {
      name: "a negative minimumLevel",
      body: withCampaign({ minimumLevel: -1 }),
      error: "campaign.minimumLevel must be an integer >= 0",
    },
    {
      name: "empty countries",
      body: withCampaign({ countries: [] }),
      error: "campaign.countries must be a non-empty array of strings",
    },
    {
      name: "countries containing a non-string",
      body: withCampaign({ countries: ["ES", 7] }),
      error: "campaign.countries must be a non-empty array of strings",
    },
    {
      name: "playerIds that is not an array",
      body: { ...evaluationBody(), playerIds: "p-42" },
      error: "playerIds must be an array of strings",
    },
    {
      name: "playerIds containing a non-string",
      body: { ...evaluationBody(), playerIds: ["p-42", null] },
      error: "playerIds must be an array of strings",
    },
  ])("returns 400 for $name", async ({ body, error }) => {
    const response = await request(app)
      .post("/campaign-evaluations")
      .send(body as object);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error });
  });

  it("does not store an evaluation when the request is invalid", async () => {
    await request(app)
      .post("/campaign-evaluations")
      .send(withCampaign({ minimumLevel: -1 }) as object);

    const stored = await request(app).get("/campaign-evaluations/eval-1");
    expect(stored.status).toBe(404);
  });

  it("returns a JSON 400 for malformed JSON", async () => {
    const response = await request(app)
      .post("/campaign-evaluations")
      .set("Content-Type", "application/json")
      .send('{"evaluationId":');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Malformed JSON body" });
  });

  it("evaluates each player once when playerIds contains duplicates", async () => {
    const response = await request(app)
      .post("/campaign-evaluations")
      .send(evaluationBody({ playerIds: ["p-42", "p-77", "p-42"] }));

    expect(response.status).toBe(201);
    expect(response.body.results).toEqual([
      { playerId: "p-42", eligible: true },
      { playerId: "p-77", eligible: false },
    ]);
  });

  it("returns 200 with the stored evaluation when a request is repeated with reordered playerIds", async () => {
    const first = await request(app)
      .post("/campaign-evaluations")
      .send(evaluationBody({ playerIds: ["p-42", "p-77"] }));

    const repeated = await request(app)
      .post("/campaign-evaluations")
      .send(evaluationBody({ playerIds: ["p-77", "p-42"] }));

    expect(first.status).toBe(201);
    expect(repeated.status).toBe(200);
    expect(repeated.body).toEqual(first.body);
  });

  it("applies new campaign rules when a repeated request changes only the rules", async () => {
    await request(app)
      .post("/campaign-evaluations")
      .send(evaluationBody({ playerIds: ["p-42", "p-77"] }));

    const repeated = await request(app)
      .post("/campaign-evaluations")
      .send(
        evaluationBody({
          campaign: {
            campaignId: "summer-boost",
            minimumLevel: 5,
            countries: ["ES", "SE"],
          },
          playerIds: ["p-42", "p-77"],
        }),
      );

    expect(repeated.status).toBe(200);
    expect(repeated.body.results).toEqual([
      { playerId: "p-42", eligible: true },
      { playerId: "p-77", eligible: true },
    ]);
  });

  it("returns 409 and keeps the original when the same evaluationId has different playerIds", async () => {
    await request(app)
      .post("/campaign-evaluations")
      .send(evaluationBody({ playerIds: ["p-42", "p-77"] }));

    const conflicting = await request(app)
      .post("/campaign-evaluations")
      .send(evaluationBody({ playerIds: ["p-99"] }));

    expect(conflicting.status).toBe(409);
    expect(conflicting.body).toEqual({
      error:
        "Evaluation eval-1 already exists with a different campaignId or playerIds",
    });

    const stored = await request(app).get("/campaign-evaluations/eval-1");
    expect(stored.status).toBe(200);
    expect(stored.body.results).toEqual([
      { playerId: "p-42", eligible: true },
      { playerId: "p-77", eligible: false },
    ]);
  });

  it("returns 409 when the same evaluationId has a different campaignId", async () => {
    await request(app).post("/campaign-evaluations").send(evaluationBody());

    const conflicting = await request(app)
      .post("/campaign-evaluations")
      .send(
        evaluationBody({
          campaign: {
            campaignId: "winter-boost",
            minimumLevel: 10,
            countries: ["ES"],
          },
        }),
      );

    expect(conflicting.status).toBe(409);
  });
});

describe("GET /campaign-evaluations/:evaluationId", () => {
  it("returns 404 for an unknown evaluationId", async () => {
    const response = await request(app).get(
      "/campaign-evaluations/does-not-exist",
    );

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: "Evaluation not found: does-not-exist",
    });
  });
});
