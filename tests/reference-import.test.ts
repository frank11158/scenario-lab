import { readdirSync } from "node:fs";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { exportStudyJson, exportStudyMarkdown } from "../src/application/export.js";
import { importReferenceCase, importReferenceFixture } from "../src/application/reference-case-importer.js";
import { validateStudy } from "../src/domain/validation.js";
import { FIXED_NOW, loadFixture } from "./helpers.js";

describe("M0 reference case import", () => {
  const fixtureFiles = readdirSync("product/reference-cases").filter((name) => name.endsWith(".json"));

  it("imports all four fixtures without weakening their synthetic labels", () => {
    assert.equal(fixtureFiles.length, 4);
    for (const name of fixtureFiles) {
      const fixture = loadFixture(name) as { notice: string; options: unknown[]; important_unknowns: string[]; expected_output_properties: unknown[]; prohibited_shortcuts: string[] };
      const imported = importReferenceCase(fixture, { now: FIXED_NOW });
      const study = imported.study;
      assert.deepEqual(validateStudy(study), study);
      assert.equal(study.synthetic, true);
      assert.equal(study.syntheticNotice, fixture.notice);
      assert.equal(study.strategies.length, fixture.options.length);
      assert.deepEqual(study.evidenceGaps, fixture.important_unknowns);
      assert.equal(imported.evaluationContract.expectedOutputProperties.length, fixture.expected_output_properties.length);
      assert.deepEqual(imported.evaluationContract.prohibitedShortcuts, fixture.prohibited_shortcuts);
    }
  });

  it("produces stable IDs and deterministic JSON for a fixture", () => {
    const first = importReferenceFixture(loadFixture(), { now: FIXED_NOW });
    const second = importReferenceFixture(loadFixture(), { now: FIXED_NOW });
    assert.deepEqual(second, first);
    assert.equal(exportStudyJson(second), exportStudyJson(first));
    assert.deepEqual(validateStudy(JSON.parse(exportStudyJson(first))), first);
  });

  it("converts an imported fixture to the existing Markdown study sections", () => {
    const markdown = exportStudyMarkdown(importReferenceFixture(loadFixture(), { now: FIXED_NOW }));
    for (const heading of ["Decision brief", "Frame", "Baseline and evidence", "Drivers", "Scenarios", "Strategy stress test", "Indicators and triggers", "Actions", "Limits and next review"]) {
      assert.ok(markdown.includes(`## ${heading}`));
    }
    assert.ok(markdown.includes("SYNTHETIC"));
    assert.ok(markdown.includes("(status quo)"));
  });
});
