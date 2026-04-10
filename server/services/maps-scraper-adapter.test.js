import { afterEach, describe, expect, it, vi } from 'vitest';

vi.stubEnv('SUPABASE_URL', 'http://localhost');
vi.stubEnv('SUPABASE_ANON_KEY', 'test');
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test');
vi.stubEnv('GEMINI_API_KEY', 'test');

const { runMapsScraper } = await import('./maps-scraper-adapter.js');

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('runMapsScraper', () => {
  it('rejects empty queries before invoking any provider', async () => {
    await expect(runMapsScraper({ query: '   ' })).rejects.toMatchObject({
      code: 'maps_scraper_query_missing',
      statusCode: 400
    });
  });
});
