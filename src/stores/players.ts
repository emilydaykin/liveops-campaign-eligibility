import type { Player } from "../lib/types.js";

const FIXTURE_PLAYERS: Player[] = [
  {
    playerId: "p-42",
    country: "ES",
    level: 18,
    lastActiveAt: "2026-08-21T09:00:00Z",
  },
  {
    playerId: "p-77",
    country: "SE",
    level: 6,
    lastActiveAt: "2026-08-17T12:15:00Z",
  },
  {
    playerId: "p-88",
    country: "ES",
    level: 10,
    lastActiveAt: "2026-08-20T20:30:00Z",
  },
  {
    playerId: "p-99",
    country: "SE",
    level: 11,
    lastActiveAt: "2026-08-22T08:45:00Z",
  },
  {
    playerId: "p-101",
    country: "FR",
    level: 20,
    lastActiveAt: "2026-08-22T14:10:00Z",
  },
  {
    playerId: "p-102",
    country: "DE",
    level: 9,
    lastActiveAt: "2026-08-19T16:25:00Z",
  },
];

const playersById = new Map(
  FIXTURE_PLAYERS.map((player) => [player.playerId, player])
);

export function getPlayerById(playerId: string): Player | undefined {
  return playersById.get(playerId);
}
