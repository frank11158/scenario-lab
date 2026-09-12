import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { extname, isAbsolute, resolve, sep } from "node:path";
import { TextDecoder } from "node:util";
import type { SourceSnapshot } from "../domain/schema.js";

export type RetrieverOptions = {
  allowedWebHosts?: string[];
  documentRoot?: string;
  fetchImpl?: typeof fetch;
  clock?: () => string;
  timeoutMs?: number;
  maxBytes?: number;
  lookupImpl?: (hostname: string) => Promise<Array<{ address: string; family: number }>>;
};

export class SourceRetrievalError extends Error {
  constructor(readonly code: "policy" | "unavailable" | "unsupported" | "too_large", message: string) {
    super(message);
    this.name = "SourceRetrievalError";
  }
}

export type RetrieveInput = {
  kind: "web" | "document";
  locator: string;
  claim: string;
  maxAgeDays: number;
};

type RawSource = {
  content: string;
  title: string | null;
  publisher: string | null;
  publishedAt: string | null;
  locator: string;
};

const known = <T>(value: T) => ({ status: "known" as const, value });
const unknown = (note: string) => ({ status: "unknown" as const, note });

function decodeEntities(value: string): string {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity: string) => {
    if (entity.startsWith("#x")) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    if (entity.startsWith("#")) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    return named[entity.toLowerCase()] ?? match;
  });
}

function htmlMeta(html: string, names: string[]): string | null {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`, "i")
    ];
    for (const pattern of patterns) {
      const value = html.match(pattern)?.[1];
      if (value) return decodeEntities(value.trim());
    }
  }
  return null;
}

function htmlText(html: string): string {
  return decodeEntities(html
    .replace(/<(script|style|noscript|template)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--([\s\S]*?)-->/g, " ")
    .replace(/<[^>]+>/g, " "))
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function excerptFor(content: string, claim: string): string {
  const lower = content.toLocaleLowerCase();
  const needle = claim.trim().toLocaleLowerCase();
  const match = needle.length >= 12 ? lower.indexOf(needle) : -1;
  const start = match < 0 ? 0 : Math.max(0, match - 300);
  const excerpt = content.slice(start, start + 1_600).trim();
  if (!excerpt) throw new SourceRetrievalError("unsupported", "The source contains no readable text");
  return excerpt;
}

function freshness(publishedAt: string | null, retrievedAt: string, maxAgeDays: number): SourceSnapshot["freshness"] {
  if (!publishedAt) return { status: "unknown", asOf: retrievedAt, basis: "No machine-readable publication date was found" };
  const ageDays = Math.max(0, (Date.parse(retrievedAt) - Date.parse(publishedAt)) / 86_400_000);
  if (ageDays > maxAgeDays) return { status: "stale", asOf: retrievedAt, basis: `Published ${Math.floor(ageDays)} days ago; review threshold is ${maxAgeDays} days` };
  if (ageDays > maxAgeDays * 0.8) return { status: "aging", asOf: retrievedAt, basis: `Published ${Math.floor(ageDays)} days ago; approaching the ${maxAgeDays}-day threshold` };
  return { status: "current", asOf: retrievedAt, basis: `Published ${Math.floor(ageDays)} days ago; within the ${maxAgeDays}-day threshold` };
}

function publicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const [a, b] = address.split(".").map(Number) as [number, number, number, number];
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && (b === 0 || b === 168)) return false;
    if (a === 198 && (b === 18 || b === 19 || b === 51)) return false;
    if (a === 203 && b === 0) return false;
    return true;
  }
  if (family === 6) {
    const normalized = address.toLowerCase();
    if (normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb") || normalized.startsWith("ff") || normalized.startsWith("2001:db8")) return false;
    if (normalized.startsWith("::ffff:")) return publicAddress(normalized.slice(7));
    return normalized.startsWith("2") || normalized.startsWith("3");
  }
  return false;
}

export class SourceRetriever {
  private readonly allowedWebHosts: Set<string>;
  private readonly fetchImpl: typeof fetch;
  private readonly clock: () => string;
  private readonly timeoutMs: number;
  private readonly maxBytes: number;
  private readonly lookupImpl: (hostname: string) => Promise<Array<{ address: string; family: number }>>;

  constructor(private readonly options: RetrieverOptions = {}) {
    this.allowedWebHosts = new Set((options.allowedWebHosts ?? []).map((host) => host.trim().toLowerCase()).filter(Boolean));
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.clock = options.clock ?? (() => new Date().toISOString());
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.maxBytes = options.maxBytes ?? 1_000_000;
    this.lookupImpl = options.lookupImpl ?? ((hostname) => lookup(hostname, { all: true, verbatim: true }));
  }

  get capabilities(): { webHosts: string[]; documentRoot: string | null; documentExtensions: string[] } {
    return { webHosts: [...this.allowedWebHosts].sort(), documentRoot: this.options.documentRoot ?? null, documentExtensions: [".md", ".txt"] };
  }

  async retrieve(input: RetrieveInput): Promise<SourceSnapshot> {
    const raw = input.kind === "web" ? await this.web(input.locator) : await this.document(input.locator);
    const retrievedAt = this.clock();
    const publishedAt = normalizedDate(raw.publishedAt);
    return {
      kind: input.kind,
      locator: raw.locator,
      title: raw.title ? known(raw.title) : unknown("No title found"),
      publisher: raw.publisher ? known(raw.publisher) : unknown("No publisher found"),
      publishedAt: publishedAt ? known(publishedAt) : unknown("No publication date found"),
      retrievedAt,
      excerpt: excerptFor(raw.content, input.claim),
      contentHash: createHash("sha256").update(raw.content).digest("hex"),
      freshness: freshness(publishedAt, retrievedAt, input.maxAgeDays),
      untrustedContent: true
    };
  }

  private async document(locator: string): Promise<RawSource> {
    if (!this.options.documentRoot) throw new SourceRetrievalError("policy", "Document retrieval is not configured");
    if (isAbsolute(locator)) throw new SourceRetrievalError("policy", "Document locators must be relative to the configured document root");
    const extension = extname(locator).toLowerCase();
    if (extension !== ".md" && extension !== ".txt") throw new SourceRetrievalError("unsupported", "Only UTF-8 .md and .txt documents are supported");
    try {
      const [root, path] = await Promise.all([realpath(this.options.documentRoot), realpath(resolve(this.options.documentRoot, locator))]);
      if (!path.startsWith(`${root}${sep}`)) throw new SourceRetrievalError("policy", "Document path escapes the configured document root");
      const info = await stat(path);
      if (!info.isFile()) throw new SourceRetrievalError("unsupported", "Document locator does not identify a file");
      if (info.size > this.maxBytes) throw new SourceRetrievalError("too_large", `Document exceeds the ${this.maxBytes}-byte limit`);
      const bytes = await readFile(path);
      let content: string;
      try { content = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
      catch { throw new SourceRetrievalError("unsupported", "Document is not valid UTF-8 text"); }
      const firstHeading = content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? null;
      return { content, title: firstHeading, publisher: null, publishedAt: null, locator };
    } catch (error) {
      if (error instanceof SourceRetrievalError) throw error;
      throw new SourceRetrievalError("unavailable", error instanceof Error ? error.message : "Document could not be read");
    }
  }

  private async web(locator: string): Promise<RawSource> {
    let url: URL;
    try { url = new URL(locator); } catch { throw new SourceRetrievalError("policy", "Web source must be a valid URL"); }
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
      throw new SourceRetrievalError("policy", "Web sources require HTTPS, no embedded credentials, and the standard port");
    }
    if (!this.allowedWebHosts.has(url.hostname.toLowerCase())) {
      throw new SourceRetrievalError("policy", `Web host is not allowlisted: ${url.hostname}`);
    }
    let addresses: Array<{ address: string; family: number }>;
    try { addresses = await this.lookupImpl(url.hostname); }
    catch (error) { throw new SourceRetrievalError("unavailable", error instanceof Error ? `DNS lookup failed: ${error.message}` : "DNS lookup failed"); }
    if (!addresses.length || addresses.some((entry) => !publicAddress(entry.address))) {
      throw new SourceRetrievalError("policy", "Allowlisted web host resolved to a non-public or unsupported address");
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = this.options.fetchImpl
        ? await this.fetchImpl(url, { redirect: "manual", signal: controller.signal, headers: { accept: "text/html, text/plain;q=0.9", "user-agent": "ScenarioLab/0.4 research" } })
        : await this.fetchPinned(url, addresses[0]!, controller.signal);
      if (response.status >= 300 && response.status < 400) throw new SourceRetrievalError("policy", "Redirects are not followed; enter the final allowlisted URL");
      if (!response.ok) throw new SourceRetrievalError("unavailable", `Source returned HTTP ${response.status}`);
      const type = (response.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
      if (!["text/html", "application/xhtml+xml", "text/plain"].includes(type)) {
        throw new SourceRetrievalError("unsupported", `Unsupported web content type: ${type || "unknown"}`);
      }
      const declared = Number(response.headers.get("content-length") ?? 0);
      if (declared > this.maxBytes) throw new SourceRetrievalError("too_large", `Source exceeds the ${this.maxBytes}-byte limit`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength > this.maxBytes) throw new SourceRetrievalError("too_large", `Source exceeds the ${this.maxBytes}-byte limit`);
      const raw = buffer.toString("utf8");
      const isHtml = type !== "text/plain";
      return {
        content: isHtml ? htmlText(raw) : raw.replace(/\s+/g, " ").trim(),
        title: isHtml ? (htmlMeta(raw, ["og:title", "twitter:title"]) ?? (decodeEntities(raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "") || null)) : null,
        publisher: isHtml ? htmlMeta(raw, ["og:site_name", "publisher"]) : null,
        publishedAt: isHtml ? htmlMeta(raw, ["article:published_time", "date", "datePublished"]) : null,
        locator: url.toString()
      };
    } catch (error) {
      if (error instanceof SourceRetrievalError) throw error;
      throw new SourceRetrievalError("unavailable", error instanceof Error ? error.message : "Web source could not be retrieved");
    } finally {
      clearTimeout(timeout);
    }
  }

  private fetchPinned(url: URL, target: { address: string; family: number }, signal: AbortSignal): Promise<Response> {
    return new Promise((resolveResponse, rejectResponse) => {
      const request = httpsRequest({
        protocol: "https:",
        hostname: target.address,
        family: target.family,
        port: 443,
        method: "GET",
        path: `${url.pathname}${url.search}`,
        servername: url.hostname,
        signal,
        headers: { host: url.hostname, accept: "text/html, text/plain;q=0.9", "user-agent": "ScenarioLab/0.4 research" }
      }, (response) => {
        const chunks: Buffer[] = [];
        let total = 0;
        response.on("data", (chunk: Buffer) => {
          total += chunk.length;
          if (total > this.maxBytes) response.destroy(new SourceRetrievalError("too_large", `Source exceeds the ${this.maxBytes}-byte limit`));
          else chunks.push(chunk);
        });
        response.on("error", rejectResponse);
        response.on("end", () => {
          const headers = new Headers();
          for (const [name, value] of Object.entries(response.headers)) {
            if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
            else if (value !== undefined) headers.set(name, String(value));
          }
          const status = response.statusCode ?? 500;
          const body = status === 204 || status === 205 || status === 304 ? null : new Uint8Array(Buffer.concat(chunks));
          resolveResponse(new Response(body, { status, headers }));
        });
      });
      request.on("error", rejectResponse);
      request.end();
    });
  }
}
