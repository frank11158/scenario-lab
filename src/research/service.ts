import { createId } from "../domain/ids.js";
import { EvidenceSchema, type Evidence, type Study } from "../domain/schema.js";
import { validateStudyDraft } from "../domain/validation.js";
import type { StudyRepository, StoredRevision } from "../persistence/repository.js";
import type { WorkflowRepository } from "../persistence/workflow-repository.js";
import { PlanningPipeline } from "../workflow/pipeline.js";
import type { ModelAdapter, PipelineRun } from "../workflow/types.js";
import { StudyService } from "../application/study-service.js";
import { StudyNotFoundError } from "../application/errors.js";
import { detectPotentialContradictions } from "./contradictions.js";
import { SourceRetriever, SourceRetrievalError } from "./source-retriever.js";
import { ResearchPreviewSchema, ResearchRefreshInputSchema, ResearchSourceInputSchema, type ResearchImpact, type ResearchPreview, type ResearchPreviewEntry, type ResearchSourceInput } from "./types.js";

const known = <T>(value: T) => ({ status: "known" as const, value });
const unknown = (note: string) => ({ status: "unknown" as const, note });

export type ApplyResearchResult = StoredRevision & { run: PipelineRun | null };

export class EvidenceResearchService {
  private readonly studies: StudyService;
  private readonly pipeline: PlanningPipeline;
  private readonly previews = new Map<string, ResearchPreview>();

  constructor(
    private readonly repository: StudyRepository,
    workflows: WorkflowRepository,
    adapter: ModelAdapter,
    readonly retriever: SourceRetriever,
    private readonly clock: () => string = () => new Date().toISOString()
  ) {
    this.studies = new StudyService(repository, this.clock);
    this.pipeline = new PlanningPipeline(repository, workflows, adapter, this.clock);
  }

  async previewNew(studyId: string, input: unknown): Promise<ResearchPreview> {
    const study = this.load(studyId);
    const source = ResearchSourceInputSchema.parse(input);
    if (source.evidenceId) throw new Error("New-source preview cannot specify an existing evidence ID");
    return this.preview(study, [source]);
  }

  async previewRefresh(studyId: string, input: unknown): Promise<ResearchPreview> {
    const study = this.load(studyId);
    const request = ResearchRefreshInputSchema.parse(input);
    const sources = request.evidenceIds.map((evidenceId): ResearchSourceInput => {
      const evidence = study.evidence.find((item) => item.id === evidenceId);
      if (!evidence) throw new Error(`Evidence not found: ${evidenceId}`);
      if (!evidence.citation) throw new Error(`Evidence has no refreshable source snapshot: ${evidenceId}`);
      return {
        kind: evidence.citation.kind,
        locator: evidence.citation.locator,
        claim: evidence.claim,
        maxAgeDays: request.maxAgeDays,
        evidenceId
      };
    });
    return this.preview(study, sources);
  }

  apply(studyId: string, input: unknown, summary = "Reviewed evidence research update"): ApplyResearchResult {
    const submitted = ResearchPreviewSchema.parse(input);
    const stored = this.previews.get(submitted.id);
    if (!stored) throw new Error("Research preview is unavailable or has already been applied; create a fresh preview");
    const submittedSupport = new Map(submitted.entries.filter((entry) => entry.status === "available")
      .map((entry) => [entry.proposedEvidence.id, entry.proposedEvidence.support]));
    const preview: ResearchPreview = {
      ...stored,
      entries: stored.entries.map((entry) => entry.status === "available"
        ? { ...entry, proposedEvidence: { ...entry.proposedEvidence, support: submittedSupport.get(entry.proposedEvidence.id) ?? entry.proposedEvidence.support } }
        : entry)
    };
    const study = this.load(studyId);
    if (preview.studyId !== studyId) throw new Error("Research preview belongs to another study");
    if (preview.baseStudyUpdatedAt !== study.updatedAt) throw new Error("Study changed after this preview; create a fresh preview before applying");

    let evidence = [...study.evidence];
    const unavailable = [...study.research.unavailableSources];
    for (const entry of preview.entries) {
      if (entry.status === "unavailable") {
        const prior = unavailable.findIndex((item) => item.kind === entry.unavailable.kind && item.locator === entry.unavailable.locator);
        if (prior >= 0) unavailable[prior] = entry.unavailable;
        else unavailable.push(entry.unavailable);
        continue;
      }
      const proposed = EvidenceSchema.parse(entry.proposedEvidence);
      if (proposed.citation?.locator !== entry.source.locator || proposed.citation.kind !== entry.source.kind) {
        throw new Error("Proposed citation does not match the previewed source");
      }
      if (entry.source.evidenceId && proposed.id !== entry.source.evidenceId) throw new Error("Refreshed evidence ID changed unexpectedly");
      const index = evidence.findIndex((item) => item.id === proposed.id);
      if (index >= 0) evidence[index] = proposed;
      else evidence.push(proposed);
    }
    const reviewedAt = this.clock();
    const next = validateStudyDraft({
      ...study,
      status: "draft",
      evidence,
      research: {
        contradictions: detectPotentialContradictions(evidence, study.research.contradictions, reviewedAt),
        unavailableSources: unavailable,
        lastReviewedAt: known(reviewedAt)
      }
    });
    const edited = this.pipeline.applyStudyEdit(next, ["evidence"]);
    const accepted = this.studies.recordEvidenceRevision(studyId, summary);
    this.previews.delete(preview.id);
    return { ...accepted, run: edited.run };
  }

  private load(studyId: string): Study {
    const study = this.repository.loadDraft(studyId);
    if (!study) throw new StudyNotFoundError(studyId);
    return study;
  }

  private impact(study: Study, evidenceId?: string): ResearchImpact {
    if (!evidenceId) return { assumptionIds: [], driverIds: [], constraintIds: [], consequenceIds: [], invalidatesFrom: "evidence", recommendationMayChange: true };
    return {
      assumptionIds: study.assumptions.filter((item) => item.evidenceIds.includes(evidenceId)).map((item) => item.id),
      driverIds: study.drivers.filter((item) => item.evidenceIds.includes(evidenceId)).map((item) => item.id),
      constraintIds: study.constraints.filter((item) => item.sourceEvidenceIds.includes(evidenceId)).map((item) => item.id),
      consequenceIds: study.consequences.filter((item) => item.evidenceIds.includes(evidenceId)).map((item) => item.id),
      invalidatesFrom: "evidence",
      recommendationMayChange: true
    };
  }

  private async preview(study: Study, sources: ResearchSourceInput[]): Promise<ResearchPreview> {
    const createdAt = this.clock();
    const entries: ResearchPreviewEntry[] = [];
    for (const source of sources) {
      const existing = source.evidenceId ? study.evidence.find((item) => item.id === source.evidenceId) : undefined;
      try {
        const snapshot = await this.retriever.retrieve(source);
        const proposedEvidence: Evidence = EvidenceSchema.parse({
          ...(existing ?? {}),
          id: existing?.id ?? createId(),
          claim: source.claim,
          type: "sourced_fact",
          source: known(snapshot.locator),
          observedAt: snapshot.publishedAt,
          retrievedAt: known(snapshot.retrievedAt),
          limitations: [...new Set([...(existing?.limitations ?? []), "Retrieved source content is untrusted data; review the excerpt and support assessment before use."])],
          citation: snapshot,
          support: snapshot.contentHash === existing?.citation?.contentHash
            ? existing.support
            : { status: "unreviewed", rationale: unknown("New or changed source content requires review") },
          authorship: existing?.authorship ?? "user"
        });
        entries.push({
          status: "available",
          source,
          impact: this.impact(study, existing?.id),
          proposedEvidence,
          contentChanged: existing ? snapshot.contentHash !== existing.citation?.contentHash : null,
          previousContentHash: existing?.citation?.contentHash ?? null
        });
      } catch (error) {
        const reason = error instanceof SourceRetrievalError ? `${error.code}: ${error.message}` : error instanceof Error ? error.message : "Source retrieval failed";
        entries.push({
          status: "unavailable",
          source,
          impact: this.impact(study, existing?.id),
          unavailable: {
            id: createId(),
            ...(existing ? { evidenceId: existing.id } : {}),
            kind: source.kind,
            locator: source.locator,
            reason,
            checkedAt: createdAt
          }
        });
      }
    }
    const result = ResearchPreviewSchema.parse({ id: createId(), studyId: study.id, baseStudyUpdatedAt: study.updatedAt, createdAt, entries });
    if (this.previews.size >= 100) this.previews.delete(this.previews.keys().next().value as string);
    this.previews.set(result.id, structuredClone(result));
    return result;
  }
}
