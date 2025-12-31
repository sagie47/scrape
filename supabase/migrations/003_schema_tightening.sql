-- ============================================
-- Migration 003: Schema Tightening
-- Enums, Constraints, Indexes, Updated RLS
-- ============================================

-- ============================================
-- 1. CREATE ENUMS (for type safety)
-- ============================================

-- Create job_type enum
DO $$ BEGIN
    CREATE TYPE public.job_type AS ENUM ('batch', 'single', 'leads');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create job_status enum  
DO $$ BEGIN
    CREATE TYPE public.job_status AS ENUM ('queued', 'running', 'done', 'error', 'stopped');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create log_level enum
DO $$ BEGIN
    CREATE TYPE public.log_level AS ENUM ('debug', 'info', 'warn', 'error');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 2. ALTER JOBS TABLE
-- ============================================

-- Drop old CHECK constraints
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_type_check;
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;

-- Drop defaults before type conversion (required for enum casts)
ALTER TABLE public.jobs ALTER COLUMN type DROP DEFAULT;
ALTER TABLE public.jobs ALTER COLUMN status DROP DEFAULT;

-- Migrate type column to enum
ALTER TABLE public.jobs 
    ALTER COLUMN type TYPE public.job_type USING type::public.job_type;

-- Migrate status column to enum (handle 'pending' -> 'queued' first)
UPDATE public.jobs SET status = 'queued' WHERE status = 'pending';
ALTER TABLE public.jobs 
    ALTER COLUMN status TYPE public.job_status USING status::public.job_status;

-- Re-add defaults after type conversion
ALTER TABLE public.jobs ALTER COLUMN status SET DEFAULT 'queued';

-- Rename total to total_urls (clearer naming)
DO $$ BEGIN
    ALTER TABLE public.jobs RENAME COLUMN total TO total_urls;
EXCEPTION
    WHEN undefined_column THEN 
        -- Column might already be named total_urls
        NULL;
END $$;

-- Add missing columns
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS total_urls INT DEFAULT 0;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Drop errors array (we'll use job_events instead)
-- Keep for now but mark as deprecated
COMMENT ON COLUMN public.jobs.errors IS 'DEPRECATED: Use job_events table instead';

-- Add constraint: processed <= total_urls (only when both are set)
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS processed_le_total;
ALTER TABLE public.jobs ADD CONSTRAINT processed_le_total 
    CHECK (processed IS NULL OR total_urls IS NULL OR processed <= total_urls);

-- Add constraint: completed_at only set for terminal statuses
-- Note: This is a soft constraint, enforced via trigger is better but this documents intent
COMMENT ON COLUMN public.jobs.completed_at IS 'Should only be set when status IN (done, error, stopped)';

-- ============================================
-- 3. ALTER JOB_EVENTS TABLE
-- ============================================

-- Migrate level to enum
ALTER TABLE public.job_events DROP CONSTRAINT IF EXISTS job_events_level_check;
ALTER TABLE public.job_events 
    ALTER COLUMN level TYPE public.log_level USING level::public.log_level;

-- ============================================
-- 4. IMPROVED INDEXES
-- ============================================

-- Jobs: user dashboard queries (most common)
DROP INDEX IF EXISTS jobs_user_created_idx;
CREATE INDEX jobs_user_created_idx ON public.jobs (user_id, created_at DESC);

-- Jobs: status-based queries (for workers)
CREATE INDEX IF NOT EXISTS jobs_status_idx ON public.jobs (status) WHERE status = 'queued';

-- Job Results: unique per job + row (prevents duplicates on replay)
DROP INDEX IF EXISTS job_results_job_row_idx;
CREATE UNIQUE INDEX job_results_job_row_idx ON public.job_results (job_id, row_index);

-- Job Results: fast fetch by job
DROP INDEX IF EXISTS job_results_job_idx;
CREATE INDEX job_results_job_idx ON public.job_results (job_id);

-- Job Events: by job and time (for logs view)
CREATE INDEX IF NOT EXISTS job_events_job_created_idx ON public.job_events (job_id, created_at DESC);

-- ============================================
-- 5. AUTO-UPDATE updated_at TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS jobs_updated_at ON public.jobs;
CREATE TRIGGER jobs_updated_at
    BEFORE UPDATE ON public.jobs
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- 6. LEADS TABLE IMPROVEMENTS (for deduplication)
-- ============================================

-- Add place_id for Google Places deduplication
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS place_id TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'serper';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Unique constraint on place_id per user (prevents importing same business twice)
DROP INDEX IF EXISTS leads_user_place_idx;
CREATE UNIQUE INDEX leads_user_place_idx ON public.leads (user_id, place_id) 
    WHERE place_id IS NOT NULL;

-- Index for website lookups
CREATE INDEX IF NOT EXISTS leads_website_idx ON public.leads (website) WHERE website IS NOT NULL;

-- ============================================
-- 7. OUTREACH SCRIPTS IMPROVEMENTS
-- ============================================

-- Add caching by input hash (avoid regenerating same script)
ALTER TABLE public.outreach_scripts ADD COLUMN IF NOT EXISTS inputs_hash TEXT;
ALTER TABLE public.outreach_scripts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Unique index on inputs_hash (cache key)
CREATE UNIQUE INDEX IF NOT EXISTS outreach_inputs_hash_idx 
    ON public.outreach_scripts (inputs_hash) WHERE inputs_hash IS NOT NULL;

-- ============================================
-- 8. VERIFY RLS POLICIES EXIST
-- ============================================

-- Jobs: All CRUD scoped to user_id = auth.uid()
-- (Already set in 001, but verify)
DO $$ BEGIN
    -- Re-create if missing
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'jobs' AND policyname = 'Users can view own jobs'
    ) THEN
        CREATE POLICY "Users can view own jobs" ON public.jobs 
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
END $$;

-- ============================================
-- 9. STORAGE KEY COLUMN (prep for Supabase Storage)
-- ============================================

-- Add screenshot_key for Supabase Storage (replaces screenshot_path over time)
ALTER TABLE public.job_results ADD COLUMN IF NOT EXISTS screenshot_key TEXT;
COMMENT ON COLUMN public.job_results.screenshot_key IS 'Supabase Storage object key (e.g., screenshots/{user_id}/{job_id}/{row}.png)';

-- ============================================
-- 10. HELPFUL VIEWS (optional, for dashboard queries)
-- ============================================

CREATE OR REPLACE VIEW public.jobs_with_stats AS
SELECT 
    j.*,
    (SELECT COUNT(*) FROM public.job_results jr WHERE jr.job_id = j.id) as result_count,
    (SELECT COUNT(*) FROM public.job_events je WHERE je.job_id = j.id AND je.level = 'error') as error_count
FROM public.jobs j;

-- Grant access to the view
GRANT SELECT ON public.jobs_with_stats TO authenticated;
