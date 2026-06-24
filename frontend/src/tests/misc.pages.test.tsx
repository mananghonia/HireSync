/**
 * Miscellaneous page tests targeting uncovered lines:
 * - SeekerApplicationsPage (seeker/ApplicationsPage.tsx): 37.5% → covers card rows, withdraw, message
 * - NotificationsPage: 60% → covers mark-all-read, mark-read click
 * - ManageJobsPage: 60% → covers job rows, pause/close buttons
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, waitFor, fireEvent } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { configureStore } from '@reduxjs/toolkit'
import React from 'react'
import authReducer, { setCredentials } from '../features/auth/authSlice'
import notificationsReducer from '../features/notifications/notificationsSlice'

import SeekerApplicationsPage from '../pages/seeker/ApplicationsPage'
import NotificationsPage from '../pages/NotificationsPage'
import ManageJobsPage from '../pages/recruiter/ManageJobsPage'
import SeekerDashboard from '../pages/seeker/SeekerDashboard'
import AnalyticsDashboard from '../pages/recruiter/AnalyticsDashboard'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../lib/axios', () => ({
  default: {
    get: vi.fn(),
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

vi.mock('react-hot-toast', () => {
  const toast: any = vi.fn()
  toast.success = vi.fn()
  toast.error = vi.fn()
  return { default: toast, Toaster: () => null }
})

vi.mock('@react-oauth/google', () => ({
  GoogleLogin: () => null,
  GoogleOAuthProvider: ({ children }: any) => <>{children}</>,
}))

vi.mock('recharts', () => ({
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => null,
  Cell: () => null,
  Legend: () => null,
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...(actual as any), useNavigate: () => mockNavigate }
})

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const SEEKER = { id: 'u1', email: 's@test.com', first_name: 'Alice', last_name: 'S', full_name: 'Alice S', role: 'seeker' as const, is_verified: true }
const RECRUITER = { id: 'r1', email: 'r@test.com', first_name: 'Bob', last_name: 'R', full_name: 'Bob R', role: 'recruiter' as const, is_verified: true }

const APPLICATIONS = [
  {
    id: 1, status: 'applied', applied_at: '2024-01-15T00:00:00Z',
    job: { id: 'j1', title: 'Frontend Dev', location: 'Mumbai', recruiter_id: 'r1', company: { name: 'TechCo' } },
  },
  {
    id: 2, status: 'withdrawn', applied_at: '2024-01-10T00:00:00Z',
    job: { id: 'j2', title: 'Backend Dev', location: 'Pune', recruiter_id: 'r2', company: { name: 'StartupX' } },
  },
  {
    id: 3, status: 'hired', applied_at: '2024-01-05T00:00:00Z',
    job: { id: 'j3', title: 'Full Stack Dev', location: 'Remote', recruiter_id: 'r3', company: { name: 'DevCorp' } },
  },
  {
    id: 4, status: 'rejected', applied_at: '2024-01-02T00:00:00Z',
    job: { id: 'j4', title: 'DevOps Engineer', location: 'Bangalore', recruiter_id: 'r4', company: { name: 'CloudCo' } },
  },
]

const NOTIFICATIONS = [
  { id: 1, notification_type: 'application_status', title: 'Your app status changed', message: 'Status updated', created_at: '2024-01-15T10:00:00Z', is_read: false },
  { id: 2, notification_type: 'new_message', title: 'New message', message: 'You got a message', created_at: '2024-01-14T10:00:00Z', is_read: true },
]

const JOBS = [
  { id: 'j1', title: 'React Dev', location: 'Mumbai', status: 'active', views_count: 42, created_at: '2024-01-01T00:00:00Z', company: { name: 'TechCo' } },
  { id: 'j2', title: 'Python Dev', location: 'Pune', status: 'paused', views_count: 10, created_at: '2024-01-02T00:00:00Z', company: { name: 'TechCo' } },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStore(user: typeof SEEKER | typeof RECRUITER) {
  const s = configureStore({ reducer: { auth: authReducer, notifications: notificationsReducer } })
  s.dispatch(setCredentials({ user, tokens: { access: 'tok', refresh: 'ref' } }))
  return s
}

function wrapSeeker(ui: React.ReactElement) {
  const store = makeStore(SEEKER)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } } })
  return render(
    <Provider store={store}>
      <QueryClientProvider client={qc}>
        <MemoryRouter>{ui}</MemoryRouter>
      </QueryClientProvider>
    </Provider>,
  )
}

function wrapRecruiter(ui: React.ReactElement) {
  const store = makeStore(RECRUITER)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } } })
  return render(
    <Provider store={store}>
      <QueryClientProvider client={qc}>
        <MemoryRouter>{ui}</MemoryRouter>
      </QueryClientProvider>
    </Provider>,
  )
}

beforeAll(() => {
  ;(global as any).WebSocket = vi.fn().mockImplementation(() => ({
    close: vi.fn(), send: vi.fn(), readyState: 1, onopen: null, onclose: null, onerror: null, onmessage: null,
  }))
})

beforeEach(async () => {
  const api = (await import('../lib/axios')).default as any
  api.get.mockReset()
  api.post.mockReset()
  api.patch.mockReset()
  api.post.mockResolvedValue({ data: {} })
  api.patch.mockResolvedValue({ data: {} })
  mockNavigate.mockReset()
})

// ===========================================================================
// SeekerApplicationsPage
// ===========================================================================

describe('SeekerApplicationsPage', () => {
  async function renderWithData() {
    const api = (await import('../lib/axios')).default as any
    api.get.mockImplementation((url: string) => {
      if (url.includes('/applications/my/')) return Promise.resolve({ data: { results: APPLICATIONS } })
      if (url.includes('/notifications/unread-count/')) return Promise.resolve({ data: { unread_count: 0 } })
      return Promise.resolve({ data: {} })
    })
    const result = wrapSeeker(<SeekerApplicationsPage />)
    await waitFor(() => expect(result.container.textContent).toContain('Frontend Dev'), { timeout: 3000 })
    return result
  }

  it('renders My Applications heading', async () => {
    const { container } = await renderWithData()
    expect(container.textContent).toContain('My Applications')
  })

  it('shows all application job titles', async () => {
    const { container } = await renderWithData()
    expect(container.textContent).toContain('Frontend Dev')
    expect(container.textContent).toContain('Backend Dev')
    expect(container.textContent).toContain('Full Stack Dev')
  })

  it('shows company names', async () => {
    const { container } = await renderWithData()
    expect(container.textContent).toContain('TechCo')
    expect(container.textContent).toContain('StartupX')
  })

  it('shows applied status badge', async () => {
    const { container } = await renderWithData()
    expect(container.textContent).toContain('applied')
  })

  it('shows withdrawn status badge', async () => {
    const { container } = await renderWithData()
    expect(container.textContent).toContain('withdrawn')
  })

  it('shows hired status badge', async () => {
    const { container } = await renderWithData()
    expect(container.textContent).toContain('hired')
  })

  it('shows Apply Again button for withdrawn application', async () => {
    const { container } = await renderWithData()
    expect(container.textContent).toContain('Apply Again')
  })

  it('shows Withdraw button for pending application', async () => {
    const { container } = await renderWithData()
    expect(container.textContent).toContain('Withdraw')
  })

  it('no Withdraw button for hired/rejected', async () => {
    const { container } = await renderWithData()
    const withdrawBtns = Array.from(container.querySelectorAll('button')).filter(b => b.textContent?.trim() === 'Withdraw')
    // Only 1 withdraw button (for 'applied' status, not hired/rejected/withdrawn)
    expect(withdrawBtns.length).toBe(1)
  })

  it('clicking Withdraw calls api.post withdraw', async () => {
    const api = (await import('../lib/axios')).default as any
    const { container } = await renderWithData()

    const withdrawBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Withdraw')
    if (withdrawBtn) fireEvent.click(withdrawBtn)

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(expect.stringContaining('/withdraw/'))
    }, { timeout: 3000 })
  })

  it('clicking message icon calls api.post to start conversation', async () => {
    const api = (await import('../lib/axios')).default as any
    api.post.mockResolvedValue({ data: { id: 'c1' } })

    const { container } = await renderWithData()
    const msgBtn = container.querySelector('button[title="Message recruiter"]')
    if (msgBtn) fireEvent.click(msgBtn)

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/messaging/conversations/start/', { user_id: 'r1' })
    }, { timeout: 3000 })
  })

  it('clicking Apply Again navigates to job detail', async () => {
    const { container } = await renderWithData()
    const applyAgainBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Apply Again'))
    if (applyAgainBtn) fireEvent.click(applyAgainBtn)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/jobs/'))
    }, { timeout: 2000 })
  })

  it('shows empty state when no applications', async () => {
    const api = (await import('../lib/axios')).default as any
    api.get.mockImplementation((url: string) => {
      if (url.includes('/applications/my/')) return Promise.resolve({ data: { results: [] } })
      return Promise.resolve({ data: {} })
    })

    const { container } = wrapSeeker(<SeekerApplicationsPage />)
    await waitFor(() => expect(container.textContent).toContain('No applications yet'), { timeout: 3000 })
  })

  it('clicking job title navigates to job detail', async () => {
    const { container } = await renderWithData()
    const jobTitle = container.querySelector('.cursor-pointer')
    if (jobTitle) fireEvent.click(jobTitle)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/jobs/'))
    }, { timeout: 2000 })
  })
})

// ===========================================================================
// NotificationsPage
// ===========================================================================

describe('NotificationsPage', () => {
  async function renderWithData() {
    const api = (await import('../lib/axios')).default as any
    api.get.mockImplementation((url: string) => {
      if (url.includes('/notifications/') && !url.includes('unread')) return Promise.resolve({ data: { results: NOTIFICATIONS } })
      if (url.includes('/notifications/unread-count/')) return Promise.resolve({ data: { unread_count: 1 } })
      return Promise.resolve({ data: {} })
    })
    const result = wrapSeeker(<NotificationsPage />)
    await waitFor(() => expect(result.container.textContent).toContain('Your app status changed'), { timeout: 3000 })
    return result
  }

  it('renders Notifications heading', async () => {
    const { container } = await renderWithData()
    expect(container.textContent).toContain('Notifications')
  })

  it('shows notification titles', async () => {
    const { container } = await renderWithData()
    expect(container.textContent).toContain('Your app status changed')
    expect(container.textContent).toContain('New message')
  })

  it('shows Mark all read button', async () => {
    const { container } = await renderWithData()
    expect(container.textContent).toContain('Mark all read')
  })

  it('clicking Mark all read calls api.post', async () => {
    const api = (await import('../lib/axios')).default as any
    const { container } = await renderWithData()

    const markAllBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Mark all read'))
    if (markAllBtn) fireEvent.click(markAllBtn)

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/notifications/mark-all-read/')
    }, { timeout: 3000 })
  })

  it('clicking unread notification marks it read', async () => {
    const api = (await import('../lib/axios')).default as any
    const { container } = await renderWithData()

    // Click the unread notification (first one, is_read: false)
    const notifItems = container.querySelectorAll('[class*="cursor-pointer"]')
    if (notifItems.length > 0) fireEvent.click(notifItems[0])

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(expect.stringContaining('/notifications/'))
    }, { timeout: 3000 })
  })

  it('shows empty state when no notifications', async () => {
    const api = (await import('../lib/axios')).default as any
    api.get.mockImplementation((url: string) => {
      if (url.includes('/notifications/')) return Promise.resolve({ data: { results: [] } })
      return Promise.resolve({ data: {} })
    })

    const { container } = wrapSeeker(<NotificationsPage />)
    await waitFor(() => expect(container.textContent).toContain('No notifications yet'), { timeout: 3000 })
  })
})

// ===========================================================================
// ManageJobsPage
// ===========================================================================

describe('ManageJobsPage', () => {
  async function renderWithData() {
    const api = (await import('../lib/axios')).default as any
    api.get.mockImplementation((url: string) => {
      if (url.includes('/jobs/my_jobs/')) return Promise.resolve({ data: { results: JOBS } })
      if (url.includes('/notifications/unread-count/')) return Promise.resolve({ data: { unread_count: 0 } })
      return Promise.resolve({ data: {} })
    })
    const result = wrapRecruiter(<ManageJobsPage />)
    await waitFor(() => expect(result.container.textContent).toContain('React Dev'), { timeout: 3000 })
    return result
  }

  it('renders My Jobs heading', async () => {
    const { container } = await renderWithData()
    expect(container.textContent).toContain('My Jobs')
  })

  it('shows job titles', async () => {
    const { container } = await renderWithData()
    expect(container.textContent).toContain('React Dev')
    expect(container.textContent).toContain('Python Dev')
  })

  it('shows job location and company', async () => {
    const { container } = await renderWithData()
    expect(container.textContent).toContain('Mumbai')
    expect(container.textContent).toContain('TechCo')
  })

  it('shows job status badges', async () => {
    const { container } = await renderWithData()
    expect(container.textContent).toContain('active')
    expect(container.textContent).toContain('paused')
  })

  it('shows Post New Job link', async () => {
    const { container } = await renderWithData()
    expect(container.textContent).toContain('Post New Job')
  })

  it('shows Applicants link per job', async () => {
    const { container } = await renderWithData()
    expect(container.textContent).toContain('Applicants')
  })

  it('pause button calls api.patch with paused status for active job', async () => {
    const api = (await import('../lib/axios')).default as any
    const { container } = await renderWithData()

    // Active job has a pause button
    const pauseBtn = container.querySelector('button[title]') ||
      Array.from(container.querySelectorAll('button')).find(b => {
        const icon = b.querySelector('svg')
        return icon && b.className.includes('hover:text-yellow')
      })
    if (pauseBtn) fireEvent.click(pauseBtn as HTMLElement)

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith(expect.stringContaining('/jobs/'), expect.objectContaining({ status: 'paused' }))
    }, { timeout: 3000 })
  })

  it('play button calls api.patch with active status for paused job', async () => {
    const api = (await import('../lib/axios')).default as any
    const { container } = await renderWithData()

    // Find the play button (paused job has play to resume)
    const playBtn = Array.from(container.querySelectorAll('button')).find(b => b.className.includes('hover:text-green'))
    if (playBtn) fireEvent.click(playBtn as HTMLElement)

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith(expect.stringContaining('/jobs/'), expect.objectContaining({ status: 'active' }))
    }, { timeout: 3000 })
  })

  it('close (X) button calls api.patch with closed status', async () => {
    const api = (await import('../lib/axios')).default as any
    const { container } = await renderWithData()

    const closeBtn = Array.from(container.querySelectorAll('button')).find(b => b.className.includes('hover:text-red'))
    if (closeBtn) fireEvent.click(closeBtn as HTMLElement)

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith(expect.stringContaining('/jobs/'), expect.objectContaining({ status: 'closed' }))
    }, { timeout: 3000 })
  })

  it('shows empty state with link when no jobs', async () => {
    const api = (await import('../lib/axios')).default as any
    api.get.mockImplementation((url: string) => {
      if (url.includes('/jobs/my_jobs/')) return Promise.resolve({ data: { results: [] } })
      return Promise.resolve({ data: {} })
    })

    const { container } = wrapRecruiter(<ManageJobsPage />)
    await waitFor(() => expect(container.textContent).toContain('No jobs posted yet'), { timeout: 3000 })
  })
})

// ===========================================================================
// SeekerDashboard — covers filter callbacks (lines 28-30, 82)
// ===========================================================================

describe('SeekerDashboard', () => {
  const APPS = [
    { id: 1, status: 'applied', applied_at: '2024-01-15T00:00:00Z', job: { id: 'j1', title: 'React Dev', company: { name: 'TechCo' } } },
    { id: 2, status: 'hired', applied_at: '2024-01-10T00:00:00Z', job: { id: 'j2', title: 'Backend Dev', company: { name: 'StartupX' } } },
    { id: 3, status: 'rejected', applied_at: '2024-01-05T00:00:00Z', job: { id: 'j3', title: 'DevOps', company: { name: 'CloudCo' } } },
  ]

  async function renderWithApps() {
    const api = (await import('../lib/axios')).default as any
    api.get.mockImplementation((url: string) => {
      if (url.includes('/applications/my/')) return Promise.resolve({ data: { results: APPS } })
      if (url.includes('/notifications/unread-count/')) return Promise.resolve({ data: { unread_count: 0 } })
      return Promise.resolve({ data: {} })
    })
    const result = wrapSeeker(<SeekerDashboard />)
    await waitFor(() => expect(result.container.textContent).toContain('Welcome back'), { timeout: 3000 })
    return result
  }

  it('shows welcome message', async () => {
    const { container } = await renderWithApps()
    expect(container.textContent).toContain('Welcome back')
  })

  it('shows Total Applications stat', async () => {
    const { container } = await renderWithApps()
    await waitFor(() => expect(container.textContent).toContain('Total Applications'), { timeout: 3000 })
  })

  it('shows correct app counts from filter callbacks', async () => {
    const { container } = await renderWithApps()
    // APPS has: 1 active (applied), 1 hired, 1 rejected
    await waitFor(() => expect(container.textContent).toContain('3'), { timeout: 3000 })
  })

  it('shows Recent Applications section', async () => {
    const { container } = await renderWithApps()
    expect(container.textContent).toContain('Recent Applications')
  })

  it('shows job title in recent apps list', async () => {
    const { container } = await renderWithApps()
    await waitFor(() => expect(container.textContent).toContain('React Dev'), { timeout: 3000 })
  })

  it('shows Browse Jobs card', async () => {
    const { container } = await renderWithApps()
    expect(container.textContent).toContain('Browse Jobs')
  })

  it('shows Update Profile card', async () => {
    const { container } = await renderWithApps()
    expect(container.textContent).toContain('Update Profile')
  })
})

// ===========================================================================
// SeekerApplicationsPage — onError for message recruiter (line 39)
// ===========================================================================

describe('SeekerApplicationsPage — message recruiter onError', () => {
  it('shows error toast when start conversation api call fails (covers line 39)', async () => {
    const toast = (await import('react-hot-toast')).default as any
    const api = (await import('../lib/axios')).default as any
    api.get.mockImplementation((url: string) => {
      if (url.includes('/applications/my/')) return Promise.resolve({ data: { results: [
        { id: 1, status: 'applied', applied_at: '2024-01-15T00:00:00Z', job: { id: 'j1', title: 'Frontend Dev', location: 'Mumbai', recruiter_id: 'r1', company: { name: 'TechCo' } } },
      ] } })
      return Promise.resolve({ data: {} })
    })
    api.post.mockRejectedValueOnce({ response: { data: { detail: 'Conversation failed' } } })

    const result = wrapSeeker(<SeekerApplicationsPage />)
    await waitFor(() => expect(result.container.textContent).toContain('Frontend Dev'), { timeout: 3000 })

    const msgBtn = result.container.querySelector('button[title="Message recruiter"]')
    if (msgBtn) fireEvent.click(msgBtn)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Could not open conversation.')
    }, { timeout: 3000 })
  })
})

// ===========================================================================
// AnalyticsDashboard — covers lines 41 (XAxis) and 82 (top_jobs row)
// ===========================================================================

describe('AnalyticsDashboard — with non-empty data (covers lines 41, 82)', () => {
  const ANALYTICS_DATA = {
    overview: { total_jobs: 5, total_applications: 20, hired_count: 2, total_views: 150, conversion_rate: 10 },
    status_breakdown: { applied: 12, shortlisted: 5, hired: 3 },
    daily_applications: [
      { date: '2024-01-15', count: 3 },
      { date: '2024-01-16', count: 5 },
    ],
    top_jobs: [
      { id: 'j1', title: 'Senior React Dev', views_count: 80, app_count: 12 },
      { id: 'j2', title: 'Backend Engineer', views_count: 45, app_count: 8 },
    ],
  }

  async function renderAnalytics() {
    const api = (await import('../lib/axios')).default as any
    api.get.mockImplementation((url: string) => {
      if (url.includes('/analytics/recruiter/dashboard/')) return Promise.resolve({ data: ANALYTICS_DATA })
      if (url.includes('/notifications/unread-count/')) return Promise.resolve({ data: { unread_count: 0 } })
      return Promise.resolve({ data: {} })
    })
    const result = wrapRecruiter(<AnalyticsDashboard />)
    await waitFor(() => expect(result.container.textContent).toContain('Recruiter Analytics'), { timeout: 3000 })
    return result
  }

  it('renders Recruiter Analytics heading', async () => {
    const { container } = await renderAnalytics()
    expect(container.textContent).toContain('Recruiter Analytics')
  })

  it('shows Total Jobs stat', async () => {
    const { container } = await renderAnalytics()
    expect(container.textContent).toContain('Total Jobs')
    expect(container.textContent).toContain('5')
  })

  it('renders BarChart with daily_applications data (covers line 41 XAxis)', async () => {
    const { container } = await renderAnalytics()
    // dailyData.length > 0 → renders BarChart → covers line 41
    expect(container.querySelector('[data-testid="bar-chart"]') || container.querySelector('[data-testid="x-axis"]')).toBeTruthy()
  })

  it('shows top jobs in table (covers line 82 - tr key={job.id})', async () => {
    const { container } = await renderAnalytics()
    await waitFor(() => expect(container.textContent).toContain('Senior React Dev'), { timeout: 3000 })
    expect(container.textContent).toContain('Backend Engineer')
  })

  it('shows views count for top jobs', async () => {
    const { container } = await renderAnalytics()
    await waitFor(() => expect(container.textContent).toContain('80'), { timeout: 3000 })
  })
})
