import { useState, useEffect, useCallback, useRef } from 'react';
import { useStudentProgress } from '../components/Progress/StudentProgressContext';
import { leetcodeService } from '../services/leetcodeService';
import { codechefService } from '../services/codechefService';
import { codeforcesService } from '../services/codeforcesService';
import { hackerrankService } from '../services/hackerrankService';

const services = {
  leetcode: leetcodeService,
  codechef: codechefService,
  codeforces: codeforcesService,
  hackerrank: hackerrankService
};

/**
 * Shared custom hook to query platform-specific student CP analytics.
 * Handles request lifecycle, loading state, request cancellations, retries, and cleanup.
 * @param {string} platformName - 'leetcode' | 'codechef' | 'codeforces' | 'hackerrank'
 */
export function usePlatformData(platformName) {
  const { selectedStudent, refreshVersion, triggerGlobalRefresh } = useStudentProgress();
  const studentId = selectedStudent?.id || null;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  // Track active fetch ID to cancel previous updates if student/platform changes or component unmounts
  const activeFetchIdRef = useRef(0);

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!studentId) {
      setData(null);
      setLoading(false);
      return;
    }

    const currentFetchId = ++activeFetchIdRef.current;
    setError('');

    const service = services[platformName];
    if (!service) {
      setError(`Platform service for ${platformName} not found.`);
      setLoading(false);
      return;
    }

    try {
      let profile;
      if (forceRefresh) {
        profile = await service.refreshData(studentId);
      } else {
        profile = await service.getProfile(studentId);
      }

      // Check if another request has been started since this one was initiated
      if (currentFetchId !== activeFetchIdRef.current) return;

      if (!profile || !profile.verified) {
        setData(null);
      } else {
        // Fetch remaining platform metrics concurrently
        const [history, solved, subs, heatmap, ratings] = await Promise.all([
          service.getContestHistory(studentId),
          service.getSolvedProblems(studentId),
          service.getSubmissionStats(studentId),
          service.getHeatmap(studentId),
          service.getRatingHistory(studentId)
        ]);

        if (currentFetchId !== activeFetchIdRef.current) return;

        setData({
          profile,
          contestHistory: history,
          solvedStats: solved,
          submissionStats: subs,
          heatmap,
          ratingHistory: ratings
        });
        setLastUpdated(new Date().toISOString());
      }
    } catch (err) {
      if (currentFetchId === activeFetchIdRef.current) {
        setError(err.message || `Failed to fetch data for ${platformName}`);
      }
    } finally {
      if (currentFetchId === activeFetchIdRef.current) {
        setLoading(false);
      }
    }
  }, [studentId, platformName]);

  useEffect(() => {
    setLoading(true);
    fetchData(false);

    return () => {
      // Increment request ID on cleanup to invalidate current pending promise resolution
      activeFetchIdRef.current++;
    };
  }, [fetchData, refreshVersion]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    const service = services[platformName];
    if (!service) {
      setError(`Platform service for ${platformName} not found.`);
      setLoading(false);
      return;
    }
    try {
      // Force refresh the profile data (which synchronizes backend & updates cache)
      await service.refreshData(studentId);
      // Trigger global refresh to make other platform components fetch updated cache
      triggerGlobalRefresh();
    } catch (err) {
      setError(err.message || `Failed to refresh data for ${platformName}`);
      setLoading(false);
    }
  }, [studentId, platformName, triggerGlobalRefresh]);

  const retry = useCallback(() => {
    setLoading(true);
    return fetchData(false);
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refresh,
    retry,
    lastUpdated
  };
}
