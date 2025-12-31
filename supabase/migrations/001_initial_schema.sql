-- ============================================
-- Supabase Migration: Auth, Data Model, Storage
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. PROFILES TABLE (extends auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    display_name TEXT,
    avatar_url TEXT,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name)
    VALUES (
        NEW.id, 
        NEW.email, 
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);


-- ============================================
-- 2. JOBS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('batch', 'single', 'leads')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'error', 'stopped')),
    total INT DEFAULT 0,
    processed INT DEFAULT 0,
    progress INT DEFAULT 0,
    errors TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON public.jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON public.jobs(created_at DESC);

-- RLS for jobs
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own jobs" ON public.jobs;
CREATE POLICY "Users can view own jobs"
    ON public.jobs FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own jobs" ON public.jobs;
CREATE POLICY "Users can create own jobs"
    ON public.jobs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own jobs" ON public.jobs;
CREATE POLICY "Users can update own jobs"
    ON public.jobs FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own jobs" ON public.jobs;
CREATE POLICY "Users can delete own jobs"
    ON public.jobs FOR DELETE
    USING (auth.uid() = user_id);


-- ============================================
-- 3. JOB_RESULTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.job_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    row_index INT,
    url TEXT,
    name TEXT,
    screenshot_path TEXT,
    report JSONB,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_results_job_id ON public.job_results(job_id);

-- RLS for job_results
ALTER TABLE public.job_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view results of own jobs" ON public.job_results;
CREATE POLICY "Users can view results of own jobs"
    ON public.job_results FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.jobs
            WHERE jobs.id = job_results.job_id
            AND jobs.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert results for own jobs" ON public.job_results;
CREATE POLICY "Users can insert results for own jobs"
    ON public.job_results FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.jobs
            WHERE jobs.id = job_results.job_id
            AND jobs.user_id = auth.uid()
        )
    );


-- ============================================
-- 4. LEADS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    website TEXT,
    rating NUMERIC(2,1),
    reviews INT,
    coordinates JSONB,
    analysis JSONB,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_user_id ON public.leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_website ON public.leads(website);

-- RLS for leads
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own leads" ON public.leads;
CREATE POLICY "Users can manage own leads"
    ON public.leads FOR ALL
    USING (auth.uid() = user_id);


-- ============================================
-- 5. CREDITS TABLE (pricing tiers)
-- ============================================
CREATE TABLE IF NOT EXISTS public.credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    plan TEXT NOT NULL DEFAULT 'scout' CHECK (plan IN ('scout', 'operative', 'warlord')),
    total_credits INT NOT NULL DEFAULT 20,
    used_credits INT NOT NULL DEFAULT 0,
    period_start TIMESTAMPTZ DEFAULT NOW(),
    period_end TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);

-- Auto-create credits on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_credits()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.credits (user_id, plan, total_credits)
    VALUES (NEW.id, 'scout', 20);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_credits ON auth.users;
CREATE TRIGGER on_auth_user_created_credits
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_credits();

-- RLS for credits
ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own credits" ON public.credits;
CREATE POLICY "Users can view own credits"
    ON public.credits FOR SELECT
    USING (auth.uid() = user_id);


-- ============================================
-- 6. STORAGE BUCKET
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('scrape-storage', 'scrape-storage', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "Users can upload own files" ON storage.objects;
CREATE POLICY "Users can upload own files"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'scrape-storage'
    AND (storage.foldername(name))[1] IN ('uploads', 'screenshots', 'exports')
    AND (storage.foldername(name))[2] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can read own files" ON storage.objects;
CREATE POLICY "Users can read own files"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'scrape-storage'
    AND (storage.foldername(name))[2] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'scrape-storage'
    AND (storage.foldername(name))[2] = auth.uid()::text
);


-- ============================================
-- 7. ENABLE REALTIME
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
