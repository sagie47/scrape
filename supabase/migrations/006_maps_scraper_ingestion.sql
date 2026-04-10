-- Migration 006: Maps scraper ingestion metadata

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS source_metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS last_scraped_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS leads_user_email_idx
  ON public.leads (user_id, email)
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS leads_user_dedupe_key_idx
  ON public.leads (user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;
