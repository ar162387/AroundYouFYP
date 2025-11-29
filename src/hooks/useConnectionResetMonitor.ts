import { useEffect, useRef } from 'react';
import { useQueryClient } from 'react-query';
import { getConnectionResetCount } from '../services/supabase';

/**
 * Hook to monitor connection resets and automatically invalidate react-query queries
 * This ensures the UI updates when the connection is restored after a reset
 * 
 * Usage: Add this hook to your App component or any component that needs to react to connection resets
 */
export function useConnectionResetMonitor() {
  const queryClient = useQueryClient();
  const lastResetCountRef = useRef<number>(0);

  useEffect(() => {
    // Initialize with current reset count
    lastResetCountRef.current = getConnectionResetCount();

    // Monitor connection resets every 2 seconds
    const checkInterval = setInterval(() => {
      const currentResetCount = getConnectionResetCount();
      
      if (currentResetCount > lastResetCountRef.current) {
        // Connection was reset - invalidate all queries to trigger refetch
        console.log('[useConnectionResetMonitor] Connection reset detected, invalidating all queries...');
        lastResetCountRef.current = currentResetCount;
        
        // Invalidate all queries to trigger refetch with fresh connection
        queryClient.invalidateQueries([]);
      }
    }, 2000); // Check every 2 seconds

    return () => clearInterval(checkInterval);
  }, [queryClient]);
}

