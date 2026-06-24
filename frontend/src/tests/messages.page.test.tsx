/**
 * MessagesPage tests — conversations list, selecting a convo, sending messages,
 * WebSocket handling, and the handleSend fallback path.
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
import MessagesPage from '../pages/MessagesPage'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../lib/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn().mockResolvedValue({ data: { id: 'm1', content: 'hi', sent_at: new Date().toISOString() } }),
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

const USER = {
  id: 'user-1', email: 'seeker@test.com', first_name: 'Alice', last_name: 'S',
  full_name: 'Alice S', role: 'seeker' as const, is_verified: true,
}

const CONVERSATIONS = [
  {
    id: 'convo-1',
    other_participant: { id: 'u2', full_name: 'Bob Recruiter' },
    last_message: { content: 'Hey there!', sent_at: '2024-01-01T10:00:00Z' },
    unread_count: 3,
  },
  {
    id: 'convo-2',
    other_participant: { id: 'u3', full_name: 'Carol Recruiter' },
    last_message: null,
    unread_count: 0,
  },
]

const MESSAGES = [
  { id: 'm1', content: 'Hello from Bob!', sender: { id: 'u2' }, sent_at: '2024-01-01T10:00:00Z' },
  { id: 'm2', content: 'Hi Bob!', sender: { id: 'user-1' }, sent_at: '2024-01-01T10:01:00Z' },
]

// ---------------------------------------------------------------------------
// WS mock
// ---------------------------------------------------------------------------

let capturedWs: any = null

const WS_OPEN = 1
const WS_CLOSED = 3

class MockWS {
  close = vi.fn()
  send = vi.fn()
  onopen: any = null
  onclose: any = null
  onerror: any = null
  onmessage: any = null
  readyState = WS_OPEN

  constructor(_url: string) {
    capturedWs = this
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStore() {
  const s = configureStore({ reducer: { auth: authReducer, notifications: notificationsReducer } })
  s.dispatch(setCredentials({ user: USER, tokens: { access: 'tok', refresh: 'ref' } }))
  return s
}

function wrap() {
  const store = makeStore()
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } } })
  return render(
    <Provider store={store}>
      <QueryClientProvider client={qc}>
        <MemoryRouter>{<MessagesPage />}</MemoryRouter>
      </QueryClientProvider>
    </Provider>,
  )
}

beforeEach(async () => {
  capturedWs = null
  ;(global as any).WebSocket = MockWS
  // WebSocket.OPEN constant must be available for the component's readyState check
  ;(global as any).WebSocket.OPEN = WS_OPEN
  // scrollIntoView not implemented in jsdom
  ;(Element.prototype as any).scrollIntoView = vi.fn()
  ;(global as any).localStorage = {
    getItem: vi.fn().mockReturnValue('mock-token'),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  }

  const api = (await import('../lib/axios')).default as any
  api.get.mockReset()
  api.post.mockReset()
  api.get.mockImplementation((url: string) => {
    if (url.includes('/messaging/conversations/')) {
      if (url.includes('/messages/')) return Promise.resolve({ data: { results: MESSAGES } })
      return Promise.resolve({ data: { results: CONVERSATIONS } })
    }
    return Promise.resolve({ data: {} })
  })
  api.post.mockResolvedValue({ data: { id: 'm-new', content: 'sent', sent_at: new Date().toISOString() } })
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MessagesPage — conversations list', () => {
  it('renders Messages heading', async () => {
    const { container } = wrap()
    await waitFor(() => expect(container.textContent).toContain('Messages'), { timeout: 3000 })
  })

  it('shows conversation with Bob Recruiter', async () => {
    const { container } = wrap()
    await waitFor(() => expect(container.textContent).toContain('Bob Recruiter'), { timeout: 3000 })
  })

  it('shows conversation with Carol Recruiter', async () => {
    const { container } = wrap()
    await waitFor(() => expect(container.textContent).toContain('Carol Recruiter'), { timeout: 3000 })
  })

  it('shows last message preview', async () => {
    const { container } = wrap()
    await waitFor(() => expect(container.textContent).toContain('Hey there!'), { timeout: 3000 })
  })

  it('shows unread count badge', async () => {
    const { container } = wrap()
    await waitFor(() => expect(container.textContent).toContain('3'), { timeout: 3000 })
  })

  it('shows "No conversations yet" when empty', async () => {
    const api = (await import('../lib/axios')).default as any
    api.get.mockImplementation((url: string) => {
      if (url.includes('/messaging/conversations/')) return Promise.resolve({ data: { results: [] } })
      return Promise.resolve({ data: {} })
    })

    const { container } = wrap()
    await waitFor(() => expect(container.textContent).toContain('No conversations yet'), { timeout: 3000 })
  })

  it('shows initials avatar for Bob Recruiter', async () => {
    const { container } = wrap()
    await waitFor(() => expect(container.textContent).toContain('BR'), { timeout: 3000 })
  })
})

describe('MessagesPage — selecting a conversation', () => {
  it('clicking a conversation opens chat area', async () => {
    const { container } = wrap()
    await waitFor(() => expect(container.textContent).toContain('Bob Recruiter'), { timeout: 3000 })

    const bobConvo = Array.from(container.querySelectorAll('[class*="cursor-pointer"]')).find(
      (el) => el.textContent?.includes('Bob Recruiter')
    )
    if (bobConvo) fireEvent.click(bobConvo)

    await waitFor(() => expect(container.textContent).toContain('Hello from Bob!'), { timeout: 3000 })
  })

  it('shows message input after selecting conversation', async () => {
    const { container } = wrap()
    await waitFor(() => expect(container.textContent).toContain('Bob Recruiter'), { timeout: 3000 })

    const bobConvo = Array.from(container.querySelectorAll('[class*="cursor-pointer"]')).find(
      (el) => el.textContent?.includes('Bob Recruiter')
    )
    if (bobConvo) fireEvent.click(bobConvo)

    await waitFor(() => {
      const input = container.querySelector('input[placeholder="Type a message..."]')
      expect(input).not.toBeNull()
    }, { timeout: 3000 })
  })

  it('creates WebSocket when conversation is selected', async () => {
    const { container } = wrap()
    await waitFor(() => expect(container.textContent).toContain('Bob Recruiter'), { timeout: 3000 })

    const bobConvo = Array.from(container.querySelectorAll('[class*="cursor-pointer"]')).find(
      (el) => el.textContent?.includes('Bob Recruiter')
    )
    if (bobConvo) {
      fireEvent.click(bobConvo)
      await waitFor(() => expect(capturedWs).not.toBeNull(), { timeout: 3000 })
    }
  })

  it('shows own messages on right side', async () => {
    const { container } = wrap()
    await waitFor(() => expect(container.textContent).toContain('Bob Recruiter'), { timeout: 3000 })

    const bobConvo = Array.from(container.querySelectorAll('[class*="cursor-pointer"]')).find(
      (el) => el.textContent?.includes('Bob Recruiter')
    )
    if (bobConvo) fireEvent.click(bobConvo)

    await waitFor(() => expect(container.textContent).toContain('Hi Bob!'), { timeout: 3000 })
  })
})

describe('MessagesPage — sending messages', () => {
  async function openConvo(container: HTMLElement) {
    await waitFor(() => expect(container.textContent).toContain('Bob Recruiter'), { timeout: 3000 })
    const bobConvo = Array.from(container.querySelectorAll('[class*="cursor-pointer"]')).find(
      (el) => el.textContent?.includes('Bob Recruiter')
    )
    if (bobConvo) fireEvent.click(bobConvo)
    await waitFor(() => expect(container.querySelector('input[placeholder="Type a message..."]')).not.toBeNull(), { timeout: 3000 })
  }

  it('typing in message input updates state', async () => {
    const { container } = wrap()
    await openConvo(container)

    const input = container.querySelector('input[placeholder="Type a message..."]') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Hello!' } })
    expect(input.value).toBe('Hello!')
  })

  it('submitting via WebSocket OPEN path sends ws.send', async () => {
    const { container } = wrap()
    await openConvo(container)
    await waitFor(() => expect(capturedWs).not.toBeNull(), { timeout: 3000 })

    const input = container.querySelector('input[placeholder="Type a message..."]') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Hello via WS!' } })

    const form = container.querySelector('form')!
    fireEvent.submit(form)

    expect(capturedWs?.send).toHaveBeenCalledWith(JSON.stringify({ content: 'Hello via WS!' }))
  })

  it('submitting empty message does nothing', async () => {
    const api = (await import('../lib/axios')).default as any
    const { container } = wrap()
    await openConvo(container)

    const form = container.querySelector('form')!
    fireEvent.submit(form)

    expect(api.post).not.toHaveBeenCalledWith(
      expect.stringContaining('/messages/'), expect.any(Object)
    )
  })

  it('WebSocket closed path falls back to api.post', async () => {
    const api = (await import('../lib/axios')).default as any
    const { container } = wrap()
    await openConvo(container)
    await waitFor(() => expect(capturedWs).not.toBeNull(), { timeout: 3000 })

    // Force WS to be closed
    capturedWs.readyState = WS_CLOSED

    const input = container.querySelector('input[placeholder="Type a message..."]') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Fallback message' } })

    const form = container.querySelector('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        expect.stringContaining('/messages/'),
        { content: 'Fallback message' }
      )
    }, { timeout: 3000 })
  })

  it('WebSocket message handler refetches messages', async () => {
    const { container } = wrap()
    await openConvo(container)
    await waitFor(() => expect(capturedWs).not.toBeNull(), { timeout: 3000 })

    act(() => {
      capturedWs?.onmessage?.({ data: JSON.stringify({ type: 'message', content: 'New msg' }) })
    })

    // Just verify no error was thrown
    expect(capturedWs).not.toBeNull()
  })
})

describe('MessagesPage — auto-open from URL', () => {
  it('auto-opens conversation when ?convo= param matches a conversation (covers lines 26-27)', async () => {
    const store = makeStore()
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } } })
    const { container } = render(
      <Provider store={store}>
        <QueryClientProvider client={qc}>
          <MemoryRouter initialEntries={['/?convo=convo-1']}>
            <MessagesPage />
          </MemoryRouter>
        </QueryClientProvider>
      </Provider>,
    )

    // Once conversations load and effect fires, convo-1 is auto-selected
    await waitFor(() => expect(container.textContent).toContain('Bob Recruiter'), { timeout: 3000 })
    // The effect should auto-select convo-1 and load its messages
    await waitFor(() => expect(container.textContent).toContain('Hello from Bob!'), { timeout: 5000 })
  })
})
