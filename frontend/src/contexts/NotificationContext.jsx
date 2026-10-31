import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/client';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const [toolsProgress, setToolsProgress] = useState([]);
  const [changeLogs, setChangeLogs] = useState([]);
  const [activeJobsCount, setActiveJobsCount] = useState(0);
  const [unreadLogsCount, setUnreadLogsCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const prevActiveCount = useRef(0);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await api.get('/notifications/summary');
      const data = res.data || {};
      const tools = Array.isArray(data.tools_progress) ? data.tools_progress : [];
      const logs = Array.isArray(data.change_logs) ? data.change_logs : [];
      const activeCount = data.active_jobs_count || 0;

      setToolsProgress(tools);
      setChangeLogs(logs);
      setActiveJobsCount(activeCount);
      setUnreadLogsCount(data.unread_logs_count || 0);

      // Notify if an active job just completed
      if (prevActiveCount.current > activeCount && activeCount >= 0) {
        // A background process just finished!
      }
      prevActiveCount.current = activeCount;
    } catch (err) {
      // Quiet fail on network hiccups
    }
  }, []);

  // Adaptive polling: fast (2.5s) when processing, relaxed (20s) when idle
  useEffect(() => {
    fetchSummary();
    const intervalTime = activeJobsCount > 0 ? 2500 : 20000;
    const interval = setInterval(fetchSummary, intervalTime);
    return () => clearInterval(interval);
  }, [fetchSummary, activeJobsCount]);

  // Cancel running job
  const cancelJob = useCallback(async (jobId) => {
    try {
      await api.post(`/utility/jobs/${jobId}/cancel`);
      await fetchSummary();
      return true;
    } catch (err) {
      console.error('Failed to cancel job:', err);
      return false;
    }
  }, [fetchSummary]);

  // Dismiss / delete job record
  const deleteJob = useCallback(async (jobId) => {
    try {
      await api.delete(`/utility/jobs/${jobId}`);
      await fetchSummary();
      return true;
    } catch (err) {
      console.error('Failed to delete job:', err);
      return false;
    }
  }, [fetchSummary]);

  // Direct download result without leaving page
  const downloadJobResult = useCallback(async (jobId, fallbackName = 'result_file') => {
    try {
      const response = await api.get(`/utility/jobs/${jobId}/download`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fallbackName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      return true;
    } catch (err) {
      console.error('Download failed:', err);
      return false;
    }
  }, []);

  // Submit background job helper for tools
  const submitToolJob = useCallback(async (jobType, formData) => {
    setLoading(true);
    try {
      const res = await api.post(`/utility/jobs/${jobType}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      await fetchSummary();
      return res.data;
    } finally {
      setLoading(false);
    }
  }, [fetchSummary]);

  const value = {
    toolsProgress,
    changeLogs,
    activeJobsCount,
    unreadLogsCount,
    loading,
    fetchSummary,
    cancelJob,
    deleteJob,
    downloadJobResult,
    submitToolJob,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return ctx;
};
