import { createId } from "../domain/ids.js";
import { STUDY_SCHEMA_VERSION, StudyRevisionSchema, type Study, type StudyRevision } from "../domain/schema.js";
import { validateStudy, validateStudyDraft } from "../domain/validation.js";
import type { StoredRevision, StudyRepository } from "../persistence/repository.js";
import { RevisionNotFoundError, StudyNotFoundError } from "./errors.js";

export type Clock = () => string;

export class StudyService {
  constructor(
    private readonly repository: StudyRepository,
    private readonly clock: Clock = () => new Date().toISOString()
  ) {}

  createStudy(input: unknown): Study {
    const study = validateStudyDraft(input);
    this.repository.saveDraft(study);
    return study;
  }

  saveStudy(input: unknown): Study {
    const study = validateStudyDraft(input);
    this.repository.saveDraft(study);
    return study;
  }

  loadStudy(studyId: string): Study {
    const study = this.repository.loadDraft(studyId);
    if (!study) throw new StudyNotFoundError(studyId);
    return study;
  }

  acceptRevision(studyId: string, summary: string): StoredRevision {
    return this.recordRevision(studyId, summary, "decision", true);
  }

  recordEvidenceRevision(studyId: string, summary: string): StoredRevision {
    return this.recordRevision(studyId, summary, "evidence", false);
  }

  private recordRevision(studyId: string, summary: string, kind: StudyRevision["kind"], requireComplete: boolean): StoredRevision {
    if (summary.trim().length === 0) throw new Error("Revision summary must not be empty");
    const current = this.loadStudy(studyId);
    const prior = this.repository.listRevisions(studyId);
    const revisionId = createId();
    const acceptedAt = this.clock();
    const revision: StudyRevision = StudyRevisionSchema.parse({
      id: revisionId,
      studyId,
      ordinal: prior.length + 1,
      parentRevisionId: current.currentRevisionId.status === "known"
        ? current.currentRevisionId
        : { status: "unknown", note: "Initial revision" },
      acceptedAt,
      summary: summary.trim(),
      kind,
      schemaVersion: STUDY_SCHEMA_VERSION
    });
    const candidate = {
      ...current,
      status: requireComplete ? "reviewed" : current.status,
      updatedAt: acceptedAt,
      currentRevisionId: { status: "known", value: revisionId }
    };
    const snapshot = requireComplete ? validateStudy(candidate) : validateStudyDraft(candidate);
    if (requireComplete) this.repository.saveAcceptedRevision(snapshot, revision);
    else this.repository.saveRevisionSnapshot(snapshot, revision);
    return { revision, snapshot };
  }

  listRevisions(studyId: string): StudyRevision[] {
    this.loadStudy(studyId);
    return this.repository.listRevisions(studyId);
  }

  loadRevision(studyId: string, revisionId: string): StoredRevision {
    const stored = this.repository.loadRevision(studyId, revisionId);
    if (!stored) throw new RevisionNotFoundError(studyId, revisionId);
    return stored;
  }
}
