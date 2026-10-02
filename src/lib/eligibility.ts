import type { CampaignRules, Player } from "./types.js";

export function isEligible(player: Player, rules: CampaignRules): boolean {
  return (
    rules.countries.includes(player.country) &&
    player.level >= rules.minimumLevel
  );
}
