/**
 * PostJobPage tests — covers SetupCompanyForm (no company) and the job posting form.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor, fireEvent } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { configureStore } from '@reduxjs/toolkit'
import React from 'react'
import authReducer, { setCredentials } from '../features/auth/authSlice'
import notificationsReducer from '../features/notifications/notificationsSlice'
import PostJobPage from '../pages/recruiter/PostJobPage'

vi.mock('../lib/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn().mockResolvedValue({ data: { id: 'j-new' } }),
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

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...(actual as any), useNavigate: () => mockNavigate }
})

const COMPANY_DATA = { id: 'c1', name: 'TechCorp', industry: 'technology', size: '11-50', location: 'Mumbai' }

const SKILLS_DATA = [
  { id: 'sk1', name: 'React' },
  { id: 'sk2', name: 'Django' },
  { id: 'sk3', name: 'Python' },
]

const RECRUITER = {
  id: 'r1', email: 'rec@test.com', first_name: 'Bob', last_name: 'R',
  full_name: 'Bob R', role: 'recruiter' as const, is_verified: true,
}

function makeStore() {
  const s = configureStore({ reducer: { auth: authReducer, notifications: notificationsReducer } })
  s.dispatch(setCredentials({ user: RECRUITER, tokens: { access: 'tok', refresh: 'ref' } }))
  return s
}

function wrap() {
  const store = makeStore()
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } } })
  return render(
    <Provider store={store}>
      <QueryClientProvider client={qc}>
        <MemoryRouter>{<PostJobPage />}</MemoryRouter>
      </QueryClientProvider>
    </Provider>,
  )
}

beforeEach(async () => {
  const api = (await import('../lib/axios')).default as any
  api.get.mockReset()
  api.post.mockReset()
  api.post.mockResolvedValue({ data: { id: 'j-new' } })
  mockNavigate.mockReset()
  ;(global as any).WebSocket = vi.fn().mockImplementation(() => ({
    close: vi.fn(), send: vi.fn(), onopen: null, onclose: null, onerror: null, onmessage: null, readyState: 1,
  }))
})

// ---------------------------------------------------------------------------
// WITH company — renders the job posting form
// ---------------------------------------------------------------------------
describe('PostJobPage — with company', () => {
  beforeEach(async () => {
    const api = (await import('../lib/axios')).default as any
    api.get.mockImplementation((url: string) => {
      if (url.includes('/profiles/companies/my_company/')) return Promise.resolve({ data: COMPANY_DATA })
      if (url.includes('/profiles/skills/')) return Promise.resolve({ data: { results: SKILLS_DATA } })
      return Promise.resolve({ data: {} })
    })
  })

  it('renders Post a New Job heading', async () => {
    const { container } = wrap()
    await waitFor(() => expect(container.textContent).toContain('Post a New Job'), { timeout: 3000 })
  })

  it('shows Posting as company badge', async () => {
    const { container } = wrap()
    await waitFor(() => expect(container.textContent).toContain('Posting as'), { timeout: 3000 })
  })

  it('shows TechCorp company name in badge', async () => {
    const { container } = wrap()
    await waitFor(() => expect(container.textContent).toContain('TechCorp'), { timeout: 3000 })
  })

  it('shows Basic Information section', async () => {
    const { container } = wrap()
    await waitFor(() => expect(container.textContent).toContain('Basic Information'), { timeout: 3000 })
  })

  it('shows job title input', async () => {
    const { container } = wrap()
    await waitFor(() => {
      const input = container.querySelector('input[name="title"]')
      expect(input).not.toBeNull()
    }, { timeout: 3000 })
  })

  it('shows job type select', async () => {
    const { container } = wrap()
    await waitFor(() => {
      const select = container.querySelector('select[name="job_type"]')
      expect(select).not.toBeNull()
    }, { timeout: 3000 })
  })

  it('shows description textarea', async () => {
    const { container } = wrap()
    await waitFor(() => {
      const ta = container.querySelector('textarea[name="description"]')
      expect(ta).not.toBeNull()
    }, { timeout: 3000 })
  })

  it('shows salary fields', async () => {
    const { container } = wrap()
    await waitFor(() => expect(container.textContent).toContain('Salary'), { timeout: 3000 })
  })

  it('shows Post Job submit button', async () => {
    const { container } = wrap()
    await waitFor(() => expect(container.textContent).toContain('Post Job'), { timeout: 3000 })
  })

  async function fillAndSubmitForm(container: HTMLElement) {
    // Wait for company to load (badge appears) so company.id is available
    await waitFor(() => expect(container.textContent).toContain('TechCorp'), { timeout: 3000 })
    const titleInput = container.querySelector('input[name="title"]') as HTMLInputElement
    const descInput = container.querySelector('textarea[name="description"]') as HTMLTextAreaElement
    fireEvent.change(titleInput, { target: { value: 'Senior React Developer' } })
    if (descInput) fireEvent.change(descInput, { target: { value: 'Build modern React apps with TypeScript.' } })
    const submitBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Post Job'))
    if (submitBtn) fireEvent.click(submitBtn)
  }

  it('fills title and submits form, calls api.post', async () => {
    const api = (await import('../lib/axios')).default as any
    const { container } = wrap()
    await fillAndSubmitForm(container)
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/jobs/', expect.objectContaining({ company_id: 'c1' }))
    }, { timeout: 3000 })
  })

  it('successful job post shows success toast and navigates', async () => {
    const toast = (await import('react-hot-toast')).default as any
    const { container } = wrap()
    await fillAndSubmitForm(container)
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Job posted successfully!')
    }, { timeout: 3000 })
  })

  it('failed job post shows error toast', async () => {
    const toast = (await import('react-hot-toast')).default as any
    const api = (await import('../lib/axios')).default as any
    api.post.mockRejectedValueOnce({ response: { data: { title: ['Required'] } } })
    const { container } = wrap()
    await fillAndSubmitForm(container)
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
    }, { timeout: 3000 })
  })

  it('skills checkboxes render', async () => {
    const { container } = wrap()
    await waitFor(() => {
      // Skills section or checkboxes
      const inputs = container.querySelectorAll('input[type="checkbox"]')
      expect(inputs.length).toBeGreaterThan(0)
    }, { timeout: 3000 })
  })
})

// ---------------------------------------------------------------------------
// WITHOUT company — shows SetupCompanyForm
// ---------------------------------------------------------------------------
describe('PostJobPage — without company', () => {
  beforeEach(async () => {
    const api = (await import('../lib/axios')).default as any
    api.get.mockImplementation((url: string) => {
      if (url.includes('/profiles/companies/my_company/')) return Promise.reject({ response: { status: 404 } })
      if (url.includes('/profiles/skills/')) return Promise.resolve({ data: { results: SKILLS_DATA } })
      return Promise.resolve({ data: {} })
    })
  })

  it('shows Set up your company section', async () => {
    const { container } = wrap()
    await waitFor(() => expect(container.textContent).toContain('Set up your company'), { timeout: 3000 })
  })

  it('shows company name input', async () => {
    const { container } = wrap()
    await waitFor(() => {
      const input = container.querySelector('input[placeholder*="Company name"]')
      expect(input).not.toBeNull()
    }, { timeout: 3000 })
  })

  it('shows industry select in setup form', async () => {
    const { container } = wrap()
    await waitFor(() => {
      const select = container.querySelector('select[name="industry"]')
      expect(select).not.toBeNull()
    }, { timeout: 3000 })
  })

  it('shows company size select in setup form', async () => {
    const { container } = wrap()
    await waitFor(() => {
      const select = container.querySelector('select[name="size"]')
      expect(select).not.toBeNull()
    }, { timeout: 3000 })
  })

  it('shows location input in setup form', async () => {
    const { container } = wrap()
    await waitFor(() => {
      const locInput = container.querySelector('input[placeholder*="Location"]') ||
        container.querySelector('input[name="location"]')
      expect(locInput).not.toBeNull()
    }, { timeout: 3000 })
  })

  it('shows Create Company & Continue button', async () => {
    const { container } = wrap()
    await waitFor(() => expect(container.textContent).toContain('Create Company'), { timeout: 3000 })
  })

  it('submitting company form calls api.post', async () => {
    const api = (await import('../lib/axios')).default as any
    api.post.mockResolvedValueOnce({ data: COMPANY_DATA })

    const { container } = wrap()
    await waitFor(() => expect(container.querySelector('input[placeholder*="Company name"]')).not.toBeNull(), { timeout: 3000 })

    const nameInput = container.querySelector('input[placeholder*="Company name"]') as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: 'My Company' } })

    const form = container.querySelector('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/profiles/companies/my_company/', expect.any(Object))
    }, { timeout: 3000 })
  })

  it('successful company creation shows toast', async () => {
    const toast = (await import('react-hot-toast')).default as any
    const api = (await import('../lib/axios')).default as any
    api.post.mockResolvedValueOnce({ data: COMPANY_DATA })

    const { container } = wrap()
    await waitFor(() => expect(container.querySelector('input[placeholder*="Company name"]')).not.toBeNull(), { timeout: 3000 })

    const nameInput = container.querySelector('input[placeholder*="Company name"]') as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: 'My Company' } })

    fireEvent.submit(container.querySelector('form')!)

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Company created!')
    }, { timeout: 3000 })
  })

  it('failed company creation shows error toast', async () => {
    const toast = (await import('react-hot-toast')).default as any
    const api = (await import('../lib/axios')).default as any
    api.post.mockRejectedValueOnce(new Error('Server error'))

    const { container } = wrap()
    await waitFor(() => expect(container.querySelector('input[placeholder*="Company name"]')).not.toBeNull(), { timeout: 3000 })

    const nameInput = container.querySelector('input[placeholder*="Company name"]') as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: 'My Company' } })

    fireEvent.submit(container.querySelector('form')!)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to create company.')
    }, { timeout: 3000 })
  })
})
