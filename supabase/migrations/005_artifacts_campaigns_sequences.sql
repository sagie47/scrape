-- Migration 005: Artifacts, Campaigns, and Sequences Tables
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. ARTIFACTS TABLE (for mini audit sharing)
-- ============================================
CREATE TABLE IF NOT EXISTS public.artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
    type TEXT NOT NULL DEFAULT 'mini_audit' CHECK (type IN ('mini_audit', 'report', 'other')),
    storage_key TEXT NOT NULL,
    share_token TEXT NOT NULL UNIQUE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_artifacts_user_id ON public.artifacts(user_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_lead_id ON public.artifacts(lead_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_campaign_id ON public.artifacts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_share_token ON public.artifacts(share_token);
CREATE INDEX IF NOT EXISTS idx_artifacts_type ON public.artifacts(type);

-- RLS for artifacts
ALTER TABLE public.artifacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own artifacts" ON public.artifacts;
CREATE POLICY "Users can view own artifacts"
    ON public.artifacts FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own artifacts" ON public.artifacts;
CREATE POLICY "Users can create own artifacts"
    ON public.artifacts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own artifacts" ON public.artifacts;
CREATE POLICY "Users can delete own artifacts"
    ON public.artifacts FOR DELETE
    USING (auth.uid() = user_id);

-- Public access for share tokens
DROP POLICY IF EXISTS "Public can view artifacts by share token" ON public.artifacts;
CREATE POLICY "Public can view artifacts by share token"
    ON public.artifacts FOR SELECT
    USING (
        share_token IS NOT NULL
        AND (expires_at IS NULL OR expires_at > NOW())
    );

-- ============================================
-- 2. CAMPAIGNS TABLE (MVP1)
-- ============================================
CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
    lead_source TEXT,
    keywords TEXT[],
    filters JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    stats JSONB DEFAULT '{"total": 0, "sent": 0, "replied": 0, "booked": 0}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON public.campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON public.campaigns(created_at DESC);

-- RLS for campaigns
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own campaigns" ON public.campaigns;
CREATE POLICY "Users can view own campaigns"
    ON public.campaigns FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own campaigns" ON public.campaigns;
CREATE POLICY "Users can create own campaigns"
    ON public.campaigns FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own campaigns" ON public.campaigns;
CREATE POLICY "Users can update own campaigns"
    ON public.campaigns FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own campaigns" ON public.campaigns;
CREATE POLICY "Users can delete own campaigns"
    ON public.campaigns FOR DELETE
    USING (auth.uid() = user_id);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_campaign_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_campaigns_updated ON public.campaigns;
CREATE TRIGGER on_campaigns_updated
    BEFORE UPDATE ON public.campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_campaign_updated_at();

-- ============================================
-- 3. CAMPAIGN_LEADS TABLE (junction table)
-- ============================================
CREATE TABLE IF NOT EXISTS public.campaign_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'replied', 'booked', 'unresponsive', 'bounced')),
    current_step TEXT DEFAULT 'outreach',
    next_task TEXT,
    notes TEXT,
    contacted_at TIMESTAMPTZ,
    replied_at TIMESTAMPTZ,
    booked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(campaign_id, lead_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign_id ON public.campaign_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_lead_id ON public.campaign_leads(lead_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_status ON public.campaign_leads(status);

-- RLS for campaign_leads
ALTER TABLE public.campaign_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own campaign_leads" ON public.campaign_leads;
CREATE POLICY "Users can manage own campaign_leads"
    ON public.campaign_leads FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.campaigns
            WHERE campaigns.id = campaign_leads.campaign_id
            AND campaigns.user_id = auth.uid()
        )
    );

-- Update timestamp trigger
DROP TRIGGER IF EXISTS on_campaign_leads_updated ON public.campaign_leads;
CREATE TRIGGER on_campaign_leads_updated
    BEFORE UPDATE ON public.campaign_leads
    FOR EACH ROW
    EXECUTE FUNCTION update_campaign_updated_at();

-- ============================================
-- 4. OUTREACH_SCRIPTS TABLE (stores generated scripts)
-- ============================================
CREATE TABLE IF NOT EXISTS public.outreach_scripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_lead_id UUID REFERENCES public.campaign_leads(id) ON DELETE CASCADE,
    job_result_id UUID REFERENCES public.job_results(id) ON DELETE SET NULL,
    email_subject TEXT,
    email_body TEXT,
    sms_text TEXT,
    phone_script TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'opened', 'replied', 'bounced')),
    sent_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    replied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_scripts_campaign_lead_id ON public.outreach_scripts(campaign_lead_id);
CREATE INDEX IF NOT EXISTS idx_outreach_scripts_job_result_id ON public.outreach_scripts(job_result_id);
CREATE INDEX IF NOT EXISTS idx_outreach_scripts_status ON public.outreach_scripts(status);

-- RLS for outreach_scripts
ALTER TABLE public.outreach_scripts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own outreach_scripts" ON public.outreach_scripts;
CREATE POLICY "Users can manage own outreach_scripts"
    ON public.outreach_scripts FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.campaign_leads
            INNER JOIN public.campaigns ON campaigns.id = campaign_leads.campaign_id
            WHERE campaign_leads.id = outreach_scripts.campaign_lead_id
            AND campaigns.user_id = auth.uid()
        )
    );

-- Update timestamp trigger
DROP TRIGGER IF EXISTS on_outreach_scripts_updated ON public.outreach_scripts;
CREATE TRIGGER on_outreach_scripts_updated
    BEFORE UPDATE ON public.outreach_scripts
    FOR EACH ROW
    EXECUTE FUNCTION update_campaign_updated_at();

-- ============================================
-- 5. SEQUENCES TABLE (email/SMS sequences)
-- ============================================
CREATE TABLE IF NOT EXISTS public.sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('email', 'sms', 'phone')),
    description TEXT,
    steps JSONB NOT NULL DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sequences_user_id ON public.sequences(user_id);
CREATE INDEX IF NOT EXISTS idx_sequences_type ON public.sequences(type);

-- RLS for sequences
ALTER TABLE public.sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own sequences" ON public.sequences;
CREATE POLICY "Users can view own sequences"
    ON public.sequences FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own sequences" ON public.sequences;
CREATE POLICY "Users can create own sequences"
    ON public.sequences FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own sequences" ON public.sequences;
CREATE POLICY "Users can update own sequences"
    ON public.sequences FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own sequences" ON public.sequences;
CREATE POLICY "Users can delete own sequences"
    ON public.sequences FOR DELETE
    USING (auth.uid() = user_id);

-- Update timestamp trigger
DROP TRIGGER IF EXISTS on_sequences_updated ON public.sequences;
CREATE TRIGGER on_sequences_updated
    BEFORE UPDATE ON public.sequences
    FOR EACH ROW
    EXECUTE FUNCTION update_campaign_updated_at();

-- ============================================
-- 6. ATOMS TABLE (for Agent A's step rendering)
-- ============================================
CREATE TABLE IF NOT EXISTS public.atoms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('opener', 'value_prop', 'social_proof', 'urgency', 'cta')),
    key TEXT NOT NULL,
    value JSONB NOT NULL,
    category TEXT,
    source TEXT DEFAULT 'manual',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_atoms_user_id ON public.atoms(user_id);
CREATE INDEX IF NOT EXISTS idx_atoms_lead_id ON public.atoms(lead_id);
CREATE INDEX IF NOT EXISTS idx_atoms_campaign_id ON public.atoms(campaign_id);
CREATE INDEX IF NOT EXISTS idx_atoms_type ON public.atoms(type);
CREATE INDEX IF NOT EXISTS idx_atoms_category ON public.atoms(category);

-- RLS for atoms
ALTER TABLE public.atoms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own atoms" ON public.atoms;
CREATE POLICY "Users can view own atoms"
    ON public.atoms FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own atoms" ON public.atoms;
CREATE POLICY "Users can create own atoms"
    ON public.atoms FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own atoms" ON public.atoms;
CREATE POLICY "Users can update own atoms"
    ON public.atoms FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own atoms" ON public.atoms;
CREATE POLICY "Users can delete own atoms"
    ON public.atoms FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- 7. ENABLE REALTIME FOR NEW TABLES
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaigns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.artifacts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.atoms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sequences;
