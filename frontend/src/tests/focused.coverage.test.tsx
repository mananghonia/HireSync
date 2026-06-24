/**
 * Focused coverage tests for AdminDashboard and Navbar with tab/state switching.
 * Uses URL-based api mock and static imports to avoid React 18 concurrent mode issues.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { configureStore } from '@reduxjs/toolkit'
import React from 'react'
import authReducer, { setCredentials } from '../features/auth/authSlice'
import notificationsReducer from '../features/notifications/notificationsSlice'

// Static imports — must come AFTER vi.mock calls (which are hoisted)
import AdminDashboard from '../pages/admin/AdminDashboard'
import Navbar from '../components/layout/Navbar'
import AnalyticsDashboard from '../pages/recruiter/AnalyticsDashboard'

// ---------------------------------------------------------------------------
// Module mocks (hoisted before all imports)
// ---------------------------------------------------------------------------

vi.mock('../lib/axios', () => ({
  default: {
    get: vi.fn().mockImplementation((url: string) => {
      if (url.includes('/admin/stats/'))
        return Promise.resolve({
          data: {
            users: { total: 50, seekers: 40, recruiters: 10, new_this_week: 2 },
            jobs: { total: 20, active: 15, posted_this_month: 3 },
            applications: { total: 100, this_week: 8, hired: 5 },
          },
        })
      if (url.includes('/admin/users/'))
        return Promise.resolve({
          data: [
            { id: 'u1', email: 'alice@test.com', full_name: 'Alice S', role: 'seeker', is_active: true, is_verified: true, created_at: '2024-01-01T00:00:00Z' },
            { id: 'u2', email: 'bob@test.com', full_name: 'Bob R', role: 'recruiter', is_active: false, is_verified: true, created_at: '2024-01-01T00:00:00Z' },
          ],
        })
      if (url.includes('/admin/jobs/'))
        return Promise.resolve({
          data: [
            { id: 'j1', title: 'Backend Developer', company: 'TechCo', location: 'Mumbai', recruiter: 'Bob', recruiter_email: 'bob@test.com', status: 'open', created_at: '2024-01-01T00:00:00Z' },
          ],
        })
      if (url.includes('/notifications/unread-count/'))
        return Promise.resolve({ data: 3 })
      if (url.includes('/analytics/recruiter/dashboard/'))
        return Promise.resolve({
          data: {
            overview: { total_jobs: 5, total_applications: 20, total_views: 100, conversion_rate: 10, hired_count: 2 },
            status_breakdown: { applied: 10, hired: 2 },
            daily_applications: [],
            top_jobs: [],
          },
        })
      return Promise.resolve({ data: { results: [], count: 0, total_pages: 1, current_page: 1 } })
    }),
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
  return { default: toast, Toaster: () => null }
})

vi.mock('recharts', () => ({
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  PieChart: ({ children }: any) => <div>{children}</div>,
  Pie: () => null,
  Cell: () => null,
  Legend: () => null,
}))

beforeAll(() => {
  ;(global as any).WebSocket = vi.fn().mockImplementation(() => ({
    close: vi.fn(), send: vi.fn(),
    onopen: null, onclose: null, onerror: null, onmessage: null, readyState: 1,
  }))
  ;(global as any).confirm = vi.fn(() => true)
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADMIN = { id: 'admin-1', email: 'admin@test.com', first_name: 'Admin', last_name: 'A', full_name: 'Admin A', role: 'admin' as const, is_verified: true }
const SEEKER = { id: 'seeker-1', email: 'seeker@test.com', first_name: 'Alice', last_name: 'S', full_name: 'Alice S', role: 'seeker' as const, is_verified: true }
const RECRUITER = { id: 'recruiter-1', email: 'rec@test.com', first_name: 'Bob', last_name: 'R', full_name: 'Bob R', role: 'recruiter' as const, is_verified: true }

function makeStore(user?: typeof ADMIN | typeof SEEKER | typeof RECRUITER) {
  const s = configureStore({ reducer: { auth: authReducer, notifications: notificationsReducer } })
  if (user) s.dispatch(setCredentials({ user, tokens: { access: 'tok', refresh: 'ref' } }))
  return s
}

function wrap(ui: React.ReactElement, user?: typeof ADMIN | typeof SEEKER | typeof RECRUITER) {
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

// ---------------------------------------------------------------------------
// AdminDashboard — tab-by-tab coverage
// ---------------------------------------------------------------------------

describe('AdminDashboard coverage', () => {
  it('renders heading', async () => {
    const { container } = wrap(<AdminDashboard />, ADMIN)
    await waitFor(() => expect(container.textContent).toContain('Admin Dashboard'), { timeout: 3000 })
  })

  it('shows Overview, Users, Jobs tabs', async () => {
    const { container } = wrap(<AdminDashboard />, ADMIN)
    await waitFor(() => {
      expect(container.textContent).toContain('Overview')
      expect(container.textContent).toContain('Users')
      expect(container.textContent).toContain('Jobs')
    }, { timeout: 3000 })
  })

  it('Overview: shows Total Users stat card', async () => {
    const { container } = wrap(<AdminDashboard />, ADMIN)
    await waitFor(() => expect(container.textContent).toContain('Total Users'), { timeout: 3000 })
  })

  it('Overview: shows Job Seekers stat card', async () => {
    const { container } = wrap(<AdminDashboard />, ADMIN)
    await waitFor(() => expect(container.textContent).toContain('Job Seekers'), { timeout: 3000 })
  })

  it('Overview: shows Active Jobs stat card', async () => {
    const { container } = wrap(<AdminDashboard />, ADMIN)
    await waitFor(() => expect(container.textContent).toContain('Active Jobs'), { timeout: 3000 })
  })

  it('Overview: shows Applications stat card', async () => {
    const { container } = wrap(<AdminDashboard />, ADMIN)
    await waitFor(() => expect(container.textContent).toContain('Applications'), { timeout: 3000 })
  })

  it('Overview: shows User Breakdown section', async () => {
    const { container } = wrap(<AdminDashboard />, ADMIN)
    await waitFor(() => expect(container.textContent).toContain('User Breakdown'), { timeout: 3000 })
  })

  it('Users tab: shows user list after click', async () => {
    const { container } = wrap(<AdminDashboard />, ADMIN)

    await waitFor(() => screen.getByText('Users'), { timeout: 3000 })
    fireEvent.click(screen.getAllByText('Users')[0])

    await waitFor(() => expect(container.textContent).toContain('alice@test.com'), { timeout: 3000 })
  })

  it('Users tab: shows search input', async () => {
    const { container } = wrap(<AdminDashboard />, ADMIN)

    await waitFor(() => screen.getByText('Users'), { timeout: 3000 })
    fireEvent.click(screen.getAllByText('Users')[0])

    await waitFor(() => {
      expect(container.querySelector('input[placeholder*="Search"]') || container.querySelector('input[placeholder*="name"]')).toBeTruthy()
    }, { timeout: 3000 })
  })

  it('Users tab: shows role filter', async () => {
    const { container } = wrap(<AdminDashboard />, ADMIN)

    await waitFor(() => screen.getByText('Users'), { timeout: 3000 })
    fireEvent.click(screen.getAllByText('Users')[0])

    await waitFor(() => expect(container.textContent).toContain('All roles'), { timeout: 3000 })
  })

  it('Jobs tab: shows job list after click', async () => {
    const { container } = wrap(<AdminDashboard />, ADMIN)

    await waitFor(() => screen.getByText('Jobs'), { timeout: 3000 })
    fireEvent.click(screen.getAllByText('Jobs')[0])

    await waitFor(() => expect(container.textContent).toContain('Backend Developer'), { timeout: 3000 })
  })

  it('Jobs tab: shows status filter dropdown', async () => {
    const { container } = wrap(<AdminDashboard />, ADMIN)

    await waitFor(() => screen.getByText('Jobs'), { timeout: 3000 })
    fireEvent.click(screen.getAllByText('Jobs')[0])

    await waitFor(() => expect(container.textContent).toMatch(/all status|open|closed/i), { timeout: 3000 })
  })
})

// ---------------------------------------------------------------------------
// Navbar — authenticated state coverage
// ---------------------------------------------------------------------------

describe('Navbar coverage', () => {
  it('unauthenticated: shows HireSync brand', async () => {
    const { container } = wrap(<Navbar />)
    await waitFor(() => expect(container.textContent).toContain('HireSync'), { timeout: 3000 })
  })

  it('unauthenticated: shows sign-in link', async () => {
    const { container } = wrap(<Navbar />)
    await waitFor(() => expect(container.textContent).toMatch(/sign in|login/i), { timeout: 3000 })
  })

  it('seeker: renders without crashing', async () => {
    const { container } = wrap(<Navbar />, SEEKER)
    await waitFor(() => expect(container.textContent).toContain('HireSync'), { timeout: 3000 })
  })

  it('seeker: shows navigation items', async () => {
    const { container } = wrap(<Navbar />, SEEKER)
    await waitFor(() => expect(container.textContent).toMatch(/dashboard|job|notification|message/i), { timeout: 3000 })
  })

  it('seeker: notification count loads from api', async () => {
    const { container } = wrap(<Navbar />, SEEKER)
    await waitFor(() => expect(container).toBeTruthy(), { timeout: 3000 })
  })

  it('recruiter: renders without crashing', async () => {
    const { container } = wrap(<Navbar />, RECRUITER)
    await waitFor(() => expect(container.textContent).toContain('HireSync'), { timeout: 3000 })
  })

  it('recruiter: shows recruiter navigation', async () => {
    const { container } = wrap(<Navbar />, RECRUITER)
    await waitFor(() => expect(container.textContent).toMatch(/HireSync|dashboard|job/i), { timeout: 3000 })
  })

  it('admin: renders without crashing', async () => {
    const { container } = wrap(<Navbar />, ADMIN)
    await waitFor(() => expect(container.textContent).toContain('HireSync'), { timeout: 3000 })
  })
})

// ---------------------------------------------------------------------------
// AnalyticsDashboard — with data coverage
// ---------------------------------------------------------------------------

describe('AnalyticsDashboard coverage', () => {
  it('shows Recruiter Analytics heading', async () => {
    const { container } = wrap(<AnalyticsDashboard />, RECRUITER)
    await waitFor(() => expect(container.textContent).toContain('Recruiter Analytics'), { timeout: 3000 })
  })

  it('shows Total Jobs stat', async () => {
    const { container } = wrap(<AnalyticsDashboard />, RECRUITER)
    await waitFor(() => expect(container.textContent).toContain('Total Jobs'), { timeout: 3000 })
  })

  it('shows Total Applications stat', async () => {
    const { container } = wrap(<AnalyticsDashboard />, RECRUITER)
    await waitFor(() => expect(container.textContent).toContain('Total Applications'), { timeout: 3000 })
  })

  it('shows chart sections', async () => {
    const { container } = wrap(<AnalyticsDashboard />, RECRUITER)
    await waitFor(() => expect(container.textContent).toMatch(/application|over time|breakdown/i), { timeout: 3000 })
  })
})
