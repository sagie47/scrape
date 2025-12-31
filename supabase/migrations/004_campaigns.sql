-- MVP1 Campaigns Migration
-- Creates tables for sequences, campaigns, tasks, and activities

-- ============================================================================
-- OUTREACH ATOMS (structured AI output for templating)
-- ============================================================================
CREATE TABLE IF NOT EXISTS outreach_atoms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  job_result_id uuid REFERENCES job_results(id) ON DELETE SET NULL,
  subject_lines text[] DEFAULT '{}',
  openers text[] DEFAULT '{}',
  problem_bullets text[] DEFAULT '{}',
  quick_win_bullets text[] DEFAULT '{}',
  proof_points text[] DEFAULT '{}',
  cta_options text[] DEFAULT '{}',
  call_openers text[] DEFAULT '{}',
  objection_handles text[] DEFAULT '{}',
  dm_one_liners text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_outreach_atoms_lead ON outreach_atoms(lead_id);
CREATE INDEX idx_outreach_atoms_latest ON outreach_atoms(lead_id, created_at DESC);

-- ============================================================================
-- SEQUENCES (reusable multi-step outreach templates)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  tone text DEFAULT 'professional',
  stop_rules jsonb DEFAULT '{"stop_on": ["replied", "booked"]}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_sequences_user ON sequences(user_id);

-- ============================================================================
-- SEQUENCE STEPS (individual steps in a sequence)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sequence_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid REFERENCES sequences(id) ON DELETE CASCADE NOT NULL,
  step_order int NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'dm_task', 'call_task')),
  delay_days int DEFAULT 0,
  template_a text NOT NULL,
  template_b text,
  subject_a text,
  subject_b text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_step_order_per_sequence UNIQUE(sequence_id, step_order)
);

CREATE INDEX idx_sequence_steps_sequence ON sequence_steps(sequence_id);
CREATE INDEX idx_sequence_steps_order ON sequence_steps(sequence_id, step_order);

-- ============================================================================
-- CAMPAIGNS (lead + sequence enrollment)
-- ============================================================================
CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  sequence_id uuid REFERENCES sequences(id) ON DELETE SET NULL,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  credits_spent int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  start_at timestamptz
);

CREATE INDEX idx_campaigns_user ON campaigns(user_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);

-- ============================================================================
-- CAMPAIGN LEADS (leads enrolled in a campaign)
-- ============================================================================
CREATE TABLE IF NOT EXISTS campaign_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE NOT NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  state text DEFAULT 'queued' CHECK (state IN ('queued', 'in_progress', 'waiting', 'stopped', 'completed')),
  current_step_order int DEFAULT 0,
  next_due_at timestamptz,
  outcome text CHECK (outcome IN ('replied', 'booked', 'not_interested', 'none') OR outcome IS NULL),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(campaign_id, lead_id)
);

CREATE INDEX idx_campaign_leads_campaign ON campaign_leads(campaign_id);
CREATE INDEX idx_campaign_leads_state ON campaign_leads(state);
CREATE INDEX idx_campaign_leads_next_due ON campaign_leads(campaign_id, next_due_at);

-- ============================================================================
-- TOUCH TASKS (individual outreach actions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS touch_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_lead_id uuid REFERENCES campaign_leads(id) ON DELETE CASCADE NOT NULL,
  step_id uuid REFERENCES sequence_steps(id) ON DELETE SET NULL,
  channel text NOT NULL,
  due_at timestamptz NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'skipped')),
  variant text CHECK (variant IN ('A', 'B')),
  rendered_subject text,
  rendered_body text NOT NULL,
  missing_fields text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_touch_tasks_campaign_lead ON touch_tasks(campaign_lead_id);
CREATE INDEX idx_touch_tasks_due ON touch_tasks(due_at);
CREATE INDEX idx_touch_tasks_status ON touch_tasks(campaign_lead_id, status);

-- ============================================================================
-- ACTIVITIES (timeline events for campaign leads)
-- ============================================================================
CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_lead_id uuid REFERENCES campaign_leads(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL,
  meta jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_activities_campaign_lead ON activities(campaign_lead_id);
CREATE INDEX idx_activities_created ON activities(created_at DESC);

-- ============================================================================
-- ARTIFACTS (mini audits, shareable content)
-- ============================================================================
CREATE TABLE IF NOT EXISTS artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('mini_audit', 'pdf_report')),
  storage_key text NOT NULL,
  share_token text UNIQUE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_artifacts_user ON artifacts(user_id);
CREATE INDEX idx_artifacts_share_token ON artifacts(share_token);

-- ============================================================================
-- SCHEMA MODIFICATIONS (add lead_id to job_results, credits to jobs)
-- ============================================================================
ALTER TABLE job_results ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS ai_cost_units int DEFAULT 0;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE outreach_atoms ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE touch_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES (using EXISTS pattern for proper chain access)
-- ============================================================================

-- Sequences: direct user ownership
CREATE POLICY "Users see own sequences" ON sequences
  FOR ALL USING (user_id = auth.uid());

-- Sequence steps: user owns parent sequence
CREATE POLICY "Users see own sequence_steps" ON sequence_steps
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM sequences s
      WHERE s.id = sequence_steps.sequence_id
        AND s.user_id = auth.uid()
    )
  );

-- Campaigns: direct user ownership
CREATE POLICY "Users see own campaigns" ON campaigns
  FOR ALL USING (user_id = auth.uid());

-- Campaign leads: user owns parent campaign
CREATE POLICY "Users see own campaign_leads" ON campaign_leads
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      WHERE c.id = campaign_leads.campaign_id
        AND c.user_id = auth.uid()
    )
  );

-- Touch tasks: user owns campaign through campaign_leads -> campaigns
CREATE POLICY "Users see own touch_tasks" ON touch_tasks
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM campaign_leads cl
      JOIN campaigns c ON c.id = cl.campaign_id
      WHERE cl.id = touch_tasks.campaign_lead_id
        AND c.user_id = auth.uid()
    )
  );

-- Activities: same chain as touch_tasks
CREATE POLICY "Users see own activities" ON activities
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM campaign_leads cl
      JOIN campaigns c ON c.id = cl.campaign_id
      WHERE cl.id = activities.campaign_lead_id
        AND c.user_id = auth.uid()
    )
  );

-- Artifacts: direct user ownership
CREATE POLICY "Users see own artifacts" ON artifacts
  FOR ALL USING (user_id = auth.uid());

-- Public artifact sharing (read-only via share_token)
CREATE POLICY "Public can view shared artifacts" ON artifacts
  FOR SELECT USING (share_token IS NOT NULL);

-- Outreach atoms: user owns lead
CREATE POLICY "Users see own outreach_atoms" ON outreach_atoms
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM leads l
      WHERE l.id = outreach_atoms.lead_id
        AND l.user_id = auth.uid()
    )
  );
