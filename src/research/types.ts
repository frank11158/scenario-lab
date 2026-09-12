import { z } from "zod";
import { EntityIdSchema } from "../domain/ids.js";
import { EvidenceSchema, ISODateTimeSchema, UnavailableSourceSchema } from "../domain/schema.js";

const Text = z.string().trim().min(1);

export const ResearchSourceInputSchema = z.object({
  kind: z.enum(["web", "document"]),
  locator: Text,
  claim: Text,
  maxAgeDays: z.number().int().min(1).max(3_650).default(180),
  evidenceId: EntityIdSchema.optional()
}).strict();

export const ResearchRefreshInputSchema = z.object({
  evidenceIds: z.array(EntityIdSchema).min(1).max(25),
  maxAgeDays: z.number().int().min(1).max(3_650).default(180)
}).strict();

export const ResearchImpactSchema = z.object({
  assumptionIds: z.array(EntityIdSchema),
  driverIds: z.array(EntityIdSchema),
  constraintIds: z.array(EntityIdSchema),
  consequenceIds: z.array(EntityIdSchema),
  invalidatesFrom: z.literal("evidence"),
  recommendationMayChange: z.literal(true)
}).strict();

const PreviewBase = {
  source: ResearchSourceInputSchema,
  impact: ResearchImpactSchema
};

export const ResearchPreviewEntrySchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("available"),
    ...PreviewBase,
    proposedEvidence: EvidenceSchema,
    contentChanged: z.boolean().nullable(),
    previousContentHash: z.string().regex(/^[a-f0-9]{64}$/).nullable()
  }).strict(),
  z.object({
    status: z.literal("unavailable"),
    ...PreviewBase,
    unavailable: UnavailableSourceSchema
  }).strict()
]);

export const ResearchPreviewSchema = z.object({
  id: EntityIdSchema,
  studyId: EntityIdSchema,
  baseStudyUpdatedAt: ISODateTimeSchema,
  createdAt: ISODateTimeSchema,
  entries: z.array(ResearchPreviewEntrySchema).min(1).max(25)
}).strict();

export type ResearchSourceInput = z.infer<typeof ResearchSourceInputSchema>;
export type ResearchRefreshInput = z.infer<typeof ResearchRefreshInputSchema>;
export type ResearchImpact = z.infer<typeof ResearchImpactSchema>;
export type ResearchPreviewEntry = z.infer<typeof ResearchPreviewEntrySchema>;
export type ResearchPreview = z.infer<typeof ResearchPreviewSchema>;
