// Centralized API helper with auth token injection

import { supabase } from './supabaseClient';

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function getAuthHeaders(extraHeaders = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    return {
        ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
        ...extraHeaders
    };
}

export async function apiFetch(endpoint, options = {}) {
    const headers = await getAuthHeaders({
        'Content-Type': 'application/json',
        ...(options.headers || {})
    });

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
}

export async function apiDownload(endpoint, filenameHint = 'download') {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${endpoint}`, { headers });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filenameHint;
    link.click();
    window.URL.revokeObjectURL(url);
}

export const api = {
    get: (endpoint) => apiFetch(endpoint, { method: 'GET' }),
    post: (endpoint, body) => apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(body)
    }),
    put: (endpoint, body) => apiFetch(endpoint, {
        method: 'PUT',
        body: JSON.stringify(body)
    }),
    delete: (endpoint) => apiFetch(endpoint, { method: 'DELETE' }),

    upload: async (endpoint, formData) => {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers,
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || `HTTP ${response.status}`);
        }

        const text = await response.text();
        return text ? JSON.parse(text) : null;
    },

    getJobs: () => apiFetch('/jobs'),
    getJobStatus: (id) => apiFetch(`/status/${id}`),
    deleteJob: (id) => api.delete(`/jobs/${id}`),
    stopJob: (id) => api.post(`/stop/${id}`),

    uploadUrlsFile: (formData) => api.upload('/upload', formData),
    analyzeSingle: (payload) => api.post('/analyze-single', payload),
    analyzeLeadPayload: (payload) => api.post('/analyze-leads', payload),

    scrapeLeads: (payload) => api.post('/scrape-leads', payload),
    getLeads: () => api.get('/leads'),

    createMapsJob: (payload) => api.post('/prospecting/maps/jobs', payload),
    getMapsJob: (jobId) => api.get(`/prospecting/maps/jobs/${jobId}`),

    createAnalysisJob: (payload) => api.post('/analysis/jobs', payload),
    getAnalysisJob: (jobId) => api.get(`/analysis/jobs/${jobId}`),

    getReports: () => api.get('/reports'),
    createReport: (payload) => api.post('/reports', payload),
    getReport: (id) => api.get(`/reports/${id}`),
    downloadReport: (id, filenameHint = 'report.pdf') => apiDownload(`/reports/${id}/download`, filenameHint),
    downloadLeadExport: (format = 'xlsx') => apiDownload(`/export-my-leads?format=${format}`, `leads.${format}`),

    getBranding: () => api.get('/settings/branding'),
    updateBranding: (payload) => api.put('/settings/branding', payload),

    getOutboundDestinations: () => api.get('/outbound/destinations'),
    saveOutboundDestination: (payload) => api.post('/outbound/destinations', payload),
    exportOutbound: (payload) => api.post('/outbound/exports', payload),

    getCampaigns: () => api.get('/campaigns'),
    getCampaign: (id) => api.get(`/campaigns/${id}`),
    createCampaign: (data) => api.post('/campaigns', data),
    activateCampaign: (id) => api.post(`/campaigns/${id}/activate`),
    pauseCampaign: (id) => api.post(`/campaigns/${id}/pause`),
    getTasks: (campaignId, bucket = 'today') => api.get(`/campaigns/${campaignId}/tasks?bucket=${bucket}`),
    completeTask: (taskId) => api.post(`/tasks/${taskId}/complete`),
    setOutcome: (campaignLeadId, outcome) => api.post(`/campaign-leads/${campaignLeadId}/outcome`, { outcome }),
    getSequences: () => api.get('/sequences'),
    createSequence: (data) => api.post('/sequences', data),
    updateSequence: (id, data) => api.put(`/sequences/${id}`, data),
    downloadCampaignExport: (campaignId, format = 'csv') => apiDownload(`/campaigns/${campaignId}/export.csv?format=${format}`, `campaign_${campaignId}.${format}`),

    getScreenshotUrl: (path) => {
        if (!path) return null;
        if (path.startsWith('http')) return path;
        return `${API_BASE}${path}`;
    }
};
