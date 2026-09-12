import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as tables from "./schema.js";

export type ScenarioLabDatabase = BetterSQLite3Database<typeof tables>;

export type OpenDatabase = {
  sqlite: Database.Database;
  db: ScenarioLabDatabase;
  close: () => void;
};

type Migration = { id: number; sql: string };

export const DATABASE_MIGRATIONS: Migration[] = [{
  id: 1,
  sql: `
    CREATE TABLE studies (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      schema_version TEXT NOT NULL,
      draft_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE study_revisions (
      id TEXT PRIMARY KEY NOT NULL,
      study_id TEXT NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
      ordinal INTEGER NOT NULL,
      parent_revision_id TEXT,
      accepted_at TEXT NOT NULL,
      summary TEXT NOT NULL,
      schema_version TEXT NOT NULL,
      snapshot_json TEXT NOT NULL
    );
    CREATE UNIQUE INDEX study_revisions_study_ordinal_unique
      ON study_revisions(study_id, ordinal);
    CREATE INDEX study_revisions_study_id_index
      ON study_revisions(study_id);
  `
}];

function migrate(sqlite: Database.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
  const applied = new Set(
    sqlite.prepare("SELECT id FROM schema_migrations").all().map((row) => (row as { id: number }).id)
  );
  const apply = sqlite.transaction((migration: Migration) => {
    sqlite.exec(migration.sql);
    sqlite.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)")
      .run(migration.id, new Date().toISOString());
  });
  for (const migration of DATABASE_MIGRATIONS) {
    if (!applied.has(migration.id)) apply(migration);
  }
}

export function openDatabase(filename: string): OpenDatabase {
  const sqlite = new Database(filename);
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("journal_mode = WAL");
  migrate(sqlite);
  return {
    sqlite,
    db: drizzle(sqlite, { schema: tables }),
    close: () => sqlite.close()
  };
}
