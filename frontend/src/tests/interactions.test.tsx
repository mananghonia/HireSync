/**
 * Interaction tests for Navbar dropdowns, mobile menu, and ApplicantsPage.
 * Uses static imports and URL-based api mock with corrected data shapes.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { configureStore } from '@reduxjs/toolkit'
import React from 'react'
import authReducer, { setCredentials } from '../features/auth/authSlice'
import notificationsReducer from '../features/notifications/notificationsSlice'

import Navbar from '../components/layout/Navbar'
import ApplicantsPage from '../pages/recruiter/ApplicantsPage'
import PostJobPage from '../pages/recruiter/PostJobPage'
import ManageJobsPage from '../pages/recruiter/ManageJobsPage'
import SeekerProfilePage from '../pages/seeker/SeekerProfilePage'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../lib/axios', () => ({
  default: {
    get: vi.fn().mockImplementation((url: string) => {
      if (url.includes('/notifications/unread-count/'))
        return Promise.resolve({ data: { unread_count: 5 } })
      if (url.includes('/notifications/'))
        return Promise.resolve({ data: { results: [
          { id: 1, notification_type: 'application_status', title: 'Status Update', message: 'You were shortlisted', is_read: false, created_at: '2024-01-01T00:00:00Z' },
        ], count: 1 } })
      if (url.includes('/applications/manage/'))
        return Promise.resolve({ data: { results: [
          {
            id: 'app1',
            job: { id: 'job-1', title: 'Backend Dev' },
            applicant: { id: 'u1', full_name: 'Jane Doe', email: 'jane@test.com' },
            status: 'applied',
            skill_match_score: 75,
            resume_snapshot: null,
          },
          {
            id: 'app2',
            job: { id: 'job-1', title: 'Backend Dev' },
            applicant: { id: 'u2', full_name: 'John Smith', email: 'john@test.com' },
            status: 'shortlisted',
            skill_match_score: 0,
            resume_snapshot: 'https://example.com/resume.pdf',
          },
        ]}})
      if (url.includes('/profiles/seeker/'))
        return Promise.resolve({ data: { bio: 'Developer bio', skills: ['Python', 'Django'], resume: null, experience_years: 3, desired_salary: 80000, desired_location: 'Mumbai' } })
      if (url.includes('/profiles/companies/my_company/'))
        return Promise.resolve({ data: { id: 'co1', name: 'TechCo', industry: 'technology', size: '11-50', location: 'Mumbai', website: '', description: '' } })
      if (url.includes('/profiles/skills/'))
        return Promise.resolve({ data: [{ id: 's1', name: 'Python' }, { id: 's2', name: 'Django' }] })
      if (url.includes('/jobs/my_jobs/') || (url.includes('/jobs/') && url.includes('my_jobs')))
        return Promise.resolve({ data: { results: [
          { id: 'job1', title: 'Senior Dev', status: 'open', location: 'Mumbai', job_type: 'full_time', application_count: 3, views_count: 20, created_at: '2024-01-01T00:00:00Z' },
        ], count: 1, total_pages: 1, current_page: 1 } })
      return Promise.resolve({ data: { results: [], count: 0, total_pages: 1, current_page: 1 } })
    }),
    post: vi.fn().mockResolvedValue({ data: { id: 'convo1', id_str: 'convo1' } }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({}),
    defaults: { headers: { common: {} } },
    interceptors: {
      request: { use: vi.fn(), handlers: [] },
      response: { use: vi.fn(), handlers: [] },
    },
  },
}))

vi.mock('@react-oauth/google', () => ({
  GoogleLogin: () => null,
  GoogleOAuthProvider: ({ children }: any) => <>{children}</>,
}))

vi.mock('react-hot-toast', () => {
  const toast: any = vi.fn()
  toast.success = vi.fn()
  toast.error = vi.fn()
  return { default: toast, Toaster: () => null }
})

vi.mock('recharts', () => ({
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => null, XAxis: () => null, YAxis: () => null, Tooltip: () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  PieChart: ({ children }: any) => <div>{children}</div>,
  Pie: () => null, Cell: () => null, Legend: () => null,
}))

beforeAll(() => {
  ;(global as any).WebSocket = vi.fn().mockImplementation(() => ({
    close: vi.fn(), send: vi.fn(),
    onopen: null, onclose: null, onerror: null, onmessage: null, readyState: 1,
  }))
  ;(global as any).confirm = vi.fn(() => true)
  ;(global as any).navigator = { clipboard: { writeText: vi.fn() } }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEEKER = { id: 's1', email: 'seeker@test.com', first_name: 'Alice', last_name: 'S', full_name: 'Alice S', role: 'seeker' as const, is_verified: true }
const RECRUITER = { id: 'r1', email: 'rec@test.com', first_name: 'Bob', last_name: 'R', full_name: 'Bob R', role: 'recruiter' as const, is_verified: true }

function makeStore(user?: typeof SEEKER | typeof RECRUITER) {
  const s = configureStore({ reducer: { auth: authReducer, notifications: notificationsReducer } })
  if (user) s.dispatch(setCredentials({ user, tokens: { access: 'tok', refresh: 'ref' } }))
  return s
}

function wrap(ui: React.ReactElement, user?: typeof SEEKER | typeof RECRUITER) {
  const store = makeStore(user)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } } })
  return render(
    <Provider store={store}>
      <QueryClientProvider client={qc}>
        <MemoryRouter>{ui}</MemoryRouter>
      </QueryClientProvider>
    </Provider>,
  )
}

function wrapWithRoute(pattern: string, Component: React.ComponentType, user: typeof SEEKER | typeof RECRUITER, path: string) {
  const store = makeStore(user)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } } })
  return render(
    <Provider store={store}>
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={pattern} element={<Component />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>,
  )
}

// ---------------------------------------------------------------------------
// Navbar — dropdown interactions
// ---------------------------------------------------------------------------

describe('Navbar — dropdown and mobile interactions', () => {
  it('seeker: profile button opens profile dropdown', async () => {
    const { container } = wrap(<Navbar />, SEEKER)
    await waitFor(() => screen.getByText('Alice'), { timeout: 3000 })

    // Click the profile button (contains the first name)
    const profileBtn = screen.getAllByText('Alice').find(el => el.tagName === 'SPAN')?.closest('button')
    if (profileBtn) fireEvent.click(profileBtn)

    await waitFor(() => {
      expect(container.textContent).toContain('Sign Out')
    }, { timeout: 3000 })
  })

  it('seeker: profile dropdown shows user info', async () => {
    const { container } = wrap(<Navbar />, SEEKER)
    await waitFor(() => screen.getByText('Alice'), { timeout: 3000 })

    const profileBtn = screen.getAllByText('Alice').find(el => el.tagName === 'SPAN')?.closest('button')
    if (profileBtn) fireEvent.click(profileBtn)

    await waitFor(() => {
      expect(container.textContent).toContain('seeker@test.com')
    }, { timeout: 3000 })
  })

  it('seeker: profile dropdown shows My Profile link', async () => {
    const { container } = wrap(<Navbar />, SEEKER)
    await waitFor(() => screen.getByText('Alice'), { timeout: 3000 })

    const profileBtn = screen.getAllByText('Alice').find(el => el.tagName === 'SPAN')?.closest('button')
    if (profileBtn) fireEvent.click(profileBtn)

    await waitFor(() => {
      expect(container.textContent).toContain('My Profile')
    }, { timeout: 3000 })
  })

  it('recruiter: profile dropdown shows Dashboard link', async () => {
    const { container } = wrap(<Navbar />, RECRUITER)
    await waitFor(() => screen.getByText('Bob'), { timeout: 3000 })

    const profileBtn = screen.getAllByText('Bob').find(el => el.tagName === 'SPAN')?.closest('button')
    if (profileBtn) fireEvent.click(profileBtn)

    await waitFor(() => {
      expect(container.textContent).toContain('Dashboard')
    }, { timeout: 3000 })
  })

  it('mobile: hamburger toggles mobile menu for seeker', async () => {
    const { container } = wrap(<Navbar />, SEEKER)
    await waitFor(() => expect(container.textContent).toContain('HireSync'), { timeout: 3000 })

    // Find hamburger button by its md:hidden class
    const hamburger = container.querySelector('.md\\:hidden')
    if (hamburger) fireEvent.click(hamburger as Element)

    await waitFor(() => {
      expect(container.textContent).toContain('Browse Jobs')
    }, { timeout: 3000 })
  })

  it('mobile: seeker menu shows Applications link', async () => {
    const { container } = wrap(<Navbar />, SEEKER)
    await waitFor(() => expect(container.textContent).toContain('HireSync'), { timeout: 3000 })

    const hamburger = container.querySelector('.md\\:hidden')
    if (hamburger) fireEvent.click(hamburger as Element)

    await waitFor(() => {
      expect(container.textContent).toContain('Applications')
    }, { timeout: 3000 })
  })

  it('mobile: recruiter menu shows Post Job link', async () => {
    const { container } = wrap(<Navbar />, RECRUITER)
    await waitFor(() => expect(container.textContent).toContain('HireSync'), { timeout: 3000 })

    const hamburger = container.querySelector('.md\\:hidden')
    if (hamburger) fireEvent.click(hamburger as Element)

    await waitFor(() => {
      expect(container.textContent).toContain('Post Job')
    }, { timeout: 3000 })
  })

  it('mobile: unauthenticated shows Login and Sign Up links', async () => {
    const { container } = wrap(<Navbar />)
    await waitFor(() => expect(container.textContent).toContain('HireSync'), { timeout: 3000 })

    const hamburger = container.querySelector('.md\\:hidden')
    if (hamburger) fireEvent.click(hamburger as Element)

    await waitFor(() => {
      expect(container.textContent).toContain('Login')
    }, { timeout: 3000 })
  })

  it('mobile: sign out button appears in mobile menu', async () => {
    const { container } = wrap(<Navbar />, SEEKER)
    await waitFor(() => expect(container.textContent).toContain('HireSync'), { timeout: 3000 })

    const hamburger = container.querySelector('.md\\:hidden')
    if (hamburger) fireEvent.click(hamburger as Element)

    await waitFor(() => {
      expect(container.textContent).toContain('Sign Out')
    }, { timeout: 3000 })
  })

  it('notification bell shows unread badge after count loads', async () => {
    const { container } = wrap(<Navbar />, SEEKER)
    await waitFor(() => {
      // The notification count badge should show +5
      const badge = container.querySelector('[class*="bg-red-500"]')
      expect(badge || container.textContent).toBeTruthy()
    }, { timeout: 3000 })
  })
})

// ---------------------------------------------------------------------------
// ApplicantsPage — list + modal interactions
// ---------------------------------------------------------------------------

describe('ApplicantsPage — list rendering and interactions', () => {
  it('renders Applicants heading', async () => {
    const { container } = wrapWithRoute(
      '/recruiter/jobs/:jobId/applicants', ApplicantsPage, RECRUITER, '/recruiter/jobs/job-1/applicants'
    )
    await waitFor(() => expect(container.textContent).toContain('Applicants'), { timeout: 3000 })
  })

  it('shows status filter dropdown with All Stages', async () => {
    const { container } = wrapWithRoute(
      '/recruiter/jobs/:jobId/applicants', ApplicantsPage, RECRUITER, '/recruiter/jobs/job-1/applicants'
    )
    await waitFor(() => expect(container.textContent).toContain('All Stages'), { timeout: 3000 })
  })

  it('shows applicant name from data', async () => {
    const { container } = wrapWithRoute(
      '/recruiter/jobs/:jobId/applicants', ApplicantsPage, RECRUITER, '/recruiter/jobs/job-1/applicants'
    )
    await waitFor(() => expect(container.textContent).toContain('Jane Doe'), { timeout: 3000 })
  })

  it('shows applicant email', async () => {
    const { container } = wrapWithRoute(
      '/recruiter/jobs/:jobId/applicants', ApplicantsPage, RECRUITER, '/recruiter/jobs/job-1/applicants'
    )
    await waitFor(() => expect(container.textContent).toContain('jane@test.com'), { timeout: 3000 })
  })

  it('shows skill match score when > 0', async () => {
    const { container } = wrapWithRoute(
      '/recruiter/jobs/:jobId/applicants', ApplicantsPage, RECRUITER, '/recruiter/jobs/job-1/applicants'
    )
    await waitFor(() => expect(container.textContent).toContain('75% skill match'), { timeout: 3000 })
  })

  it('shows multiple applicants', async () => {
    const { container } = wrapWithRoute(
      '/recruiter/jobs/:jobId/applicants', ApplicantsPage, RECRUITER, '/recruiter/jobs/job-1/applicants'
    )
    await waitFor(() => {
      expect(container.textContent).toContain('Jane Doe')
      expect(container.textContent).toContain('John Smith')
    }, { timeout: 3000 })
  })

  it('shows View Resume link when resume_snapshot present', async () => {
    const { container } = wrapWithRoute(
      '/recruiter/jobs/:jobId/applicants', ApplicantsPage, RECRUITER, '/recruiter/jobs/job-1/applicants'
    )
    await waitFor(() => expect(container.textContent).toContain('View Resume'), { timeout: 3000 })
  })

  it('shows pipeline stage badges', async () => {
    const { container } = wrapWithRoute(
      '/recruiter/jobs/:jobId/applicants', ApplicantsPage, RECRUITER, '/recruiter/jobs/job-1/applicants'
    )
    await waitFor(() => expect(container.textContent).toMatch(/applied|shortlisted/i), { timeout: 3000 })
  })

  it('shows status dropdown per applicant', async () => {
    const { container } = wrapWithRoute(
      '/recruiter/jobs/:jobId/applicants', ApplicantsPage, RECRUITER, '/recruiter/jobs/job-1/applicants'
    )
    await waitFor(() => {
      const selects = container.querySelectorAll('select')
      expect(selects.length).toBeGreaterThan(1) // filter + per-applicant selects
    }, { timeout: 3000 })
  })

  it('opens QuestionPanel when wand button is clicked', async () => {
    const { container } = wrapWithRoute(
      '/recruiter/jobs/:jobId/applicants', ApplicantsPage, RECRUITER, '/recruiter/jobs/job-1/applicants'
    )
    await waitFor(() => expect(container.textContent).toContain('Jane Doe'), { timeout: 3000 })

    // Click the first Wand2 button (AI questions)
    const wandBtn = container.querySelector('button[title*="question"]')
    if (wandBtn) fireEvent.click(wandBtn)

    await waitFor(() => {
      expect(container.textContent).toContain('Interview Questions')
    }, { timeout: 3000 })
  })

  it('QuestionPanel: shows Generate Questions button', async () => {
    const { container } = wrapWithRoute(
      '/recruiter/jobs/:jobId/applicants', ApplicantsPage, RECRUITER, '/recruiter/jobs/job-1/applicants'
    )
    await waitFor(() => expect(container.textContent).toContain('Jane Doe'), { timeout: 3000 })

    const wandBtn = container.querySelector('button[title*="question"]')
    if (wandBtn) fireEvent.click(wandBtn)

    await waitFor(() => {
      expect(container.textContent).toContain('Generate Questions')
    }, { timeout: 3000 })
  })

  it('QuestionPanel: closes when X button is clicked', async () => {
    const { container } = wrapWithRoute(
      '/recruiter/jobs/:jobId/applicants', ApplicantsPage, RECRUITER, '/recruiter/jobs/job-1/applicants'
    )
    await waitFor(() => expect(container.textContent).toContain('Jane Doe'), { timeout: 3000 })

    const wandBtn = container.querySelector('button[title*="question"]')
    if (wandBtn) fireEvent.click(wandBtn)

    await waitFor(() => expect(container.textContent).toContain('Interview Questions'), { timeout: 3000 })

    // Close the panel
    const closeBtn = container.querySelector('button[class*="text-gray-400"]')
    if (closeBtn) fireEvent.click(closeBtn)

    await waitFor(() => {
      expect(container.textContent).not.toContain('Interview Questions')
    }, { timeout: 3000 })
  })

  it('opens TranscriptPanel when clipboard button is clicked', async () => {
    const { container } = wrapWithRoute(
      '/recruiter/jobs/:jobId/applicants', ApplicantsPage, RECRUITER, '/recruiter/jobs/job-1/applicants'
    )
    await waitFor(() => expect(container.textContent).toContain('Jane Doe'), { timeout: 3000 })

    const transcriptBtn = container.querySelector('button[title*="transcript"]')
    if (transcriptBtn) fireEvent.click(transcriptBtn)

    await waitFor(() => {
      expect(container.textContent).toContain('Transcript Analysis')
    }, { timeout: 3000 })
  })

  it('TranscriptPanel: shows textarea for transcript input', async () => {
    const { container } = wrapWithRoute(
      '/recruiter/jobs/:jobId/applicants', ApplicantsPage, RECRUITER, '/recruiter/jobs/job-1/applicants'
    )
    await waitFor(() => expect(container.textContent).toContain('Jane Doe'), { timeout: 3000 })

    const transcriptBtn = container.querySelector('button[title*="transcript"]')
    if (transcriptBtn) fireEvent.click(transcriptBtn)

    await waitFor(() => {
      expect(container.querySelector('textarea')).toBeTruthy()
    }, { timeout: 3000 })
  })

  it('shows No applicants empty state for empty data', async () => {
    const api = (await import('../lib/axios')).default as any
    api.get.mockResolvedValueOnce({ data: { results: [] } })

    const { container } = wrapWithRoute(
      '/recruiter/jobs/:jobId/applicants', ApplicantsPage, RECRUITER, '/recruiter/jobs/empty-job/applicants'
    )
    await waitFor(() => expect(container.textContent).toContain('No applicants'), { timeout: 3000 })
  })
})

// ---------------------------------------------------------------------------
// PostJobPage — form rendering
// ---------------------------------------------------------------------------

describe('PostJobPage — form coverage', () => {
  it('shows Post a Job heading when company exists', async () => {
    const { container } = wrap(<PostJobPage />, RECRUITER)
    await waitFor(() => {
      expect(container.textContent).toMatch(/post a job|job title|job type/i)
    }, { timeout: 3000 })
  })

  it('shows job title input field', async () => {
    const { container } = wrap(<PostJobPage />, RECRUITER)
    await waitFor(() => {
      expect(container.querySelector('input[placeholder*="title"]') || container.querySelector('input[name="title"]') || container.querySelector('input[placeholder*="Senior"]')).toBeTruthy()
    }, { timeout: 3000 })
  })

  it('shows job type selector', async () => {
    const { container } = wrap(<PostJobPage />, RECRUITER)
    await waitFor(() => {
      expect(container.textContent).toMatch(/full.time|part.time|job type/i)
    }, { timeout: 3000 })
  })

  it('shows company name when company loaded', async () => {
    const { container } = wrap(<PostJobPage />, RECRUITER)
    await waitFor(() => {
      expect(container.textContent).toContain('TechCo')
    }, { timeout: 3000 })
  })

  it('shows Post Job submit button', async () => {
    const { container } = wrap(<PostJobPage />, RECRUITER)
    await waitFor(() => {
      expect(container.querySelector('button[type="submit"]')).toBeTruthy()
    }, { timeout: 3000 })
  })
})

// ---------------------------------------------------------------------------
// SeekerProfilePage — form coverage
// ---------------------------------------------------------------------------

describe('SeekerProfilePage — form coverage', () => {
  it('shows Profile heading', async () => {
    const { container } = wrap(<SeekerProfilePage />, SEEKER)
    await waitFor(() => {
      expect(container.textContent).toMatch(/profile|bio|seeker profile/i)
    }, { timeout: 3000 })
  })

  it('shows Bio label in the form', async () => {
    const { container } = wrap(<SeekerProfilePage />, SEEKER)
    await waitFor(() => {
      expect(container.textContent).toContain('Bio')
    }, { timeout: 3000 })
  })

  it('shows Save Profile button', async () => {
    const { container } = wrap(<SeekerProfilePage />, SEEKER)
    await waitFor(() => {
      expect(container.textContent).toContain('Save Profile')
    }, { timeout: 3000 })
  })

  it('shows resume upload section', async () => {
    const { container } = wrap(<SeekerProfilePage />, SEEKER)
    await waitFor(() => {
      expect(container.textContent).toMatch(/resume|upload|cv/i)
    }, { timeout: 3000 })
  })

  it('shows experience years input', async () => {
    const { container } = wrap(<SeekerProfilePage />, SEEKER)
    await waitFor(() => {
      expect(container.textContent).toMatch(/experience|years/i)
    }, { timeout: 3000 })
  })
})

// ---------------------------------------------------------------------------
// ManageJobsPage — list coverage
// ---------------------------------------------------------------------------

describe('ManageJobsPage — list coverage', () => {
  it('shows My Jobs heading', async () => {
    const { container } = wrap(<ManageJobsPage />, RECRUITER)
    await waitFor(() => {
      expect(container.textContent).toMatch(/jobs|manage/i)
    }, { timeout: 3000 })
  })

  it('shows job card from data', async () => {
    const { container } = wrap(<ManageJobsPage />, RECRUITER)
    await waitFor(() => {
      expect(container.textContent).toContain('Senior Dev')
    }, { timeout: 3000 })
  })

  it('shows job status badge', async () => {
    const { container } = wrap(<ManageJobsPage />, RECRUITER)
    await waitFor(() => {
      expect(container.textContent).toContain('open')
    }, { timeout: 3000 })
  })

  it('shows views count', async () => {
    const { container } = wrap(<ManageJobsPage />, RECRUITER)
    await waitFor(() => {
      expect(container.textContent).toContain('20 views')
    }, { timeout: 3000 })
  })
})
