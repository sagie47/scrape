// Centralized API helper with auth token injection

import { supabase } from './supabaseClient';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * @typedef {Object} CampaignSummary
 * @property {string} id
 * @property {string} name
 * @property {"draft"|"active"|"paused"} status
 * @property {string|null} sequenceName
 * @property {number} leadsCount
 * @property {string} createdAt
 * @property {string|null} startAt
 */

/**
 * @typedef {Object} CampaignStats
 * @property {number} total
 * @property {number} queued
 * @property {number} inProgress
 * @property {number} waiting
 * @property {number} stopped
 * @property {number} completed
 * @property {number} replied
 * @property {number} booked
 */

/**
 * @typedef {Object} CampaignLead
 * @property {string} id
 * @property {string} leadId
 * @property {"queued"|"in_progress"|"waiting"|"stopped"|"completed"} state
 * @property {number|null} currentStep
 * @property {string|null} nextDue
 * @property {string|null} outcome
 */

/**
 * @typedef {Object} CampaignDetail
 * @property {string} id
 * @property {string} name
 * @property {"draft"|"active"|"paused"} status
 * @property {Object|null} sequence
 * @property {CampaignStats} stats
 * @property {CampaignLead[]} leads
 * @property {string} createdAt
 * @property {string|null} startAt
 */

/**
 * @typedef {Object} Lead
 * @property {string} id
 * @property {string} name
 * @property {string} [email]
 * @property {string} [phone]
 * @property {string} [website]
 * @property {string} [address]
 * @property {string[]} [tags]
 * @property {string} [createdAt]
 */

/**
 * @typedef {Object} TaskItem
 * @property {string} id
 * @property {string} channel
 * @property {string} dueAt
 * @property {string} status
 * @property {string} variant
 * @property {string|null} subject
 * @property {string} body
 * @property {string[]} missingFields
 * @property {Lead} lead
 * @property {Object} step
 * @property {string} [campaignLeadId]
 */

/**
 * @typedef {Object} SequenceSummary
 * @property {string} id
 * @property {string} name
 * @property {string} [tone]
 * @property {Object} [stopRules]
 */

/**
 * Fetch wrapper that automatically includes Supabase auth token
 * @param {string} endpoint - API endpoint (starting with /)
 * @param {RequestInit} options - Fetch options
 * @returns {Promise<any>} Parsed JSON response
 */
export async function apiFetch(endpoint, options = {}) {
    const { data: { session } } = await supabase.auth.getSession();

    const headers = {
        'Content-Type': 'application/json',
        ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
        ...options.headers
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
    }

    // Handle empty responses
    const text = await response.text();
    return text ? JSON.parse(text) : null;
}

/**
 * Convenience methods
 */
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

    // Jobs (for batch history)
    getJobs: () => apiFetch('/jobs'),

    // Campaigns
    /** @returns {Promise<CampaignSummary[]>} */
    getCampaigns: () => apiFetch('/campaigns'),
    /** @returns {Promise<CampaignDetail>} */
    getCampaign: (id) => apiFetch(`/campaigns/${id}`),
    createCampaign: (data) => api.post('/campaigns', data),
    activateCampaign: (id) => api.post(`/campaigns/${id}/activate`),
    pauseCampaign: (id) => api.post(`/campaigns/${id}/pause`),

    // Tasks
    /** @returns {Promise<TaskItem[]>} */
    getTasks: (campaignId, bucket = 'today') => apiFetch(`/campaigns/${campaignId}/tasks?bucket=${bucket}`),
    completeTask: (taskId) => api.post(`/tasks/${taskId}/complete`),
    setOutcome: (campaignLeadId, outcome) => api.post(`/campaign-leads/${campaignLeadId}/outcome`, { outcome }),

    // Sequences
    /** @returns {Promise<SequenceSummary[]>} */
    getSequences: () => apiFetch('/sequences'),
    createSequence: (data) => api.post('/sequences', data),
    updateSequence: (id, data) => api.put(`/sequences/${id}`, data),

    /**
     * Upload file with auth
     * @param {string} endpoint 
     * @param {FormData} formData 
     */
    upload: async (endpoint, formData) => {
        const { data: { session } } = await supabase.auth.getSession();

        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: {
                ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` })
                // Note: Don't set Content-Type for FormData - browser sets it with boundary
            },
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || `HTTP ${response.status}`);
        }

        const text = await response.text();
        return text ? JSON.parse(text) : null;
    },

    /**
     * Get full URL for screenshot paths
     * Converts relative paths like /screenshot/key to full API URLs
     */
    getScreenshotUrl: (path) => {
        if (!path) return null;
        if (path.startsWith('http')) return path; // Already absolute
        return `${API_BASE}${path}`;
    }
};

export { API_BASE };
