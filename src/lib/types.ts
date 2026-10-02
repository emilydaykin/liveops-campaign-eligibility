/** Player profile from the in-memory fixture. */
export type Player = {
  playerId: string;
  country: string;
  level: number;
  lastActiveAt: string;
};

/** Campaign targeting rules (may change while the service is running). */
export type CampaignRules = {
  campaignId: string;
  minimumLevel: number;
  countries: string[];
};

/** POST /campaign-evaluations body. */
export type CreateCampaignEvaluationRequest = {
  evaluationId: string;
  campaign: CampaignRules;
  playerIds: string[];
};

/** Per-player outcome in API responses. */
export type PlayerEligibilityResult = {
  playerId: string;
  eligible: boolean;
};

/**
 * Response body for POST /campaign-evaluations
 * and GET /campaign-evaluations/{evaluationId}
 */
export type CampaignEvaluationResponse = {
  evaluationId: string;
  campaignId: string;
  results: PlayerEligibilityResult[];
};

/** What we persist per evaluationId (recompute eligibility on read). */
export type StoredEvaluation = {
  campaignId: string;
  playerIds: string[];
};
