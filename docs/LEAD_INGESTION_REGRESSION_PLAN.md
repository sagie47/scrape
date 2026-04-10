# Lead Ingestion Regression Plan

## Goal

Verify that the Google Maps ingestion migration preserves current business workflows while improving normalization, dedupe, and observability.

## Test Areas

### 1. Normalization

- gosom rows map to the expected internal lead shape
- `web_site` becomes normalized `website`
- `review_rating` and `review_count` map cleanly
- first valid email is surfaced as `lead.email`
- `complete_address` fills `address` when direct `address` is absent

### 2. Validation

- rows without `name` are rejected
- rows without any durable contact or identity fields are rejected
- malformed URLs are dropped without crashing the import

### 3. Dedupe

- duplicate `place_id` rows collapse into one lead
- duplicate websites collapse into one lead when `place_id` is missing
- richer records win on collision

### 4. Persistence

- new leads insert successfully
- existing `place_id` leads update instead of duplicating
- keyword tags are merged
- `source` is `google-maps-scraper`
- `source_metadata` and `last_scraped_at` are populated

### 5. Route compatibility

- `POST /scrape-leads` still returns `{ jobId, leads, stats }`
- `GET /leads` still returns saved leads for the current user
- `POST /analyze-leads` still accepts returned leads with `website`

### 6. Downstream workflow safety

- campaign builder still reads lead rows
- lead export still works with saved lead records
- artifact generation still finds the lead by id
- memo/outreach generation still receives lead email/website/phone data as before

### 7. Observability

- job status transitions to `running` then `done` or `error`
- `job_events` capture invalid row counts, duplicate counts, and failures
- `jobs.metadata.leadImport` captures provider and row counts

## Automated Coverage Added

- `server/services/maps-normalizer.test.js`
- `server/services/maps-import-pipeline.test.js`
- `server/test/fixtures/gosom-sample-results.json`

## Manual Smoke Tests

### Local Docker provider

1. Configure:
   - `MAPS_SCRAPER_PROVIDER=docker`
2. Start the server with valid env vars.
3. Submit a small query such as `plumbers` + `Austin, TX`.
4. Confirm:
   - leads render in the scraper UI
   - `job_events` contain import diagnostics
   - lead export still downloads
   - analyze flow still starts for leads with websites

### Remote provider

1. Configure:
   - `MAPS_SCRAPER_PROVIDER=remote`
   - `MAPS_SCRAPER_BASE_URL`
2. Repeat the same query.
3. Confirm provider job id is written into metadata.

## Failure Cases To Exercise

- Docker unavailable
- remote provider timeout
- remote provider failed job
- zero valid leads after normalization
- mixed valid and invalid rows

## Exit Criteria

- normalization and pipeline tests pass
- client build passes
- `/scrape-leads` produces leads in the UI
- exports and analyze flow still work
- row-count telemetry is visible in job metadata and events
