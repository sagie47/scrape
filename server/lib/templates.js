/**
 * Template Utilities - Variable substitution with safe fallbacks
 * 
 * Supports {{variable}} placeholders with nested access like lead.name
 */

/**
 * Extract all variable names from template
 * @param {string} template - Template with {{variable}} placeholders
 * @returns {string[]} Array of variable paths (e.g., ['lead.name', 'audit_date'])
 */
export function extractVariables(template) {
  if (!template || typeof template !== 'string') return [];

  const regex = /\{\{([^}]+)\}\}/g;
  const variables = new Set();
  let match;

  while ((match = regex.exec(template)) !== null) {
    const variable = match[1].trim();
    variables.add(variable);
  }

  return Array.from(variables);
}

/**
 * Get value from nested object by path
 * @param {Object} obj - Source object
 * @param {string} path - Dot-notation path (e.g., 'lead.name')
 * @returns {*} Value or undefined
 */
function getNestedValue(obj, path) {
  if (!obj || !path) return undefined;

  return path.split('.').reduce((current, key) => {
    if (current != null && typeof current === 'object' && key in current) {
      return current[key];
    }
    return undefined;
  }, obj);
}

/**
 * Substitute variables in template string
 * @param {string} template - Template with {{variable}} placeholders
 * @param {Object} context - Variable values
 * @param {Object} fallbacks - Fallback values for missing variables
 * @returns {{ result: string, missingFields: string[] }}
 */
export function render(template, context = {}, fallbacks = {}) {
  if (!template || typeof template !== 'string') {
    return { result: '', missingFields: [] };
  }

  const variables = extractVariables(template);
  const missingFields = [];
  let result = template;

  // Process variables in reverse order of length (longer variables first) to avoid partial replacements
  const sortedVariables = [...variables].sort((a, b) => b.length - a.length);

  for (const variable of sortedVariables) {
    const value = getNestedValue(context, variable);
    const fallback = getNestedValue(fallbacks, variable);

    // Track if variable was missing from context
    if (value === undefined || value === null || value === '') {
      missingFields.push(variable);
    }

    // Determine replacement value
    let replacement;
    if (value !== undefined && value !== null && value !== '') {
      replacement = String(value);
    } else if (fallback !== undefined && fallback !== null && fallback !== '') {
      replacement = String(fallback);
    } else {
      replacement = `{{${variable}}}`;
    }

    // Replace variable (escape regex special chars)
    const escapedVariable = variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\{\\{\\s*${escapedVariable}\\s*\\}\\}`, 'g');
    result = result.replace(regex, replacement);
  }

  return { result, missingFields };
}

/**
 * Validate template has all required variables
 * @param {string} template - Template to validate
 * @param {string[]} requiredVars - Array of required variable paths
 * @returns { isValid: boolean, missing: string[] }
 */
export function validateTemplate(template, requiredVars) {
  if (!template || !requiredVars) {
    return { isValid: true, missing: [] };
  }

  const variables = extractVariables(template);
  const missing = requiredVars.filter(req => !variables.includes(req));

  return {
    isValid: missing.length === 0,
    missing
  };
}
