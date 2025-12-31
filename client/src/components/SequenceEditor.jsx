import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';

const CHANNEL_OPTIONS = [
    { value: 'email', label: 'Email' },
    { value: 'dm_task', label: 'DM' },
    { value: 'call_task', label: 'Phone' }
];

const createStep = (channel = 'email') => ({
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    channel,
    delayDays: 0,
    subjectA: '',
    subjectB: '',
    templateA: '',
    templateB: ''
});

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

/**
 * @param {object} props
 * @param {SequenceStep[]} props.steps
 * @param {(next: SequenceStep[]) => void} props.onChange
 * @param {boolean} [props.readOnly]
 */
export default function SequenceEditor({ steps, onChange, readOnly = false }) {
    const updateStep = (index, updates) => {
        const next = steps.map((step, idx) => (idx === index ? { ...step, ...updates } : step));
        onChange(next);
    };

    const moveStep = (index, direction) => {
        const next = [...steps];
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= next.length) return;
        const [removed] = next.splice(index, 1);
        next.splice(newIndex, 0, removed);
        onChange(next);
    };

    const handleAddStep = () => {
        onChange([...steps, createStep()]);
    };

    const handleRemoveStep = (index) => {
        const next = steps.filter((_, idx) => idx !== index);
        onChange(next.length > 0 ? next : [createStep()]);
    };

    return (
        <div className="sequence-editor">
            {steps.map((step, index) => {
                const isEmail = step.channel === 'email';
                return (
                    <div key={step.id} className="sequence-step-card">
                        <div className="sequence-step-header">
                            <div className="sequence-step-title">Step {index + 1}</div>
                            <div className="sequence-step-actions">
                                <button
                                    className="icon-toggle"
                                    type="button"
                                    onClick={() => moveStep(index, -1)}
                                    disabled={readOnly || index === 0}
                                    aria-label="Move step up"
                                >
                                    <ChevronUp size={16} />
                                </button>
                                <button
                                    className="icon-toggle"
                                    type="button"
                                    onClick={() => moveStep(index, 1)}
                                    disabled={readOnly || index === steps.length - 1}
                                    aria-label="Move step down"
                                >
                                    <ChevronDown size={16} />
                                </button>
                                <button
                                    className="icon-toggle"
                                    type="button"
                                    onClick={() => handleRemoveStep(index)}
                                    disabled={readOnly}
                                    aria-label="Remove step"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="sequence-step-grid">
                            <label className="sequence-field">
                                <span className="stat-label">Channel</span>
                                <select
                                    className="hud-input"
                                    value={step.channel}
                                    disabled={readOnly}
                                    onChange={(event) => updateStep(index, { channel: event.target.value })}
                                >
                                    {CHANNEL_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="sequence-field">
                                <span className="stat-label">Delay (days)</span>
                                <input
                                    className="hud-input"
                                    type="number"
                                    min="0"
                                    value={step.delayDays}
                                    disabled={readOnly}
                                    onChange={(event) => updateStep(index, { delayDays: Number(event.target.value) })}
                                />
                            </label>
                        </div>

                        {isEmail && (
                            <div className="sequence-step-grid">
                                <label className="sequence-field">
                                    <span className="stat-label">Subject A</span>
                                    <input
                                        className="hud-input"
                                        value={step.subjectA}
                                        disabled={readOnly}
                                        placeholder="Subject line A"
                                        onChange={(event) => updateStep(index, { subjectA: event.target.value })}
                                    />
                                </label>
                                <label className="sequence-field">
                                    <span className="stat-label">Subject B</span>
                                    <input
                                        className="hud-input"
                                        value={step.subjectB}
                                        disabled={readOnly}
                                        placeholder="Subject line B"
                                        onChange={(event) => updateStep(index, { subjectB: event.target.value })}
                                    />
                                </label>
                            </div>
                        )}

                        <div className="sequence-step-grid">
                            <label className="sequence-field">
                                <span className="stat-label">Template A</span>
                                <textarea
                                    className="hud-input sequence-textarea"
                                    rows={4}
                                    value={step.templateA}
                                    disabled={readOnly}
                                    placeholder="Write template A..."
                                    onChange={(event) => updateStep(index, { templateA: event.target.value })}
                                />
                            </label>
                            <label className="sequence-field">
                                <span className="stat-label">Template B</span>
                                <textarea
                                    className="hud-input sequence-textarea"
                                    rows={4}
                                    value={step.templateB}
                                    disabled={readOnly}
                                    placeholder="Write template B..."
                                    onChange={(event) => updateStep(index, { templateB: event.target.value })}
                                />
                            </label>
                        </div>
                    </div>
                );
            })}

            {!readOnly && (
                <button className="hud-btn" type="button" onClick={handleAddStep}>
                    <Plus size={16} /> Add Step
                </button>
            )}
        </div>
    );
}
