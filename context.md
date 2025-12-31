# Project Context: Lead Scraper & CRO Audit Tool

> Full-stack web application that scrapes business leads, captures website screenshots, and provides AI-powered conversion rate optimization (CRO) analysis.

---

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

---

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

---

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
│   ├── services/
│   │   ├── db.js             # Supabase DB operations
│   │   ├── storage.js        # Supabase Storage uploads
│   │   └── audit.js          # SEO/PSI/CrUX audit
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

---

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

### Enums (from Migration 003)
- `job_type`: `batch`, `single`, `leads`
- `job_status`: `queued`, `running`, `done`, `error`, `stopped`

---

## 5. API Endpoints

### Authentication Required (via `requireAuth` middleware)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/upload` | Upload Excel, start batch analysis |
| POST | `/analyze-single` | Analyze single URL |
| GET | `/jobs` | Get user's job history |
| DELETE | `/jobs/:id` | Delete a job |
| GET | `/status/:jobId` | Get job status + results |
| POST | `/stop/:jobId` | Request job stop |
| POST | `/scrape-leads` | Scrape leads from Google Places |
| GET | `/leads` | Get user's saved leads |
| POST | `/analyze-leads` | Analyze leads with websites |
| POST | `/export-leads` | Export leads to XLSX |
| GET | `/export-my-leads` | Export DB leads (XLSX/CSV) |
| GET | `/screenshot/:key` | Get signed URL for screenshot |
| POST | `/generate-outreach` | Generate sales scripts with AI |

---

## 6. Core Features

### 6.1 Lead Scraping
1. User enters keyword + location (e.g., "plumbers in Los Angeles")
2. Server calls Serper Google Places API
3. Returns: name, address, phone, website, rating, reviews
4. Leads auto-saved to `leads` table with `place_id` for dedupe

### 6.2 Website Analysis
1. User provides URL(s) via single input or Excel upload
2. Playwright captures full-page screenshot
3. Gemini Vision analyzes for CRO:
   - Summary of conversion blockers
   - Issues list
   - Quick wins (actionable fixes)
   - Confidence score
4. SEO audit runs in parallel:
   - Title, meta description, H1 checks
   - Missing alt text count
   - robots.txt, sitemap.xml presence
   - Structured data (JSON-LD) detection

### 6.3 Outreach Generation
1. User clicks "Generate Outreach" on a result
2. Gemini creates personalized scripts:
   - Email (subject + body)
   - SMS
   - Phone script
3. Based on analysis issues + business context

---

## 7. Screenshot Capture Pipeline

Located in `server/lib/capture.js`:

```
captureAuditScreenshot(page, url, path)
├── navigateAndSettle()     # WP-friendly: load + networkidle + fonts
├── autoScroll()            # Scroll to trigger lazy loading (stays at bottom)
├── prepForScreenshot()     # Disable animations, force reveals visible
├── waitForVisualStability()# 2x rAF + timeout + networkidle
└── Screenshot              # fullPage first, container fallback
```

### WordPress-Friendly Features
- Uses `waitUntil: 'load'` instead of `domcontentloaded`
- Forces Elementor/AOS reveal classes visible
- Disables CSS animations during capture
- Pauses video/audio elements
- Does NOT scroll back to top (preserves reveal-on-scroll)

---

## 8. Authentication Flow

1. **Frontend**: `AuthContext.jsx` manages Supabase session
2. **API Calls**: `lib/api.js` injects Bearer token in headers
3. **Backend**: `requireAuth` middleware validates JWT
4. **RLS**: Supabase Row Level Security enforces user scoping

```javascript
// Example protected route
app.get("/jobs", requireAuth, async (req, res) => {
  const userId = req.user.id;  // From validated JWT
  const jobs = await db.getUserJobs(userId);
  res.json(jobs);
});
```

---

## 9. Environment Variables

### Required
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...
GEMINI_API_KEY=AIza...
SERPER_API_KEY=xxx
```

### Optional (for full audit)
```
PSI_API_KEY=xxx          # PageSpeed Insights
CRUX_API_KEY=xxx         # Chrome UX Report
PSI_MIN_TIME_MS=300      # Rate limit tuning
CRUX_MIN_TIME_MS=450
```

---

## 10. Design System: Obsidian Glass

Defined in `client/src/index.css`:

- **Palette**: Deep void backgrounds (#0a0a0c), glass overlays
- **Typography**: SF Pro Display / system fonts
- **Effects**: Subtle glass blur, gradient borders
- **Components**: `.widget`, `.hud-btn`, `.list-item`, `.obsidian-row`
- **Philosophy**: Minimalist, typography-driven, subtle animations

---

## 11. Job Processing Flow

```
User Request → Create Job in DB → Update status to "running"
                                          ↓
              ┌─────────────────────────────────────────┐
              │        processUrl (per URL)             │
              │  1. Open Playwright page                │
              │  2. captureAuditScreenshot()            │
              │  3. Upload to Supabase Storage          │  
              │  4. analyzeScreenshot() with Gemini     │
              │  5. runQuickAudit() for SEO             │
              │  6. db.insertResult()                   │
              └─────────────────────────────────────────┘
                                          ↓
              Aggregate results → db.updateJob() → Done/Error
```

---

## 12. Recent Improvements (Dec 2024)

1. **Supabase Integration**: Auth, DB, Storage replacing local files
2. **Capture Pipeline**: WP-friendly screenshot with animation disable
3. **SEO Audit**: HTML checks via Cheerio (title, meta, h1, images)
4. **Lead Persistence**: Leads saved to DB with dedupe
5. **Schema Tightening**: Enums, constraints, indexes, RLS
6. **Export**: CSV/XLSX from Archives page

---

## 13. MVP1 Campaigns Feature (Dec 2024)

### New Tables (Migration 004)
| Table | Purpose |
|-------|---------|
| `sequences` | Reusable multi-step outreach templates |
| `sequence_steps` | Individual steps with channel, delay, A/B templates |
| `campaigns` | Campaign metadata + sequence assignment |
| `campaign_leads` | Lead enrollment with state machine (queued→in_progress→stopped/completed) |
| `touch_tasks` | Generated tasks with rendered content + due dates |
| `activities` | Timeline events per campaign lead |
| `artifacts` | Shareable mini audit HTML documents |
| `outreach_atoms` | Structured AI-generated content (openers, bullets, CTAs) |

### New API Endpoints
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/campaigns` | Create campaign with leads + sequence |
| POST | `/campaigns/:id/activate` | Generate tasks, start campaign |
| GET | `/campaigns/:id/tasks` | Tasks by bucket (today/overdue/upcoming) |
| POST | `/tasks/:id/complete` | Mark task done |
| POST | `/campaign-leads/:id/outcome` | Set outcome (triggers stop rules) |
| POST | `/sequences` | Create sequence with steps |
| POST | `/artifacts/generate` | Generate mini audit HTML |
| GET | `/share/:token` | Public artifact view |

### New Frontend Pages
| Page | Location | Features |
|------|----------|----------|
| CampaignsList | `pages/CampaignsList.jsx` | Grid view, stats, activate/pause |
| CampaignBuilder | `pages/CampaignBuilder.jsx` | Lead selector, sequence editor, preview |
| CampaignDashboard | `pages/CampaignDashboard.jsx` | Stats, lead table, filters |
| TaskInbox | `pages/TaskInbox.jsx` | Bucket tabs, copy, mark done, outcomes |

### New Components
| Component | Purpose |
|-----------|---------|
| TaskCard | Task preview with copy/complete/outcome |
| LeadSelector | Multi-select leads with search |
| SequenceEditor | Reorderable steps with A/B templates |
| LeadDetailDrawer | Timeline + analysis summary |

### New Services
| Service | Location | Key Functions |
|---------|----------|---------------|
| campaigns.js | `services/campaigns.js` | State machine, activation, stop rules |
| sequences.js | `services/sequences.js` | Sequence CRUD with step ordering |
| rendering.js | `services/rendering.js` | Template substitution with fallbacks |
| artifacts.js | `services/artifacts.js` | Mini audit HTML generator |
| exports.js | `services/exports.js` | Campaign/leads CSV export |
| templates.js | `lib/templates.js` | {{variable}} substitution |

### Campaign State Machine
```
queued → in_progress → waiting → completed
                    ↘ stopped (on outcome: replied/booked/not_interested)
```

Stop rules skip all pending tasks when triggered.

### Key Design Decisions
1. **A/B Variant**: Deterministic hash of campaignLeadId + stepOrder
2. **Task Scheduling**: Due at 9am, delays in days
3. **Rendering Contract**: Never empty body, always `missingFields[]`
4. **Mini Audit**: HTML with shareable token, Obsidian styling

---

## 14. Updated Directory Structure

```
scrape/
├── client/src/
│   ├── pages/                    # NEW: Campaign pages
│   │   ├── CampaignsList.jsx
│   │   ├── CampaignBuilder.jsx
│   │   ├── CampaignDashboard.jsx
│   │   └── TaskInbox.jsx
│   ├── components/
│   │   ├── TaskCard.jsx          # NEW
│   │   ├── LeadSelector.jsx      # NEW
│   │   ├── SequenceEditor.jsx    # NEW
│   │   └── LeadDetailDrawer.jsx  # NEW
│   └── lib/api.js                # Extended with campaign methods
│
├── server/
│   ├── routes/
│   │   ├── campaigns.routes.js   # NEW
│   │   ├── sequences.routes.js   # NEW
│   │   └── artifacts.routes.js   # NEW
│   ├── services/
│   │   ├── campaigns.js          # NEW: State machine
│   │   ├── sequences.js          # NEW
│   │   ├── rendering.js          # NEW
│   │   ├── artifacts.js          # NEW
│   │   └── exports.js            # NEW
│   └── lib/
│       └── templates.js          # NEW: Variable substitution
│
└── supabase/migrations/
    └── 004_campaigns.sql         # NEW: All campaign tables + RLS
```

---

## 15. Future Considerations

- [ ] Realtime task updates via Supabase Realtime
- [ ] PDF generation from mini audits (Playwright page.pdf())
- [ ] Hour-level scheduling with user timezone
- [ ] Credits deduction per campaign activation
- [ ] Thumbnail generation for screenshots
