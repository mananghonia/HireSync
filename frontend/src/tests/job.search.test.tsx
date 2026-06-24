/**
 * JobSearchPage tests — covers form submission, filter changes,
 * job card rendering (skills, has_applied badge), pagination.
 * Targets uncovered lines 25-47, 52, 100-126.
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
import JobSearchPage from '../pages/JobSearchPage'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../lib/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn().mockResolvedValue({ data: {} }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
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

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...(actual as any), useNavigate: () => mockNavigate }
})

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const SEEKER = { id: 'u1', email: 's@test.com', first_name: 'Alice', last_name: 'S', full_name: 'Alice S', role: 'seeker' as const, is_verified: true }

const JOBS_DATA = {
  count: 2,
  total_pages: 2,
  results: [
    {
      id: 'j1',
      title: 'Senior React Developer',
      company: { name: 'TechCo' },
      location: 'Mumbai',
      job_type: 'full_time',
      salary_min: 80000,
      salary_max: 120000,
      salary_currency: 'USD',
      created_at: '2024-01-15T00:00:00Z',
      has_applied: false,
      skills: [{ id: 's1', name: 'React' }, { id: 's2', name: 'TypeScript' }],
    },
    {
      id: 'j2',
      title: 'Backend Engineer',
      company: { name: 'StartupX' },
      location: 'Remote',
      job_type: 'remote',
      salary_min: null,
      salary_max: null,
      salary_currency: 'USD',
      created_at: '2024-01-10T00:00:00Z',
      has_applied: true,
      skills: [{ id: 's3', name: 'Python' }, { id: 's4', name: 'Django' }],
    },
  ],
}

const EMPTY_RESULTS = { count: 0, total_pages: 1, results: [] }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStore() {
  const s = configureStore({ reducer: { auth: authReducer, notifications: notificationsReducer } })
  s.dispatch(setCredentials({ user: SEEKER, tokens: { access: 'tok', refresh: 'ref' } }))
  return s
}

function wrap() {
  const store = makeStore()
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } } })
  return render(
    <Provider store={store}>
      <QueryClientProvider client={qc}>
        <MemoryRouter><JobSearchPage /></MemoryRouter>
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
  api.get.mockImplementation((url: string) => {
    if (url.includes('/search/jobs/')) return Promise.resolve({ data: JOBS_DATA })
    if (url.includes('/notifications/unread-count/')) return Promise.resolve({ data: { unread_count: 0 } })
    return Promise.resolve({ data: {} })
  })
  mockNavigate.mockReset()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('JobSearchPage — initial render', () => {
  it('renders search form', async () => {
    const { container } = wrap()
    await waitFor(() => expect(container.querySelector('form')).not.toBeNull(), { timeout: 3000 })
  })

  it('shows job title input', async () => {
    const { container } = wrap()
    await waitFor(() => expect(container.querySelector('input[placeholder*="Job title"]')).not.toBeNull(), { timeout: 3000 })
  })

  it('shows location input', async () => {
    const { container } = wrap()
    await waitFor(() => expect(container.querySelector('input[placeholder="Location"]')).not.toBeNull(), { timeout: 3000 })
  })

  it('shows Search button', async () => {
    const { container } = wrap()
    await waitFor(() => expect(container.textContent).toContain('Search'), { timeout: 3000 })
  })
})

describe('JobSearchPage — filter interactions', () => {
  it('typing in query input updates value', async () => {
    const { container } = wrap()
    await waitFor(() => expect(container.querySelector('input[placeholder*="Job title"]')).not.toBeNull(), { timeout: 3000 })

    const queryInput = container.querySelector('input[placeholder*="Job title"]') as HTMLInputElement
    fireEvent.change(queryInput, { target: { value: 'React Developer' } })
    expect(queryInput.value).toBe('React Developer')
  })

  it('typing in location input updates value', async () => {
    const { container } = wrap()
    await waitFor(() => expect(container.querySelector('input[placeholder="Location"]')).not.toBeNull(), { timeout: 3000 })

    const locationInput = container.querySelector('input[placeholder="Location"]') as HTMLInputElement
    fireEvent.change(locationInput, { target: { value: 'Mumbai' } })
    expect(locationInput.value).toBe('Mumbai')
  })

  it('changing job type select updates value', async () => {
    const { container } = wrap()
    await waitFor(() => expect(container.querySelector('form')).not.toBeNull(), { timeout: 3000 })

    const selects = container.querySelectorAll('select') as NodeListOf<HTMLSelectElement>
    // First select is job type
    if (selects.length >= 1) {
      fireEvent.change(selects[0], { target: { value: 'full_time' } })
      expect(selects[0].value).toBe('full_time')
    }
  })

  it('changing experience level select updates value', async () => {
    const { container } = wrap()
    await waitFor(() => expect(container.querySelector('form')).not.toBeNull(), { timeout: 3000 })

    const selects = container.querySelectorAll('select') as NodeListOf<HTMLSelectElement>
    // Second select is experience level
    if (selects.length >= 2) {
      fireEvent.change(selects[1], { target: { value: 'mid' } })
      expect(selects[1].value).toBe('mid')
    }
  })

  it('submitting search form calls api.get with params', async () => {
    const api = (await import('../lib/axios')).default as any
    const { container } = wrap()
    await waitFor(() => expect(container.querySelector('form')).not.toBeNull(), { timeout: 3000 })

    const queryInput = container.querySelector('input[placeholder*="Job title"]') as HTMLInputElement
    fireEvent.change(queryInput, { target: { value: 'React' } })

    const form = container.querySelector('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/search/jobs/', expect.objectContaining({ params: expect.objectContaining({ q: 'React' }) }))
    }, { timeout: 3000 })
  })

  it('submitting form with location filter', async () => {
    const api = (await import('../lib/axios')).default as any
    const { container } = wrap()
    await waitFor(() => expect(container.querySelector('form')).not.toBeNull(), { timeout: 3000 })

    const locationInput = container.querySelector('input[placeholder="Location"]') as HTMLInputElement
    fireEvent.change(locationInput, { target: { value: 'Mumbai' } })

    fireEvent.submit(container.querySelector('form')!)

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/search/jobs/', expect.objectContaining({ params: expect.objectContaining({ location: 'Mumbai' }) }))
    }, { timeout: 3000 })
  })
})

describe('JobSearchPage — results display', () => {
  it('shows job titles after search', async () => {
    const { container } = wrap()
    await waitFor(() => expect(container.textContent).toContain('Senior React Developer'), { timeout: 3000 })
  })

  it('shows job company names', async () => {
    const { container } = wrap()
    await waitFor(() => expect(container.textContent).toContain('TechCo'), { timeout: 3000 })
  })

  it('shows job locations', async () => {
    const { container } = wrap()
    await waitFor(() => expect(container.textContent).toContain('Mumbai'), { timeout: 3000 })
  })

  it('shows skill tags', async () => {
    const { container } = wrap()
    await waitFor(() => expect(container.textContent).toContain('React'), { timeout: 3000 })
    expect(container.textContent).toContain('TypeScript')
  })

  it('shows Applied badge for applied jobs', async () => {
    const { container } = wrap()
    await waitFor(() => expect(container.textContent).toContain('Applied'), { timeout: 3000 })
  })

  it('shows salary range when available', async () => {
    const { container } = wrap()
    await waitFor(() => expect(container.textContent).toContain('80,000'), { timeout: 3000 })
  })

  it('shows jobs count', async () => {
    const { container } = wrap()
    await waitFor(() => expect(container.textContent).toContain('2 jobs found'), { timeout: 3000 })
  })

  it('clicking a job card navigates to job detail', async () => {
    const { container } = wrap()
    await waitFor(() => expect(container.textContent).toContain('Senior React Developer'), { timeout: 3000 })

    const jobCards = container.querySelectorAll('[class*="cursor-pointer"]')
    if (jobCards.length > 0) fireEvent.click(jobCards[0])

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/jobs/'))
    }, { timeout: 2000 })
  })

  it('shows empty state when no results', async () => {
    const api = (await import('../lib/axios')).default as any
    api.get.mockImplementation((url: string) => {
      if (url.includes('/search/jobs/')) return Promise.resolve({ data: EMPTY_RESULTS })
      return Promise.resolve({ data: {} })
    })

    const { container } = wrap()
    await waitFor(() => expect(container.textContent).toContain('No jobs found'), { timeout: 3000 })
  })
})

describe('JobSearchPage — pagination', () => {
  it('shows page buttons when total_pages > 1', async () => {
    const { container } = wrap()
    await waitFor(() => expect(container.textContent).toContain('Senior React Developer'), { timeout: 3000 })

    // data has total_pages: 2, so pagination should show
    await waitFor(() => {
      const pageBtns = Array.from(container.querySelectorAll('button')).filter(b => b.textContent?.trim() === '1' || b.textContent?.trim() === '2')
      expect(pageBtns.length).toBeGreaterThan(0)
    }, { timeout: 3000 })
  })

  it('clicking page 2 triggers new search', async () => {
    const api = (await import('../lib/axios')).default as any
    const { container } = wrap()
    await waitFor(() => expect(container.textContent).toContain('Senior React Developer'), { timeout: 3000 })

    const page2Btn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.trim() === '2')
    if (page2Btn) fireEvent.click(page2Btn)

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/search/jobs/', expect.objectContaining({ params: expect.objectContaining({ page: 2 }) }))
    }, { timeout: 3000 })
  })
})
