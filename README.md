# HireSync

**Live:** [https://hire-sync-ten.vercel.app](https://hire-sync-ten.vercel.app) &nbsp;|&nbsp; ![CI](https://github.com/mananghonia/HireSync/actions/workflows/ci.yml/badge.svg)

A full-stack hiring platform built with React, Django, and MongoDB. Connects job seekers and recruiters with AI-powered recommendations, real-time messaging, and interview analysis.

---

## Try It

| Role | Email | Password |
|---|---|---|
| Job Seeker | demo.seeker@hiresync.com | Demo@1234 |
| Recruiter | demo.recruiter@hiresync.com | Demo@1234 |

No sign-up needed — log in and explore all features immediately.

---

## Features

### Job Seekers
- **Browse & Search Jobs** — full-text search across title, description, company, and requirements with filters for location, job type, experience level, salary range, remote toggle, and skills
- **Apply to Jobs** — apply using your saved profile resume or upload a fresh PDF per application
- **Track Applications** — view all applications and their pipeline status (Applied → Shortlisted → Interview Scheduled → Hired); withdraw any time
- **AI Job Recommendations** — personalised feed ranked by match score using profile skills, LLM-extracted resume skills, and past application history
- **Message Recruiters** — real-time WebSocket chat initiated from any application card

### Recruiters
- **Post & Manage Jobs** — create jobs with rich metadata (job type, experience level, salary range, skills, deadline, remote flag); pause, reactivate, or close listings
- **Application Pipeline** — 8 stages (applied → viewed → shortlisted → interview scheduled → interviewed → offer made → hired → rejected); one-click stage transitions from the applicants view
- **AI Interview Questions** — generate 12 tailored interview questions across 4 categories (Technical, Problem Solving, Behavioral, Role Fit) using the applicant's resume and job requirements
- **AI Transcript Analysis** — paste an interview transcript and get an instant AI report: hire recommendation (Strong Hire / Hire / Maybe / No Hire), strengths, concerns, key quotes, and scores across Technical, Communication, Problem Solving, and Culture Fit
- **Schedule Interviews** — pick a date/time from the applicant card; a notification email is sent automatically to the seeker
- **Recruiter Notes** — attach private notes to any application
- **Analytics Dashboard** — overview stats, application status breakdown (pie chart), daily applications over 30 days (bar chart), and top performing jobs by application count

### Admin
- **User Management** — search, filter by role, suspend/activate accounts, delete users
- **Job Management** — search jobs, change status on any listing, delete jobs
- **Platform Stats** — total users by role, active jobs, total applications, hires

### Real-Time & Notifications
- **WebSocket Chat** — messages delivered instantly via Django Channels; falls back to REST POST if the socket drops
- **WebSocket Notifications** — in-app push on new messages and application status changes; unread count badge, dashboard stats, and application status badges all update live without any page refresh
- **Email Notifications** — transactional emails via Brevo on: application received, status change, interview scheduled, application withdrawn

### Auth
- **Email + OTP Registration** — 6-digit code sent to email (10-minute expiry) before account creation
- **Google OAuth** — one-click sign-in; new Google users pick a role (seeker/recruiter) on first login
- **JWT Auth** — short-lived access token + long-lived refresh token with silent refresh interceptor
- **Forgot Password** — OTP-based password reset flow

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| State | Redux Toolkit, TanStack React Query v5 |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Icons | Lucide React |
| API client | Axios (with JWT interceptor + 401 auto-refresh) |
| Routing | React Router v6 (code-split with `React.lazy` + `Suspense`) |
| Backend | Django, Django REST Framework |
| Auth | SimpleJWT, Google OAuth (`google-auth`) |
| WebSockets | Django Channels (ASGI) |
| Task queue | Celery + django-celery-beat |
| Database | MongoDB Atlas (`django-mongodb-backend`) |
| Cache / WS layer | Redis |
| AI | Anthropic Claude Haiku (`claude-haiku-4-5-20251001`) |
| Email | Brevo (transactional) |
| File storage | AWS S3 (production), local filesystem (dev) |
| Frontend deploy | Vercel |
| Backend deploy | Railway |
| Monitoring | Sentry (production) |
| CI | GitHub Actions |

---

## Project Structure

```
HireSync/
├── .github/workflows/ci.yml      # GitHub Actions CI (frontend + backend tests)
├── frontend/                      # React + Vite app (deployed to Vercel)
│   ├── tsconfig.json              # TypeScript config (strict mode, vite/client types)
│   ├── tsconfig.node.json         # TypeScript config for Vite/Vitest config files
│   └── src/
│       ├── pages/                 # All pages lazy-loaded (React.lazy + Suspense)
│       │   ├── auth/              # LoginPage, RegisterPage, ForgotPasswordPage
│       │   ├── seeker/            # SeekerDashboard, ApplicationsPage, SeekerProfilePage, RecommendationsPage
│       │   ├── recruiter/         # RecruiterDashboard, PostJobPage, ManageJobsPage, ApplicantsPage, AnalyticsDashboard
│       │   ├── admin/             # AdminDashboard
│       │   └── JobSearchPage, JobDetailPage, MessagesPage, NotificationsPage
│       ├── features/              # Redux slices (auth, notifications)
│       ├── hooks/                 # useAuth, useWebSocket (real-time notification + query invalidation)
│       ├── lib/                   # Axios instance with JWT interceptors
│       └── tests/                 # 487 Vitest tests — 81.4% line coverage
│
└── backend/                       # Django ASGI app (deployed to Railway)
    └── apps/
        ├── users/                 # Registration, login, Google OAuth, password management
        ├── profiles/              # JobSeekerProfile, RecruiterProfile, Company, Skills
        ├── jobs/                  # Job CRUD, SavedJob, JobView tracking
        ├── applications/          # Application lifecycle, recruiter notes, AI question/transcript analysis
        ├── messaging/             # Conversation + Message models, ChatConsumer (WS)
        ├── notifications/         # Notification model, NotificationConsumer (WS), email tasks
        ├── analytics/             # Recruiter dashboard stats, per-job analytics
        └── search/                # Job search (ORM-based), AI-powered recommendations
```

---

## Local Development

### Prerequisites
- Node 20+
- Python 3.11+
- MongoDB Atlas cluster (or local MongoDB)
- Redis

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Mac/Linux
pip install -r requirements.txt
```

Create `backend/.env`:

```env
DJANGO_SETTINGS_MODULE=hiresync.settings_dev
SECRET_KEY=any-long-random-string
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/?retryWrites=true&w=majority

# Optional — leave blank to disable in dev
BREVO_API_KEY=
GOOGLE_CLIENT_ID=
ANTHROPIC_API_KEY=
```

```bash
python manage.py migrate
python manage.py runserver
```

For WebSocket support run with Daphne instead:

```bash
daphne -p 8000 hiresync.asgi:application
```

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8000/api
VITE_WS_BASE_URL=ws://localhost:8000
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```

```bash
npm run dev
```

---

## Running Tests

### Frontend (Vitest)

```bash
cd frontend
npm test                   # run all tests once
npm run test:watch         # watch mode
npm run test:coverage      # generate coverage report
```

487 tests, 81.4% line coverage across all pages, Redux slices, hooks, and the axios interceptor layer.

### Backend (pytest)

```bash
cd backend
pytest tests/ -v
```

321 tests covering all API endpoints, models, permissions, and AI feature fallbacks.

---

## Environment Variables Reference

### Backend

| Variable | Required | Description |
|---|---|---|
| `SECRET_KEY` | Yes | Django secret key |
| `MONGODB_URI` | Yes | MongoDB Atlas connection string |
| `REDIS_URL` | Yes (prod) | Redis URL for WebSocket channel layer and cache |
| `ALLOWED_HOSTS` | Yes | Comma-separated allowed hostnames |
| `CORS_ALLOWED_ORIGINS` | Yes (prod) | Comma-separated allowed frontend origins |
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth 2.0 client ID |
| `BREVO_API_KEY` | Optional | Brevo API key for transactional email |
| `ANTHROPIC_API_KEY` | Optional | Anthropic API key for Claude AI features |
| `USE_S3` | Optional | Set `True` to enable S3 file storage |
| `AWS_ACCESS_KEY_ID` | If S3 | AWS credentials |
| `AWS_SECRET_ACCESS_KEY` | If S3 | AWS credentials |
| `AWS_STORAGE_BUCKET_NAME` | If S3 | S3 bucket name |
| `SENTRY_DSN` | Optional | Sentry DSN for error monitoring |

### Frontend

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Backend REST API base URL |
| `VITE_WS_BASE_URL` | Backend WebSocket base URL |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID |

---

## Deployment

### Frontend → Vercel
**Production URL:** [https://hire-sync-ten.vercel.app](https://hire-sync-ten.vercel.app)

1. Connect the `frontend/` directory to a Vercel project
2. Set `VITE_API_BASE_URL`, `VITE_WS_BASE_URL`, and `VITE_GOOGLE_CLIENT_ID` in the Vercel dashboard
3. Build command: `npm run build` — output: `dist/`

### Backend → Railway
1. Create a Railway project and attach a Redis plugin
2. Set all backend environment variables listed above
3. Set `DJANGO_SETTINGS_MODULE=hiresync.settings_prod`
4. Railway runs migrations on each deploy

### CI/CD
GitHub Actions runs on every push and pull request to `main`:
- **Frontend job** — installs deps, runs `npm run test:coverage`, uploads coverage artifact
- **Backend job** — installs deps, runs `pytest tests/ -v`

---

## AI Features

All AI features use **Claude Haiku** (`claude-haiku-4-5-20251001`) and degrade gracefully when `ANTHROPIC_API_KEY` is absent.

### Job Recommendations
Signals are combined additively per job:
1. **Profile skills** (manually selected) — weight 2.0
2. **Resume skills** extracted by Claude from uploaded PDF/DOCX — weight 1.5
3. **Skills from past applications** — weight 0.5 × frequency
4. **Experience level match bonus** — ×1.2
5. **Job title keyword overlap** — ×1.1

The top 20 jobs by weighted cosine similarity are returned.

### Interview Question Generation
A recruiter clicks "Generate Questions" on any applicant card. Claude reads the job title, description, requirements, required skills, experience level, and the applicant's resume to produce 12 questions across four categories (Technical Skills, Problem Solving, Behavioral, Role Fit). Questions can be copied individually or all at once.

### Interview Transcript Analysis
A recruiter pastes an interview transcript directly into the applicant panel. Claude returns:
- **Hire recommendation** — Strong Hire / Hire / Maybe / No Hire
- **Summary** — 2-3 sentence overall assessment
- **Strengths & Concerns** — bullet lists drawn from the transcript
- **Key Quotes** — notable excerpts with context
- **Scores out of 10** — Technical, Communication, Problem Solving, Culture Fit

Falls back to a graceful "unavailable" response if the API key is absent.

---

## Application Status Pipeline

Applications move through these stages — transitions are controlled by the recruiter from the Applicants page:

```
applied → viewed → shortlisted → interview_scheduled → interviewed → offer_made → hired
                                                                                ↘ rejected
```

Each transition triggers:
- An in-app WebSocket notification pushed to the seeker
- Immediate live update of the seeker's dashboard stats and application status badges (no refresh needed)
- A transactional email via Brevo
- A row in `ApplicationStatusHistory` for audit trail
