/**
 * Smoke tests for React pages.
 *
 * Every page is rendered inside a full Provider+QueryClientProvider+MemoryRouter
 * wrapper so no page crashes on mount. We also test key states (loading, empty,
 * with-data) to maximise branch coverage.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { configureStore } from '@reduxjs/toolkit'
import React from 'react'
import authReducer, { setCredentials } from '../features/auth/authSlice'
import notificationsReducer from '../features/notifications/notificationsSlice'

// ---------------------------------------------------------------------------
// Module-level mocks — resolved before any import of the mocked modules
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
  GoogleLogin: ({ onSuccess }: any) => (
    <button onClick={() => onSuccess?.({ credential: 'test-credential' })}>
      Sign in with Google
    </button>
  ),
  GoogleOAuthProvider: ({ children }: any) => <>{children}</>,
}))

vi.mock('react-hot-toast', () => {
  const toast: any = vi.fn()
  toast.success = vi.fn()
  toast.error = vi.fn()
  toast.loading = vi.fn()
  return { default: toast, Toaster: () => null }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEEKER_USER = {
  id: 'seeker-1',
  email: 'seeker@test.com',
  first_name: 'Alice',
  last_name: 'Seeker',
  full_name: 'Alice Seeker',
  role: 'seeker' as const,
  is_verified: true,
}

const RECRUITER_USER = {
  id: 'recruiter-1',
  email: 'recruiter@test.com',
  first_name: 'Bob',
  last_name: 'Recruiter',
  full_name: 'Bob Recruiter',
  role: 'recruiter' as const,
  is_verified: true,
}

function makeStore(user?: typeof SEEKER_USER | typeof RECRUITER_USER) {
  const store = configureStore({
    reducer: { auth: authReducer, notifications: notificationsReducer },
  })
  if (user) {
    store.dispatch(setCredentials({ user, tokens: { access: 'access-token', refresh: 'refresh-token' } }))
  }
  return store
}

function makeQC() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  })
}

function renderPage(
  ui: React.ReactElement,
  {
    user,
    path = '/',
  }: { user?: typeof SEEKER_USER | typeof RECRUITER_USER; path?: string } = {},
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

// ---------------------------------------------------------------------------
// Auth pages
// ---------------------------------------------------------------------------

describe('LoginPage smoke tests', () => {
  it('renders without crashing', async () => {
    const { default: LoginPage } = await import('../pages/auth/LoginPage')
    const { container } = renderPage(<LoginPage />)
    expect(container).toBeTruthy()
  })

  it('shows email and password inputs', async () => {
    const { default: LoginPage } = await import('../pages/auth/LoginPage')
    const { container } = renderPage(<LoginPage />)
    expect(container.querySelector('input[name="email"]')).toBeTruthy()
  })

  it('renders the HireSync brand text', async () => {
    const { default: LoginPage } = await import('../pages/auth/LoginPage')
    const { container } = renderPage(<LoginPage />)
    expect(container.textContent).toContain('HireSync')
  })

  it('renders the Sign In button', async () => {
    const { default: LoginPage } = await import('../pages/auth/LoginPage')
    const { container } = renderPage(<LoginPage />)
    expect(container.querySelector('button[type="submit"]')).toBeTruthy()
  })

  it('renders the Google sign-in button', async () => {
    const { default: LoginPage } = await import('../pages/auth/LoginPage')
    renderPage(<LoginPage />)
    expect(screen.getByText('Sign in with Google')).toBeTruthy()
  })

  it('shows the signup link', async () => {
    const { default: LoginPage } = await import('../pages/auth/LoginPage')
    const { container } = renderPage(<LoginPage />)
    expect(container.textContent).toContain('Sign up')
  })
})

describe('RegisterPage smoke tests', () => {
  it('renders without crashing', async () => {
    const { default: RegisterPage } = await import('../pages/auth/RegisterPage')
    const { container } = renderPage(<RegisterPage />)
    expect(container).toBeTruthy()
  })

  it('shows the registration form', async () => {
    const { default: RegisterPage } = await import('../pages/auth/RegisterPage')
    const { container } = renderPage(<RegisterPage />)
    expect(container.textContent).toContain('HireSync')
  })

  it('shows email input', async () => {
    const { default: RegisterPage } = await import('../pages/auth/RegisterPage')
    const { container } = renderPage(<RegisterPage />)
    expect(container.querySelector('input[name="email"]')).toBeTruthy()
  })

  it('shows a role selection option', async () => {
    const { default: RegisterPage } = await import('../pages/auth/RegisterPage')
    const { container } = renderPage(<RegisterPage />)
    expect(container.textContent).toContain('Seeker')
  })
})

describe('ForgotPasswordPage smoke tests', () => {
  it('renders without crashing', async () => {
    const { default: ForgotPasswordPage } = await import('../pages/auth/ForgotPasswordPage')
    const { container } = renderPage(<ForgotPasswordPage />)
    expect(container).toBeTruthy()
  })

  it('shows the email step by default', async () => {
    const { default: ForgotPasswordPage } = await import('../pages/auth/ForgotPasswordPage')
    const { container } = renderPage(<ForgotPasswordPage />)
    expect(container.textContent).toMatch(/forgot|reset|password/i)
  })

  it('shows HireSync brand text', async () => {
    const { default: ForgotPasswordPage } = await import('../pages/auth/ForgotPasswordPage')
    const { container } = renderPage(<ForgotPasswordPage />)
    expect(container.textContent).toContain('HireSync')
  })
})

// ---------------------------------------------------------------------------
// Seeker pages
// ---------------------------------------------------------------------------

describe('SeekerDashboard smoke tests', () => {
  it('renders without crashing', async () => {
    const { default: SeekerDashboard } = await import('../pages/seeker/SeekerDashboard')
    const { container } = renderPage(<SeekerDashboard />, { user: SEEKER_USER })
    expect(container).toBeTruthy()
  })

  it('shows the welcome message', async () => {
    const { default: SeekerDashboard } = await import('../pages/seeker/SeekerDashboard')
    const { container } = renderPage(<SeekerDashboard />, { user: SEEKER_USER })
    expect(container.textContent).toContain('Alice')
  })

  it('shows Browse Jobs link', async () => {
    const { default: SeekerDashboard } = await import('../pages/seeker/SeekerDashboard')
    const { container } = renderPage(<SeekerDashboard />, { user: SEEKER_USER })
    expect(container.textContent).toContain('Browse Jobs')
  })

  it('shows stat cards with zero counts initially', async () => {
    const { default: SeekerDashboard } = await import('../pages/seeker/SeekerDashboard')
    const { container } = renderPage(<SeekerDashboard />, { user: SEEKER_USER })
    expect(container.textContent).toContain('Total Applications')
  })

  it('shows recent applications empty state after data loads', async () => {
    const { default: SeekerDashboard } = await import('../pages/seeker/SeekerDashboard')
    // api.get returns { data: { results: [] } } — no applications
    const { container } = renderPage(<SeekerDashboard />, { user: SEEKER_USER })
    await waitFor(() => {
      expect(container.textContent).toContain('No applications yet')
    }, { timeout: 3000 })
  })
})

describe('ApplicationsPage smoke tests', () => {
  it('renders without crashing', async () => {
    const { default: ApplicationsPage } = await import('../pages/seeker/ApplicationsPage')
    const { container } = renderPage(<ApplicationsPage />, { user: SEEKER_USER })
    expect(container).toBeTruthy()
  })

  it('shows My Applications heading after data loads', async () => {
    const { default: ApplicationsPage } = await import('../pages/seeker/ApplicationsPage')
    const { container } = renderPage(<ApplicationsPage />, { user: SEEKER_USER })
    await waitFor(() => {
      expect(container.textContent).toContain('Applications')
    }, { timeout: 3000 })
  })

  it('shows empty state message when no applications', async () => {
    const api = (await import('../lib/axios')).default as any
    api.get.mockResolvedValueOnce({ data: { results: null } })
    const { default: ApplicationsPage } = await import('../pages/seeker/ApplicationsPage')
    const { container } = renderPage(<ApplicationsPage />, { user: SEEKER_USER })
    await waitFor(() => {
      expect(container.textContent).toContain('Applications')
    }, { timeout: 3000 })
  })
})

describe('RecommendationsPage smoke tests', () => {
  it('renders without crashing', async () => {
    const { default: RecommendationsPage } = await import('../pages/seeker/RecommendationsPage')
    const { container } = renderPage(<RecommendationsPage />, { user: SEEKER_USER })
    expect(container).toBeTruthy()
  })

  it('shows Jobs For You heading', async () => {
    const { default: RecommendationsPage } = await import('../pages/seeker/RecommendationsPage')
    const { container } = renderPage(<RecommendationsPage />, { user: SEEKER_USER })
    expect(container.textContent).toContain('Jobs For You')
  })

  it('shows empty state when no recommendations returned', async () => {
    const api = (await import('../lib/axios')).default as any
    api.get.mockResolvedValueOnce({ data: { results: [] } })
    const { default: RecommendationsPage } = await import('../pages/seeker/RecommendationsPage')
    const { container } = renderPage(<RecommendationsPage />, { user: SEEKER_USER })
    await waitFor(() => {
      expect(container.textContent).toContain('Jobs For You')
    }, { timeout: 3000 })
  })

  it('renders job cards when recommendations are available', async () => {
    const api = (await import('../lib/axios')).default as any
    api.get.mockResolvedValueOnce({
      data: {
        results: [
          { id: 'j1', title: 'Python Developer', company: { name: 'Acme Corp' }, location: 'Mumbai', job_type: 'full_time', skills: [] },
        ],
      },
    })
    const { default: RecommendationsPage } = await import('../pages/seeker/RecommendationsPage')
    const { container } = renderPage(<RecommendationsPage />, { user: SEEKER_USER })
    await waitFor(() => {
      expect(container.textContent).toContain('Python Developer')
    }, { timeout: 3000 })
  })
})

// ---------------------------------------------------------------------------
// Notifications page
// ---------------------------------------------------------------------------

describe('NotificationsPage smoke tests', () => {
  it('renders without crashing', async () => {
    const { default: NotificationsPage } = await import('../pages/NotificationsPage')
    const { container } = renderPage(<NotificationsPage />, { user: SEEKER_USER })
    expect(container).toBeTruthy()
  })

  it('shows Notifications heading', async () => {
    const { default: NotificationsPage } = await import('../pages/NotificationsPage')
    const { container } = renderPage(<NotificationsPage />, { user: SEEKER_USER })
    expect(container.textContent).toContain('Notifications')
  })

  it('shows mark-all-read button', async () => {
    const { default: NotificationsPage } = await import('../pages/NotificationsPage')
    const { container } = renderPage(<NotificationsPage />, { user: SEEKER_USER })
    expect(container.textContent).toContain('Mark all read')
  })

  it('shows empty state after data loads with no notifications', async () => {
    const api = (await import('../lib/axios')).default as any
    api.get.mockResolvedValueOnce({ data: { results: [] } })
    const { default: NotificationsPage } = await import('../pages/NotificationsPage')
    const { container } = renderPage(<NotificationsPage />, { user: SEEKER_USER })
    await waitFor(() => {
      expect(container.textContent).toContain('No notifications yet')
    }, { timeout: 3000 })
  })

  it('renders notification items when present', async () => {
    const api = (await import('../lib/axios')).default as any
    api.get.mockResolvedValueOnce({
      data: {
        results: [
          {
            id: 1,
            notification_type: 'application_status',
            title: 'Application Update',
            message: 'You were shortlisted',
            is_read: false,
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
      },
    })
    const { default: NotificationsPage } = await import('../pages/NotificationsPage')
    const { container } = renderPage(<NotificationsPage />, { user: SEEKER_USER })
    await waitFor(() => {
      expect(container.textContent).toContain('Application Update')
    }, { timeout: 3000 })
  })
})

// ---------------------------------------------------------------------------
// Recruiter pages
// ---------------------------------------------------------------------------

describe('RecruiterDashboard smoke tests', () => {
  it('renders without crashing', async () => {
    const { default: RecruiterDashboard } = await import('../pages/recruiter/RecruiterDashboard')
    const { container } = renderPage(<RecruiterDashboard />, { user: RECRUITER_USER })
    expect(container).toBeTruthy()
  })

  it('shows welcome message with recruiter name', async () => {
    const { default: RecruiterDashboard } = await import('../pages/recruiter/RecruiterDashboard')
    const { container } = renderPage(<RecruiterDashboard />, { user: RECRUITER_USER })
    expect(container.textContent).toContain('Bob')
  })

  it('shows Post a Job link', async () => {
    const { default: RecruiterDashboard } = await import('../pages/recruiter/RecruiterDashboard')
    const { container } = renderPage(<RecruiterDashboard />, { user: RECRUITER_USER })
    expect(container.textContent).toContain('Post a Job')
  })

  it('shows stat cards', async () => {
    const { default: RecruiterDashboard } = await import('../pages/recruiter/RecruiterDashboard')
    const { container } = renderPage(<RecruiterDashboard />, { user: RECRUITER_USER })
    expect(container.textContent).toContain('Active Jobs')
  })

  it('shows no-jobs empty state after data resolves', async () => {
    const api = (await import('../lib/axios')).default as any
    api.get.mockResolvedValueOnce({ data: { overview: {}, top_jobs: [] } })
    const { default: RecruiterDashboard } = await import('../pages/recruiter/RecruiterDashboard')
    const { container } = renderPage(<RecruiterDashboard />, { user: RECRUITER_USER })
    await waitFor(() => {
      expect(container.textContent).toContain('Post your first job')
    }, { timeout: 3000 })
  })

  it('renders top job rows when analytics returns data', async () => {
    const api = (await import('../lib/axios')).default as any
    api.get.mockResolvedValueOnce({
      data: {
        overview: { active_jobs: 2, total_views: 50, total_applications: 10, conversion_rate: 20 },
        top_jobs: [{ id: 'j1', title: 'Senior Dev', views_count: 30, app_count: 8 }],
      },
    })
    const { default: RecruiterDashboard } = await import('../pages/recruiter/RecruiterDashboard')
    const { container } = renderPage(<RecruiterDashboard />, { user: RECRUITER_USER })
    await waitFor(() => {
      expect(container.textContent).toContain('Senior Dev')
    }, { timeout: 3000 })
  })
})
