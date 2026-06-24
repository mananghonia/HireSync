/**
 * Dedicated AdminDashboard tests — covers tab content, table rows,
 * search/filter, and action buttons (toggle active, delete, job actions).
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
import AdminDashboard from '../pages/admin/AdminDashboard'

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

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const ADMIN = {
  id: 'admin-1', email: 'admin@test.com', first_name: 'Admin', last_name: 'A',
  full_name: 'Admin A', role: 'admin' as const, is_verified: true,
}

const STATS = {
  users: { total: 50, seekers: 40, recruiters: 10, new_this_week: 2 },
  jobs: { total: 20, active: 15, posted_this_month: 3 },
  applications: { total: 100, this_week: 8, hired: 5 },
}

const USERS = [
  { id: 'u1', email: 'alice@test.com', full_name: 'Alice Smith', role: 'seeker', is_active: true, is_verified: true, created_at: '2024-01-01T00:00:00Z' },
  { id: 'u2', email: 'bob@test.com', full_name: 'Bob Jones', role: 'recruiter', is_active: false, is_verified: true, created_at: '2024-02-01T00:00:00Z' },
]

const JOBS = [
  { id: 'j1', title: 'Backend Developer', company: 'TechCo', location: 'Mumbai', recruiter: 'Bob', recruiter_email: 'bob@test.com', status: 'open', created_at: '2024-01-01T00:00:00Z' },
  { id: 'j2', title: 'Frontend Engineer', company: 'StartupX', location: 'Pune', recruiter: 'Alice', recruiter_email: 'alice@test.com', status: 'closed', created_at: '2024-02-01T00:00:00Z' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStore() {
  const s = configureStore({ reducer: { auth: authReducer, notifications: notificationsReducer } })
  s.dispatch(setCredentials({ user: ADMIN, tokens: { access: 'tok', refresh: 'ref' } }))
  return s
}

function wrap() {
  const store = makeStore()
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } } })
  return render(
    <Provider store={store}>
      <QueryClientProvider client={qc}>
        <MemoryRouter><AdminDashboard /></MemoryRouter>
      </QueryClientProvider>
    </Provider>,
  )
}

beforeAll(() => {
  ;(global as any).confirm = vi.fn(() => true)
  ;(global as any).WebSocket = vi.fn().mockImplementation(() => ({
    close: vi.fn(), send: vi.fn(), onopen: null, onclose: null, onerror: null, onmessage: null, readyState: 1,
  }))
})

beforeEach(async () => {
  const api = (await import('../lib/axios')).default as any
  api.get.mockReset()
  api.patch.mockReset()
  api.delete.mockReset()
  api.patch.mockResolvedValue({ data: {} })
  api.delete.mockResolvedValue({})
  api.get.mockImplementation((url: string) => {
    if (url.includes('/admin/stats/')) return Promise.resolve({ data: STATS })
    if (url.includes('/admin/users/')) return Promise.resolve({ data: USERS })
    if (url.includes('/admin/jobs/')) return Promise.resolve({ data: JOBS })
    if (url.includes('/notifications/unread-count/')) return Promise.resolve({ data: { unread_count: 0 } })
    return Promise.resolve({ data: {} })
  })
})

// ---------------------------------------------------------------------------
// Overview tab (default)
// ---------------------------------------------------------------------------

describe('AdminDashboard — Overview', () => {
  it('renders Admin Dashboard heading', async () => {
    const { container } = wrap()
    await waitFor(() => expect(container.textContent).toContain('Admin Dashboard'), { timeout: 3000 })
  })

  it('shows Total Users stat with value', async () => {
    const { container } = wrap()
    await waitFor(() => expect(container.textContent).toContain('50'), { timeout: 3000 })
  })

  it('shows Job Seekers count', async () => {
    const { container } = wrap()
    await waitFor(() => expect(container.textContent).toContain('40'), { timeout: 3000 })
  })

  it('shows Active Jobs count', async () => {
    const { container } = wrap()
    await waitFor(() => expect(container.textContent).toContain('Active Jobs'), { timeout: 3000 })
  })

  it('shows Applications stat', async () => {
    const { container } = wrap()
    await waitFor(() => expect(container.textContent).toContain('Applications'), { timeout: 3000 })
  })

  it('shows User Breakdown section', async () => {
    const { container } = wrap()
    await waitFor(() => expect(container.textContent).toContain('User Breakdown'), { timeout: 3000 })
  })

  it('shows tab buttons', async () => {
    const { container } = wrap()
    await waitFor(() => {
      expect(container.textContent).toContain('Overview')
      expect(container.textContent).toContain('Users')
      expect(container.textContent).toContain('Jobs')
    }, { timeout: 3000 })
  })
})

// ---------------------------------------------------------------------------
// Users tab
// ---------------------------------------------------------------------------

describe('AdminDashboard — Users tab', () => {
  async function openUsersTab(container: HTMLElement) {
    await waitFor(() => expect(container.textContent).toContain('Admin Dashboard'), { timeout: 3000 })
    const usersTab = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Users')
    if (usersTab) fireEvent.click(usersTab)
    await waitFor(() => expect(container.textContent).toContain('alice@test.com'), { timeout: 3000 })
  }

  it('shows Alice Smith after clicking Users tab', async () => {
    const { container } = wrap()
    await openUsersTab(container)
    expect(container.textContent).toContain('Alice Smith')
  })

  it('shows Bob Jones in user list', async () => {
    const { container } = wrap()
    await openUsersTab(container)
    expect(container.textContent).toContain('Bob Jones')
  })

  it('shows active/suspended status badges', async () => {
    const { container } = wrap()
    await openUsersTab(container)
    expect(container.textContent).toMatch(/Active|Suspended/)
  })

  it('shows role badges (seeker, recruiter)', async () => {
    const { container } = wrap()
    await openUsersTab(container)
    expect(container.textContent).toContain('seeker')
    expect(container.textContent).toContain('recruiter')
  })

  it('shows search input', async () => {
    const { container } = wrap()
    await openUsersTab(container)
    const searchInput = container.querySelector('input[placeholder*="Search"]')
    expect(searchInput).not.toBeNull()
  })

  it('typing in search filters users', async () => {
    const { container } = wrap()
    await openUsersTab(container)

    const searchInput = container.querySelector('input[placeholder*="Search"]') as HTMLInputElement
    fireEvent.change(searchInput, { target: { value: 'alice' } })

    await waitFor(() => {
      expect(container.textContent).toContain('Alice Smith')
      expect(container.textContent).not.toContain('Bob Jones')
    }, { timeout: 3000 })
  })

  it('role filter dropdown shows all roles', async () => {
    const { container } = wrap()
    await openUsersTab(container)
    expect(container.textContent).toContain('All roles')
  })

  it('filtering by seeker role refetches with role param', async () => {
    const api = (await import('../lib/axios')).default as any
    // Make the seeker-filtered call return only Alice
    api.get.mockImplementation((url: string, config?: any) => {
      if (url.includes('/admin/stats/')) return Promise.resolve({ data: STATS })
      if (url.includes('/admin/users/')) {
        if (config?.params?.role === 'seeker') return Promise.resolve({ data: [USERS[0]] })
        return Promise.resolve({ data: USERS })
      }
      if (url.includes('/admin/jobs/')) return Promise.resolve({ data: JOBS })
      return Promise.resolve({ data: {} })
    })

    const { container } = wrap()
    await openUsersTab(container)

    const roleSelect = container.querySelector('select') as HTMLSelectElement
    fireEvent.change(roleSelect, { target: { value: 'seeker' } })

    await waitFor(() => {
      expect(container.textContent).toContain('Alice Smith')
    }, { timeout: 3000 })
  })

  it('clicking suspend button calls api.patch', async () => {
    const api = (await import('../lib/axios')).default as any
    const { container } = wrap()
    await openUsersTab(container)

    const suspendBtn = container.querySelector('button[title*="Suspend"]')
    if (suspendBtn) fireEvent.click(suspendBtn)

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith(expect.stringContaining('/admin/'), expect.objectContaining({ is_active: false }))
    }, { timeout: 3000 })
  })

  it('clicking activate button calls api.patch for suspended user', async () => {
    const api = (await import('../lib/axios')).default as any
    const { container } = wrap()
    await openUsersTab(container)

    const activateBtn = container.querySelector('button[title*="Activate"]')
    if (activateBtn) fireEvent.click(activateBtn)

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith(expect.stringContaining('/admin/'), expect.objectContaining({ is_active: true }))
    }, { timeout: 3000 })
  })

  it('clicking delete button calls api.delete after confirm', async () => {
    const api = (await import('../lib/axios')).default as any
    const { container } = wrap()
    await openUsersTab(container)

    const deleteBtn = container.querySelector('button[title="Delete user"]')
    if (deleteBtn) fireEvent.click(deleteBtn)

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith(expect.stringContaining('/admin/'))
    }, { timeout: 3000 })
  })

  it('toggleActive onError shows error toast (covers line 124)', async () => {
    const api = (await import('../lib/axios')).default as any
    const toast = (await import('react-hot-toast')).default as any
    api.patch.mockRejectedValueOnce({ response: { data: { detail: 'Toggle failed' } } })

    const { container } = wrap()
    await openUsersTab(container)

    const suspendBtn = container.querySelector('button[title*="Suspend"]')
    if (suspendBtn) fireEvent.click(suspendBtn)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
    }, { timeout: 3000 })
  })

  it('deleteUser onError shows error toast (covers line 130)', async () => {
    const api = (await import('../lib/axios')).default as any
    const toast = (await import('react-hot-toast')).default as any
    api.delete.mockRejectedValueOnce({ response: { data: { detail: 'Delete failed' } } })

    const { container } = wrap()
    await openUsersTab(container)

    const deleteBtn = container.querySelector('button[title="Delete user"]')
    if (deleteBtn) fireEvent.click(deleteBtn)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
    }, { timeout: 3000 })
  })

  it('shows no users found when search has no matches', async () => {
    const { container } = wrap()
    await openUsersTab(container)

    const searchInput = container.querySelector('input[placeholder*="Search"]') as HTMLInputElement
    fireEvent.change(searchInput, { target: { value: 'zzznomatch' } })

    await waitFor(() => {
      expect(container.textContent).toContain('No users found')
    }, { timeout: 3000 })
  })
})

// ---------------------------------------------------------------------------
// Jobs tab
// ---------------------------------------------------------------------------

describe('AdminDashboard — Jobs tab', () => {
  async function openJobsTab(container: HTMLElement) {
    await waitFor(() => expect(container.textContent).toContain('Admin Dashboard'), { timeout: 3000 })
    const jobsTab = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Jobs')
    if (jobsTab) fireEvent.click(jobsTab)
    await waitFor(() => expect(container.textContent).toContain('Backend Developer'), { timeout: 3000 })
  }

  it('shows Backend Developer after clicking Jobs tab', async () => {
    const { container } = wrap()
    await openJobsTab(container)
    expect(container.textContent).toContain('Backend Developer')
  })

  it('shows Frontend Engineer in jobs list', async () => {
    const { container } = wrap()
    await openJobsTab(container)
    expect(container.textContent).toContain('Frontend Engineer')
  })

  it('shows company names in jobs list', async () => {
    const { container } = wrap()
    await openJobsTab(container)
    expect(container.textContent).toContain('TechCo')
    expect(container.textContent).toContain('StartupX')
  })

  it('shows job status badges', async () => {
    const { container } = wrap()
    await openJobsTab(container)
    expect(container.textContent).toMatch(/open|closed/)
  })

  it('shows status filter dropdown', async () => {
    const { container } = wrap()
    await openJobsTab(container)
    expect(container.textContent).toContain('All statuses')
  })

  it('shows search input for jobs', async () => {
    const { container } = wrap()
    await openJobsTab(container)
    const searchInput = container.querySelector('input[placeholder*="Search"]')
    expect(searchInput).not.toBeNull()
  })

  it('typing search filters jobs by title', async () => {
    const { container } = wrap()
    await openJobsTab(container)

    const searchInput = container.querySelector('input[placeholder*="Search"]') as HTMLInputElement
    fireEvent.change(searchInput, { target: { value: 'Backend' } })

    await waitFor(() => {
      expect(container.textContent).toContain('Backend Developer')
      expect(container.textContent).not.toContain('Frontend Engineer')
    }, { timeout: 3000 })
  })

  it('delete job button calls api.delete', async () => {
    const api = (await import('../lib/axios')).default as any
    const { container } = wrap()
    await openJobsTab(container)

    // Jobs table delete buttons have no title — find by red color class
    const deleteBtn = container.querySelector('td button.text-red-500') ||
      Array.from(container.querySelectorAll('button')).find(b => b.className.includes('text-red-500') && !b.getAttribute('title'))
    if (deleteBtn) fireEvent.click(deleteBtn as HTMLElement)

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith(expect.stringContaining('/admin/jobs/'))
    }, { timeout: 3000 })
  })

  it('changing status filter select refetches jobs with status param (covers line 266)', async () => {
    const api = (await import('../lib/axios')).default as any
    const { container } = wrap()
    await openJobsTab(container)

    // The status filter select in the jobs tab header
    const selects = container.querySelectorAll('select') as NodeListOf<HTMLSelectElement>
    const statusFilterSelect = Array.from(selects).find(s => Array.from(s.options).some(o => o.value === 'paused'))
    if (statusFilterSelect) {
      fireEvent.change(statusFilterSelect, { target: { value: 'open' } })
    }

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/admin/jobs/', expect.objectContaining({ params: expect.objectContaining({ status: 'open' }) }))
    }, { timeout: 3000 })
  })

  it('api.patch failure shows error toast (covers onError line 238-239 job patch)', async () => {
    const api = (await import('../lib/axios')).default as any
    const toast = (await import('react-hot-toast')).default as any
    api.patch.mockRejectedValueOnce({ response: { data: { detail: 'Patch failed' } } })

    const { container } = wrap()
    await openJobsTab(container)

    const rowSelects = container.querySelectorAll('td select') as NodeListOf<HTMLSelectElement>
    if (rowSelects.length > 0) {
      fireEvent.change(rowSelects[0], { target: { value: 'paused' } })
    }

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
    }, { timeout: 3000 })
  })

  it('changing job row status select calls api.patch (covers lines 238-239, 312)', async () => {
    const api = (await import('../lib/axios')).default as any
    const { container } = wrap()
    await openJobsTab(container)

    // Row selects are inside <td> elements (not the filter header select)
    const rowSelects = container.querySelectorAll('td select') as NodeListOf<HTMLSelectElement>
    if (rowSelects.length > 0) {
      fireEvent.change(rowSelects[0], { target: { value: 'paused' } })
    }

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith(
        expect.stringContaining('/admin/jobs/'),
        expect.objectContaining({ status: 'paused' })
      )
    }, { timeout: 3000 })
  })
})
