import { createFixtureId } from "../domain/ids.js";
import type { Evidence, EvidenceContradiction } from "../domain/schema.js";

const NEGATIONS = new Set(["no", "not", "never", "none", "without", "cannot", "cant", "wont", "isnt", "arent", "didnt", "doesnt"]);
const STOP = new Set(["a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "have", "in", "is", "it", "of", "on", "or", "that", "the", "this", "to", "was", "were", "will", "with"]);

function words(value: string): string[] {
  return value.toLowerCase().replace(/[’']/g, "").match(/[a-z0-9]+/g) ?? [];
}

function signature(value: string): { terms: Set<string>; negated: boolean } {
  const tokens = words(value);
  return {
    terms: new Set(tokens.filter((word) => !STOP.has(word) && !NEGATIONS.has(word))),
    negated: tokens.some((word) => NEGATIONS.has(word))
  };
}

export function detectPotentialContradictions(
  evidence: Evidence[],
  existing: EvidenceContradiction[],
  detectedAt: string
): EvidenceContradiction[] {
  const retained = existing.filter((item) => evidence.some((entry) => entry.id === item.leftEvidenceId)
    && evidence.some((entry) => entry.id === item.rightEvidenceId));
  const knownPairs = new Set(retained.map((item) => [item.leftEvidenceId, item.rightEvidenceId].sort().join(":")));
  for (let leftIndex = 0; leftIndex < evidence.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < evidence.length; rightIndex += 1) {
      const left = evidence[leftIndex]!;
      const right = evidence[rightIndex]!;
      const leftSignature = signature(left.claim);
      const rightSignature = signature(right.claim);
      if (leftSignature.negated === rightSignature.negated) continue;
      const union = new Set([...leftSignature.terms, ...rightSignature.terms]);
      const overlap = [...leftSignature.terms].filter((term) => rightSignature.terms.has(term)).length;
      if (union.size < 3 || overlap / union.size < 0.55) continue;
      const pair = [left.id, right.id].sort().join(":");
      if (knownPairs.has(pair)) continue;
      retained.push({
        id: createFixtureId("research-contradiction", pair),
        leftEvidenceId: left.id,
        rightEvidenceId: right.id,
        description: "Potential conflict detected: the claims use substantially overlapping terms but differ in negation. Review both sources.",
        status: "open",
        resolution: { status: "unknown", note: "Not reviewed" },
        detectedAt,
        detectedBy: "heuristic"
      });
      knownPairs.add(pair);
    }
  }
  return retained;
}
