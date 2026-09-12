import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { openDatabase } from "../src/persistence/database.js";
import { SqliteStudyRepository } from "../src/persistence/repository.js";
import { SqliteWorkflowRepository } from "../src/persistence/workflow-repository.js";
import { createScenarioServer } from "../src/server/app.js";
import { UnavailableModelAdapter } from "../src/workflow/unavailable-adapter.js";
import type { Study } from "../src/domain/schema.js";
import type { ModelAdapter, PipelineRun } from "../src/workflow/types.js";
import { ScriptedModelAdapter } from "./scripted-model.js";

async function createHarness(adapter: ModelAdapter = new ScriptedModelAdapter()) {
  const database = openDatabase(":memory:");
  const app = createScenarioServer({
    studies: new SqliteStudyRepository(database.db),
    workflows: new SqliteWorkflowRepository(database.db),
    adapter,
    referenceCaseDirectory: resolve("product/reference-cases"),
    staticDirectory: resolve("web-dist"),
    clock: () => "2026-09-11T18:00:00.000Z"
  });
  await new Promise<void>((resolveListen) => app.server.listen(0, "127.0.0.1", resolveListen));
  const port = (app.server.address() as AddressInfo).port;
  return {
    database,
    app,
    url: `http://127.0.0.1:${port}`,
    close: async () => {
      app.server.closeAllConnections();
      await new Promise<void>((resolveClose, reject) => app.server.close((error) => error ? reject(error) : resolveClose()));
      database.close();
    }
  };
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set("content-type", "application/json");
  const response = await fetch(url, {
    ...init,
    headers
  });
  if (!response.ok) assert.fail(`${response.status} ${await response.text()}`);
  return response.json() as Promise<T>;
}

describe("MVP application API", () => {
  it("completes import, generation, revision, and export through HTTP", async () => {
    const test = await createHarness();
    try {
      const cases = await json<{ cases: Array<{ file: string }> }>(`${test.url}/api/reference-cases`);
      const imported = await json<{ study: Study }>(`${test.url}/api/reference-cases/${cases.cases[0]!.file}/import`, { method: "POST" });
      const created = await json<{ run: PipelineRun }>(`${test.url}/api/studies/${imported.study.id}/runs`, { method: "POST", body: JSON.stringify({ scenarioCount: 3 }) });
      const completed = await json<{ run: PipelineRun }>(`${test.url}/api/runs/${created.run.id}/execute`, { method: "POST" });
      assert.equal(completed.run.status, "completed");

      const accepted = await json<{ snapshot: Study }>(`${test.url}/api/studies/${imported.study.id}/revisions`, { method: "POST", body: JSON.stringify({ summary: "Reviewed MVP flow" }) });
      assert.equal(accepted.snapshot.status, "reviewed");
      const revisions = await json<{ revisions: unknown[] }>(`${test.url}/api/studies/${imported.study.id}/revisions`);
      assert.equal(revisions.revisions.length, 1);

      const markdown = await fetch(`${test.url}/api/studies/${imported.study.id}/export?format=markdown`);
      assert.equal(markdown.ok, true);
      assert.match(await markdown.text(), /## Strategy stress test/);
      const exportedJson = await fetch(`${test.url}/api/studies/${imported.study.id}/export?format=json`);
      assert.equal(exportedJson.ok, true);
      assert.equal((await exportedJson.json() as Study).id, imported.study.id);
    } finally { await test.close(); }
  });

  it("creates and reopens a manually authored study", async () => {
    const test = await createHarness();
    try {
      const created = await json<{ study: Study }>(`${test.url}/api/studies`, { method: "POST", body: JSON.stringify({
        title: "Manual decision",
        decision: "Choose a path",
        objective: "Make a reversible choice",
        successCriteria: ["Preserve optionality"],
        mode: "quick",
        options: [{ name: "Stay", statusQuo: true }, { name: "Pilot", statusQuo: false }]
      }) });
      const edited = { ...created.study, problem: { ...created.study.problem, statement: "Choose a path this week", authorship: "user" as const } };
      await json(`${test.url}/api/studies/${created.study.id}`, { method: "PUT", body: JSON.stringify({ study: edited, changes: ["problem"] }) });
      const reopened = await json<{ study: Study }>(`${test.url}/api/studies/${created.study.id}`);
      assert.equal(reopened.study.problem.statement, "Choose a path this week");
      const list = await json<{ studies: Array<{ id: string }> }>(`${test.url}/api/studies`);
      assert.ok(list.studies.some((item) => item.id === created.study.id));
    } finally { await test.close(); }
  });

  it("keeps editing, save, reopen, and export usable after model failure", async () => {
    const test = await createHarness(new UnavailableModelAdapter());
    try {
      const imported = await json<{ study: Study }>(`${test.url}/api/reference-cases/rc-01-workshop.json/import`, { method: "POST" });
      const run = await json<{ run: PipelineRun }>(`${test.url}/api/studies/${imported.study.id}/runs`, { method: "POST", body: JSON.stringify({}) });
      const failed = await json<{ run: PipelineRun }>(`${test.url}/api/runs/${run.run.id}/execute`, { method: "POST" });
      assert.equal(failed.run.status, "failed");
      assert.match(failed.run.stages[0]!.error!.message, /editing the study manually/);

      const edited = { ...imported.study, title: "Workshop — manual recovery" };
      await json(`${test.url}/api/studies/${edited.id}`, { method: "PUT", body: JSON.stringify({ study: edited, changes: ["problem"] }) });
      assert.equal((await json<{ study: Study }>(`${test.url}/api/studies/${edited.id}`)).study.title, edited.title);
      assert.equal((await fetch(`${test.url}/api/studies/${edited.id}/export?format=json`)).ok, true);
    } finally { await test.close(); }
  });

  it("serves the production workbench with local-only security headers", async () => {
    const test = await createHarness();
    try {
      const response = await fetch(test.url);
      assert.equal(response.ok, true);
      assert.match(await response.text(), /ScenarioLab/);
      assert.equal(response.headers.get("x-frame-options"), "DENY");
      assert.match(response.headers.get("content-security-policy") ?? "", /default-src 'self'/);
    } finally { await test.close(); }
  });
});
