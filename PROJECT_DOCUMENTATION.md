# Lead Scraper & CRO Audit Tool - Documentation

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Vite + React)                   │
│  Port 5173 • Obsidian Glass UI • Supabase Auth                  │
├─────────────────────────────────────────────────────────────────┤
│                         SERVER (Express)                        │
│  Port 3000 • Playwright • Gemini AI • Supabase DB/Storage       │
├─────────────────────────────────────────────────────────────────┤
│                         SUPABASE (Cloud)                        │
│  Auth • PostgreSQL • Storage Bucket • RLS Policies              │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React 18, Vite 7 | SPA with HMR |
| **Styling** | Vanilla CSS | Obsidian Glass design system |
| **Auth** | Supabase Auth | Google OAuth + email/password |
| **Backend** | Express.js (ESM) | REST API server |
| **Scraping** | Playwright (Chromium) | Headless browser automation |
| **AI Analysis** | Google Gemini 1.5 Pro | Vision-based CRO recommendations |
| **SEO Audit** | Cheerio | HTML parsing for SEO checks |
| **Lead Discovery** | Serper API | Google Places data |
| **Database** | Supabase PostgreSQL | Jobs, results, leads, credits |
| **Storage** | Supabase Storage | Screenshot files |
| **Rate Limiting** | Bottleneck, p-limit | API throttling, concurrency |

## 3. Directory Structure

```
scrape/
├── client/                    # React frontend
│   ├── src/
│   │   ├── App.jsx           # Main app component (1200+ lines)
│   │   ├── LandingPage.jsx   # Marketing landing page
│   │   ├── AuthModal.jsx     # Sign in/up modal
│   │   ├── Dashboard.jsx     # Post-login dashboard
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx  # Supabase auth state
│   │   ├── lib/
│   │   │   ├── supabase.js   # Supabase client init
│   │   │   └── api.js        # Authenticated fetch wrapper
│   │   ├── hooks/            # Custom React hooks
│   │   └── index.css         # Design system (Obsidian Glass)
│   └── vite.config.js
│
├── server/                    # Express backend
│   ├── index.js              # Main server (routes, job runners)
│   ├── config/
│   │   └── env.js            # Environment validation
│   ├── lib/
│   │   ├── supabase.js       # Admin + RLS clients
│   │   └── capture.js        # Unified screenshot pipeline
│   ├── middleware/
│   │   └── auth.js           # requireAuth JWT validation
│   ├── routes/
│   │   ├── jobs.routes.js
│   │   ├── leads.routes.js
│   │   ├── outreach.routes.js
│   │   └── screenshots.routes.js
│   ├── services/
│   │   ├── db.js             # Supabase DB operations
│   │   ├── storage.js        # Supabase Storage uploads
│   │   ├── gemini.js         # AI analysis + outreach generation
│   │   ├── audit.js          # SEO/PSI/CrUX audit
│   │   └── job-processor.js  # Unified job execution
│   └── worker.js             # Background job processor (optional)
│
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql
│       ├── 002_job_queue_and_events.sql
│       └── 003_schema_tightening.sql
│
├── outputs/                   # Local screenshot temp storage
├── uploads/                   # Uploaded Excel files
└── package.json
```

## 4. Database Schema

### Tables

| Table | Purpose |
|-------|---------|
| `jobs` | Scraping/analysis job metadata |
| `job_results` | Per-URL analysis results |
| `job_events` | Log events per job |
| `leads` | Persisted scraped leads |
| `profiles` | Extended user profiles |
| `credits` | User subscription/credits |
| `outreach_scripts` | Generated sales scripts |

### Key Relationships
- `jobs.user_id` → `auth.users.id`
- `job_results.job_id` → `jobs.id`
- `leads.user_id` → `auth.users.id`

### Enums
- `job_type`: `batch`, `single`, `leads`
- `job_status`: `queued`, `running`, `done`, `error`, `stopped`

## 5. Current User Flow (As-Is)

### Flow Steps

1. **Lead Source →**
   - Upload Excel file with URLs (batch analysis)
   - Enter single URL manually
   - Scrape Google Places via Serper API (keyword + location)

2. **Screenshot Capture →**
   - Playwright launches headless Chromium
   - Full-page scroll to trigger lazy loading
   - WP-friendly capture (animation disable, force reveals)
   - Upload screenshot to Supabase Storage
   - Generate thumbnail (optional)

3. **CRO Analysis →**
   - Gemini Vision analyzes screenshot for conversion blockers
   - SEO audit runs in parallel (title, meta, H1, images)
   - Results stored in `job_results` table

4. **Outreach Script Generation →**
   - User selects targets from results
   - Gemini generates personalized scripts (email, SMS, phone)
   - Based on analysis issues + business context

### Screens & Routes

| Screen | Route | Purpose |
|--------|--------|---------|
| Landing Page | `/` | Marketing, sign in |
| Command Center | `currentView='analyze'` | Batch/single analysis dashboard |
| Lead Intelligence | `currentView='scraper'` | Google Places scraper |
| Outreach Operations | `currentView='outreach'` | Script generation |
| Mission Archives | `currentView='history'` | Job history |
| Settings | `currentView='settings'` | User configuration |
| Plan Selection | `currentView='pricing'` | Subscription tiers |

### Jobs

| Job Type | Storage | Trigger |
|----------|----------|---------|
| `batch` | `outputs/{jobId}/` + DB | Excel upload |
| `single` | `outputs/{jobId}/` + DB | Single URL analyze |
| `leads` | `outputs/{jobId}/` + DB | Analyze scraped leads |

## 6. Data Model / Storage Reality

### Where Leads Live

**Database**: `leads` table in Supabase PostgreSQL
- Schema: `id, user_id, name, address, phone, website, rating, reviews, place_id, coordinates, analysis, tags, created_at`
- RLS: Users can only view their own leads
- No local file storage for leads

### Where Screenshots Live

**Primary**: Supabase Storage bucket `scrape-storage`
- Path: `screenshots/{userId}/{jobId}/{resultId}.png`
- Thumbnail: `screenshots/{userId}/{jobId}/{resultId}_thumb.jpg`

**Fallback**: Local `outputs/{jobId}/screenshots/` (legacy)
- Used if Supabase upload fails or is not configured
- File naming: `row_{rowIndex}.png`

### Where CRO Audit Results Live

**Database**: `job_results.report` column (JSONB)
- Embedded within each job result
- Schema:
  ```javascript
  {
    summary: "string",
    issues: ["array of strings"],
    quick_wins: ["array of strings"],
    confidence: "low|medium|high",
    seo: { ... } // optional, from audit service
  }
  ```

### Existing Tables

- `jobs`: Job metadata (id, user_id, type, status, total, processed, errors, metadata, created_at)
- `job_results`: Per-URL results (id, job_id, row_index, url, name, screenshot_key, screenshot_path, thumbnail_key, thumbnail_path, report, error)
- `leads`: Persisted scraped leads (see above)
- `credits`: User subscription (user_id, plan, total_credits, used_credits, period_start, period_end)

### IDs & Joins

- **UUIDs**: Primary key for all tables (gen_random_uuid())
- **Job ID**: Links `jobs` → `job_results` (one-to-many)
- **User ID**: Links to `auth.users.id` (foreign key)
- **Result ID**: Implicit via `job_results.id` (for outreach scripts)
- **Place ID**: Google Places unique identifier (for lead dedupe)

### Example Objects

**Lead Record**:
```javascript
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "user-uuid-here",
  "name": "Vida Chiropractic",
  "address": "123 Main St, Toronto, ON",
  "phone": "(416) 555-0123",
  "website": "https://vidachiropractic.ca/",
  "rating": 4.8,
  "reviews": 124,
  "place_id": "ChIJ...x8k",
  "tags": ["Chiropractors"],
  "created_at": "2025-01-15T10:30:00Z"
}
```

**Audit Record** (from `job_results.report`):
```javascript
{
  "summary": "The website suffers from a dated design aesthetic and significant 'above-the-fold' friction...",
  "issues": [
    "Intrusive Pop-up: The 'New Patient Special' pop-up obscures main hero content...",
    "Weak Value Proposition: The hero section leads with brand name rather than a clear benefit...",
    "Poor Text Contrast: The white text on light green background fails accessibility standards..."
  ],
  "quick_wins": [
    "Fix spelling of 'Knee Pain' in services section.",
    "Change pop-up trigger to 'exit-intent' or a 15-second delay...",
    "Increase font weight or darken background of 'What To Expect' section..."
  ],
  "confidence": "high",
  "seo": {
    "title": "Vida Chiropractic | Toronto, ON",
    "metaDescription": "Expert chiropractic care in Toronto...",
    "h1Count": 1,
    "h1Text": "Welcome to Vida Chiropractic",
    "imagesMissingAlt": 3,
    "hasViewportMeta": true,
    "issues": ["images_missing_alt"]
  }
}
```

**Outreach Scripts Record** (from Gemini, not yet persisted):
```javascript
{
  "email": {
    "subject": "Quick fix for Vida Chiropractic's conversion rate",
    "body": "Hi team, I noticed your website has a pop-up that immediately blocks..."
  },
  "sms": "Saw a few quick wins for your site - want me to share them?",
  "phone": "Hi, this is Alex from LeadAudit. I noticed your chiropractic site..."
}
```

## 7. Existing APIs

### Jobs Routes (`server/routes/jobs.routes.js`)

| Method | Path | Request Body | Response | File |
|--------|------|-------------|----------|------|
| POST | `/upload` | `excel` (file), `sheet`, `column`, `limit`, `captureMode` | `{ jobId }` | jobs.routes.js:36 |
| POST | `/analyze-single` | `{ url, captureMode }` | `{ jobId }` | jobs.routes.js:81 |
| POST | `/analyze-leads` | `{ leads[], keyword, location, captureMode }` | `{ jobId }` | jobs.routes.js:111 |
| GET | `/jobs` | (auth header) | `[{ id, type, status, createdAt, total, processed, results[] }]` | jobs.routes.js:155 |
| DELETE | `/jobs/:id` | (auth header) | `{ success: true }` | jobs.routes.js:164 |
| GET | `/status/:jobId` | (auth header) | `{ status, total, processed, errors, results[] }` | jobs.routes.js:181 |
| POST | `/stop/:jobId` | (auth header) | `{ message: "Job stop requested" }` | jobs.routes.js:195 |

### Leads Routes (`server/routes/leads.routes.js`)

| Method | Path | Request Body | Response | File |
|--------|------|-------------|----------|------|
| POST | `/scrape-leads` | `{ keyword, location, limit }` | `[{ name, address, phone, website, rating, reviews, placeId, coordinates }]` | leads.routes.js:19 |
| GET | `/leads` | (auth header) | `[{ id, name, address, phone, website, rating, reviews, placeId, tags, createdAt }]` | leads.routes.js:74 |
| POST | `/export-leads` | `{ leads[] }` | XLSX file download | leads.routes.js:83 |
| GET | `/export-my-leads` | `?format=xlsx|csv` | XLSX/CSV file download | leads.routes.js:131 |

### Outreach Routes (`server/routes/outreach.routes.js`)

| Method | Path | Request Body | Response | File |
|--------|------|-------------|----------|------|
| POST | `/generate-outreach` | `{ name, url, report }` | `{ email: { subject, body }, sms, phone }` | outreach.routes.js:18 |

### Screenshots Routes (`server/routes/screenshots.routes.js`)

| Method | Path | Response | File |
|--------|------|----------|------|
| GET | `/screenshot/:key` | Redirect to signed URL | screenshots.routes.js |

### Background Worker

- **File**: `server/worker.js` (optional)
- **Purpose**: Separate process for long-running jobs
- **Status**: Currently runs in-process (no separate worker)

## 8. "Generation" Components (AI + Templating)

### Model/Provider

- **Primary**: Google Gemini 1.5 Pro
- **Fallback**: None (requires `GEMINI_API_KEY`)
- **Alternative**: None (no OpenAI integration)

### Prompt Locations

**CRO Analysis Prompt** (`server/services/gemini.js:31-43`):
```javascript
[
  {
    text: [
      "You are a conversion rate optimizer.",
      "Analyze the screenshot for conversion blockers and design flaws.",
      "Focus on hierarchy, CTA clarity, trust signals, load clutter,",
      "form friction, messaging alignment, and visual noise.",
      "Return JSON with fields:",
      "summary (string), issues (array of strings),",
      "action_items (array of strings: specific, actionable fixes),",
      "confidence (low|medium|high).",
      `Context URL: ${url}`
    ].join(" ")
  },
  { inlineData: { mimeType: "image/png", data: imageData } }
]
```

**Outreach Generation Prompt** (`server/services/gemini.js:89-104`):
```javascript
`
You are an expert sales copywriter.
Context: We analyzed ${name ? name : "a potential client"} (${url}).
Findings: ${JSON.stringify(report || "No specific report...")}

Task: Create 3 outreach scripts to pitch our "Conversion Optimization Services".
1. Cold Email (Short, personalized, value-first).
2. SMS (One sentence hook).
3. Cold Call Script (Opening + value prop).

Return JSON ONLY:
{
  "email": { "subject": "...", "body": "..." },
  "sms": "...",
  "phone": "..."
}
`;
```

### Output Schema

**CRO Report** (from `analyzeScreenshot()`):
```javascript
{
  summary: "string",
  issues: ["string array"],
  quick_wins: ["string array"],  // renamed from action_items
  confidence: "low" | "medium" | "high"
}
```

**Outreach Scripts** (from `generateOutreach()`):
```javascript
{
  email: {
    subject: "string",
    body: "string"
  },
  sms: "string",
  phone: "string"
}
```

### Validation/Parsing Logic

- **JSON Extraction**: Regex to find first `{...}` block in response
- **Field Normalization**: Handles `quick_wins`, `quickWins`, `"quick-wins"`, `QuickWins`
- **Error Handling**: Returns `{ raw: text }` if JSON parsing fails
- **No Schema Validation**: Trusts Gemini output structure

### Sample Output JSON

**CRO Analysis**:
```json
{
  "summary": "The website suffers from a dated design aesthetic and significant 'above-the-fold' friction. A large, intrusive pop-up immediately blocks the brand's value proposition, while the underlying hero section lacks a clear, benefit-driven headline.",
  "issues": [
    "Intrusive Pop-up: The 'New Patient Special' pop-up obscures main hero content immediately upon load, creating high bounce potential.",
    "Weak Value Proposition: The hero section leads with brand name rather than a clear benefit for patient.",
    "Poor Text Contrast: The white text on light green background fails accessibility standards."
  ],
  "quick_wins": [
    "Fix spelling of 'Knee Pain' in services section.",
    "Change pop-up trigger to 'exit-intent' or a 15-second delay.",
    "Increase font weight or darken background to improve readability."
  ],
  "confidence": "high"
}
```

**Outreach Scripts**:
```json
{
  "email": {
    "subject": "Quick fix for Vida Chiropractic's conversion rate",
    "body": "Hi team, I noticed your website has a pop-up that immediately blocks your hero content. This typically increases bounce rates by 30-50%. I have 3 specific recommendations that would take less than 30 minutes to implement. Would you be open to a quick call?"
  },
  "sms": "Saw a few quick wins for your site - want me to share them?",
  "phone": "Hi, this is Alex from LeadAudit. I noticed your chiropractic site has a pop-up that's blocking your main message. I've analyzed it and have three specific fixes that would take under 30 minutes. Do you have a quick moment?"
}
```

## 9. UI Components Relevant to MVP1

### Where Leads Table Lives

**Screen**: Lead Intelligence (`currentView='scraper'`)
- **Component**: Leads list inside `App.jsx` (lines 724-830)
- **Features**:
  - Sector/keyword dropdown
  - Location input
  - Limit selector (10/20/50/100)
  - Export to CSV/XLSX
  - "Analyze All" button

### Where Screenshot Viewing Happens

**Screen**: Command Center (`currentView='analyze'`)
- **Component**: Results view with grid/list toggle
- **Grid View**: Preview cards with thumbnail + summary
- **List View**: Expandable rows with full details
- **Thumbnail Source**: `res.thumbnail || res.screenshot`
- **Full Screenshot**: Not directly viewable (only thumbnails)

### Where CRO Report is Displayed

**Screen**: Command Center + Outreach
- **Command Center**: Expandable row details
  - Summary (always visible)
  - Quick wins tags
  - Issues list
  - Confidence badge
- **Outreach**: Left panel "Intelligence Brief"
  - Summary
  - Opportunities (quick_wins)
  - Pain Points (issues)

### Existing Notions

- **Campaigns**: Jobs (`job.type` = "batch", "single", "leads")
- **Status**: `job.status` = "queued", "running", "done", "error", "stopped"
- **Tasks**: No task system (only job-level tracking)
- **History**: Job history in Mission Archives (`currentView='history'`)

## 10. Constraints + Gotchas

### Rate Limits / Cost Constraints

| API | Limit | Implementation |
|-----|-------|----------------|
| Gemini Vision | Rate limited by Google quota | Bottleneck limiter (configurable) |
| Serper (Google Places) | ~1000 searches/month | No rate limiting implemented |
| PSI API | ~25K/day | Bottleneck limiter: 300ms minTime, 4 concurrent |
| CrUX API | ~1K/day | Bottleneck limiter: 450ms minTime, 4 concurrent |
| Playwright Concurrency | 4 pages max | p-limit with configurable `CAPTURE_CONCURRENCY` |

### Typical Batch Size

- **Default Limit**: 10 URLs
- **Max Recommended**: 50 URLs (per job)
- **Technical Max**: 100+ (but may hit API rate limits)
- **Enterprise**: 500+ (would need queue worker)

### Current Pain Points

1. **Slow Capture**: Full-page screenshots take 10-30s per URL
2. **Flaky Sites**: WordPress lazy loading, pop-ups, anti-bot
3. **Gemini JSON**: Occasionally returns malformed JSON
4. **No Queue Worker**: All jobs run in-process (blocks server)
5. **Missing RLS**: Some tables missing proper user scoping
6. **Thumbnail Generation**: Fails for some images

### Refusing to Build

1. **OAuth Integration**: No Gmail/Google Calendar OAuth in MVP1
2. **Inbox Sending**: No email/SMS sending (export-first only)
3. **Phone Dialer**: No integrated calling
4. **Multi-tenant**: Single-tenant (no team accounts)
5. **White-label**: No custom branding

## 11. MVP1 Vision

### Where "Campaigns" Should Live

**Navigation**: New top-level nav item "Campaigns"
**Routes**: `/campaigns/new`, `/campaigns/:id`
**Location**: Between "Command Center" and "Lead Intelligence"

**Campaign Features**:
- Create campaign from leads (bulk select)
- Track campaign status (draft, active, paused, completed)
- Campaign metrics (sent, opened, replied, booked)

### Export-First vs Sending In-App

**Preferred**: **Export-First**
- Export CSV with Gmail drafts
- Export phone scripts for manual dialing
- No integrated sending in MVP1

**Why**:
- Faster to implement
- No OAuth complexity
- User maintains control
- Lower liability

### Must-Have KPIs

**Campaign-Level**:
- **Leads Count**: Total leads in campaign
- **Contact Rate**: (leads contacted / total) × 100%
- **Reply Rate**: (replies / sent) × 100%
- **Booked Calls**: (booked / sent) × 100%

**Global**:
- **Total Jobs**: User's job count
- **Total Leads**: User's lead count
- **Active Campaigns**: Campaigns with status=active

### MVP1 Scope

**Campaign Management**:
- [ ] Create campaign from leads
- [ ] Update campaign status
- [ ] View campaign details
- [ ] Delete campaign

**Outreach**:
- [ ] Generate scripts (email/SMS/phone)
- [ ] Export scripts to CSV (Gmail-ready)
- [ ] Export scripts to XLSX (for CRM import)

**Tracking**:
- [ ] Mark leads as contacted
- [ ] Track reply status (manual)
- [ ] Track booked calls (manual)

**Metrics**:
- [ ] Campaign dashboard with KPIs
- [ ] Global stats in Command Center

**Out of Scope**:
- Gmail/Google OAuth
- Email/SMS sending from app
- Phone dialer integration
- Automated follow-ups
- A/B testing
- Team collaboration
