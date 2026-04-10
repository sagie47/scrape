import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { describe, expect, it } from 'vitest';

import { normalizeMapsPlaces } from './maps-normalizer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadFixture() {
  const fixturePath = path.join(__dirname, '..', 'test', 'fixtures', 'gosom-sample-results.json');
  const raw = await fs.readFile(fixturePath, 'utf8');
  return JSON.parse(raw);
}

describe('normalizeMapsPlaces', () => {
  it('normalizes gosom rows, removes duplicates, and records invalid rows', async () => {
    const fixture = await loadFixture();

    const result = normalizeMapsPlaces(fixture, {
      query: 'plumbers in austin',
      limit: 10
    });

    expect(result.counts.raw).toBe(4);
    expect(result.counts.normalized).toBe(2);
    expect(result.counts.duplicates).toBe(1);
    expect(result.counts.invalid).toBe(1);

    expect(result.leads[0]).toMatchObject({
      name: 'Alpha Plumbing',
      website: 'https://alphaplumbing.com/',
      email: 'hello@alphaplumbing.com',
      placeId: 'place-alpha',
      mapsUrl: 'https://maps.google.com/?cid=cid-alpha'
    });

    expect(result.leads[1]).toMatchObject({
      name: 'Bravo Rooter',
      address: '456 Oak Ave, Austin, TX, 78701, USA',
      email: 'team@bravorooter.com'
    });

    expect(result.invalidRows[0].errors).toContain('missing_name');
  });
});
