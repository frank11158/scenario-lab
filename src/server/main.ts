import { resolve } from "node:path";
import { openDatabase } from "../persistence/database.js";
import { SqliteStudyRepository } from "../persistence/repository.js";
import { SqliteWorkflowRepository } from "../persistence/workflow-repository.js";
import { OpenAIResponsesAdapter } from "../workflow/openai-responses-adapter.js";
import type { ModelAdapter } from "../workflow/types.js";
import { UnavailableModelAdapter } from "../workflow/unavailable-adapter.js";
import { createScenarioServer } from "./app.js";

const port = Number(process.env.SCENARIOLAB_PORT ?? 4174);
const database = openDatabase(resolve(process.env.SCENARIOLAB_DB_PATH ?? "scenario-lab.sqlite"));
const adapter: ModelAdapter = process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL
  ? new OpenAIResponsesAdapter({ apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL })
  : new UnavailableModelAdapter();
const { server } = createScenarioServer({
  studies: new SqliteStudyRepository(database.db),
  workflows: new SqliteWorkflowRepository(database.db),
  adapter,
  referenceCaseDirectory: resolve("product/reference-cases"),
  staticDirectory: resolve("web-dist")
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`ScenarioLab listening at http://127.0.0.1:${port}\n`);
});

const shutdown = () => server.close(() => {
  database.close();
  process.exit(0);
});
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
