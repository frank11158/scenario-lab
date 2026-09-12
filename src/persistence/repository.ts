import { and, asc, eq } from "drizzle-orm";
import { StudyRevisionSchema, type Study, type StudyRevision } from "../domain/schema.js";
import { validateStudy, validateStudyDraft } from "../domain/validation.js";
import type { ScenarioLabDatabase } from "./database.js";
import { revisionsTable, studiesTable } from "./schema.js";

export type StoredRevision = {
  revision: StudyRevision;
  snapshot: Study;
};

export type StudySummary = Pick<Study, "id" | "title" | "status" | "mode" | "synthetic" | "createdAt" | "updatedAt">;

export interface StudyRepository {
  saveDraft(study: Study): void;
  loadDraft(studyId: string): Study | undefined;
  listStudies(): StudySummary[];
  saveAcceptedRevision(study: Study, revision: StudyRevision): void;
  listRevisions(studyId: string): StudyRevision[];
  loadRevision(studyId: string, revisionId: string): StoredRevision | undefined;
}

function serialize(value: unknown): string {
  return JSON.stringify(value);
}

export class SqliteStudyRepository implements StudyRepository {
  constructor(private readonly db: ScenarioLabDatabase) {}

  saveDraft(study: Study): void {
    const valid = validateStudyDraft(study);
    if (valid.currentRevisionId.status === "known") {
      const revision = this.db.select({ id: revisionsTable.id }).from(revisionsTable).where(and(
        eq(revisionsTable.studyId, valid.id),
        eq(revisionsTable.id, valid.currentRevisionId.value)
      )).get();
      if (!revision) throw new Error(`Current revision reference does not exist: ${valid.currentRevisionId.value}`);
    } else {
      const existing = this.db.select({ id: revisionsTable.id }).from(revisionsTable)
        .where(eq(revisionsTable.studyId, valid.id)).get();
      if (existing) throw new Error("A study with accepted history must reference its current revision");
    }
    this.db.insert(studiesTable).values({
      id: valid.id,
      title: valid.title,
      status: valid.status,
      schemaVersion: valid.schemaVersion,
      draftJson: serialize(valid),
      createdAt: valid.createdAt,
      updatedAt: valid.updatedAt
    }).onConflictDoUpdate({
      target: studiesTable.id,
      set: {
        title: valid.title,
        status: valid.status,
        schemaVersion: valid.schemaVersion,
        draftJson: serialize(valid),
        updatedAt: valid.updatedAt
      }
    }).run();
  }

  loadDraft(studyId: string): Study | undefined {
    const row = this.db.select({ draftJson: studiesTable.draftJson })
      .from(studiesTable).where(eq(studiesTable.id, studyId)).get();
    return row ? validateStudyDraft(JSON.parse(row.draftJson)) : undefined;
  }

  listStudies(): StudySummary[] {
    return this.db.select({ draftJson: studiesTable.draftJson }).from(studiesTable)
      .orderBy(asc(studiesTable.title)).all()
      .map((row) => {
        const study = validateStudyDraft(JSON.parse(row.draftJson));
        return {
          id: study.id,
          title: study.title,
          status: study.status,
          mode: study.mode,
          synthetic: study.synthetic,
          createdAt: study.createdAt,
          updatedAt: study.updatedAt
        };
      });
  }

  saveAcceptedRevision(study: Study, revision: StudyRevision): void {
    const valid = validateStudy(study);
    const validRevision = StudyRevisionSchema.parse(revision);
    if (validRevision.studyId !== valid.id) throw new Error("Revision studyId does not match the study ID");
    if (valid.currentRevisionId.status !== "known" || valid.currentRevisionId.value !== validRevision.id) {
      throw new Error("Accepted study snapshot must reference the revision being stored");
    }
    const prior = this.listRevisions(valid.id);
    const expectedOrdinal = prior.length + 1;
    if (validRevision.ordinal !== expectedOrdinal) throw new Error(`Revision ordinal must be ${expectedOrdinal}`);
    const latest = prior.at(-1);
    if (!latest && validRevision.parentRevisionId.status === "known") {
      throw new Error("Initial revision cannot have a parent revision");
    }
    if (latest && (validRevision.parentRevisionId.status !== "known" || validRevision.parentRevisionId.value !== latest.id)) {
      throw new Error(`Revision parent must reference latest revision ${latest.id}`);
    }
    this.db.transaction((tx) => {
      tx.insert(studiesTable).values({
        id: valid.id,
        title: valid.title,
        status: valid.status,
        schemaVersion: valid.schemaVersion,
        draftJson: serialize(valid),
        createdAt: valid.createdAt,
        updatedAt: valid.updatedAt
      }).onConflictDoUpdate({
        target: studiesTable.id,
        set: {
          title: valid.title,
          status: valid.status,
          schemaVersion: valid.schemaVersion,
          draftJson: serialize(valid),
          updatedAt: valid.updatedAt
        }
      }).run();
      tx.insert(revisionsTable).values({
        id: validRevision.id,
        studyId: validRevision.studyId,
        ordinal: validRevision.ordinal,
        parentRevisionId: validRevision.parentRevisionId.status === "known" ? validRevision.parentRevisionId.value : null,
        acceptedAt: validRevision.acceptedAt,
        summary: validRevision.summary,
        schemaVersion: validRevision.schemaVersion,
        snapshotJson: serialize(valid)
      }).run();
    });
  }

  listRevisions(studyId: string): StudyRevision[] {
    return this.db.select().from(revisionsTable)
      .where(eq(revisionsTable.studyId, studyId))
      .orderBy(asc(revisionsTable.ordinal)).all()
      .map((row) => StudyRevisionSchema.parse({
        id: row.id,
        studyId: row.studyId,
        ordinal: row.ordinal,
        parentRevisionId: row.parentRevisionId
          ? { status: "known" as const, value: row.parentRevisionId }
          : { status: "unknown" as const, note: "Initial revision" },
        acceptedAt: row.acceptedAt,
        summary: row.summary,
        schemaVersion: row.schemaVersion
      }));
  }

  loadRevision(studyId: string, revisionId: string): StoredRevision | undefined {
    const row = this.db.select().from(revisionsTable).where(and(
      eq(revisionsTable.studyId, studyId),
      eq(revisionsTable.id, revisionId)
    )).get();
    if (!row) return undefined;
    return {
      revision: StudyRevisionSchema.parse({
        id: row.id,
        studyId: row.studyId,
        ordinal: row.ordinal,
        parentRevisionId: row.parentRevisionId
          ? { status: "known", value: row.parentRevisionId }
          : { status: "unknown", note: "Initial revision" },
        acceptedAt: row.acceptedAt,
        summary: row.summary,
        schemaVersion: row.schemaVersion
      }),
      snapshot: validateStudy(JSON.parse(row.snapshotJson))
    };
  }
}
