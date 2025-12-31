// Leads management hook

import { useState, useCallback } from 'react';
import { api } from '../lib/api';

/**
 * Hook for managing scraped leads
 */
export function useLeads() {
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Scrape new leads
    const scrapeLeads = useCallback(async (keyword, location, limit = 10) => {
        try {
            setLoading(true);
            setError(null);
            const data = await api.post('/scrape-leads', { keyword, location, limit });
            setLeads(data || []);
            return data;
        } catch (err) {
            console.error('Scrape failed:', err);
            setError(err.message);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    // Analyze leads (send to analysis job)
    const analyzeLeads = useCallback(async (leadsToAnalyze, keyword, location) => {
        try {
            setLoading(true);
            const data = await api.post('/analyze-leads', {
                leads: leadsToAnalyze,
                keyword,
                location
            });
            return data; // Returns { jobId }
        } catch (err) {
            console.error('Analyze failed:', err);
            setError(err.message);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    // Export leads to file
    const exportLeads = useCallback(async (format = 'xlsx') => {
        if (leads.length === 0) {
            setError('No leads to export');
            return null;
        }

        try {
            // For client-side export using xlsx library
            const XLSX = await import('xlsx');

            const cleanData = leads.map(l => ({
                Name: l.name || 'N/A',
                Address: l.address || 'N/A',
                Phone: l.phone || 'N/A',
                Website: l.website || 'N/A',
                Rating: l.rating || 'N/A',
                Reviews: l.reviews || 'N/A'
            }));

            const ws = XLSX.utils.json_to_sheet(cleanData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Leads');

            const filename = `leads_export_${Date.now()}.${format}`;
            XLSX.writeFile(wb, filename);

            return filename;
        } catch (err) {
            console.error('Export failed:', err);
            setError(err.message);
            return null;
        }
    }, [leads]);

    // Clear leads
    const clearLeads = useCallback(() => {
        setLeads([]);
        setError(null);
    }, []);

    return {
        leads,
        loading,
        error,
        setLeads,
        scrapeLeads,
        analyzeLeads,
        exportLeads,
        clearLeads
    };
}
