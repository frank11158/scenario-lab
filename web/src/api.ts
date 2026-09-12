import type { CreateStudyInput } from "../../src/application/create-study";
import type { Study, StudyRevision } from "../../src/domain/schema";
import type { StudySummary, StoredRevision } from "../../src/persistence/repository";
import type { PipelineConfig, PipelineRun } from "../../src/workflow/types";
import type { StudyChange } from "../../src/workflow/dependencies";
import type { ResearchPreview, ResearchRefreshInput, ResearchSourceInput } from "../../src/research/types";

export type ReferenceCase = { file: string; id: string; title: string; family: string };

export class ApiError extends Error {
  constructor(message: string, readonly issues: Array<{ path: string; message: string }> = []) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body ? { "content-type": "application/json", ...init.headers } : init?.headers
  });
  const body = await response.json().catch(() => null) as { error?: { message?: string; issues?: Array<{ path: string; message: string }> } } | T | null;
  if (!response.ok) {
    const error = body && typeof body === "object" && "error" in body ? body.error : undefined;
    throw new ApiError(error?.message ?? `Request failed (${response.status})`, error?.issues ?? []);
  }
  return body as T;
}

export type ResearchCapabilities = { webHosts: string[]; documentRoot: string | null; documentExtensions: string[] };

export const api = {
  health: () => request<{ ok: true; modelConfigured: boolean; research: ResearchCapabilities }>("/api/health"),
  listStudies: () => request<{ studies: StudySummary[] }>("/api/studies"),
  getStudy: (id: string) => request<{ study: Study }>(`/api/studies/${id}`),
  createStudy: (input: CreateStudyInput) => request<{ study: Study }>("/api/studies", { method: "POST", body: JSON.stringify(input) }),
  saveStudy: (study: Study, changes: StudyChange[]) => request<{ study: Study; run: PipelineRun | null }>(`/api/studies/${study.id}`, { method: "PUT", body: JSON.stringify({ study, changes }) }),
  listReferenceCases: () => request<{ cases: ReferenceCase[] }>("/api/reference-cases"),
  importReferenceCase: (file: string) => request<{ study: Study }>(`/api/reference-cases/${encodeURIComponent(file)}/import`, { method: "POST" }),
  listRuns: (studyId: string) => request<{ runs: PipelineRun[] }>(`/api/studies/${studyId}/runs`),
  createRun: (studyId: string, config: Partial<PipelineConfig>) => request<{ run: PipelineRun }>(`/api/studies/${studyId}/runs`, { method: "POST", body: JSON.stringify(config) }),
  executeRun: (runId: string) => request<{ run: PipelineRun }>(`/api/runs/${runId}/execute`, { method: "POST" }),
  cancelRun: (runId: string) => request<{ run: PipelineRun }>(`/api/runs/${runId}/cancel`, { method: "POST" }),
  listRevisions: (studyId: string) => request<{ revisions: StudyRevision[] }>(`/api/studies/${studyId}/revisions`),
  acceptRevision: (studyId: string, summary: string) => request<StoredRevision>(`/api/studies/${studyId}/revisions`, { method: "POST", body: JSON.stringify({ summary }) }),
  previewResearch: (studyId: string, input: ResearchSourceInput) => request<{ preview: ResearchPreview }>(`/api/studies/${studyId}/research/preview`, { method: "POST", body: JSON.stringify(input) }),
  previewResearchRefresh: (studyId: string, input: ResearchRefreshInput) => request<{ preview: ResearchPreview }>(`/api/studies/${studyId}/research/refresh-preview`, { method: "POST", body: JSON.stringify(input) }),
  applyResearch: (studyId: string, preview: ResearchPreview, summary: string) => request<StoredRevision & { run: PipelineRun | null }>(`/api/studies/${studyId}/research/apply`, { method: "POST", body: JSON.stringify({ preview, summary }) }),
  exportUrl: (studyId: string, format: "json" | "markdown", revisionId?: string) =>
    `/api/studies/${studyId}/export?format=${format}${revisionId ? `&revision=${encodeURIComponent(revisionId)}` : ""}`
};
