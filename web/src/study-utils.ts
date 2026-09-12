import type { Unknown } from "../../src/domain/schema";

export const newId = () => crypto.randomUUID();
export const unknown = (note: string): Unknown => ({ status: "unknown", note });
export const knownText = (value: string) => value.trim()
  ? { status: "known" as const, value }
  : unknown("Not provided");
export const valueOf = (value: { status: "known"; value: string } | Unknown) => value.status === "known" ? value.value : "";
export const lines = (value: string) => value.split("\n").map((item) => item.trim()).filter(Boolean);

export function replaceAt<T>(values: T[], index: number, value: T): T[] {
  return values.map((item, itemIndex) => itemIndex === index ? value : item);
}

export const shortId = (id: string) => id.slice(0, 8);
