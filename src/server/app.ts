import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createServer, type Server } from "node:http";
import { createStudyDraft } from "../application/create-study.js";
import { exportStudyJson, exportStudyMarkdown } from "../application/export.js";
import { importReferenceFixture } from "../application/reference-case-importer.js";
import { StudyService } from "../application/study-service.js";
import { StudyValidationError, validateStudyDraft } from "../domain/validation.js";
import type { StudyRepository } from "../persistence/repository.js";
import type { WorkflowRepository } from "../persistence/workflow-repository.js";
import { PlanningPipeline, PipelineRunNotFoundError } from "../workflow/pipeline.js";
import { StudyChangeSchema } from "../workflow/dependencies.js";
import type { ModelAdapter } from "../workflow/types.js";

const CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

type ServerOptions = {
  studies: StudyRepository;
  workflows: WorkflowRepository;
  adapter: ModelAdapter;
  referenceCaseDirectory: string;
  staticDirectory?: string;
  clock?: () => string;
};

type JsonObject = Record<string, unknown>;

function securityHeaders(response: ServerResponse): void {
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("x-frame-options", "DENY");
  response.setHeader("referrer-policy", "no-referrer");
  response.setHeader("content-security-policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'");
}

function json(response: ServerResponse, status: number, body: unknown): void {
  securityHeaders(response);
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage): Promise<JsonObject> {
  let content = "";
  for await (const chunk of request) {
    content += String(chunk);
    if (content.length > 1_000_000) throw new Error("Request body exceeds 1 MB");
  }
  if (!content) return {};
  const parsed: unknown = JSON.parse(content);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("JSON request body must be an object");
  return parsed as JsonObject;
}

function match(pathname: string, pattern: RegExp): string[] | null {
  const result = pathname.match(pattern);
  return result ? result.slice(1).map(decodeURIComponent) : null;
}

function safeReferenceFile(directory: string, file: string): string {
  if (!/^rc-[0-9]{2}-[a-z0-9-]+\.json$/.test(file)) throw new Error("Unknown reference case");
  const path = resolve(directory, file);
  if (!path.startsWith(`${resolve(directory)}${sep}`) || !existsSync(path)) throw new Error("Unknown reference case");
  return path;
}

function serveStatic(response: ServerResponse, pathname: string, directory: string): boolean {
  const root = resolve(directory);
  const requested = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
  let path = resolve(root, requested);
  if (!path.startsWith(`${root}${sep}`) && path !== root) return false;
  if (!existsSync(path) || !statSync(path).isFile()) path = resolve(root, "index.html");
  if (!existsSync(path) || !statSync(path).isFile()) return false;
  securityHeaders(response);
  response.writeHead(200, { "content-type": CONTENT_TYPES[extname(path)] ?? "application/octet-stream" });
  createReadStream(path).pipe(response);
  return true;
}

export type ScenarioServer = {
  server: Server;
  pipeline: PlanningPipeline;
};

export function createScenarioServer(options: ServerOptions): ScenarioServer {
  const studies = new StudyService(options.studies, options.clock);
  const pipeline = new PlanningPipeline(options.studies, options.workflows, options.adapter, options.clock);

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      const pathname = url.pathname;
      if (request.method === "GET" && pathname === "/api/health") {
        return json(response, 200, { ok: true, modelConfigured: options.adapter.provider !== "unavailable" });
      }
      if (request.method === "GET" && pathname === "/api/studies") {
        return json(response, 200, { studies: options.studies.listStudies() });
      }
      if (request.method === "POST" && pathname === "/api/studies") {
        const body = await readJson(request);
        const study = studies.createStudy(createStudyDraft(body as never, options.clock ? { now: options.clock() } : {}));
        return json(response, 201, { study });
      }
      if (request.method === "GET" && pathname === "/api/reference-cases") {
        const cases = ["rc-01-workshop.json", "rc-02-job-timing.json", "rc-03-capacity.json", "rc-04-inference-adoption.json"]
          .map((file) => ({ file, ...(JSON.parse(readFileSync(safeReferenceFile(options.referenceCaseDirectory, file), "utf8")) as { id: string; title: string; family: string }) }));
        return json(response, 200, { cases });
      }
      let params = match(pathname, /^\/api\/reference-cases\/([^/]+)\/import$/);
      if (request.method === "POST" && params) {
        const input: unknown = JSON.parse(readFileSync(safeReferenceFile(options.referenceCaseDirectory, params[0]!), "utf8"));
        const study = studies.createStudy(importReferenceFixture(input, options.clock ? { now: options.clock() } : {}));
        return json(response, 201, { study });
      }
      params = match(pathname, /^\/api\/studies\/([^/]+)$/);
      if (request.method === "GET" && params) return json(response, 200, { study: studies.loadStudy(params[0]!) });
      if (request.method === "PUT" && params) {
        const body = await readJson(request);
        const study = validateStudyDraft(body.study);
        if (study.id !== params[0]) throw new Error("Study ID does not match the route");
        const changes = StudyChangeSchema.array().parse(Array.isArray(body.changes) ? body.changes : []);
        const result = pipeline.applyStudyEdit(study, changes);
        return json(response, 200, result);
      }
      params = match(pathname, /^\/api\/studies\/([^/]+)\/revisions$/);
      if (request.method === "GET" && params) return json(response, 200, { revisions: studies.listRevisions(params[0]!) });
      if (request.method === "POST" && params) {
        const body = await readJson(request);
        return json(response, 201, studies.acceptRevision(params[0]!, String(body.summary ?? "")));
      }
      params = match(pathname, /^\/api\/studies\/([^/]+)\/revisions\/([^/]+)$/);
      if (request.method === "GET" && params) return json(response, 200, studies.loadRevision(params[0]!, params[1]!));
      params = match(pathname, /^\/api\/studies\/([^/]+)\/runs$/);
      if (request.method === "GET" && params) return json(response, 200, { runs: options.workflows.listRuns(params[0]!) });
      if (request.method === "POST" && params) {
        const body = await readJson(request);
        return json(response, 201, { run: pipeline.createRun(params[0]!, body) });
      }
      params = match(pathname, /^\/api\/runs\/([^/]+)$/);
      if (request.method === "GET" && params) return json(response, 200, { run: pipeline.getRun(params[0]!) });
      params = match(pathname, /^\/api\/runs\/([^/]+)\/execute$/);
      if (request.method === "POST" && params) return json(response, 200, { run: await pipeline.executeRun(params[0]!) });
      params = match(pathname, /^\/api\/runs\/([^/]+)\/cancel$/);
      if (request.method === "POST" && params) return json(response, 200, { run: pipeline.cancelRun(params[0]!) });
      params = match(pathname, /^\/api\/studies\/([^/]+)\/export$/);
      if (request.method === "GET" && params) {
        const format = url.searchParams.get("format") ?? "markdown";
        const revisionId = url.searchParams.get("revision");
        const study = revisionId ? studies.loadRevision(params[0]!, revisionId).snapshot : studies.loadStudy(params[0]!);
        const content = format === "json" ? exportStudyJson(study) : exportStudyMarkdown(study);
        const extension = format === "json" ? "json" : "md";
        securityHeaders(response);
        response.writeHead(200, {
          "content-type": format === "json" ? "application/json; charset=utf-8" : "text/markdown; charset=utf-8",
          "content-disposition": `attachment; filename="scenario-study-${study.id}.${extension}"`
        });
        return response.end(content);
      }
      if (pathname.startsWith("/api/")) return json(response, 404, { error: { message: "API route not found" } });
      if (request.method === "GET" && options.staticDirectory && serveStatic(response, pathname, options.staticDirectory)) return;
      return json(response, 404, { error: { message: "Not found" } });
    } catch (error) {
      const status = error instanceof StudyValidationError ? 422
        : error instanceof SyntaxError ? 400
        : error instanceof PipelineRunNotFoundError ? 404
        : error instanceof Error && /not found/i.test(error.message) ? 404
        : 400;
      return json(response, status, {
        error: {
          name: error instanceof Error ? error.name : "Error",
          message: error instanceof Error ? error.message : "Unknown error",
          ...(error instanceof StudyValidationError ? { issues: error.issues } : {})
        }
      });
    }
  });
  return { server, pipeline };
}
