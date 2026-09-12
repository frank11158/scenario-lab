import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";

export const EntityIdSchema = z.string().uuid("must be an opaque UUID");
export type EntityId = z.infer<typeof EntityIdSchema>;

export function createId(): EntityId {
  return randomUUID();
}

/** Produces repeatable opaque UUIDs for versioned evaluation fixtures. */
export function createFixtureId(...parts: string[]): EntityId {
  const hex = createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 32);
  const value = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  return EntityIdSchema.parse(value);
}
