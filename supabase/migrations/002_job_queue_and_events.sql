-- ============================================
-- Migration 002: Job Queue + Events + Outreach
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. JOB QUEUE ENHANCEMENTS
-- ============================================

-- Add started_at for tracking
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

-- Update status enum to include 'queued'
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_status_check 
  CHECK (status IN ('queued', 'pending', 'running', 'done', 'error', 'stopped'));

-- Update default status to 'queued'
ALTER TABLE public.jobs ALTER COLUMN status SET DEFAULT 'queued';

-- ============================================
-- 2. CLAIM FUNCTION (Postgres Job Queue)
-- ============================================

CREATE OR REPLACE FUNCTION public.claim_next_job()
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE 
  claimed_job public.jobs;
BEGIN
  -- Select and lock the oldest queued job
  SELECT * INTO claimed_job
  FROM public.jobs
  WHERE status = 'queued'
  ORDER BY created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  -- If no job found, return null
  IF claimed_job.id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Update to running
  UPDATE public.jobs
  SET status = 'running', started_at = NOW()
  WHERE id = claimed_job.id
  RETURNING * INTO claimed_job;

  RETURN claimed_job;
END;
$$;

-- ============================================
-- 3. JOB EVENTS TABLE (Logging)
-- ============================================

CREATE TABLE IF NOT EXISTS public.job_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error', 'debug')),
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_events_job_id ON public.job_events(job_id);
CREATE INDEX IF NOT EXISTS idx_job_events_created_at ON public.job_events(created_at DESC);

-- RLS for job_events
ALTER TABLE public.job_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own job events" ON public.job_events;
CREATE POLICY "Users can view own job events" 
ON public.job_events FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.jobs 
        WHERE jobs.id = job_events.job_id 
        AND jobs.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Service can insert events" ON public.job_events;
CREATE POLICY "Service can insert events"
ON public.job_events FOR INSERT
WITH CHECK (true); -- Worker uses service role, bypasses RLS anyway

-- ============================================
-- 4. OUTREACH SCRIPTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.outreach_scripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    result_id UUID REFERENCES public.job_results(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    email_subject TEXT,
    email_body TEXT,
    sms_text TEXT,
    phone_script TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT outreach_has_parent CHECK (result_id IS NOT NULL OR lead_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_outreach_result ON public.outreach_scripts(result_id);
CREATE INDEX IF NOT EXISTS idx_outreach_lead ON public.outreach_scripts(lead_id);

-- RLS for outreach_scripts
ALTER TABLE public.outreach_scripts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own outreach" ON public.outreach_scripts;
CREATE POLICY "Users can manage own outreach"
ON public.outreach_scripts FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.job_results jr
        JOIN public.jobs j ON jr.job_id = j.id
        WHERE jr.id = outreach_scripts.result_id
        AND j.user_id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = outreach_scripts.lead_id
        AND l.user_id = auth.uid()
    )
);

-- ============================================
-- 5. REALTIME FOR NEW TABLES
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.job_events;

-- ============================================
-- 6. HELPER FUNCTION: Log job event
-- ============================================

CREATE OR REPLACE FUNCTION public.log_job_event(
    p_job_id UUID,
    p_level TEXT,
    p_message TEXT,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    event_id UUID;
BEGIN
    INSERT INTO public.job_events (job_id, level, message, metadata)
    VALUES (p_job_id, p_level, p_message, p_metadata)
    RETURNING id INTO event_id;
    
    RETURN event_id;
END;
$$;
