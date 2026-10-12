/**
 * SQLite helper for offline data storage.
 * Uses expo-sqlite for local FIR drafts cache and section mappings cache.
 */
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { FIRDraft, IncidentDetails, SectionMapping } from '../types';
import { naturalCompareSections } from './sort';

// Web fallback: use in-memory storage
const isWeb = Platform.OS === 'web';

let db: SQLite.SQLiteDatabase | null = null;

function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync('ipcai_offline.db');
  }
  return db;
}

/**
 * Initialize all offline tables.
 * Call this on app startup.
 */
export async function initOfflineDb(): Promise<void> {
  if (isWeb) return; // Skip SQLite on web

  const database = getDb();

  // FIR drafts offline cache
  database.execSync(`
    CREATE TABLE IF NOT EXISTS offline_firs (
      client_uuid TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      incident_details TEXT DEFAULT '{}',
      sections_applied TEXT DEFAULT '[]',
      status TEXT DEFAULT 'draft',
      synced INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Section mappings cache
  database.execSync(`
    CREATE TABLE IF NOT EXISTS section_mappings (
      id INTEGER PRIMARY KEY,
      old_act TEXT NOT NULL,
      old_section TEXT NOT NULL,
      old_title TEXT,
      old_text TEXT,
      new_act TEXT NOT NULL,
      new_section TEXT NOT NULL,
      new_title TEXT,
      new_text TEXT,
      mapping_notes TEXT,
      is_identical INTEGER DEFAULT 0
    );
  `);

  // Create indexes for fast lookup
  database.execSync(`
    CREATE INDEX IF NOT EXISTS idx_mappings_old ON section_mappings(old_act, old_section);
  `);
  database.execSync(`
    CREATE INDEX IF NOT EXISTS idx_mappings_new ON section_mappings(new_act, new_section);
  `);
}

// ─── Offline FIR Drafts ───────────────────────────────────────

export interface OfflineFIR {
  client_uuid: string;
  title: string;
  incident_details: IncidentDetails;
  sections_applied: string[];
  status: string;
  synced: boolean;
  created_at: string;
  updated_at: string;
}

export function saveOfflineFIR(fir: {
  client_uuid: string;
  title: string;
  incident_details: IncidentDetails;
  sections_applied: string[];
}): void {
  if (isWeb) return;
  const database = getDb();
  const now = new Date().toISOString();

  database.runSync(
    `INSERT OR REPLACE INTO offline_firs (client_uuid, title, incident_details, sections_applied, status, synced, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'draft', 0, ?, ?)`,
    [
      fir.client_uuid,
      fir.title,
      JSON.stringify(fir.incident_details),
      JSON.stringify(fir.sections_applied),
      now,
      now,
    ]
  );
}

export function getUnsyncedFIRs(): OfflineFIR[] {
  if (isWeb) return [];
  const database = getDb();
  const rows = database.getAllSync(
    'SELECT * FROM offline_firs WHERE synced = 0 ORDER BY created_at DESC'
  ) as any[];

  return rows.map((row) => ({
    client_uuid: row.client_uuid,
    title: row.title,
    incident_details: JSON.parse(row.incident_details || '{}'),
    sections_applied: JSON.parse(row.sections_applied || '[]'),
    status: row.status,
    synced: row.synced === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export function markFIRSynced(clientUuid: string): void {
  if (isWeb) return;
  const database = getDb();
  database.runSync(
    'UPDATE offline_firs SET synced = 1 WHERE client_uuid = ?',
    [clientUuid]
  );
}

export function deleteOfflineFIR(clientUuid: string): void {
  if (isWeb) return;
  const database = getDb();
  database.runSync(
    'DELETE FROM offline_firs WHERE client_uuid = ?',
    [clientUuid]
  );
}

export function getAllOfflineFIRs(): OfflineFIR[] {
  if (isWeb) return [];
  const database = getDb();
  const rows = database.getAllSync(
    'SELECT * FROM offline_firs ORDER BY updated_at DESC'
  ) as any[];

  return rows.map((row) => ({
    client_uuid: row.client_uuid,
    title: row.title,
    incident_details: JSON.parse(row.incident_details || '{}'),
    sections_applied: JSON.parse(row.sections_applied || '[]'),
    status: row.status,
    synced: row.synced === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

// ─── Offline Section Mappings ─────────────────────────────────

export function cacheMappings(mappings: SectionMapping[]): void {
  if (isWeb) return;
  const database = getDb();

  // Clear existing cache
  database.runSync('DELETE FROM section_mappings');

  // Insert all mappings
  for (const m of mappings) {
    database.runSync(
      `INSERT INTO section_mappings (id, old_act, old_section, old_title, old_text, new_act, new_section, new_title, new_text, mapping_notes, is_identical)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        m.id,
        m.old_act,
        m.old_section,
        m.old_title || null,
        m.old_text || null,
        m.new_act,
        m.new_section,
        m.new_title || null,
        m.new_text || null,
        m.mapping_notes || null,
        m.is_identical ? 1 : 0,
      ]
    );
  }
}

export function getMappingsCount(): number {
  if (isWeb) return 0;
  const database = getDb();
  const result = database.getFirstSync(
    'SELECT COUNT(*) as count FROM section_mappings'
  ) as any;
  return result?.count || 0;
}

export function searchOfflineMappings(
  query: string,
  direction: 'old_to_new' | 'new_to_old' = 'old_to_new'
): SectionMapping[] {
  if (isWeb) return [];
  const database = getDb();
  const search = `%${query}%`;

  const rows = database.getAllSync(
    `SELECT * FROM section_mappings
     WHERE old_section LIKE ? OR new_section LIKE ?
        OR old_title LIKE ? OR new_title LIKE ?
        OR old_text LIKE ? OR new_text LIKE ?
     LIMIT 50`,
    [search, search, search, search, search, search]
  ) as any[];

  const list: SectionMapping[] = rows.map((row) => ({
    id: row.id,
    old_act: row.old_act,
    old_section: row.old_section,
    old_title: row.old_title,
    old_text: row.old_text,
    new_act: row.new_act,
    new_section: row.new_section,
    new_title: row.new_title,
    new_text: row.new_text,
    mapping_notes: row.mapping_notes,
    is_identical: row.is_identical === 1,
  }));

  list.sort((a, b) => {
    const aSec = direction === 'old_to_new' ? a.old_section : a.new_section;
    const bSec = direction === 'old_to_new' ? b.old_section : b.new_section;
    return naturalCompareSections(aSec, bSec);
  });

  return list;
}

export function getAllCachedMappings(): SectionMapping[] {
  if (isWeb) return [];
  const database = getDb();
  const rows = database.getAllSync('SELECT * FROM section_mappings') as any[];

  return rows.map((row) => ({
    id: row.id,
    old_act: row.old_act,
    old_section: row.old_section,
    old_title: row.old_title,
    old_text: row.old_text,
    new_act: row.new_act,
    new_section: row.new_section,
    new_title: row.new_title,
    new_text: row.new_text,
    mapping_notes: row.mapping_notes,
    is_identical: row.is_identical === 1,
  }));
}
