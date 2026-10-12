/**
 * Hook for searching section mappings.
 * Tries the API first, falls back to offline SQLite cache.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { Platform } from 'react-native';

import api from '../lib/api';
import { searchOfflineMappings, getMappingsCount } from '../lib/db';
import { SectionMapping } from '../types';

type Direction = 'old_to_new' | 'new_to_old';

export function useMappings() {
  const [mappings, setMappings] = useState<SectionMapping[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  const hasCachedMappings = Platform.OS !== 'web' && getMappingsCount() > 0;

  /**
   * Search mappings — tries API first, then falls back to offline SQLite cache.
   */
  const search = useCallback(
    async (query: string, direction: Direction = 'old_to_new') => {
      if (!query.trim()) {
        setMappings([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Try online API first
        const res = await api.get('/compare', {
          params: { q: query, direction },
        });
        setMappings(res.data as SectionMapping[]);
        setIsOffline(false);
      } catch (apiError: any) {
        // Fallback to offline cache
        if (Platform.OS !== 'web' && hasCachedMappings) {
          const offlineResults = searchOfflineMappings(query, direction);
          setMappings(offlineResults);
          setIsOffline(true);
        } else {
          setMappings([]);
          setError('Unable to search. Connect to the internet or cache mappings for offline use.');
        }
      } finally {
        setIsLoading(false);
      }
    },
    [hasCachedMappings]
  );

  /**
   * Debounced search — call this from the search input.
   */
  const debouncedSearch = useCallback(
    (query: string, direction: Direction = 'old_to_new', delay: number = 400) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        search(query, direction);
      }, delay);
    },
    [search]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return {
    mappings,
    isLoading,
    isOffline,
    error,
    search,
    debouncedSearch,
    hasCachedMappings,
  };
}
