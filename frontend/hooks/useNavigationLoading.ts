import { useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useLoading } from '../contexts/LoadingContext';

/**
 * Hook to automatically show loading indicator during route transitions.
 * Place this in a component inside the Router.
 */
export const useNavigationLoading = () => {
  const location = useLocation();
  const { hideLoading } = useLoading();
  
  useEffect(() => {
    // Hide loading when navigation completes
    hideLoading();
  }, [location.pathname, hideLoading]);
};

/**
 * Hook for manual loading control in components.
 * Returns functions to show/hide the global loader.
 * 
 * Usage:
 * ```tsx
 * const { showLoading, hideLoading } = useGlobalLoading();
 * 
 * const handleFetch = async () => {
 *   showLoading('Daten werden geladen...');
 *   try {
 *     await fetchData();
 *   } finally {
 *     hideLoading();
 *   }
 * };
 * ```
 */
export const useGlobalLoading = () => {
  const { showLoading, hideLoading, isLoading } = useLoading();
  
  /**
   * Wrap an async function to automatically show/hide loading
   */
  const withLoading = useCallback(
    <T>(asyncFn: () => Promise<T>, message?: string): Promise<T> => {
      showLoading(message);
      return asyncFn().finally(() => hideLoading());
    },
    [showLoading, hideLoading]
  );
  
  return {
    showLoading,
    hideLoading,
    isLoading,
    withLoading,
  };
};

export default useNavigationLoading;
