import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const studiesTable = sqliteTable("studies", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  status: text("status").notNull(),
  schemaVersion: text("schema_version").notNull(),
  draftJson: text("draft_json").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const revisionsTable = sqliteTable("study_revisions", {
  id: text("id").primaryKey(),
  studyId: text("study_id").notNull().references(() => studiesTable.id, { onDelete: "cascade" }),
  ordinal: integer("ordinal").notNull(),
  parentRevisionId: text("parent_revision_id"),
  acceptedAt: text("accepted_at").notNull(),
  summary: text("summary").notNull(),
  schemaVersion: text("schema_version").notNull(),
  snapshotJson: text("snapshot_json").notNull()
}, (table) => ({
  studyOrdinalUnique: uniqueIndex("study_revisions_study_ordinal_unique").on(table.studyId, table.ordinal)
}));
