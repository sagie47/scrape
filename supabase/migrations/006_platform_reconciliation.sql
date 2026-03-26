-- ============================================
-- Migration 006: Platform Reconciliation
-- Canonicalizes campaign/report schema around the normalized 004 model
-- and adds fields needed for maps ingestion, reports, branding, and exports.
-- ============================================

-- --------------------------------------------
-- 1. Jobs: extend enum and useful fields
-- --------------------------------------------
DO $$
BEGIN
  ALTER TYPE public.job_type ADD VALUE IF NOT EXISTS 'maps_import';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.job_type ADD VALUE IF NOT EXISTS 'lead_analysis';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.job_type ADD VALUE IF NOT EXISTS 'report_generation';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.job_type ADD VALUE IF NOT EXISTS 'outbound_export';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS ai_cost_units INT DEFAULT 0;

-- --------------------------------------------
-- 2. Leads: normalized prospect fields
-- --------------------------------------------
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS emails TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS source_external_id TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS maps_url TEXT,
  ADD COLUMN IF NOT EXISTS raw_source JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_analyzed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_report_id UUID,
  ADD COLUMN IF NOT EXISTS analysis_summary JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS leads_user_website_idx ON public.leads (user_id, website) WHERE website IS NOT NULL;
CREATE INDEX IF NOT EXISTS leads_user_email_idx ON public.leads (user_id, email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS leads_user_source_external_idx ON public.leads (user_id, source_external_id) WHERE source_external_id IS NOT NULL;

-- --------------------------------------------
-- 3. Job results: durable analysis payload fields
-- --------------------------------------------
ALTER TABLE public.job_results
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS thumbnail_key TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_path TEXT,
  ADD COLUMN IF NOT EXISTS analysis_version TEXT DEFAULT 'v2',
  ADD COLUMN IF NOT EXISTS analysis_kind TEXT DEFAULT 'cro';

CREATE INDEX IF NOT EXISTS job_results_lead_idx ON public.job_results (lead_id);

-- --------------------------------------------
-- 4. Canonical sequence + campaign schema
-- --------------------------------------------
ALTER TABLE public.sequences
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS tone TEXT DEFAULT 'professional',
  ADD COLUMN IF NOT EXISTS stop_rules JSONB DEFAULT '{"stop_on":["replied","booked"]}';

ALTER TABLE public.sequences
  ALTER COLUMN type SET DEFAULT 'email';

CREATE TABLE IF NOT EXISTS public.sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID REFERENCES public.sequences(id) ON DELETE CASCADE NOT NULL,
  step_order INT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'dm_task', 'call_task')),
  delay_days INT DEFAULT 0,
  template_a TEXT NOT NULL,
  template_b TEXT,
  subject_a TEXT,
  subject_b TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_step_order_per_sequence UNIQUE(sequence_id, step_order)
);

CREATE INDEX IF NOT EXISTS idx_sequence_steps_sequence ON public.sequence_steps(sequence_id);
CREATE INDEX IF NOT EXISTS idx_sequence_steps_order ON public.sequence_steps(sequence_id, step_order);

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS sequence_id UUID REFERENCES public.sequences(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS credits_spent INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ;

ALTER TABLE public.campaign_leads
  ADD COLUMN IF NOT EXISTS state TEXT DEFAULT 'queued',
  ADD COLUMN IF NOT EXISTS current_step_order INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS outcome TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.campaign_leads
SET state = CASE COALESCE(status, 'pending')
  WHEN 'pending' THEN 'queued'
  WHEN 'contacted' THEN 'in_progress'
  WHEN 'replied' THEN 'stopped'
  WHEN 'booked' THEN 'completed'
  WHEN 'unresponsive' THEN 'waiting'
  WHEN 'bounced' THEN 'stopped'
  ELSE COALESCE(state, 'queued')
END
WHERE state IS NULL OR state = '';

UPDATE public.campaign_leads
SET outcome = CASE COALESCE(status, '')
  WHEN 'replied' THEN 'replied'
  WHEN 'booked' THEN 'booked'
  WHEN 'bounced' THEN 'not_interested'
  ELSE outcome
END
WHERE outcome IS NULL;

ALTER TABLE public.campaign_leads
  DROP CONSTRAINT IF EXISTS campaign_leads_state_check;

ALTER TABLE public.campaign_leads
  ADD CONSTRAINT campaign_leads_state_check
  CHECK (state IN ('queued', 'in_progress', 'waiting', 'stopped', 'completed'));

ALTER TABLE public.campaign_leads
  DROP CONSTRAINT IF EXISTS campaign_leads_outcome_check;

ALTER TABLE public.campaign_leads
  ADD CONSTRAINT campaign_leads_outcome_check
  CHECK (outcome IN ('replied', 'booked', 'not_interested', 'none') OR outcome IS NULL);

CREATE INDEX IF NOT EXISTS idx_campaign_leads_state ON public.campaign_leads(state);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_next_due ON public.campaign_leads(campaign_id, next_due_at);

CREATE TABLE IF NOT EXISTS public.touch_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_lead_id UUID REFERENCES public.campaign_leads(id) ON DELETE CASCADE NOT NULL,
  step_id UUID REFERENCES public.sequence_steps(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'dm_task', 'call_task')),
  due_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'skipped')),
  variant TEXT CHECK (variant IN ('A', 'B')),
  rendered_subject TEXT,
  rendered_body TEXT NOT NULL,
  missing_fields TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_touch_tasks_campaign_lead ON public.touch_tasks(campaign_lead_id);
CREATE INDEX IF NOT EXISTS idx_touch_tasks_due ON public.touch_tasks(due_at);
CREATE INDEX IF NOT EXISTS idx_touch_tasks_status ON public.touch_tasks(campaign_lead_id, status);

CREATE TABLE IF NOT EXISTS public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_lead_id UUID REFERENCES public.campaign_leads(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_campaign_lead ON public.activities(campaign_lead_id);
CREATE INDEX IF NOT EXISTS idx_activities_created ON public.activities(created_at DESC);

CREATE TABLE IF NOT EXISTS public.outreach_atoms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  job_result_id UUID REFERENCES public.job_results(id) ON DELETE SET NULL,
  subject_lines TEXT[] DEFAULT '{}',
  openers TEXT[] DEFAULT '{}',
  problem_bullets TEXT[] DEFAULT '{}',
  quick_win_bullets TEXT[] DEFAULT '{}',
  proof_points TEXT[] DEFAULT '{}',
  cta_options TEXT[] DEFAULT '{}',
  call_openers TEXT[] DEFAULT '{}',
  objection_handles TEXT[] DEFAULT '{}',
  dm_one_liners TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_atoms_lead ON public.outreach_atoms(lead_id);
CREATE INDEX IF NOT EXISTS idx_outreach_atoms_latest ON public.outreach_atoms(lead_id, created_at DESC);

ALTER TABLE public.outreach_scripts
  ADD COLUMN IF NOT EXISTS campaign_lead_id UUID REFERENCES public.campaign_leads(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ;

-- --------------------------------------------
-- 5. Artifacts: canonical report shape
-- --------------------------------------------
ALTER TABLE public.artifacts
  ADD COLUMN IF NOT EXISTS kind TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

UPDATE public.artifacts
SET kind = COALESCE(kind, type, 'mini_audit');

ALTER TABLE public.artifacts
  ALTER COLUMN kind SET DEFAULT 'mini_audit';

ALTER TABLE public.artifacts
  DROP CONSTRAINT IF EXISTS artifacts_kind_check;

ALTER TABLE public.artifacts
  ADD CONSTRAINT artifacts_kind_check
  CHECK (kind IN ('mini_audit', 'pdf_report', 'intelligence_report_html', 'intelligence_report_pdf'));

CREATE INDEX IF NOT EXISTS idx_artifacts_kind ON public.artifacts(kind);

-- --------------------------------------------
-- 6. Settings + outbound + metering
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS public.outbound_destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('webhook', 'smartlead', 'mailead')),
  target_url TEXT,
  headers JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outbound_destinations_user ON public.outbound_destinations(user_id);

CREATE TABLE IF NOT EXISTS public.usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  artifact_id UUID REFERENCES public.artifacts(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  units INT NOT NULL DEFAULT 1,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_user_created ON public.usage_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_event_type ON public.usage_events(event_type);

-- --------------------------------------------
-- 7. RLS for new tables
-- --------------------------------------------
ALTER TABLE public.outbound_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.touch_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_atoms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own outbound destinations" ON public.outbound_destinations;
CREATE POLICY "Users manage own outbound destinations" ON public.outbound_destinations
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users see own usage events" ON public.usage_events;
CREATE POLICY "Users see own usage events" ON public.usage_events
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users see own sequence_steps" ON public.sequence_steps;
CREATE POLICY "Users see own sequence_steps" ON public.sequence_steps
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.sequences s
      WHERE s.id = sequence_steps.sequence_id
      AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users see own touch_tasks" ON public.touch_tasks;
CREATE POLICY "Users see own touch_tasks" ON public.touch_tasks
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.campaign_leads cl
      JOIN public.campaigns c ON c.id = cl.campaign_id
      WHERE cl.id = touch_tasks.campaign_lead_id
      AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users see own activities" ON public.activities;
CREATE POLICY "Users see own activities" ON public.activities
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.campaign_leads cl
      JOIN public.campaigns c ON c.id = cl.campaign_id
      WHERE cl.id = activities.campaign_lead_id
      AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users see own outreach_atoms" ON public.outreach_atoms;
CREATE POLICY "Users see own outreach_atoms" ON public.outreach_atoms
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.leads l
      WHERE l.id = outreach_atoms.lead_id
      AND l.user_id = auth.uid()
    )
  );
