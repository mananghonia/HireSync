/**
 * Targeted tests to maximize SeekerProfilePage line coverage by triggering
 * mutation callbacks, file handlers, and both resume-section branches.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor, fireEvent, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { configureStore } from '@reduxjs/toolkit'
import React from 'react'
import authReducer, { setCredentials } from '../features/auth/authSlice'
import notificationsReducer from '../features/notifications/notificationsSlice'
import SeekerProfilePage from '../pages/seeker/SeekerProfilePage'

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

const SEEKER = {
  id: 's1', email: 'seeker@test.com', first_name: 'Alice', last_name: 'S',
  full_name: 'Alice S', role: 'seeker' as const, is_verified: true,
}

const PROFILE_DATA = {
  full_name: 'Alice S', email: 'seeker@test.com',
  headline: 'Full Stack Dev', bio: 'Developer bio here',
  location: 'Mumbai', experience_level: 'mid', github_url: '', linkedin_url: '',
  is_open_to_work: true, resume: null, resume_filename: null,
}

const PROFILE_WITH_RESUME = {
  ...PROFILE_DATA,
  resume: 'https://cdn.example.com/resume.pdf',
  resume_filename: 'MyResume.pdf',
}

function makeStore() {
  const s = configureStore({ reducer: { auth: authReducer, notifications: notificationsReducer } })
  s.dispatch(setCredentials({ user: SEEKER, tokens: { access: 'tok', refresh: 'ref' } }))
  return s
}

function wrap(ui: React.ReactElement) {
  const store = makeStore()
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } } })
  return render(
    <Provider store={store}>
      <QueryClientProvider client={qc}>
        <MemoryRouter>{ui}</MemoryRouter>
      </QueryClientProvider>
    </Provider>,
  )
}

beforeEach(async () => {
  const api = (await import('../lib/axios')).default as any
  api.get.mockReset()
  api.patch.mockReset()
  api.get.mockResolvedValue({ data: PROFILE_DATA })
  api.patch.mockResolvedValue({ data: PROFILE_DATA })
  ;(global as any).WebSocket = vi.fn().mockImplementation(() => ({
    close: vi.fn(), send: vi.fn(), onopen: null, onclose: null, onerror: null, onmessage: null, readyState: 1,
  }))
})

describe('SeekerProfilePage — render', () => {
  it('renders My Profile heading', async () => {
    const { container } = wrap(<SeekerProfilePage />)
    await waitFor(() => expect(container.textContent).toContain('My Profile'), { timeout: 3000 })
  })

  it('renders Headline label', async () => {
    const { container } = wrap(<SeekerProfilePage />)
    await waitFor(() => expect(container.textContent).toContain('Headline'), { timeout: 3000 })
  })

  it('renders Bio label', async () => {
    const { container } = wrap(<SeekerProfilePage />)
    await waitFor(() => expect(container.textContent).toContain('Bio'), { timeout: 3000 })
  })

  it('renders Location label', async () => {
    const { container } = wrap(<SeekerProfilePage />)
    await waitFor(() => expect(container.textContent).toContain('Location'), { timeout: 3000 })
  })

  it('renders Experience Level label', async () => {
    const { container } = wrap(<SeekerProfilePage />)
    await waitFor(() => expect(container.textContent).toContain('Experience Level'), { timeout: 3000 })
  })

  it('renders GitHub label', async () => {
    const { container } = wrap(<SeekerProfilePage />)
    await waitFor(() => expect(container.textContent).toContain('GitHub'), { timeout: 3000 })
  })

  it('renders LinkedIn label', async () => {
    const { container } = wrap(<SeekerProfilePage />)
    await waitFor(() => expect(container.textContent).toContain('LinkedIn'), { timeout: 3000 })
  })

  it('renders Open to work checkbox', async () => {
    const { container } = wrap(<SeekerProfilePage />)
    await waitFor(() => expect(container.textContent).toContain('Open to work'), { timeout: 3000 })
  })

  it('renders Save Profile button', async () => {
    const { container } = wrap(<SeekerProfilePage />)
    await waitFor(() => expect(container.textContent).toContain('Save Profile'), { timeout: 3000 })
  })

  it('renders Resume section', async () => {
    const { container } = wrap(<SeekerProfilePage />)
    await waitFor(() => expect(container.textContent).toContain('Resume'), { timeout: 3000 })
  })

  it('renders upload prompt when no resume', async () => {
    const { container } = wrap(<SeekerProfilePage />)
    await waitFor(() => expect(container.textContent).toContain('upload your resume'), { timeout: 3000 })
  })

  it('renders resume card when profile has resume', async () => {
    const api = (await import('../lib/axios')).default as any
    api.get.mockResolvedValue({ data: PROFILE_WITH_RESUME })
    const { container } = wrap(<SeekerProfilePage />)
    await waitFor(() => expect(container.textContent).toContain('MyResume.pdf'), { timeout: 3000 })
  })

  it('shows headline input with form', async () => {
    const { container } = wrap(<SeekerProfilePage />)
    await waitFor(() => {
      const input = container.querySelector('input[name="headline"]')
      expect(input).not.toBeNull()
    }, { timeout: 3000 })
  })

  it('shows bio textarea with form', async () => {
    const { container } = wrap(<SeekerProfilePage />)
    await waitFor(() => {
      const textarea = container.querySelector('textarea[name="bio"]')
      expect(textarea).not.toBeNull()
    }, { timeout: 3000 })
  })

  it('shows experience_level select', async () => {
    const { container } = wrap(<SeekerProfilePage />)
    await waitFor(() => {
      const select = container.querySelector('select[name="experience_level"]')
      expect(select).not.toBeNull()
    }, { timeout: 3000 })
  })
})

describe('SeekerProfilePage — interactions', () => {
  it('fills headline and submits form, calls api.patch', async () => {
    const api = (await import('../lib/axios')).default as any
    const { container } = wrap(<SeekerProfilePage />)

    await waitFor(() => expect(container.querySelector('input[name="headline"]')).not.toBeNull(), { timeout: 3000 })

    const headlineInput = container.querySelector('input[name="headline"]') as HTMLInputElement
    fireEvent.change(headlineInput, { target: { value: 'Senior Dev | React' } })

    const form = container.querySelector('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/profiles/seeker/', expect.any(Object))
    }, { timeout: 3000 })
  })

  it('successful save shows success toast', async () => {
    const toast = (await import('react-hot-toast')).default as any
    const api = (await import('../lib/axios')).default as any
    api.patch.mockResolvedValueOnce({ data: { ...PROFILE_DATA, headline: 'Senior Dev' } })

    const { container } = wrap(<SeekerProfilePage />)
    await waitFor(() => expect(container.querySelector('form')).not.toBeNull(), { timeout: 3000 })

    fireEvent.submit(container.querySelector('form')!)

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Profile updated!')
    }, { timeout: 3000 })
  })

  it('failed save shows error toast', async () => {
    const toast = (await import('react-hot-toast')).default as any
    const api = (await import('../lib/axios')).default as any
    api.patch.mockRejectedValueOnce(new Error('Server error'))

    const { container } = wrap(<SeekerProfilePage />)
    await waitFor(() => expect(container.querySelector('form')).not.toBeNull(), { timeout: 3000 })

    fireEvent.submit(container.querySelector('form')!)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to update profile.')
    }, { timeout: 3000 })
  })

  it('file input change: invalid type shows error toast', async () => {
    const toast = (await import('react-hot-toast')).default as any
    const { container } = wrap(<SeekerProfilePage />)

    await waitFor(() => expect(container.querySelector('input[type="file"]')).not.toBeNull(), { timeout: 3000 })

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const invalidFile = new File(['data'], 'image.png', { type: 'image/png' })
    Object.defineProperty(fileInput, 'files', { value: [invalidFile], writable: false })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Only PDF files allowed.')
    }, { timeout: 3000 })
  })

  it('file input change: file too large shows error toast', async () => {
    const toast = (await import('react-hot-toast')).default as any
    const { container } = wrap(<SeekerProfilePage />)

    await waitFor(() => expect(container.querySelector('input[type="file"]')).not.toBeNull(), { timeout: 3000 })

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const bigFile = new File([new ArrayBuffer(6 * 1024 * 1024)], 'big.pdf', { type: 'application/pdf' })
    Object.defineProperty(fileInput, 'files', { value: [bigFile], writable: false })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('File too large. Max 5MB.')
    }, { timeout: 3000 })
  })

  it('valid PDF upload calls api.patch', async () => {
    const api = (await import('../lib/axios')).default as any
    const { container } = wrap(<SeekerProfilePage />)

    await waitFor(() => expect(container.querySelector('input[type="file"]')).not.toBeNull(), { timeout: 3000 })

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const pdfFile = new File(['%PDF'], 'resume.pdf', { type: 'application/pdf' })
    Object.defineProperty(fileInput, 'files', { value: [pdfFile], writable: false })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/profiles/seeker/', expect.any(FormData), expect.any(Object))
    }, { timeout: 3000 })
  })

  it('successful upload shows success toast', async () => {
    const toast = (await import('react-hot-toast')).default as any
    const api = (await import('../lib/axios')).default as any
    api.patch.mockResolvedValueOnce({ data: { ...PROFILE_DATA, resume: 'https://cdn.example.com/r.pdf' } })

    const { container } = wrap(<SeekerProfilePage />)
    await waitFor(() => expect(container.querySelector('input[type="file"]')).not.toBeNull(), { timeout: 3000 })

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const pdfFile = new File(['%PDF'], 'resume.pdf', { type: 'application/pdf' })
    Object.defineProperty(fileInput, 'files', { value: [pdfFile], writable: false })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Resume uploaded!')
    }, { timeout: 3000 })
  })

  it('upload failure shows error toast', async () => {
    const toast = (await import('react-hot-toast')).default as any
    const api = (await import('../lib/axios')).default as any
    api.patch.mockRejectedValueOnce(new Error('Upload failed'))

    const { container } = wrap(<SeekerProfilePage />)
    await waitFor(() => expect(container.querySelector('input[type="file"]')).not.toBeNull(), { timeout: 3000 })

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const pdfFile = new File(['%PDF'], 'resume.pdf', { type: 'application/pdf' })
    Object.defineProperty(fileInput, 'files', { value: [pdfFile], writable: false })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Upload failed. Only PDF allowed.')
    }, { timeout: 3000 })
  })

  it('delete resume button appears when profile has resume', async () => {
    const api = (await import('../lib/axios')).default as any
    api.get.mockResolvedValue({ data: PROFILE_WITH_RESUME })
    const { container } = wrap(<SeekerProfilePage />)

    await waitFor(() => {
      const delBtn = container.querySelector('button[title="Remove"]')
      expect(delBtn).not.toBeNull()
    }, { timeout: 3000 })
  })

  it('clicking delete resume calls api.patch with null resume', async () => {
    const api = (await import('../lib/axios')).default as any
    api.get.mockResolvedValue({ data: PROFILE_WITH_RESUME })
    api.patch.mockResolvedValueOnce({ data: { ...PROFILE_DATA, resume: null } })

    const { container } = wrap(<SeekerProfilePage />)
    await waitFor(() => expect(container.querySelector('button[title="Remove"]')).not.toBeNull(), { timeout: 3000 })

    fireEvent.click(container.querySelector('button[title="Remove"]')!)

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/profiles/seeker/', { resume: null })
    }, { timeout: 3000 })
  })

  it('successful resume delete shows toast', async () => {
    const toast = (await import('react-hot-toast')).default as any
    const api = (await import('../lib/axios')).default as any
    api.get.mockResolvedValue({ data: PROFILE_WITH_RESUME })
    api.patch.mockResolvedValueOnce({ data: { ...PROFILE_DATA, resume: null } })

    const { container } = wrap(<SeekerProfilePage />)
    await waitFor(() => expect(container.querySelector('button[title="Remove"]')).not.toBeNull(), { timeout: 3000 })

    fireEvent.click(container.querySelector('button[title="Remove"]')!)

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Resume removed.')
    }, { timeout: 3000 })
  })

  it('file input no file selected does nothing', async () => {
    const api = (await import('../lib/axios')).default as any
    const { container } = wrap(<SeekerProfilePage />)

    await waitFor(() => expect(container.querySelector('input[type="file"]')).not.toBeNull(), { timeout: 3000 })

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    Object.defineProperty(fileInput, 'files', { value: [], writable: false })
    fireEvent.change(fileInput)

    // api.patch should NOT be called (no file)
    expect(api.patch).not.toHaveBeenCalled()
  })
})
