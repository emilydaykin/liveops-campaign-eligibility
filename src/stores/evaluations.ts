import type { StoredEvaluation } from "../lib/types.js";

const evaluationsById = new Map<string, StoredEvaluation>();

export function upsertEvaluation(
  evaluationId: string,
  evaluation: StoredEvaluation
): void {
  evaluationsById.set(evaluationId, evaluation);
}

export function clearEvaluations(): void {
  evaluationsById.clear();
}

export function getEvaluation(
  evaluationId: string
): StoredEvaluation | undefined {
  return evaluationsById.get(evaluationId);
}
