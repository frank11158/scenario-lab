import type { PipelineRun, StageName } from "./types.js";
import { STAGE_ORDER } from "./types.js";
import { z } from "zod";

export const StudyChangeSchema = z.enum([
  "problem", "objective", "constraint", "evidence", "assumption", "driver",
  "scenario", "consequence", "strategy", "evaluation", "indicator", "action"
]);
export type StudyChange = z.infer<typeof StudyChangeSchema>;

export const CHANGE_INVALIDATES_FROM: Record<StudyChange, StageName> = {
  problem: "framing",
  objective: "framing",
  constraint: "framing",
  evidence: "evidence",
  assumption: "drivers",
  driver: "scenarios",
  scenario: "consequences",
  consequence: "strategy_evaluation",
  strategy: "strategy_evaluation",
  evaluation: "synthesis",
  indicator: "synthesis",
  action: "synthesis"
};

export function invalidateRun(run: PipelineRun, changes: StudyChange[], updatedAt: string): PipelineRun {
  if (changes.length === 0) return run;
  const first = Math.min(...changes.map((change) => STAGE_ORDER.indexOf(CHANGE_INVALIDATES_FROM[change])));
  return {
    ...run,
    status: "stale",
    updatedAt,
    completedAt: null,
    stages: run.stages.map((stage) => {
      if (stage.ordinal < first) return stage;
      if (stage.status === "pending") return stage;
      return { ...stage, status: "stale", error: null };
    })
  };
}

export type RunFreshness = {
  current: boolean;
  staleStages: StageName[];
};

export function getRunFreshness(run: PipelineRun): RunFreshness {
  const staleStages = run.stages.filter((stage) => stage.status === "stale").map((stage) => stage.stage);
  return { current: run.status === "completed" && staleStages.length === 0, staleStages };
}

export function assertRunCurrent(run: PipelineRun): void {
  const freshness = getRunFreshness(run);
  if (!freshness.current) {
    throw new Error(`Planning results are not current; run status is ${run.status}${freshness.staleStages.length ? ` and stale stages are ${freshness.staleStages.join(", ")}` : ""}`);
  }
}
