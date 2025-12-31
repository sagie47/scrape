// Supabase Realtime subscription hook

import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * Subscribe to job updates via Supabase Realtime
 * @param {string} jobId - Job ID to watch
 * @param {function} onUpdate - Callback when job updates
 */
export function useJobRealtime(jobId, onUpdate) {
    const channelRef = useRef(null);

    useEffect(() => {
        if (!jobId) return;

        // Create channel for this job
        const channel = supabase
            .channel(`job-${jobId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'jobs',
                    filter: `id=eq.${jobId}`
                },
                (payload) => {
                    console.log('[Realtime] Job update:', payload);
                    onUpdate?.(payload.new);
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'job_results',
                    filter: `job_id=eq.${jobId}`
                },
                (payload) => {
                    console.log('[Realtime] New result:', payload);
                    onUpdate?.(null, payload.new);
                }
            )
            .subscribe((status) => {
                console.log('[Realtime] Subscription status:', status);
            });

        channelRef.current = channel;

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
            }
        };
    }, [jobId, onUpdate]);

    return channelRef.current;
}

/**
 * Subscribe to all job events for the current user
 * @param {function} onJobChange - Callback when any job changes
 */
export function useJobsRealtime(onJobChange) {
    const channelRef = useRef(null);

    useEffect(() => {
        const channel = supabase
            .channel('all-jobs')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'jobs'
                },
                (payload) => {
                    console.log('[Realtime] Jobs change:', payload.eventType, payload);
                    onJobChange?.(payload.eventType, payload.new, payload.old);
                }
            )
            .subscribe();

        channelRef.current = channel;

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
            }
        };
    }, [onJobChange]);

    return channelRef.current;
}
