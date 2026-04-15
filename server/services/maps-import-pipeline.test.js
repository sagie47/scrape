import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = {
  updateJob: vi.fn(),
  logEvent: vi.fn(),
  saveLeads: vi.fn(),
  mergeJobMetadata: vi.fn(),
  completeJob: vi.fn()
};

const mockRunMapsScraper = vi.fn();

vi.mock('./db.js', () => mockDb);
vi.mock('./maps-scraper-adapter.js', () => ({
  runMapsScraper: mockRunMapsScraper
}));

const { importMapsLeads } = await import('./maps-import-pipeline.js');

describe('importMapsLeads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs the ingestion pipeline and persists normalized leads with job metadata', async () => {
    mockRunMapsScraper.mockResolvedValue({
      provider: 'local-docker',
      version: 'gosom/google-maps-scraper:latest',
      results: [
        {
          title: 'Alpha Plumbing',
          address: '123 Main St, Austin, TX',
          phone: '+1 512-555-0100',
          web_site: 'alphaplumbing.com',
          review_rating: 4.8,
          review_count: 128,
          latitude: 30.2672,
          longtitude: -97.7431,
          place_id: 'place-alpha',
          emails: ['hello@alphaplumbing.com'],
          link: 'https://maps.google.com/?cid=cid-alpha'
        },
        {
          title: 'Alpha Plumbing',
          address: '123 Main St, Austin, TX',
          phone: '+1 512-555-0100',
          web_site: 'alphaplumbing.com',
          place_id: 'place-alpha'
        },
        {
          title: '',
          address: '',
          phone: ''
        }
      ]
    });

    mockDb.saveLeads.mockResolvedValue([
      {
        id: 'lead-1',
        name: 'Alpha Plumbing',
        website: 'https://alphaplumbing.com/'
      }
    ]);

    const result = await importMapsLeads({
      userId: 'user-1',
      keyword: 'plumbers',
      location: 'Austin, TX',
      limit: 10,
      jobId: 'job-1'
    });

    expect(mockRunMapsScraper).toHaveBeenCalledWith({
      query: 'plumbers in Austin, TX',
      limit: 10
    });
    expect(mockDb.saveLeads).toHaveBeenCalledTimes(1);
    expect(mockDb.saveLeads.mock.calls[0][2]).toMatchObject({
      jobId: 'job-1',
      keyword: 'plumbers',
      location: 'Austin, TX',
      source: 'google-maps-scraper',
      provider: 'local-docker'
    });
    expect(mockDb.mergeJobMetadata).toHaveBeenCalledWith('job-1', {
      leadImport: expect.objectContaining({
        rawCount: 3,
        normalizedCount: 1,
        invalidCount: 1,
        duplicateCount: 1,
        savedCount: 1
      })
    });
    expect(mockDb.completeJob).toHaveBeenCalledWith('job-1', 1);
    expect(result.leads).toHaveLength(1);
  });

  it('fails when the scraper returns no valid leads', async () => {
    mockRunMapsScraper.mockResolvedValue({
      provider: 'local-docker',
      version: 'gosom/google-maps-scraper:latest',
      results: [
        {
          title: '',
          address: '',
          phone: ''
        }
      ]
    });

    await expect(importMapsLeads({
      userId: 'user-1',
      keyword: 'plumbers',
      location: 'Austin, TX',
      limit: 10,
      jobId: 'job-1'
    })).rejects.toThrow('Maps scraper returned no valid leads.');

    expect(mockDb.saveLeads).not.toHaveBeenCalled();
    expect(mockDb.completeJob).not.toHaveBeenCalled();
  });
});
