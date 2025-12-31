// Job state management hook with Supabase integration

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { api } from '../lib/api';

/**
 * Hook for managing job state with Supabase backend
 */
export function useJobs() {
    const [jobs, setJobs] = useState([]);
    const [currentJob, setCurrentJob] = useState(null);
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const pollInterval = useRef(null);

    // Fetch job history
    const fetchHistory = useCallback(async () => {
        try {
            setLoading(true);
            const data = await api.get('/jobs');
            setJobs(data || []);
        } catch (err) {
            console.error('Failed to fetch jobs:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    // Load a specific job
    const loadJob = useCallback(async (jobId) => {
        try {
            setLoading(true);
            const data = await api.get(`/status/${jobId}`);
            setCurrentJob(jobId);
            setStatus(data);
            return data;
        } catch (err) {
            console.error('Failed to load job:', err);
            setError(err.message);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    // Delete a job
    const deleteJob = useCallback(async (jobId) => {
        try {
            await api.delete(`/jobs/${jobId}`);
            setJobs(prev => prev.filter(j => j.id !== jobId));
            if (currentJob === jobId) {
                setCurrentJob(null);
                setStatus(null);
            }
            return true;
        } catch (err) {
            console.error('Failed to delete job:', err);
            setError(err.message);
            return false;
        }
    }, [currentJob]);

    // Start polling for job status
    const startPolling = useCallback((jobId) => {
        if (pollInterval.current) {
            clearInterval(pollInterval.current);
        }

        const poll = async () => {
            try {
                const data = await api.get(`/status/${jobId}`);
                setStatus(data);

                if (data.status === 'done' || data.status === 'error') {
                    clearInterval(pollInterval.current);
                    pollInterval.current = null;
                    fetchHistory();
                }
            } catch (err) {
                console.error('Polling error:', err);
            }
        };

        poll(); // Initial poll
        pollInterval.current = setInterval(poll, 2000);
        setCurrentJob(jobId);

        return () => {
            if (pollInterval.current) {
                clearInterval(pollInterval.current);
                pollInterval.current = null;
            }
        };
    }, [fetchHistory]);

    // Stop current job
    const stopJob = useCallback(async () => {
        if (!currentJob) return;

        try {
            await api.post(`/stop/${currentJob}`);
            if (pollInterval.current) {
                clearInterval(pollInterval.current);
                pollInterval.current = null;
            }
            setCurrentJob(null);
        } catch (err) {
            console.error('Failed to stop job:', err);
        }
    }, [currentJob]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (pollInterval.current) {
                clearInterval(pollInterval.current);
            }
        };
    }, []);

    // Calculate stats
    const stats = {
        total: jobs.length,
        completed: jobs.filter(j => j.status === 'done').length,
        failed: jobs.filter(j => j.status === 'error').length,
        running: currentJob ? 1 : 0
    };

    return {
        jobs,
        currentJob,
        status,
        loading,
        error,
        stats,
        fetchHistory,
        loadJob,
        deleteJob,
        startPolling,
        stopJob,
        setCurrentJob,
        setStatus
    };
}
