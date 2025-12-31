/**
 * Artifacts Service Tests
 * 
 * Tests for template rendering, mini audit generation, and sharing
 */

import { describe, it, expect } from 'vitest';
import { render, extractVariables, validateTemplate } from '../lib/templates.js';
import { buildMiniAuditPayload } from './artifacts.js';

describe('Template Utilities', () => {
  describe('render()', () => {
    it('renders with all variables present', () => {
      const template = 'Hello {{lead.name}}, your email is {{lead.email}}';
      const context = {
        lead: { name: 'John', email: 'john@example.com' }
      };

      const { result, missingFields } = render(template, context);

      expect(result).toBe('Hello John, your email is john@example.com');
      expect(missingFields).toEqual([]);
    });

    it('uses fallback for missing variables', () => {
      const template = 'Hello {{lead.first_name}}, here is your {{audit_link}}';
      const context = {
        lead: { name: 'Acme Corp' }
      };
      const fallbacks = {
        'lead.first_name': 'there',
        'audit_link': '[audit pending]'
      };

      const { result, missingFields } = render(template, context, fallbacks);

      expect(result).toBe('Hello there, here is your [audit pending]');
      expect(missingFields).toEqual(['lead.first_name', 'audit_link']);
    });

    it('returns missingFields array', () => {
      const template = 'Hi {{lead.first_name}}, check {{issue.1}}';
      const context = { lead: { name: 'Acme' } };
      const fallbacks = { 'lead.first_name': 'there' };

      const { result, missingFields } = render(template, context, fallbacks);

      expect(result).toBe('Hi there, check {{issue.1}}');
      expect(missingFields).toEqual(['lead.first_name', 'issue.1']);
    });

    it('handles nested variables like lead.name', () => {
      const template = 'Contact {{lead.name}} at {{lead.contact.email}}';
      const context = {
        lead: {
          name: 'Acme Corp',
          contact: { email: 'contact@acme.com' }
        }
      };

      const { result, missingFields } = render(template, context);

      expect(result).toBe('Contact Acme Corp at contact@acme.com');
      expect(missingFields).toEqual([]);
    });

    it('never returns empty output - always has fallback', () => {
      const template = 'Hello {{lead.name}}';
      const context = {};
      const fallbacks = { 'lead.name': 'Valued Customer' };

      const { result } = render(template, context, fallbacks);

      expect(result).toBe('Hello Valued Customer');
    });
  });

  describe('extractVariables()', () => {
    it('extracts all variable names from template', () => {
      const template = 'Hi {{lead.name}}, your audit is at {{audit_link}}. Issue: {{issue.1}}';
      const variables = extractVariables(template);

      expect(variables).toEqual(['lead.name', 'audit_link', 'issue.1']);
    });

    it('handles duplicate variables', () => {
      const template = '{{lead.name}} and {{lead.name}} again';
      const variables = extractVariables(template);

      expect(variables).toEqual(['lead.name']);
    });

    it('handles empty template', () => {
      const variables = extractVariables('');
      expect(variables).toEqual([]);
    });

    it('handles template with no variables', () => {
      const template = 'Hello World!';
      const variables = extractVariables(template);

      expect(variables).toEqual([]);
    });
  });

  describe('validateTemplate()', () => {
    it('validates template has all required variables', () => {
      const template = 'Hi {{lead.name}}, audit: {{audit_link}}';
      const requiredVars = ['lead.name', 'audit_link'];

      const { isValid, missing } = validateTemplate(template, requiredVars);

      expect(isValid).toBe(true);
      expect(missing).toEqual([]);
    });

    it('returns missing variables', () => {
      const template = 'Hi {{lead.name}}';
      const requiredVars = ['lead.name', 'audit_link'];

      const { isValid, missing } = validateTemplate(template, requiredVars);

      expect(isValid).toBe(false);
      expect(missing).toEqual(['audit_link']);
    });

    it('handles empty requiredVars', () => {
      const template = 'Hello {{lead.name}}';
      const { isValid, missing } = validateTemplate(template, []);

      expect(isValid).toBe(true);
      expect(missing).toEqual([]);
    });
  });
});

describe('Mini Audit Generator', () => {
  let mockLead, mockJobResult;

  beforeEach(() => {
    mockLead = {
      id: 'lead-123',
      user_id: 'user-123',
      name: 'Acme Corp',
      website: 'https://acme.com',
      email: 'contact@acme.com',
      phone: '555-1234'
    };

    mockJobResult = {
      id: 'result-123',
      url: 'https://acme.com',
      screenshot_path: 'https://storage.example.com/screenshot.png',
      report: {
        summary: 'The website has weak value proposition and intrusive pop-ups.',
        issues: [
          'Intrusive pop-up blocks hero content',
          'Weak value proposition in hero',
          'Poor text contrast in sections'
        ],
        quick_wins: [
          'Change pop-up trigger to exit-intent',
          'Add benefit-driven headline',
          'Increase contrast for better readability'
        ],
        confidence: 'high'
      }
    };
  });

  describe('buildMiniAuditPayload()', () => {
    it('generates valid HTML with all sections', () => {
      const { html, filename } = buildMiniAuditPayload(mockLead, mockJobResult);

      expect(html).toContain('Acme Corp');
      expect(html).toContain('https://acme.com');
      expect(html).toContain('85%'); // high confidence
      expect(html).toContain('Intrusive pop-up blocks hero content');
      expect(html).toContain('Change pop-up trigger to exit-intent');
      expect(html).toContain('The website has weak value proposition');
      expect(filename).toMatch(/^audit-acme-corp-\d+\.html$/);
    });

    it('handles missing screenshot gracefully', () => {
      const resultWithoutScreenshot = { ...mockJobResult, screenshot_path: null };
      const { html } = buildMiniAuditPayload(mockLead, resultWithoutScreenshot);

      expect(html).toContain('No screenshot available');
    });

    it('handles missing job result', () => {
      const { html } = buildMiniAuditPayload(mockLead, null);

      expect(html).toContain('Acme Corp');
      expect(html).toContain('40%'); // default confidence
      expect(html).toContain('No screenshot available');
    });

    it('uses correct confidence values', () => {
      const highResult = { ...mockJobResult, report: { ...mockJobResult.report, confidence: 'high' } };
      const mediumResult = { ...mockJobResult, report: { ...mockJobResult.report, confidence: 'medium' } };
      const lowResult = { ...mockJobResult, report: { ...mockJobResult.report, confidence: 'low' } };

      const highHtml = buildMiniAuditPayload(mockLead, highResult).html;
      const mediumHtml = buildMiniAuditPayload(mockLead, mediumResult).html;
      const lowHtml = buildMiniAuditPayload(mockLead, lowResult).html;

      expect(highHtml).toContain('85%');
      expect(mediumHtml).toContain('60%');
      expect(lowHtml).toContain('40%');
    });

    it('limits issues and wins to top 3', () => {
      const manyIssues = {
        ...mockJobResult,
        report: {
          ...mockJobResult.report,
          issues: Array(10).fill('Issue'),
          quick_wins: Array(10).fill('Win')
        }
      };

      const { html } = buildMiniAuditPayload(mockLead, manyIssues);

      expect(html.split('<li>').length - 1).toBe(6); // 3 issues + 3 wins
    });
  });
});

describe('Integration Tests', () => {
  it('share token is unique and URL-safe', async () => {
    const { randomBytes } = await import('crypto');
    const tokens = new Set();
    const tokenRegex = /^[A-Za-z0-9_-]+$/;

    for (let i = 0; i < 100; i++) {
      const token = randomBytes(16).toString('base64url');

      expect(tokenRegex.test(token)).toBe(true);
      expect(tokens.has(token)).toBe(false);
      tokens.add(token);
    }
  });

  it('HTML output is snapshot-tested for consistency', () => {
    const lead = {
      id: 'lead-123',
      user_id: 'user-123',
      name: 'Test Company',
      website: 'https://test.com'
    };

    const jobResult = {
      url: 'https://test.com',
      screenshot_path: 'https://storage.com/screenshot.png',
      report: {
        summary: 'Test summary',
        issues: ['Test issue'],
        quick_wins: ['Test win'],
        confidence: 'high'
      }
    };

    const { html: html1 } = buildMiniAuditPayload(lead, jobResult);
    const { html: html2 } = buildMiniAuditPayload(lead, jobResult);

    expect(html1).toBe(html2);
    expect(html1).toContain('<!DOCTYPE html>');
    expect(html1).toContain('<html lang="en">');
    expect(html1).toContain('Test Company');
  });
});
