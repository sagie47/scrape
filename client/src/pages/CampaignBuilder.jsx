import { useEffect, useMemo, useState } from 'react';
import { Eye, PlusCircle } from 'lucide-react';
import ObsidianDropdown from '../ObsidianDropdown';
import LeadSelector from '../components/LeadSelector';
import SequenceEditor from '../components/SequenceEditor';
import { api } from '../lib/api';

/**
 * @typedef {Object} Lead
 * @property {string} id
 * @property {string} name
 * @property {string} [company]
 * @property {string} [email]
 * @property {string} [phone]
 * @property {string} [website]
 * @property {string} [address]
 * @property {string[]} [tags]
 * @property {string} [createdAt]
 */

/**
 * @typedef {Object} SequenceStep
 * @property {string} id
 * @property {string} channel
 * @property {number} delayDays
 * @property {string} templateA
 * @property {string} templateB
 * @property {string} subjectA
 * @property {string} subjectB
 */

const createDraftStep = () => ({
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    channel: 'email',
    delayDays: 0,
    subjectA: '',
    subjectB: '',
    templateA: '',
    templateB: ''
});

const normalizeSteps = (steps = []) => steps.map((step) => ({
    id: step.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
    channel: step.channel || 'email',
    delayDays: step.delayDays ?? step.delay_days ?? 0,
    templateA: step.templateA ?? step.template_a ?? '',
    templateB: step.templateB ?? step.template_b ?? '',
    subjectA: step.subjectA ?? step.subject_a ?? '',
    subjectB: step.subjectB ?? step.subject_b ?? ''
}));

const renderTemplate = (template, lead) => {
    if (!template) return '';
    const firstName = lead?.name ? lead.name.split(' ')[0] : '';
    const context = {
        'lead.name': lead?.name || '',
        'lead.first_name': firstName || 'there',
        'lead.company': lead?.company || lead?.name || '',
        'lead.email': lead?.email || '',
        'lead.phone': lead?.phone || '',
        'lead.website': lead?.website || '',
        'lead.address': lead?.address || ''
    };
    return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
        const trimmed = key.trim();
        if (context[trimmed]) return context[trimmed];
        if (trimmed === 'lead.first_name') return 'there';
        return `[${trimmed}]`;
    });
};

/**
 * @param {object} props
 * @param {(path: string) => void} props.onNavigate
 */
export default function CampaignBuilder({ onNavigate }) {
    const [campaignName, setCampaignName] = useState('');
    const [leads, setLeads] = useState(/** @type {Lead[]} */([]));
    const [jobHistory, setJobHistory] = useState([]);
    const [selectedBatchId, setSelectedBatchId] = useState('');
    const [selectedLeadIds, setSelectedLeadIds] = useState(new Set());
    const [sequences, setSequences] = useState([]);
    const [selectedSequenceId, setSelectedSequenceId] = useState('');
    const [selectedSequenceSteps, setSelectedSequenceSteps] = useState(/** @type {SequenceStep[]} */([]));
    const [creatingSequence, setCreatingSequence] = useState(false);
    const [newSequenceName, setNewSequenceName] = useState('');
    const [newSteps, setNewSteps] = useState(/** @type {SequenceStep[]} */([createDraftStep()]));
    const [loadingLeads, setLoadingLeads] = useState(false);
    const [loadingSequences, setLoadingSequences] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let isMounted = true;
        const loadLeads = async () => {
            setLoadingLeads(true);
            try {
                const list = await api.get('/leads');
                if (isMounted) setLeads(list || []);
            } catch (err) {
                console.error('Failed to load leads', err);
            } finally {
                if (isMounted) setLoadingLeads(false);
            }
        };
        const loadSequences = async () => {
            setLoadingSequences(true);
            try {
                const list = await api.getSequences();
                if (isMounted) setSequences(list || []);
            } catch (err) {
                console.error('Failed to load sequences', err);
            } finally {
                if (isMounted) setLoadingSequences(false);
            }
        };
        const loadJobs = async () => {
            try {
                const jobs = await api.getJobs();
                // Filter to only leads-type jobs
                const leadJobs = (jobs || []).filter((j) => j.type === 'leads' || j.type?.includes(' in '));
                if (isMounted) setJobHistory(leadJobs);
            } catch (err) {
                console.error('Failed to load job history', err);
            }
        };
        loadLeads();
        loadSequences();
        loadJobs();
        return () => { isMounted = false; };
    }, []);

    useEffect(() => {
        let isMounted = true;
        const loadSequenceDetails = async () => {
            if (!selectedSequenceId) {
                setSelectedSequenceSteps([]);
                return;
            }
            try {
                const sequence = await api.get(`/sequences/${selectedSequenceId}`);
                if (!isMounted) return;
                setSelectedSequenceSteps(normalizeSteps(sequence.steps || sequence.sequence_steps || []));
            } catch (err) {
                console.error('Failed to load sequence details', err);
            }
        };
        loadSequenceDetails();
        return () => { isMounted = false; };
    }, [selectedSequenceId]);

    // Create batch options from job history
    const batches = useMemo(() => {
        return jobHistory.map((job) => ({
            id: job.id,
            name: job.type || 'Unknown Batch',
            date: job.createdAt,
            count: leads.filter((l) => l.jobId === job.id).length
        })).filter((batch) => batch.count > 0);
    }, [jobHistory, leads]);

    const selectedLeads = useMemo(() => {
        return leads.filter((lead) => selectedLeadIds.has(lead.id));
    }, [leads, selectedLeadIds]);

    const previewStep = creatingSequence ? newSteps[0] : selectedSequenceSteps[0];
    const previewLeads = selectedLeads.length > 0 ? selectedLeads.slice(0, 3) : leads.slice(0, 3);

    const hasSequence = creatingSequence
        ? Boolean(newSequenceName && newSteps.length > 0)
        : Boolean(selectedSequenceId);

    const canSubmit = selectedLeadIds.size > 0 && hasSequence && !submitting;

    const handleCreateCampaign = async (activate) => {
        setSubmitting(true);
        setError('');
        try {
            let sequenceId = selectedSequenceId;
            if (creatingSequence) {
                if (!newSequenceName) {
                    setError('Sequence name is required.');
                    setSubmitting(false);
                    return;
                }
                const created = await api.createSequence({
                    name: newSequenceName,
                    steps: newSteps
                });
                sequenceId = created.id;
            }

            const campaign = await api.createCampaign({
                name: campaignName || 'Untitled Campaign',
                sequenceId,
                leadIds: Array.from(selectedLeadIds)
            });

            if (activate) {
                await api.activateCampaign(campaign.id);
            }
            onNavigate(`/campaigns/${campaign.id}`);
        } catch (err) {
            console.error('Failed to create campaign', err);
            setError(err.message || 'Failed to create campaign.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="campaign-builder animate-fade-in">
            <div className="campaigns-header">
                <div>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 600 }}>Build Campaign</h2>
                    <p className="campaigns-subtitle">Select leads, assign a sequence, and launch.</p>
                </div>
                <button className="hud-btn" type="button" onClick={() => onNavigate('/campaigns')}>
                    <Eye size={16} /> Back to campaigns
                </button>
            </div>

            <div className="campaign-builder-grid">
                <div className="campaign-builder-column">
                    <div className="widget">
                        <div className="widget-header">
                            <div className="widget-title">Campaign Details</div>
                        </div>
                        <label className="sequence-field">
                            <span className="stat-label">Campaign Name</span>
                            <input
                                className="hud-input"
                                value={campaignName}
                                placeholder="e.g. Q1 Dental Outreach"
                                onChange={(event) => setCampaignName(event.target.value)}
                            />
                        </label>
                    </div>

                    <div className="widget">
                        <div className="widget-header">
                            <div className="widget-title">Lead Selection</div>
                            <span className="badge">{leads.length} total</span>
                        </div>
                        <LeadSelector
                            leads={leads}
                            batches={batches}
                            selectedBatchId={selectedBatchId}
                            onBatchChange={setSelectedBatchId}
                            selectedIds={selectedLeadIds}
                            onChange={setSelectedLeadIds}
                            loading={loadingLeads}
                            helperText={`Selected ${selectedLeadIds.size} lead${selectedLeadIds.size === 1 ? '' : 's'}`}
                        />
                    </div>
                </div>

                <div className="campaign-builder-column">
                    <div className="widget">
                        <div className="widget-header">
                            <div className="widget-title">Sequence</div>

                            <button
                                className={`hud-btn ${creatingSequence ? 'primary' : ''}`}
                                type="button"
                                onClick={() => setCreatingSequence((prev) => !prev)}
                            >
                                <PlusCircle size={14} /> {creatingSequence ? 'Using New Sequence' : 'Create New'}
                            </button>
                        </div>

                        {!creatingSequence && (
                            <div style={{ marginBottom: '1rem' }}>
                                <ObsidianDropdown
                                    label="Sequence"
                                    value={selectedSequenceId}
                                    onChange={setSelectedSequenceId}
                                    options={sequences.map((sequence) => ({
                                        label: sequence.name,
                                        value: sequence.id
                                    }))}
                                    placeholder={loadingSequences ? 'Loading sequences...' : 'Select a sequence'}
                                />
                            </div>
                        )}

                        {creatingSequence && (
                            <>
                                <label className="sequence-field">
                                    <span className="stat-label">Sequence Name</span>
                                    <input
                                        className="hud-input"
                                        value={newSequenceName}
                                        placeholder="e.g. 3-step intro"
                                        onChange={(event) => setNewSequenceName(event.target.value)}
                                    />
                                </label>
                                <SequenceEditor steps={newSteps} onChange={setNewSteps} />
                            </>
                        )}

                        {!creatingSequence && selectedSequenceSteps.length > 0 && (
                            <div className="sequence-summary">
                                <div className="stat-label">Step Count</div>
                                <div className="stats-card-value">{selectedSequenceSteps.length}</div>
                            </div>
                        )}
                    </div>

                    <div className="widget">
                        <div className="widget-header">
                            <div className="widget-title">Preview Step 1</div>
                        </div>
                        {!previewStep ? (
                            <div className="preview-empty">Select or create a sequence to preview.</div>
                        ) : (
                            <div className="preview-pane">
                                {previewLeads.length === 0 && (
                                    <div className="preview-empty">Select leads to preview your first step.</div>
                                )}
                                {previewLeads.map((lead) => (
                                    <div key={lead.id} className="preview-item">
                                        <div className="preview-item-header">
                                            <span>{lead.name || 'Unnamed Lead'}</span>
                                            <span className="badge">{previewStep.channel}</span>
                                        </div>
                                        {previewStep.channel === 'email' && previewStep.subjectA && (
                                            <div className="preview-subject">
                                                Subject: {renderTemplate(previewStep.subjectA, lead)}
                                            </div>
                                        )}
                                        <div className="preview-body">
                                            {renderTemplate(previewStep.templateA, lead) || 'Add a template to preview.'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {error && <div className="campaigns-error">{error}</div>}

            <div className="campaign-builder-actions">
                <button className="hud-btn" type="button" disabled={!canSubmit} onClick={() => handleCreateCampaign(false)}>
                    Create Draft
                </button>
                <button className="hud-btn primary" type="button" disabled={!canSubmit} onClick={() => handleCreateCampaign(true)}>
                    Create & Activate
                </button>
            </div>
        </div>
    );
}
