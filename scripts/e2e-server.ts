import { resolve } from "node:path";
import { openDatabase } from "../src/persistence/database.js";
import { SqliteStudyRepository } from "../src/persistence/repository.js";
import { SqliteWorkflowRepository } from "../src/persistence/workflow-repository.js";
import { createScenarioServer } from "../src/server/app.js";
import { ScriptedModelAdapter } from "../tests/scripted-model.js";

const database = openDatabase(":memory:");
const app = createScenarioServer({
  studies: new SqliteStudyRepository(database.db),
  workflows: new SqliteWorkflowRepository(database.db),
  adapter: new ScriptedModelAdapter(),
  referenceCaseDirectory: resolve("product/reference-cases"),
  staticDirectory: resolve("web-dist")
});

const port = 4180;
app.server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`ScenarioLab acceptance server: http://127.0.0.1:${port}\n`);
});

function shutdown(): void {
  app.server.closeAllConnections();
  app.server.close(() => {
    database.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
