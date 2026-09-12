export class StudyNotFoundError extends Error {
  constructor(studyId: string) {
    super(`Study not found: ${studyId}`);
    this.name = "StudyNotFoundError";
  }
}

export class RevisionNotFoundError extends Error {
  constructor(studyId: string, revisionId: string) {
    super(`Revision ${revisionId} not found for study ${studyId}`);
    this.name = "RevisionNotFoundError";
  }
}
