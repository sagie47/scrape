/**
 * Rendering Service - Template rendering with fallbacks
 * 
 * Single source of truth for rendering step templates.
 * Guarantees: never empty body, always returns missingFields[]
 */

/**
 * Render a step template with lead context
 * 
 * @param {Object} params
 * @param {Object} params.step - Sequence step
 * @param {Object} params.lead - Lead data
 * @param {string} params.template - Template text (after A/B selection)
 * @param {string} [params.subject] - Subject template (for email)
 * @param {Object} [params.atoms] - Outreach atoms for this lead
 * @param {Object} [params.analysis] - Job result analysis
 * @returns {{ subject?: string, body: string, missingFields: string[] }}
 */
export function renderStep({ step, lead, template, subject, atoms, analysis }) {
    const context = buildContext(lead, atoms, analysis);
    const fallbacks = getDefaultFallbacks();

    const bodyResult = render(template, context, fallbacks);
    const subjectResult = subject ? render(subject, context, fallbacks) : { result: null, missingFields: [] };

    // Combine missing fields
    const allMissing = [...new Set([...bodyResult.missingFields, ...subjectResult.missingFields])];

    // GUARANTEE: never return empty body
    const finalBody = bodyResult.result || getFallbackBody(step.channel, lead);

    return {
        subject: subjectResult.result,
        body: finalBody,
        missingFields: allMissing
    };
}

/**
 * Core template rendering function
 * 
 * @param {string} template - Template with {{variable}} placeholders
 * @param {Object} context - Variable values (dot notation supported)
 * @param {Object} fallbacks - Fallback values for missing variables
 * @returns {{ result: string, missingFields: string[] }}
 */
export function render(template, context = {}, fallbacks = {}) {
    if (!template) {
        return { result: "", missingFields: [] };
    }

    const missingFields = [];
    const variablePattern = /\{\{([^}]+)\}\}/g;

    const result = template.replace(variablePattern, (match, varPath) => {
        const trimmedPath = varPath.trim();
        let value = getNestedValue(context, trimmedPath);

        if (value === undefined || value === null || value === "") {
            if (fallbacks[trimmedPath] !== undefined) {
                value = fallbacks[trimmedPath];
            } else {
                missingFields.push(trimmedPath);
                value = `[${trimmedPath}]`; // Safe placeholder
            }
        }

        return String(value);
    });

    return { result, missingFields };
}

/**
 * Extract all variable names from a template
 */
export function extractVariables(template) {
    if (!template) return [];

    const variablePattern = /\{\{([^}]+)\}\}/g;
    const variables = [];
    let match;

    while ((match = variablePattern.exec(template)) !== null) {
        variables.push(match[1].trim());
    }

    return [...new Set(variables)];
}

/**
 * Validate template has all required variables in context
 */
export function validateTemplate(template, context) {
    const variables = extractVariables(template);
    const missing = variables.filter(v => getNestedValue(context, v) === undefined);
    return {
        valid: missing.length === 0,
        missing
    };
}

// ============================================================================
// Private Helpers
// ============================================================================

function buildContext(lead = {}, atoms = {}, analysis = {}) {
    return {
        lead: {
            name: lead.name || "",
            first_name: extractFirstName(lead.name),
            email: lead.email || "",
            phone: lead.phone || "",
            website: lead.website || "",
            address: lead.address || "",
            company: lead.name || "" // Alias
        },
        atoms: {
            opener: atoms.openers?.[0] || "",
            openers: atoms.openers || [],
            problem: atoms.problem_bullets?.[0] || "",
            problems: atoms.problem_bullets || [],
            win: atoms.quick_win_bullets?.[0] || "",
            wins: atoms.quick_win_bullets || [],
            cta: atoms.cta_options?.[0] || "",
            subject: atoms.subject_lines?.[0] || "",
            call_opener: atoms.call_openers?.[0] || "",
            objection: atoms.objection_handles?.[0] || "",
            dm: atoms.dm_one_liners?.[0] || ""
        },
        analysis: {
            summary: analysis.report?.summary || "",
            confidence: analysis.report?.confidence || 0,
            issues: analysis.report?.issues || [],
            issue: analysis.report?.issues?.[0] || "",
            wins: analysis.report?.quick_wins || [],
            win: analysis.report?.quick_wins?.[0] || ""
        },
        audit_link: "[audit pending]" // Will be replaced by artifact service
    };
}

function getDefaultFallbacks() {
    return {
        "lead.first_name": "there",
        "lead.company": "your company",
        "atoms.opener": "I noticed your website and wanted to reach out.",
        "atoms.problem": "potential areas for improvement",
        "atoms.win": "quick optimizations that could help",
        "atoms.cta": "Would you be open to a quick chat?",
        "analysis.issue": "some conversion opportunities",
        "analysis.win": "easy improvements",
        "audit_link": "[audit pending]"
    };
}

function getFallbackBody(channel, lead) {
    const name = lead?.name || "there";
    switch (channel) {
        case "email":
            return `Hi ${name},\n\nI wanted to reach out about your website. I noticed some opportunities that could help improve your conversions.\n\nWould you be open to a brief discussion?\n\nBest regards`;
        case "dm_task":
            return `Hi ${name}! I checked out your website and had some ideas that might help. Mind if I share?`;
        case "call_task":
            return `Script: Introduce yourself → Reference their website → Ask about their marketing goals → Offer insights`;
        default:
            return `Hi ${name}, I wanted to reach out about a few opportunities I noticed.`;
    }
}

function extractFirstName(fullName) {
    if (!fullName) return "";
    return fullName.split(" ")[0];
}

function getNestedValue(obj, path) {
    return path.split(".").reduce((acc, part) => {
        if (acc === undefined || acc === null) return undefined;
        return acc[part];
    }, obj);
}
