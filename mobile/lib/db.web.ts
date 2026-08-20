import { IncidentDetails, SectionMapping } from '../types';

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

// Helper to get/set lists from localStorage
const getLocalStorageItem = (key: string, defaultValue: any) => {
  if (typeof window === 'undefined') return defaultValue;
  const val = localStorage.getItem(key);
  return val ? JSON.parse(val) : defaultValue;
};

const setLocalStorageItem = (key: string, value: any) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
};

export async function initOfflineDb(): Promise<void> {
  // No-op on web since localStorage is always ready
}

export function saveOfflineFIR(fir: {
  client_uuid: string;
  title: string;
  incident_details: IncidentDetails;
  sections_applied: string[];
}): void {
  const firs = getLocalStorageItem('ipcai_offline_firs', []);
  const now = new Date().toISOString();
  const existingIndex = firs.findIndex((f: any) => f.client_uuid === fir.client_uuid);

  const updatedFir = {
    ...fir,
    status: 'draft',
    synced: false,
    created_at: existingIndex >= 0 ? firs[existingIndex].created_at : now,
    updated_at: now,
  };

  if (existingIndex >= 0) {
    firs[existingIndex] = updatedFir;
  } else {
    firs.push(updatedFir);
  }
  setLocalStorageItem('ipcai_offline_firs', firs);
}

export function getUnsyncedFIRs(): OfflineFIR[] {
  const firs = getLocalStorageItem('ipcai_offline_firs', []);
  return firs.filter((f: any) => !f.synced);
}

export function markFIRSynced(clientUuid: string): void {
  const firs = getLocalStorageItem('ipcai_offline_firs', []);
  const fir = firs.find((f: any) => f.client_uuid === clientUuid);
  if (fir) {
    fir.synced = true;
    setLocalStorageItem('ipcai_offline_firs', firs);
  }
}

export function deleteOfflineFIR(clientUuid: string): void {
  const firs = getLocalStorageItem('ipcai_offline_firs', []);
  const filtered = firs.filter((f: any) => f.client_uuid !== clientUuid);
  setLocalStorageItem('ipcai_offline_firs', filtered);
}

export function getAllOfflineFIRs(): OfflineFIR[] {
  const firs = getLocalStorageItem('ipcai_offline_firs', []);
  // Sort by updated_at descending
  return firs.sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
}

export function cacheMappings(mappings: SectionMapping[]): void {
  setLocalStorageItem('ipcai_section_mappings', mappings);
}

export function getMappingsCount(): number {
  const mappings = getLocalStorageItem('ipcai_section_mappings', []);
  return mappings.length;
}

export function searchOfflineMappings(
  query: string,
  direction: 'old_to_new' | 'new_to_old' = 'old_to_new'
): SectionMapping[] {
  const mappings = getLocalStorageItem('ipcai_section_mappings', []);
  if (!query) return mappings.slice(0, 50);

  const lowerQuery = query.toLowerCase();
  const filtered = mappings.filter((m: any) => {
    return (
      (m.old_section && m.old_section.toLowerCase().includes(lowerQuery)) ||
      (m.new_section && m.new_section.toLowerCase().includes(lowerQuery)) ||
      (m.old_title && m.old_title.toLowerCase().includes(lowerQuery)) ||
      (m.new_title && m.new_title.toLowerCase().includes(lowerQuery)) ||
      (m.old_text && m.old_text.toLowerCase().includes(lowerQuery)) ||
      (m.new_text && m.new_text.toLowerCase().includes(lowerQuery))
    );
  });
  return filtered.slice(0, 50);
}

export function getAllCachedMappings(): SectionMapping[] {
  return getLocalStorageItem('ipcai_section_mappings', []);
}
