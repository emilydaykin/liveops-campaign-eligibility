import type { CampaignRules } from "../lib/types.js";

const campaignsById = new Map<string, CampaignRules>();

export function upsertCampaignRules(rules: CampaignRules): void {
  campaignsById.set(rules.campaignId, rules);
}

export function clearCampaignRules(): void {
  campaignsById.clear();
}

export function getCampaignRules(
  campaignId: string
): CampaignRules | undefined {
  return campaignsById.get(campaignId);
}
