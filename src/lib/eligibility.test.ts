import { describe, expect, it } from "vitest";
import { isEligible } from "./eligibility.js";
import type { Player } from "./types.js";

const player = (overrides: Partial<Player> = {}): Player => ({
  playerId: "p-1",
  country: "ES",
  level: 10,
  lastActiveAt: "2026-08-21T09:00:00Z",
  ...overrides,
});

const rules = {
  campaignId: "summer-boost",
  minimumLevel: 10,
  countries: ["ES", "SE"],
};

describe("isEligible", () => {
  it("is eligible when the country matches and the level equals the minimum", () => {
    expect(isEligible(player({ level: 10 }), rules)).toBe(true);
  });

  it("is eligible when the country matches and the level is above the minimum", () => {
    expect(isEligible(player({ level: 18 }), rules)).toBe(true);
  });

  it("is not eligible when the country is not in the list", () => {
    expect(isEligible(player({ country: "FR", level: 20 }), rules)).toBe(false);
  });

  it("is not eligible when the country matches but the level is below the minimum", () => {
    expect(isEligible(player({ level: 6 }), rules)).toBe(false);
  });
});
