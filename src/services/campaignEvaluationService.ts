import { isEligible } from "../lib/eligibility.js";
import type {
  CampaignEvaluationResponse,
  CampaignRules,
  CreateCampaignEvaluationRequest,
  PlayerEligibilityResult,
  StoredEvaluation,
} from "../lib/types.js";
import {
  getCampaignRules,
  upsertCampaignRules,
} from "../stores/campaigns.js";
import {
  getEvaluation,
  upsertEvaluation,
} from "../stores/evaluations.js";
import { getPlayerById } from "../stores/players.js";

export type ServiceFailure = {
  ok: false;
  status: 400 | 404 | 409 | 422;
  error: string;
  playerIds?: string[];
};

export type ServiceResult<T> =
  | { ok: true; value: T }
  | ServiceFailure;

export type CreatedEvaluation = {
  evaluation: CampaignEvaluationResponse;
  /** False when an identical request for this evaluationId was already stored. */
  created: boolean;
};

function invalid(error: string): ServiceFailure {
  return { ok: false, status: 400, error };
}

function unknownPlayers(playerIds: string[]): ServiceFailure {
  return {
    ok: false,
    status: 422,
    error: `Unknown player IDs: ${playerIds.join(", ")}`,
    playerIds,
  };
}

function notFound(error: string): ServiceFailure {
  return { ok: false, status: 404, error };
}

function conflict(error: string): ServiceFailure {
  return { ok: false, status: 409, error };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRequest(
  body: unknown,
): ServiceResult<CreateCampaignEvaluationRequest> {
  if (!isObject(body)) {
    return invalid("Request body must be a JSON object");
  }
  const { evaluationId, campaign, playerIds } = body;
  if (!isNonEmptyString(evaluationId)) {
    return invalid("evaluationId is required");
  }
  if (!isObject(campaign)) {
    return invalid("campaign is required");
  }
  const { campaignId, minimumLevel, countries } = campaign;
  if (!isNonEmptyString(campaignId)) {
    return invalid("campaign.campaignId is required");
  }
  if (
    typeof minimumLevel !== "number" ||
    !Number.isInteger(minimumLevel) ||
    minimumLevel < 0
  ) {
    return invalid("campaign.minimumLevel must be an integer >= 0");
  }
  if (!isStringArray(countries) || countries.length === 0) {
    return invalid("campaign.countries must be a non-empty array of strings");
  }
  if (!isStringArray(playerIds)) {
    return invalid("playerIds must be an array of strings");
  }

  return {
    ok: true,
    value: {
      evaluationId,
      campaign: { campaignId, minimumLevel, countries: [...countries] },
      playerIds: [...new Set(playerIds)],
    },
  };
}

function findUnknownPlayerIds(playerIds: string[]): string[] {
  return playerIds.filter((playerId) => getPlayerById(playerId) === undefined);
}

function isSameEvaluation(
  stored: StoredEvaluation,
  request: CreateCampaignEvaluationRequest,
): boolean {
  if (
    stored.campaignId !== request.campaign.campaignId ||
    stored.playerIds.length !== request.playerIds.length
  ) {
    return false;
  }
  const storedSorted = [...stored.playerIds].sort();
  const requestSorted = [...request.playerIds].sort();
  return storedSorted.every((playerId, i) => playerId === requestSorted[i]);
}

function buildResults(
  playerIds: string[],
  rules: CampaignRules,
): PlayerEligibilityResult[] {
  return playerIds.map((playerId) => {
    const player = getPlayerById(playerId)!;
    return {
      playerId,
      eligible: isEligible(player, rules),
    };
  });
}

export function createCampaignEvaluation(
  body: unknown,
): ServiceResult<CreatedEvaluation> {
  const parsed = parseRequest(body);
  if (!parsed.ok) {
    return parsed;
  }
  const request = parsed.value;

  const unknownPlayerIds = findUnknownPlayerIds(request.playerIds);
  if (unknownPlayerIds.length > 0) {
    return unknownPlayers(unknownPlayerIds);
  }

  const existing = getEvaluation(request.evaluationId);
  if (existing && !isSameEvaluation(existing, request)) {
    return conflict(
      `Evaluation ${request.evaluationId} already exists with a different campaignId or playerIds`,
    );
  }

  upsertCampaignRules(request.campaign);
  if (!existing) {
    upsertEvaluation(request.evaluationId, {
      campaignId: request.campaign.campaignId,
      playerIds: request.playerIds,
    });
  }

  return {
    ok: true,
    value: {
      created: !existing,
      evaluation: {
        evaluationId: request.evaluationId,
        campaignId: request.campaign.campaignId,
        results: buildResults(
          existing?.playerIds ?? request.playerIds,
          request.campaign,
        ),
      },
    },
  };
}

export function getCampaignEvaluation(
  evaluationId: string,
): ServiceResult<CampaignEvaluationResponse> {
  const stored = getEvaluation(evaluationId);
  if (!stored) {
    return notFound(`Evaluation not found: ${evaluationId}`);
  }

  const rules = getCampaignRules(stored.campaignId);
  if (!rules) {
    throw new Error(`Campaign rules missing for stored evaluation ${evaluationId}`);
  }

  return {
    ok: true,
    value: {
      evaluationId,
      campaignId: stored.campaignId,
      results: buildResults(stored.playerIds, rules),
    },
  };
}
