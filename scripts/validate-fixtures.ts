import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { exportStudyJson, exportStudyMarkdown } from "../src/application/export.js";
import { importReferenceCase } from "../src/application/reference-case-importer.js";

const directory = resolve("product/reference-cases");
const fixtures = readdirSync(directory).filter((name) => name.endsWith(".json")).sort();
if (fixtures.length !== 4) throw new Error(`Expected 4 reference fixtures; found ${fixtures.length}`);

for (const fixture of fixtures) {
  const input: unknown = JSON.parse(readFileSync(resolve(directory, fixture), "utf8"));
  const imported = importReferenceCase(input, { now: "2026-09-11T12:00:00.000Z" });
  const study = imported.study;
  if (imported.evaluationContract.expectedOutputProperties.length === 0) throw new Error(`${fixture} has no expected output properties`);
  if (imported.evaluationContract.prohibitedShortcuts.length === 0) throw new Error(`${fixture} has no prohibited shortcuts`);
  JSON.parse(exportStudyJson(study));
  const markdown = exportStudyMarkdown(study);
  if (!markdown.includes("SYNTHETIC")) throw new Error(`${fixture} lost its synthetic label`);
  process.stdout.write(`validated ${fixture} -> ${study.id}\n`);
}
