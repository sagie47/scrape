# Lead Ingestion Regression Plan

## Objective

Prove that the new Google Maps ingestion path preserves current user-visible workflows while improving normalization, dedupe, and observability.

## What Must Keep Working

- `POST /scrape-leads`
- `GET /leads`
- `POST /analyze-leads`
- `POST /export-leads`
- `GET /export-my-leads`
- campaign lead selection and export flows
- artifact generation from saved leads

## Test Strategy

The regression suite should cover four layers:

1. Adapter contract tests.
2. Normalization and validation tests.
3. Pipeline integration tests.
4. Route compatibility tests.

## Fixture Set

Use gosom-shaped payloads with exact upstream field names.

### Fixture 1: Minimal valid lead

```json
{
  "title": "Kelowna Plumbing Co",
  "address": "123 Main St, Kelowna, BC",
  "phone": "+1 250 555 0100",
  "web_site": "https://kelownaplumbing.example",
  "review_rating": 4.8,
  "review_count": 142,
  "latitude": 49.888,
  "longtitude": -119.496,
  "cid": "1234567890123456789",
  "place_id": "ChIJ123",
  "emails": ["info@kelownaplumbing.example"],
  "complete_address": "123 Main St, Kelowna, BC V1X 1X1, Canada",
  "link": "https://www.google.com/maps?cid=1234567890123456789"
}
```

### Fixture 2: Rich lead with duplicates in `emails`

- repeated email addresses
- uppercase website / mixed-case email
- valid `place_id`
- valid `cid`

### Fixture 3: Duplicate candidate with different richness

- same `place_id`
- missing website in one record
- richer contact data in the other record

### Fixture 4: Missing `place_id`, fallback to `cid`

- no `place_id`
- valid `cid`
- should still dedupe within the run and across runs

### Fixture 5: Partial failure

- malformed `review_rating`
- invalid `latitude` or `longtitude`
- still emit a structured rejection rather than crashing the run

## Regression Cases

### Normalization

- `title` becomes `name`
- `web_site` becomes `website`
- `review_rating` becomes `rating`
- `review_count` becomes `reviews`
- `longtitude` becomes `longitude`
- `complete_address` is retained as `completeAddress`
- `link` is retained as `mapsUrl`

### Validation

- reject records without a usable business name
- reject records with unusable numeric fields only when those fields are needed for downstream compatibility
- accept records with partial data when identity fields exist

### Dedupe

- prefer `place_id` over all other keys
- fall back to `cid`
- then fall back to normalized `website`
- then fall back to normalized `name + address`

### Persistence

- ensure `db.saveLeads` or its compatible replacement still writes the fields downstream consumers expect
- ensure `source` identifies the new provider
- ensure saved leads remain usable by exports and campaigns

### Partial Failure Handling

- one bad raw row must not fail the entire run
- a run with mixed accepted and rejected rows should be marked partial
- the response should include counts for raw, accepted, duplicate, rejected, and persisted rows

### Observability

- run status should be visible
- error messages should include the stage
- counts should be emitted for raw, normalized, deduped, persisted, and rejected rows
- trace metadata should include keyword, location, provider mode, and request id

## Suggested Test Files

- `server/services/maps-normalizer.test.js`
- `server/services/maps-import-pipeline.test.js`
- `server/services/maps-scraper-adapter.test.js`
- `server/routes/leads.routes.test.js`

## Suggested Assertions

- raw gosom JSON is accepted as input
- invalid rows are rejected without throwing away valid rows
- duplicate rows collapse to one persisted lead
- `/scrape-leads` still returns `jobId` and `leads`
- downstream exports still see the normalized fields
- artifact generation can still read the saved lead shape

## Execution Commands

When the implementation lands, run the relevant tests and checks:

- `npx vitest run`
- `npx vitest run server/services/maps-normalizer.test.js`
- `npx vitest run server/services/maps-import-pipeline.test.js`

If route or schema behavior changes, add any needed integration coverage before cutover.

## Exit Criteria

- No regression in the current lead acquisition UI.
- No regression in saved lead shape used by exports and campaigns.
- Partial failures are visible and actionable.
- Duplicate suppression improves or remains stable against the current baseline.
