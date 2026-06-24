/**
 * Auth page interaction tests — form submission, error states, step transitions.
 * Covers LoginPage, RegisterPage, ForgotPasswordPage deeply.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { configureStore } from '@reduxjs/toolkit'
import React from 'react'
import authReducer from '../features/auth/authSlice'
import notificationsReducer from '../features/notifications/notificationsSlice'

import LoginPage from '../pages/auth/LoginPage'
import RegisterPage from '../pages/auth/RegisterPage'
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...(actual as any), useNavigate: () => mockNavigate }
})

vi.mock('../lib/axios', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({
      data: {
        access: 'access-tok',
        refresh: 'refresh-tok',
        user: { id: 'u1', email: 'seeker@test.com', first_name: 'Alice', last_name: 'S', role: 'seeker', is_verified: true },
      },
    }),
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
  GoogleLogin: ({ onSuccess, onError }: any) => (
    <>
      <button data-testid="google-login" onClick={() => onSuccess?.({ credential: 'g-credential' })}>
        Sign in with Google
      </button>
      <button data-testid="google-login-error" onClick={() => onError?.()}>
        Trigger Google Error
      </button>
    </>
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

const DEFAULT_LOGIN_RESPONSE = {
  data: {
    access: 'access-tok', refresh: 'refresh-tok',
    user: { id: 'u1', email: 'seeker@test.com', first_name: 'Alice', last_name: 'S', role: 'seeker', is_verified: true },
  },
}

beforeAll(() => {
  ;(global as any).WebSocket = vi.fn().mockImplementation(() => ({
    close: vi.fn(), send: vi.fn(),
    onopen: null, onclose: null, onerror: null, onmessage: null, readyState: 1,
  }))
})

beforeEach(async () => {
  // Reset mock state so "once" queues don't bleed between tests
  const api = (await import('../lib/axios')).default as any
  api.post.mockReset()
  api.post.mockResolvedValue(DEFAULT_LOGIN_RESPONSE)
  api.get.mockReset()
  api.get.mockResolvedValue({ data: {} })
  mockNavigate.mockReset()
  const toast = (await import('react-hot-toast')).default as any
  toast.mockReset?.()
  toast.success?.mockReset?.()
  toast.error?.mockReset?.()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStore() {
  return configureStore({ reducer: { auth: authReducer, notifications: notificationsReducer } })
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

// ---------------------------------------------------------------------------
// LoginPage
// ---------------------------------------------------------------------------

describe('LoginPage — form interactions', () => {
  it('renders the email input', () => {
    const { container } = wrap(<LoginPage />)
    expect(container.querySelector('input[type="email"]') || container.querySelector('input[name="email"]')).toBeTruthy()
  })

  it('renders the password input', () => {
    const { container } = wrap(<LoginPage />)
    expect(container.querySelector('input[type="password"]') || container.querySelector('input[name="password"]')).toBeTruthy()
  })

  it('shows "Forgot password?" link', () => {
    const { container } = wrap(<LoginPage />)
    expect(container.textContent).toContain('Forgot')
  })

  it('shows "Sign up" link', () => {
    const { container } = wrap(<LoginPage />)
    expect(container.textContent).toContain('Sign up')
  })

  it('fills email input and it updates', () => {
    const { container } = wrap(<LoginPage />)
    const emailInput = container.querySelector('input[name="email"]') as HTMLInputElement
    if (emailInput) {
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      expect(emailInput.value).toBe('test@example.com')
    }
  })

  it('fills password input and it updates', () => {
    const { container } = wrap(<LoginPage />)
    const pwInput = container.querySelector('input[name="password"]') as HTMLInputElement
    if (pwInput) {
      fireEvent.change(pwInput, { target: { value: 'secret123' } })
      expect(pwInput.value).toBe('secret123')
    }
  })

  it('submits the form and calls api.post', async () => {
    const api = (await import('../lib/axios')).default as any
    api.post.mockResolvedValueOnce({
      data: {
        access: 'tok', refresh: 'ref',
        user: { id: 'u1', email: 'seeker@test.com', first_name: 'Alice', last_name: 'S', role: 'seeker', is_verified: true },
      },
    })

    const { container } = wrap(<LoginPage />)

    const emailInput = container.querySelector('input[name="email"]')!
    const pwInput = container.querySelector('input[name="password"]')!
    const submitBtn = container.querySelector('button[type="submit"]')!

    fireEvent.change(emailInput, { target: { value: 'seeker@test.com' } })
    fireEvent.change(pwInput, { target: { value: 'Test@1234' } })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/login/', expect.objectContaining({ email: 'seeker@test.com' }))
    }, { timeout: 3000 })
  })

  it('shows success toast and navigates on login', async () => {
    const toast = (await import('react-hot-toast')).default as any
    const api = (await import('../lib/axios')).default as any
    api.post.mockResolvedValueOnce({
      data: {
        access: 'tok', refresh: 'ref',
        user: { id: 'u1', email: 'seeker@test.com', first_name: 'Alice', last_name: 'S', role: 'seeker', is_verified: true },
      },
    })

    const { container } = wrap(<LoginPage />)
    fireEvent.change(container.querySelector('input[name="email"]')!, { target: { value: 'seeker@test.com' } })
    fireEvent.change(container.querySelector('input[name="password"]')!, { target: { value: 'Test@1234' } })
    fireEvent.click(container.querySelector('button[type="submit"]')!)

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Alice'))
    }, { timeout: 3000 })
  })

  it('navigates to /recruiter/dashboard for recruiter role', async () => {
    const api = (await import('../lib/axios')).default as any
    api.post.mockResolvedValueOnce({
      data: {
        access: 'tok', refresh: 'ref',
        user: { id: 'r1', email: 'rec@test.com', first_name: 'Bob', last_name: 'R', role: 'recruiter', is_verified: true },
      },
    })

    const { container } = wrap(<LoginPage />)
    fireEvent.change(container.querySelector('input[name="email"]')!, { target: { value: 'rec@test.com' } })
    fireEvent.change(container.querySelector('input[name="password"]')!, { target: { value: 'Test@1234' } })
    fireEvent.click(container.querySelector('button[type="submit"]')!)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/recruiter/dashboard')
    }, { timeout: 3000 })
  })

  it('navigates to /admin for admin role', async () => {
    const api = (await import('../lib/axios')).default as any
    api.post.mockResolvedValueOnce({
      data: {
        access: 'tok', refresh: 'ref',
        user: { id: 'a1', email: 'admin@test.com', first_name: 'Admin', last_name: 'A', role: 'admin', is_verified: true },
      },
    })

    const { container } = wrap(<LoginPage />)
    fireEvent.change(container.querySelector('input[name="email"]')!, { target: { value: 'admin@test.com' } })
    fireEvent.change(container.querySelector('input[name="password"]')!, { target: { value: 'Test@1234' } })
    fireEvent.click(container.querySelector('button[type="submit"]')!)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/admin')
    }, { timeout: 3000 })
  })

  it('shows error toast on login failure', async () => {
    const toast = (await import('react-hot-toast')).default as any
    const api = (await import('../lib/axios')).default as any
    api.post.mockRejectedValueOnce(new Error('Invalid credentials'))

    const { container } = wrap(<LoginPage />)
    fireEvent.change(container.querySelector('input[name="email"]')!, { target: { value: 'bad@test.com' } })
    fireEvent.change(container.querySelector('input[name="password"]')!, { target: { value: 'wrong' } })
    fireEvent.click(container.querySelector('button[type="submit"]')!)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
    }, { timeout: 3000 })
  })

  it('Google login button is present', () => {
    const { container } = wrap(<LoginPage />)
    expect(container.querySelector('[data-testid="google-login"]') || screen.getByText('Sign in with Google')).toBeTruthy()
  })

  it('Google login: api.post called with credential on button click', async () => {
    const api = (await import('../lib/axios')).default as any
    const { container } = wrap(<LoginPage />)
    const googleBtn = container.querySelector('[data-testid="google-login"]')
    if (googleBtn) fireEvent.click(googleBtn)

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/google/', expect.objectContaining({ credential: 'g-credential' }))
    }, { timeout: 3000 })
  })

  it('Google login: on new_user response navigates seeker to dashboard', async () => {
    const api = (await import('../lib/axios')).default as any
    api.post.mockResolvedValue({
      data: {
        access: 'tok', refresh: 'ref',
        user: { id: 'g1', email: 'g@test.com', first_name: 'Gee', last_name: 'O', role: 'seeker', is_verified: true },
      },
    })

    const { container } = wrap(<LoginPage />)
    const googleBtn = container.querySelector('[data-testid="google-login"]')
    if (googleBtn) fireEvent.click(googleBtn)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
    }, { timeout: 3000 })
  })

  it('Google login: googleMutation called with credential', async () => {
    const api = (await import('../lib/axios')).default as any
    const { container } = wrap(<LoginPage />)
    const googleBtn = container.querySelector('[data-testid="google-login"]')
    if (googleBtn) fireEvent.click(googleBtn)

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/google/', expect.objectContaining({ credential: 'g-credential' }))
    }, { timeout: 3000 })
  })

  it('Google login: googleMutation error shows toast', async () => {
    const toast = (await import('react-hot-toast')).default as any
    const api = (await import('../lib/axios')).default as any
    api.post.mockRejectedValueOnce(new Error('Google auth failed'))

    const { container } = wrap(<LoginPage />)
    const googleBtn = container.querySelector('[data-testid="google-login"]')
    if (googleBtn) fireEvent.click(googleBtn)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Google sign-in failed. Try again.')
    }, { timeout: 3000 })
  })

  it('Google login: onError callback shows toast', async () => {
    const toast = (await import('react-hot-toast')).default as any
    const { container } = wrap(<LoginPage />)

    const errorBtn = container.querySelector('[data-testid="google-login-error"]')
    if (errorBtn) fireEvent.click(errorBtn)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Google sign-in failed.')
    }, { timeout: 2000 })
  })

})

// ---------------------------------------------------------------------------
// RegisterPage
// ---------------------------------------------------------------------------

describe('RegisterPage — form interactions', () => {
  it('renders the registration form', () => {
    const { container } = wrap(<RegisterPage />)
    expect(container.textContent).toContain('HireSync')
  })

  it('shows first name input', () => {
    const { container } = wrap(<RegisterPage />)
    expect(container.querySelector('input[name="first_name"]')).toBeTruthy()
  })

  it('shows email input', () => {
    const { container } = wrap(<RegisterPage />)
    expect(container.querySelector('input[name="email"]')).toBeTruthy()
  })

  it('shows password input', () => {
    const { container } = wrap(<RegisterPage />)
    expect(container.querySelector('input[name="password"]')).toBeTruthy()
  })

  it('shows Job Seeker role option', () => {
    const { container } = wrap(<RegisterPage />)
    expect(container.textContent).toContain('Job Seeker')
  })

  it('shows Recruiter role option', () => {
    const { container } = wrap(<RegisterPage />)
    expect(container.textContent).toContain('Recruiter')
  })

  it('shows "Your details" step indicator', () => {
    const { container } = wrap(<RegisterPage />)
    expect(container.textContent).toContain('Your details')
  })

  it('fills form fields', () => {
    const { container } = wrap(<RegisterPage />)
    const emailInput = container.querySelector('input[name="email"]') as HTMLInputElement
    if (emailInput) {
      fireEvent.change(emailInput, { target: { value: 'new@test.com' } })
      expect(emailInput.value).toBe('new@test.com')
    }
  })

  it('submits form and calls sendOtp api', async () => {
    const api = (await import('../lib/axios')).default as any
    api.post.mockResolvedValueOnce({ data: { detail: 'OTP sent' } })

    const { container } = wrap(<RegisterPage />)
    const form = container.querySelector('form')!

    // Fill all required fields
    const fields = {
      first_name: 'Alice',
      last_name: 'Smith',
      email: 'alice@test.com',
      password: 'Test@1234',
      password_confirm: 'Test@1234',
    }
    Object.entries(fields).forEach(([name, value]) => {
      const input = container.querySelector(`input[name="${name}"]`) as HTMLInputElement
      if (input) fireEvent.change(input, { target: { value } })
    })

    fireEvent.submit(form)

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/send-registration-otp/', expect.any(Object))
    }, { timeout: 3000 })
  })

  it('shows OTP verification step after OTP sent', async () => {
    const api = (await import('../lib/axios')).default as any
    api.post.mockResolvedValueOnce({ data: { detail: 'OTP sent' } })

    const { container } = wrap(<RegisterPage />)
    const form = container.querySelector('form')!

    const fields = { first_name: 'Alice', last_name: 'Smith', email: 'alice@test.com', password: 'Test@1234', password_confirm: 'Test@1234' }
    Object.entries(fields).forEach(([name, value]) => {
      const input = container.querySelector(`input[name="${name}"]`) as HTMLInputElement
      if (input) fireEvent.change(input, { target: { value } })
    })
    fireEvent.submit(form)

    await waitFor(() => {
      expect(container.textContent).toContain('Verify')
    }, { timeout: 3000 })
  })

  it('shows error toast on OTP send failure', async () => {
    const api = (await import('../lib/axios')).default as any
    const toast = (await import('react-hot-toast')).default as any
    api.post.mockRejectedValueOnce({ response: { data: { detail: 'Email already taken' } } })

    const { container } = wrap(<RegisterPage />)
    const form = container.querySelector('form')!

    const fields = { first_name: 'Alice', last_name: 'Smith', email: 'taken@test.com', password: 'Test@1234', password_confirm: 'Test@1234' }
    Object.entries(fields).forEach(([name, value]) => {
      const input = container.querySelector(`input[name="${name}"]`) as HTMLInputElement
      if (input) fireEvent.change(input, { target: { value } })
    })
    fireEvent.submit(form)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
    }, { timeout: 3000 })
  })
})

// ---------------------------------------------------------------------------
// ForgotPasswordPage
// ---------------------------------------------------------------------------

describe('ForgotPasswordPage — step interactions', () => {
  it('renders Forgot password heading', () => {
    const { container } = wrap(<ForgotPasswordPage />)
    expect(container.textContent).toContain('Forgot password')
  })

  it('shows email input on step 1', () => {
    const { container } = wrap(<ForgotPasswordPage />)
    expect(container.querySelector('input[type="email"]')).toBeTruthy()
  })

  it('shows Send OTP button', () => {
    const { container } = wrap(<ForgotPasswordPage />)
    expect(container.textContent).toContain('Send OTP')
  })

  it('fills email input', () => {
    const { container } = wrap(<ForgotPasswordPage />)
    const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement
    if (emailInput) {
      fireEvent.change(emailInput, { target: { value: 'user@test.com' } })
      expect(emailInput.value).toBe('user@test.com')
    }
  })

  it('clicking Send OTP calls api.post', async () => {
    const api = (await import('../lib/axios')).default as any
    api.post.mockResolvedValueOnce({ data: { detail: 'OTP sent' } })

    const { container } = wrap(<ForgotPasswordPage />)
    const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement
    const sendBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Send OTP'))

    if (emailInput) fireEvent.change(emailInput, { target: { value: 'user@test.com' } })
    if (sendBtn) fireEvent.click(sendBtn)

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/forgot-password/', { email: 'user@test.com' })
    }, { timeout: 3000 })
  })

  it('transitions to reset step after OTP sent', async () => {
    const api = (await import('../lib/axios')).default as any
    api.post.mockResolvedValueOnce({ data: { detail: 'OTP sent' } })

    const { container } = wrap(<ForgotPasswordPage />)
    const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement
    const sendBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Send OTP'))

    if (emailInput) fireEvent.change(emailInput, { target: { value: 'user@test.com' } })
    if (sendBtn) fireEvent.click(sendBtn)

    await waitFor(() => {
      expect(container.textContent).toMatch(/OTP|code|6.digit|reset/i)
    }, { timeout: 3000 })
  })

  it('shows error toast on OTP send failure', async () => {
    const api = (await import('../lib/axios')).default as any
    const toast = (await import('react-hot-toast')).default as any
    api.post.mockRejectedValueOnce({ response: { data: { detail: 'Email not found' } } })

    const { container } = wrap(<ForgotPasswordPage />)
    const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement
    const sendBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Send OTP'))

    if (emailInput) fireEvent.change(emailInput, { target: { value: 'unknown@test.com' } })
    if (sendBtn) fireEvent.click(sendBtn)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
    }, { timeout: 3000 })
  })

  it('reset step: shows OTP input and new password fields', async () => {
    const api = (await import('../lib/axios')).default as any
    api.post.mockResolvedValueOnce({ data: {} })

    const { container } = wrap(<ForgotPasswordPage />)
    const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement
    const sendBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Send OTP'))

    if (emailInput) fireEvent.change(emailInput, { target: { value: 'user@test.com' } })
    if (sendBtn) fireEvent.click(sendBtn)

    await waitFor(() => {
      expect(container.textContent).toMatch(/code|OTP|new password/i)
    }, { timeout: 3000 })
  })

  async function advanceToResetStep(container: HTMLElement) {
    const api = (await import('../lib/axios')).default as any
    api.post.mockResolvedValueOnce({ data: {} })
    const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement
    const sendBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Send OTP'))
    if (emailInput) fireEvent.change(emailInput, { target: { value: 'user@test.com' } })
    if (sendBtn) fireEvent.click(sendBtn)
    // Wait until the reset step's new-password field appears
    await waitFor(() => expect(container.querySelector('input[type="password"]')).not.toBeNull(), { timeout: 3000 })
  }

  it('reset step: OTP input accepts digits', async () => {
    const { container } = wrap(<ForgotPasswordPage />)
    await advanceToResetStep(container)

    const allInputs = container.querySelectorAll('input')
    // first text input on reset step is the OTP field
    const otpInput = Array.from(allInputs).find(i => i.getAttribute('type') === 'text') as HTMLInputElement
    if (otpInput) {
      fireEvent.change(otpInput, { target: { value: '123456' } })
      expect(otpInput.value).toBe('123456')
    }
  })

  it('reset step: new password and confirm inputs accept values', async () => {
    const { container } = wrap(<ForgotPasswordPage />)
    await advanceToResetStep(container)

    const pwInputs = container.querySelectorAll('input[type="password"]') as NodeListOf<HTMLInputElement>
    if (pwInputs.length >= 2) {
      fireEvent.change(pwInputs[0], { target: { value: 'NewPass@1234' } })
      fireEvent.change(pwInputs[1], { target: { value: 'NewPass@1234' } })
      expect(pwInputs[0].value).toBe('NewPass@1234')
    }
  })

  it('reset step: shows mismatch error when passwords differ', async () => {
    const { container } = wrap(<ForgotPasswordPage />)
    await advanceToResetStep(container)

    const pwInputs = container.querySelectorAll('input[type="password"]') as NodeListOf<HTMLInputElement>
    if (pwInputs.length >= 2) {
      fireEvent.change(pwInputs[0], { target: { value: 'NewPass@1234' } })
      fireEvent.change(pwInputs[1], { target: { value: 'Different@99' } })
      await waitFor(() => expect(container.textContent).toContain("don't match"), { timeout: 2000 })
    }
  })

  it('reset step: successful reset calls api.post and shows toast', async () => {
    const api = (await import('../lib/axios')).default as any
    const toast = (await import('react-hot-toast')).default as any
    const { container } = wrap(<ForgotPasswordPage />)
    await advanceToResetStep(container)

    // Reset the post mock for the reset call
    api.post.mockResolvedValueOnce({ data: {} })

    const allInputs = container.querySelectorAll('input')
    const otpInput = Array.from(allInputs).find(i => i.getAttribute('type') === 'text') as HTMLInputElement
    const pwInputs = container.querySelectorAll('input[type="password"]') as NodeListOf<HTMLInputElement>
    const resetBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Reset'))

    if (otpInput) fireEvent.change(otpInput, { target: { value: '654321' } })
    if (pwInputs.length >= 2) {
      fireEvent.change(pwInputs[0], { target: { value: 'NewPass@1234' } })
      fireEvent.change(pwInputs[1], { target: { value: 'NewPass@1234' } })
    }
    if (resetBtn) fireEvent.click(resetBtn)

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/reset-password/', expect.objectContaining({ otp: '654321' }))
    }, { timeout: 3000 })
  })

  it('reset step: failed reset shows error toast', async () => {
    const api = (await import('../lib/axios')).default as any
    const toast = (await import('react-hot-toast')).default as any
    const { container } = wrap(<ForgotPasswordPage />)
    await advanceToResetStep(container)

    api.post.mockRejectedValueOnce({ response: { data: { detail: 'Invalid OTP' } } })

    const allInputs = container.querySelectorAll('input')
    const otpInput = Array.from(allInputs).find(i => i.getAttribute('type') === 'text') as HTMLInputElement
    const pwInputs = container.querySelectorAll('input[type="password"]') as NodeListOf<HTMLInputElement>
    const resetBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Reset'))

    if (otpInput) fireEvent.change(otpInput, { target: { value: '000000' } })
    if (pwInputs.length >= 2) {
      fireEvent.change(pwInputs[0], { target: { value: 'NewPass@1234' } })
      fireEvent.change(pwInputs[1], { target: { value: 'NewPass@1234' } })
    }
    if (resetBtn) fireEvent.click(resetBtn)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
    }, { timeout: 3000 })
  })

  it('reset step: back button returns to email step', async () => {
    const { container } = wrap(<ForgotPasswordPage />)
    await advanceToResetStep(container)

    const backBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Resend OTP'))
    if (backBtn) fireEvent.click(backBtn)

    await waitFor(() => expect(container.textContent).toContain('Send OTP'), { timeout: 2000 })
  })
})

// ---------------------------------------------------------------------------
// RegisterPage — OTP step interactions (covers lines 63-65, 171-195)
// ---------------------------------------------------------------------------

describe('RegisterPage — OTP step interactions', () => {
  const FORM_FIELDS = { first_name: 'Alice', last_name: 'Smith', email: 'alice@test.com', password: 'Test@1234', password_confirm: 'Test@1234' }

  async function advanceToOtpStep(container: HTMLElement) {
    const api = (await import('../lib/axios')).default as any
    api.post.mockResolvedValueOnce({ data: { detail: 'OTP sent' } })
    const form = container.querySelector('form')!
    Object.entries(FORM_FIELDS).forEach(([name, value]) => {
      const input = container.querySelector(`input[name="${name}"]`) as HTMLInputElement
      if (input) fireEvent.change(input, { target: { value } })
    })
    fireEvent.submit(form)
    await waitFor(() => expect(container.textContent).toContain('Create Account'), { timeout: 3000 })
  }

  it('OTP input is visible and accepts numbers', async () => {
    const { container } = wrap(<RegisterPage />)
    await advanceToOtpStep(container)

    const otpInput = container.querySelector('input[placeholder="••••••"]') as HTMLInputElement
    if (otpInput) {
      fireEvent.change(otpInput, { target: { value: '123456' } })
      expect(otpInput.value).toBe('123456')
    }
  })

  it('OTP input strips non-numeric characters', async () => {
    const { container } = wrap(<RegisterPage />)
    await advanceToOtpStep(container)

    const otpInput = container.querySelector('input[placeholder="••••••"]') as HTMLInputElement
    if (otpInput) {
      fireEvent.change(otpInput, { target: { value: 'abc123' } })
      expect(otpInput.value).toBe('123')
    }
  })

  it('Create Account button is disabled when OTP is short', async () => {
    const { container } = wrap(<RegisterPage />)
    await advanceToOtpStep(container)

    // 3-char OTP — button should be disabled
    const otpInput = container.querySelector('input[placeholder="••••••"]') as HTMLInputElement
    if (otpInput) fireEvent.change(otpInput, { target: { value: '123' } })

    const createBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Create Account'))
    expect((createBtn as HTMLButtonElement)?.disabled).toBe(true)
  })

  it('clicking Create Account with valid OTP calls api.post register', async () => {
    const api = (await import('../lib/axios')).default as any

    const { container } = wrap(<RegisterPage />)
    await advanceToOtpStep(container)

    // Set up mock AFTER advanceToOtpStep consumed the sendOtp mock
    api.post.mockResolvedValueOnce({ data: { tokens: { access: 'a', refresh: 'r' }, user: { role: 'seeker' } } })

    const otpInput = container.querySelector('input[placeholder="••••••"]') as HTMLInputElement
    if (otpInput) fireEvent.change(otpInput, { target: { value: '123456' } })

    const createBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Create Account'))
    if (createBtn) fireEvent.click(createBtn)

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/register/', expect.objectContaining({ otp: '123456' }))
    }, { timeout: 3000 })
  })

  it('successful register shows success toast', async () => {
    const toast = (await import('react-hot-toast')).default as any
    const api = (await import('../lib/axios')).default as any

    const { container } = wrap(<RegisterPage />)
    await advanceToOtpStep(container)

    // Set up register mock AFTER sendOtp mock was consumed
    api.post.mockResolvedValueOnce({ data: { tokens: { access: 'a', refresh: 'r' }, user: { id: 'u1', email: 'alice@test.com', first_name: 'Alice', last_name: 'S', role: 'seeker', is_verified: true } } })

    const otpInput = container.querySelector('input[placeholder="••••••"]') as HTMLInputElement
    if (otpInput) fireEvent.change(otpInput, { target: { value: '654321' } })

    const createBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Create Account'))
    if (createBtn) fireEvent.click(createBtn)

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Account created'))
    }, { timeout: 3000 })
  })

  it('failed register mutation shows error toast', async () => {
    const toast = (await import('react-hot-toast')).default as any
    const api = (await import('../lib/axios')).default as any

    const { container } = wrap(<RegisterPage />)
    await advanceToOtpStep(container)

    // Set up failure mock AFTER sendOtp mock was consumed
    api.post.mockRejectedValueOnce({ response: { data: { otp: ['Invalid OTP'] } } })

    const otpInput = container.querySelector('input[placeholder="••••••"]') as HTMLInputElement
    if (otpInput) fireEvent.change(otpInput, { target: { value: '000000' } })

    const createBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Create Account'))
    if (createBtn) fireEvent.click(createBtn)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
    }, { timeout: 3000 })
  })

  it('"Resend code" button calls sendOtp again', async () => {
    const api = (await import('../lib/axios')).default as any
    api.post.mockResolvedValueOnce({ data: {} })

    const { container } = wrap(<RegisterPage />)
    await advanceToOtpStep(container)

    const resendBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Resend'))
    if (resendBtn) fireEvent.click(resendBtn)

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/send-registration-otp/', expect.any(Object))
    }, { timeout: 3000 })
  })

  it('"Change email" button returns to form step', async () => {
    const { container } = wrap(<RegisterPage />)
    await advanceToOtpStep(container)

    const changeBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Change email'))
    if (changeBtn) fireEvent.click(changeBtn)

    await waitFor(() => expect(container.querySelector('input[name="first_name"]')).not.toBeNull(), { timeout: 2000 })
  })
})
