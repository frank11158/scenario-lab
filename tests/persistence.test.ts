import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { StudyService } from "../src/application/study-service.js";
import { createId } from "../src/domain/ids.js";
import { openDatabase } from "../src/persistence/database.js";
import { SqliteStudyRepository } from "../src/persistence/repository.js";
import { importedStudy } from "./helpers.js";

describe("SQLite study persistence", () => {
  it("preserves a study through save/load and keeps accepted revisions accessible", () => {
    const database = openDatabase(":memory:");
    try {
      const service = new StudyService(new SqliteStudyRepository(database.db), () => "2026-09-11T13:00:00.000Z");
      const original = importedStudy();
      service.createStudy(original);
      assert.deepEqual(service.loadStudy(original.id), original);

      const first = service.acceptRevision(original.id, "Initial imported baseline");
      assert.equal(first.revision.ordinal, 1);
      assert.deepEqual(service.loadStudy(original.id), first.snapshot);

      const edited = { ...first.snapshot, title: "Revised workshop decision", updatedAt: "2026-09-11T13:30:00.000Z" };
      service.saveStudy(edited);
      const secondService = new StudyService(new SqliteStudyRepository(database.db), () => "2026-09-11T14:00:00.000Z");
      const second = secondService.acceptRevision(original.id, "Clarified the title");

      assert.deepEqual(secondService.listRevisions(original.id).map((revision) => revision.ordinal), [1, 2]);
      assert.deepEqual(second.revision.parentRevisionId, { status: "known", value: first.revision.id });
      assert.equal(secondService.loadRevision(original.id, first.revision.id).snapshot.title, original.title);
      assert.equal(secondService.loadRevision(original.id, second.revision.id).snapshot.title, "Revised workshop decision");
    } finally {
      database.close();
    }
  });

  it("survives closing and reopening a file database and applies migrations once", () => {
    const directory = mkdtempSync(join(tmpdir(), "scenario-lab-m1-"));
    const filename = join(directory, "studies.sqlite");
    const study = importedStudy("rc-03-capacity.json");
    try {
      const first = openDatabase(filename);
      new StudyService(new SqliteStudyRepository(first.db)).createStudy(study);
      assert.equal((first.sqlite.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get() as { count: number }).count, 1);
      first.close();

      const reopened = openDatabase(filename);
      try {
        const loaded = new StudyService(new SqliteStudyRepository(reopened.db)).loadStudy(study.id);
        assert.deepEqual(loaded, study);
        assert.equal((reopened.sqlite.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get() as { count: number }).count, 1);
      } finally {
        reopened.close();
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects a draft whose current revision reference is not stored", () => {
    const database = openDatabase(":memory:");
    try {
      const repository = new SqliteStudyRepository(database.db);
      const study = importedStudy();
      repository.saveDraft(study);
      const missingRevision = createId();
      assert.throws(
        () => repository.saveDraft({ ...study, currentRevisionId: { status: "known", value: missingRevision } }),
        new RegExp(missingRevision)
      );
    } finally {
      database.close();
    }
  });
});
