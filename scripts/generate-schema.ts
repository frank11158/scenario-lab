import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { zodToJsonSchema } from "zod-to-json-schema";
import { STUDY_SCHEMA_VERSION, StudyRevisionSchema, StudySchema } from "../src/domain/schema.js";
import { STAGE_OUTPUT_SCHEMAS } from "../src/workflow/stage-schemas.js";
import { PipelineRunSchema, WORKFLOW_SCHEMA_VERSION } from "../src/workflow/types.js";

const structuralOutputs = [
  {
    path: resolve("schema/study.schema.json"),
    name: "ScenarioLabStudy",
    schema: StudySchema,
    comment: "Structural schema. Cross-entity references, strategy coverage, synthetic labels, and probability coverage are enforced by validateStudy()."
  },
  {
    path: resolve("schema/study-revision.schema.json"),
    name: "ScenarioLabStudyRevision",
    schema: StudyRevisionSchema,
    comment: "Structural schema for immutable accepted revision metadata; the SQLite repository stores the validated Study snapshot beside it."
  }
];

const workflowOutputs = [
  {
    path: resolve("schema/workflow-run.schema.json"),
    name: "ScenarioLabWorkflowRun",
    schema: PipelineRunSchema,
    id: `https://scenariolab.local/schema/workflow-run-${WORKFLOW_SCHEMA_VERSION}.json`,
    comment: "Persisted planning run with resumable stage checkpoints, metadata, usage, errors, and freshness state."
  },
  ...Object.entries(STAGE_OUTPUT_SCHEMAS).map(([stage, schema]) => ({
    path: resolve(`schema/stages/${stage}.schema.json`),
    name: `ScenarioLab_${stage}_output`,
    schema,
    id: `https://scenariolab.local/schema/stages/${stage}-${WORKFLOW_SCHEMA_VERSION}.json`,
    comment: `Structured output contract for the ${stage} planning stage.`
  }))
];

const outputs = [...structuralOutputs.map((item) => ({
  ...item,
  id: `https://scenariolab.local/schema/${item.name === "ScenarioLabStudy" ? "study" : "study-revision"}-${STUDY_SCHEMA_VERSION}.json`
})), ...workflowOutputs].map((item) => {
  const schema = zodToJsonSchema(item.schema, {
    name: item.name,
    target: "jsonSchema7",
    errorMessages: true
  }) as Record<string, unknown>;
  schema.$id = item.id;
  schema.$comment = item.comment;
  return { path: item.path, content: `${JSON.stringify(schema, null, 2)}\n` };
});

if (process.argv.includes("--write")) {
  mkdirSync(resolve("schema"), { recursive: true });
  for (const output of outputs) {
    mkdirSync(resolve(output.path, ".."), { recursive: true });
    writeFileSync(output.path, output.content);
    process.stdout.write(`wrote ${output.path}\n`);
  }
} else {
  for (const output of outputs) {
    if (!existsSync(output.path)) throw new Error(`${output.path} is missing; run npm run schema:generate`);
    const existing = readFileSync(output.path, "utf8");
    if (existing !== output.content) throw new Error(`${output.path} is stale; run npm run schema:generate`);
    process.stdout.write(`${output.path} is current\n`);
  }
}
