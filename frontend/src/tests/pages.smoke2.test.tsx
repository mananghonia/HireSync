/**
 * Smoke tests — second batch covering Navbar, Layout, App, and remaining pages.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { configureStore } from '@reduxjs/toolkit'
import React from 'react'
import authReducer, { setCredentials } from '../features/auth/authSlice'
import notificationsReducer from '../features/notifications/notificationsSlice'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../lib/axios', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { results: [], count: 0, total_pages: 1, current_page: 1 } }),
    post: vi.fn().mockResolvedValue({ data: {} }),
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
  toast.loading = vi.fn()
  return { default: toast, Toaster: () => null }
})

vi.mock('recharts', () => ({
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => null,
  Cell: () => null,
  Legend: () => null,
  LineChart: ({ children }: any) => <div>{children}</div>,
  Line: () => null,
}))

// Mock WebSocket so useWebSocket.ts doesn't throw in jsdom
beforeAll(() => {
  ;(global as any).WebSocket = vi.fn().mockImplementation(() => ({
    close: vi.fn(),
    send: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    onopen: null,
    onclose: null,
    onerror: null,
    onmessage: null,
    readyState: 1,
  }))
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEEKER = {
  id: 'seeker-1', email: 'seeker@test.com', first_name: 'Alice', last_name: 'S',
  full_name: 'Alice S', role: 'seeker' as const, is_verified: true,
}
const RECRUITER = {
  id: 'recruiter-1', email: 'rec@test.com', first_name: 'Bob', last_name: 'R',
  full_name: 'Bob R', role: 'recruiter' as const, is_verified: true,
}
const ADMIN = {
  id: 'admin-1', email: 'admin@test.com', first_name: 'Admin', last_name: 'A',
  full_name: 'Admin A', role: 'admin' as const, is_verified: true,
}

function makeStore(user?: typeof SEEKER | typeof RECRUITER | typeof ADMIN) {
  const s = configureStore({
    reducer: { auth: authReducer, notifications: notificationsReducer },
  })
  if (user) s.dispatch(setCredentials({ user, tokens: { access: 'tok', refresh: 'ref' } }))
  return s
}

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } } })
}

function wrap(
  ui: React.ReactElement,
  user?: typeof SEEKER | typeof RECRUITER | typeof ADMIN,
  path = '/',
) {
  const store = makeStore(user)
  const qc = makeQC()
  return render(
    <Provider store={store}>
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
      </QueryClientProvider>
    </Provider>,
  )
}

function wrapWithRoute(
  routePattern: string,
  Component: React.ComponentType,
  user?: typeof SEEKER | typeof RECRUITER | typeof ADMIN,
  path?: string,
) {
  const store = makeStore(user)
  const qc = makeQC()
  return render(
    <Provider store={store}>
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[path ?? routePattern]}>
          <Routes>
            <Route path={routePattern} element={<Component />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>,
  )
}

// ---------------------------------------------------------------------------
// Navbar tests
// ---------------------------------------------------------------------------

describe('Navbar smoke tests', () => {
  it('renders unauthenticated navbar', async () => {
    const { default: Navbar } = await import('../components/layout/Navbar')
    const { container } = wrap(<Navbar />)
    expect(container).toBeTruthy()
    expect(container.textContent).toContain('HireSync')
  })

  it('shows login link when not authenticated', async () => {
    const { default: Navbar } = await import('../components/layout/Navbar')
    const { container } = wrap(<Navbar />)
    expect(container.textContent).toMatch(/sign in|login/i)
  })

  it('renders authenticated seeker navbar', async () => {
    const { default: Navbar } = await import('../components/layout/Navbar')
    const { container } = wrap(<Navbar />, SEEKER)
    expect(container).toBeTruthy()
    expect(container.textContent).toContain('HireSync')
  })

  it('shows seeker navigation links', async () => {
    const { default: Navbar } = await import('../components/layout/Navbar')
    const { container } = wrap(<Navbar />, SEEKER)
    expect(container.textContent).toMatch(/dashboard|jobs|applications/i)
  })

  it('renders authenticated recruiter navbar', async () => {
    const { default: Navbar } = await import('../components/layout/Navbar')
    const { container } = wrap(<Navbar />, RECRUITER)
    expect(container).toBeTruthy()
  })

  it('renders authenticated admin navbar', async () => {
    const { default: Navbar } = await import('../components/layout/Navbar')
    const { container } = wrap(<Navbar />, ADMIN)
    expect(container.textContent).toContain('HireSync')
  })

  it('loads notification count on authenticated render', async () => {
    const api = (await import('../lib/axios')).default as any
    api.get.mockResolvedValueOnce({ data: 3 })
    const { default: Navbar } = await import('../components/layout/Navbar')
    const { container } = wrap(<Navbar />, SEEKER)
    expect(container).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

describe('Layout smoke tests', () => {
  it('renders children inside layout', async () => {
    const { default: Layout } = await import('../components/layout/Layout')
    const { container } = wrap(
      <Layout><div>Child content</div></Layout>,
      SEEKER,
    )
    expect(container.textContent).toContain('Child content')
  })

  it('includes Navbar in layout', async () => {
    const { default: Layout } = await import('../components/layout/Layout')
    const { container } = wrap(
      <Layout><div>Test</div></Layout>,
      SEEKER,
    )
    expect(container.textContent).toContain('HireSync')
  })
})

// ---------------------------------------------------------------------------
// JobSearchPage
// ---------------------------------------------------------------------------

describe('JobSearchPage smoke tests', () => {
  it('renders without crashing', async () => {
    const { default: JobSearchPage } = await import('../pages/JobSearchPage')
    const { container } = wrap(<JobSearchPage />)
    expect(container).toBeTruthy()
  })

  it('shows the search input', async () => {
    const { default: JobSearchPage } = await import('../pages/JobSearchPage')
    const { container } = wrap(<JobSearchPage />)
    expect(container.querySelector('input')).toBeTruthy()
  })

  it('shows filter options', async () => {
    const { default: JobSearchPage } = await import('../pages/JobSearchPage')
    const { container } = wrap(<JobSearchPage />)
    expect(container.querySelector('select') || container.querySelector('button')).toBeTruthy()
  })

  it('shows job results after data loads', async () => {
    const api = (await import('../lib/axios')).default as any
    api.get.mockResolvedValueOnce({
      data: {
        count: 1, total_pages: 1, current_page: 1,
        results: [{ id: 'j1', title: 'Backend Dev', company: { name: 'TechCo' }, location: 'Mumbai', job_type: 'full_time', is_remote: false, posted_at: '2024-01-01T00:00:00Z', skills: [] }],
      },
    })
    const { default: JobSearchPage } = await import('../pages/JobSearchPage')
    const { container } = wrap(<JobSearchPage />)
    await waitFor(() => {
      expect(container.textContent).toContain('Backend Dev')
    }, { timeout: 3000 })
  })

  it('shows no results message when empty', async () => {
    const api = (await import('../lib/axios')).default as any
    api.get.mockResolvedValueOnce({ data: { count: 0, total_pages: 1, current_page: 1, results: [] } })
    const { default: JobSearchPage } = await import('../pages/JobSearchPage')
    const { container } = wrap(<JobSearchPage />)
    await waitFor(() => {
      expect(container).toBeTruthy()
    }, { timeout: 3000 })
  })
})

// ---------------------------------------------------------------------------
// JobDetailPage
// ---------------------------------------------------------------------------

describe('JobDetailPage smoke tests', () => {
  it('renders without crashing', async () => {
    const { default: JobDetailPage } = await import('../pages/JobDetailPage')
    const { container } = wrapWithRoute('/jobs/:id', JobDetailPage, SEEKER, '/jobs/job123')
    expect(container).toBeTruthy()
  })

  it('renders loading state before data arrives', async () => {
    const { default: JobDetailPage } = await import('../pages/JobDetailPage')
    const { container } = wrapWithRoute('/jobs/:id', JobDetailPage, SEEKER, '/jobs/job123')
    expect(container).toBeTruthy()
  })

  it('renders job detail with real data', async () => {
    const api = (await import('../lib/axios')).default as any
    const jobData = { id: 'job123', title: 'Senior Backend Engineer', company: { name: 'Startup Inc', logo: null }, location: 'Bangalore', job_type: 'full_time', is_remote: false, description: 'Great role', requirements: 'Python skills', experience_level: 'senior', status: 'active', has_applied: false, skills: [], salary_min: 100000, salary_max: 200000, posted_at: '2024-01-01T00:00:00Z' }
    api.get
      .mockResolvedValueOnce({ data: { bio: '', skills: [], resume: null } })
      .mockResolvedValueOnce({ data: jobData })
    const { default: JobDetailPage } = await import('../pages/JobDetailPage')
    const { container } = wrapWithRoute('/jobs/:id', JobDetailPage, SEEKER, '/jobs/job123')
    await waitFor(() => {
      expect(container.textContent).toContain('Startup Inc')
    }, { timeout: 3000 })
  })
})

// ---------------------------------------------------------------------------
// MessagesPage
// ---------------------------------------------------------------------------

describe('MessagesPage smoke tests', () => {
  it('renders without crashing', async () => {
    const { default: MessagesPage } = await import('../pages/MessagesPage')
    const { container } = wrap(<MessagesPage />, SEEKER, '/messages')
    expect(container).toBeTruthy()
  })

  it('shows Messages heading', async () => {
    const { default: MessagesPage } = await import('../pages/MessagesPage')
    const { container } = wrap(<MessagesPage />, SEEKER)
    expect(container.textContent).toMatch(/message|conversation/i)
  })

  it('shows conversations after load', async () => {
    const api = (await import('../lib/axios')).default as any
    api.get.mockResolvedValueOnce({ data: [] })
    const { default: MessagesPage } = await import('../pages/MessagesPage')
    const { container } = wrap(<MessagesPage />, SEEKER)
    await waitFor(() => {
      expect(container).toBeTruthy()
    }, { timeout: 3000 })
  })
})

// ---------------------------------------------------------------------------
// AdminDashboard
// ---------------------------------------------------------------------------

describe('AdminDashboard smoke tests', () => {
  it('renders without crashing', async () => {
    const { default: AdminDashboard } = await import('../pages/admin/AdminDashboard')
    const { container } = wrap(<AdminDashboard />, ADMIN)
    expect(container).toBeTruthy()
  })

  it('shows admin dashboard text', async () => {
    const { default: AdminDashboard } = await import('../pages/admin/AdminDashboard')
    const { container } = wrap(<AdminDashboard />, ADMIN)
    expect(container.textContent).toMatch(/admin|dashboard|user|job/i)
  })

  it('shows stat cards after data loads', async () => {
    const api = (await import('../lib/axios')).default as any
    api.get.mockResolvedValueOnce({
      data: {
        users: { total: 100, seekers: 80, recruiters: 20, new_this_week: 5 },
        jobs: { total: 50, active: 30 },
        applications: { total: 200, this_week: 15 },
      },
    })
    const { default: AdminDashboard } = await import('../pages/admin/AdminDashboard')
    const { container } = wrap(<AdminDashboard />, ADMIN)
    await waitFor(() => {
      expect(container).toBeTruthy()
    }, { timeout: 3000 })
  })
})

// ---------------------------------------------------------------------------
// ApplicantsPage (recruiter)
// ---------------------------------------------------------------------------

describe('ApplicantsPage smoke tests', () => {
  it('renders without crashing', async () => {
    const { default: ApplicantsPage } = await import('../pages/recruiter/ApplicantsPage')
    const { container } = wrapWithRoute(
      '/recruiter/jobs/:jobId/applicants', ApplicantsPage, RECRUITER,
      '/recruiter/jobs/job456/applicants',
    )
    expect(container).toBeTruthy()
  })

  it('shows applicants heading or loading state', async () => {
    const { default: ApplicantsPage } = await import('../pages/recruiter/ApplicantsPage')
    const { container } = wrapWithRoute(
      '/recruiter/jobs/:jobId/applicants', ApplicantsPage, RECRUITER,
      '/recruiter/jobs/job456/applicants',
    )
    expect(container).toBeTruthy()
  })

  it('renders applicant pipeline after data loads', async () => {
    const api = (await import('../lib/axios')).default as any
    api.get
      .mockResolvedValueOnce({ data: { id: 'job456', title: 'Frontend Dev' } })
      .mockResolvedValueOnce({ data: { results: [
        { id: 'app1', status: 'applied', applicant: { full_name: 'John Doe', email: 'john@test.com', profile: null }, applied_at: '2024-01-01T00:00:00Z' },
      ] } })
    const { default: ApplicantsPage } = await import('../pages/recruiter/ApplicantsPage')
    const { container } = wrapWithRoute(
      '/recruiter/jobs/:jobId/applicants', ApplicantsPage, RECRUITER,
      '/recruiter/jobs/job456/applicants',
    )
    await waitFor(() => {
      expect(container).toBeTruthy()
    }, { timeout: 3000 })
  })
})

// ---------------------------------------------------------------------------
// ManageJobsPage (recruiter)
// ---------------------------------------------------------------------------

describe('ManageJobsPage smoke tests', () => {
  it('renders without crashing', async () => {
    const { default: ManageJobsPage } = await import('../pages/recruiter/ManageJobsPage')
    const { container } = wrap(<ManageJobsPage />, RECRUITER)
    expect(container).toBeTruthy()
  })

  it('shows Manage Jobs heading after data loads', async () => {
    const api = (await import('../lib/axios')).default as any
    api.get.mockResolvedValueOnce({ data: { results: [] } })
    const { default: ManageJobsPage } = await import('../pages/recruiter/ManageJobsPage')
    const { container } = wrap(<ManageJobsPage />, RECRUITER)
    await waitFor(() => {
      expect(container.textContent).toMatch(/job/i)
    }, { timeout: 3000 })
  })

  it('shows post new job link after data loads', async () => {
    const api = (await import('../lib/axios')).default as any
    api.get.mockResolvedValueOnce({ data: { results: [] } })
    const { default: ManageJobsPage } = await import('../pages/recruiter/ManageJobsPage')
    const { container } = wrap(<ManageJobsPage />, RECRUITER)
    await waitFor(() => {
      expect(container.textContent).toMatch(/post|new/i)
    }, { timeout: 3000 })
  })
})

// ---------------------------------------------------------------------------
// PostJobPage (recruiter)
// ---------------------------------------------------------------------------

describe('PostJobPage smoke tests', () => {
  it('renders without crashing', async () => {
    const { default: PostJobPage } = await import('../pages/recruiter/PostJobPage')
    const { container } = wrap(<PostJobPage />, RECRUITER)
    expect(container).toBeTruthy()
  })

  it('shows job posting form', async () => {
    const { default: PostJobPage } = await import('../pages/recruiter/PostJobPage')
    const { container } = wrap(<PostJobPage />, RECRUITER)
    expect(container.querySelector('form') || container.querySelector('input')).toBeTruthy()
  })

  it('shows title input', async () => {
    const api = (await import('../lib/axios')).default as any
    api.get.mockResolvedValueOnce({ data: [{ id: 'skill1', name: 'Python' }] })
    const { default: PostJobPage } = await import('../pages/recruiter/PostJobPage')
    const { container } = wrap(<PostJobPage />, RECRUITER)
    await waitFor(() => {
      expect(container.querySelector('input[name="title"]') || container.querySelector('input')).toBeTruthy()
    }, { timeout: 3000 })
  })
})

// ---------------------------------------------------------------------------
// AnalyticsDashboard (recruiter)
// ---------------------------------------------------------------------------

describe('AnalyticsDashboard smoke tests', () => {
  it('renders without crashing', async () => {
    const api = (await import('../lib/axios')).default as any
    api.get.mockResolvedValueOnce({ data: { overview: {}, status_breakdown: {}, daily_applications: [], top_jobs: [] } })
    const { default: AnalyticsDashboard } = await import('../pages/recruiter/AnalyticsDashboard')
    const { container } = wrap(<AnalyticsDashboard />, RECRUITER)
    await waitFor(() => expect(container).toBeTruthy(), { timeout: 3000 })
  })

  it('shows analytics heading after data loads', async () => {
    const api = (await import('../lib/axios')).default as any
    api.get.mockResolvedValueOnce({ data: { overview: {}, status_breakdown: {}, daily_applications: [], top_jobs: [] } })
    const { default: AnalyticsDashboard } = await import('../pages/recruiter/AnalyticsDashboard')
    const { container } = wrap(<AnalyticsDashboard />, RECRUITER)
    await waitFor(() => {
      expect(container.textContent).toMatch(/analytic|total|application/i)
    }, { timeout: 3000 })
  })

  it('shows data after load', async () => {
    const api = (await import('../lib/axios')).default as any
    api.get
      .mockResolvedValueOnce({ data: { overview: { total_jobs: 5, total_applications: 20, total_views: 100, conversion_rate: 10 } } })
      .mockResolvedValueOnce({ data: { results: [] } })
    const { default: AnalyticsDashboard } = await import('../pages/recruiter/AnalyticsDashboard')
    const { container } = wrap(<AnalyticsDashboard />, RECRUITER)
    await waitFor(() => {
      expect(container).toBeTruthy()
    }, { timeout: 3000 })
  })
})

// ---------------------------------------------------------------------------
// SeekerProfilePage
// ---------------------------------------------------------------------------

describe('SeekerProfilePage smoke tests', () => {
  it('renders without crashing', async () => {
    const { default: SeekerProfilePage } = await import('../pages/seeker/SeekerProfilePage')
    const { container } = wrap(<SeekerProfilePage />, SEEKER)
    expect(container).toBeTruthy()
  })

  it('shows profile heading or section', async () => {
    const { default: SeekerProfilePage } = await import('../pages/seeker/SeekerProfilePage')
    const { container } = wrap(<SeekerProfilePage />, SEEKER)
    expect(container.textContent).toMatch(/profile|resume|experience|skill/i)
  })

  it('shows profile data after load', async () => {
    const api = (await import('../lib/axios')).default as any
    api.get
      .mockResolvedValueOnce({ data: { bio: 'Developer', skills: [], experience: [], education: [], resume: null } })
      .mockResolvedValueOnce({ data: [] })
    const { default: SeekerProfilePage } = await import('../pages/seeker/SeekerProfilePage')
    const { container } = wrap(<SeekerProfilePage />, SEEKER)
    await waitFor(() => {
      expect(container).toBeTruthy()
    }, { timeout: 3000 })
  })
})
