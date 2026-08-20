/**
 * Hook to sync offline FIR drafts to the server when the device comes online.
 * Also handles the initial download of section mappings for offline use.
 */
import { useEffect, useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import api from '../lib/api';
import {
  getUnsyncedFIRs,
  markFIRSynced,
  cacheMappings,
  getMappingsCount,
  initOfflineDb,
} from '../lib/db';

export function useOfflineSync() {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [mappingsCached, setMappingsCached] = useState(false);

  // Initialize offline DB on mount
  useEffect(() => {
    if (Platform.OS !== 'web') {
      initOfflineDb().catch(console.error);
      setMappingsCached(getMappingsCount() > 0);
    }
  }, []);

  /**
   * Sync all unsynced FIR drafts to the backend.
   */
  const syncFIRs = useCallback(async (): Promise<number> => {
    if (Platform.OS === 'web') return 0;

    setIsSyncing(true);
    setSyncError(null);
    let synced = 0;

    try {
      const unsyncedFIRs = getUnsyncedFIRs();
      for (const fir of unsyncedFIRs) {
        try {
          await api.post('/fir', {
            client_uuid: fir.client_uuid,
            title: fir.title,
            incident_details: fir.incident_details,
            sections_applied: fir.sections_applied,
          });
          markFIRSynced(fir.client_uuid);
          synced++;
        } catch (error: any) {
          // If it's a 409 or server says "already exists", mark as synced
          if (error?.response?.status === 409 || error?.response?.status === 200) {
            markFIRSynced(fir.client_uuid);
            synced++;
          } else {
            console.warn(`Failed to sync FIR ${fir.client_uuid}:`, error?.message);
          }
        }
      }

      if (synced > 0) {
        // Invalidate FIR queries to refresh the UI
        queryClient.invalidateQueries({ queryKey: ['firs'] });
        queryClient.invalidateQueries({ queryKey: ['firs-recent'] });
      }
    } catch (error: any) {
      setSyncError(error?.message || 'Sync failed');
    } finally {
      setIsSyncing(false);
    }

    return synced;
  }, [queryClient]);

  /**
   * Download all section mappings from the server and cache in SQLite.
   */
  const downloadMappings = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') return false;

    try {
      const response = await api.get('/compare/bulk');
      const { mappings } = response.data;

      if (mappings && mappings.length > 0) {
        cacheMappings(mappings);
        setMappingsCached(true);
        return true;
      }
    } catch (error: any) {
      console.warn('Failed to download mappings:', error?.message);
    }
    return false;
  }, []);

  /**
   * Run a full sync: upload offline FIRs + download latest mappings.
   */
  const fullSync = useCallback(async () => {
    const [synced] = await Promise.all([
      syncFIRs(),
      downloadMappings(),
    ]);
    return synced;
  }, [syncFIRs, downloadMappings]);

  return {
    syncFIRs,
    downloadMappings,
    fullSync,
    isSyncing,
    syncError,
    mappingsCached,
  };
}
