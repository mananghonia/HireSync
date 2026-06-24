/**
 * Tests for useNotificationSocket hook covering all branches.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { configureStore } from '@reduxjs/toolkit'
import React from 'react'
import authReducer from '../features/auth/authSlice'
import notificationsReducer from '../features/notifications/notificationsSlice'
import { useNotificationSocket } from '../hooks/useWebSocket'

vi.mock('react-hot-toast', () => {
  const toast: any = vi.fn()
  toast.success = vi.fn()
  toast.error = vi.fn()
  return { default: toast, Toaster: () => null }
})

// ---------------------------------------------------------------------------
// Class-based WebSocket mock so `new WebSocket(url)` works correctly
// ---------------------------------------------------------------------------

let capturedWs: MockWebSocket | null = null

class MockWebSocket {
  close = vi.fn()
  send = vi.fn()
  onopen: ((...args: any[]) => void) | null = null
  onclose: ((...args: any[]) => void) | null = null
  onerror: ((...args: any[]) => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  readyState = 1

  constructor(_url: string) {
    capturedWs = this
  }
}

beforeEach(() => {
  capturedWs = null
  ;(global as any).WebSocket = MockWebSocket
  ;(global as any).localStorage = {
    getItem: vi.fn().mockReturnValue('mock-access-token'),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  }
})

function makeWrapper() {
  const store = configureStore({ reducer: { auth: authReducer, notifications: notificationsReducer } })
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      Provider, { store },
      React.createElement(QueryClientProvider, { client: qc }, children),
    )
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useNotificationSocket', () => {
  it('returns null ref when not authenticated', () => {
    const { result } = renderHook(() => useNotificationSocket(false), { wrapper: makeWrapper() })
    expect(capturedWs).toBeNull()
    expect(result.current.current).toBeNull()
  })

  it('creates WebSocket when authenticated', () => {
    renderHook(() => useNotificationSocket(true), { wrapper: makeWrapper() })
    expect(capturedWs).not.toBeNull()
  })

  it('WebSocket URL contains token', () => {
    let createdUrl = ''
    ;(global as any).WebSocket = class extends MockWebSocket {
      constructor(url: string) { super(url); createdUrl = url }
    }
    renderHook(() => useNotificationSocket(true), { wrapper: makeWrapper() })
    expect(createdUrl).toContain('token=mock-access-token')
  })

  it('WebSocket URL contains notifications path', () => {
    let createdUrl = ''
    ;(global as any).WebSocket = class extends MockWebSocket {
      constructor(url: string) { super(url); createdUrl = url }
    }
    renderHook(() => useNotificationSocket(true), { wrapper: makeWrapper() })
    expect(createdUrl).toContain('notifications')
  })

  it('sets up onopen handler', () => {
    renderHook(() => useNotificationSocket(true), { wrapper: makeWrapper() })
    expect(typeof capturedWs?.onopen).toBe('function')
  })

  it('sets up onclose handler', () => {
    renderHook(() => useNotificationSocket(true), { wrapper: makeWrapper() })
    expect(typeof capturedWs?.onclose).toBe('function')
  })

  it('sets up onerror handler', () => {
    renderHook(() => useNotificationSocket(true), { wrapper: makeWrapper() })
    expect(typeof capturedWs?.onerror).toBe('function')
  })

  it('sets up onmessage handler', () => {
    renderHook(() => useNotificationSocket(true), { wrapper: makeWrapper() })
    expect(typeof capturedWs?.onmessage).toBe('function')
  })

  it('onopen does not throw', () => {
    renderHook(() => useNotificationSocket(true), { wrapper: makeWrapper() })
    expect(() => capturedWs?.onopen?.()).not.toThrow()
  })

  it('onclose does not throw', () => {
    renderHook(() => useNotificationSocket(true), { wrapper: makeWrapper() })
    expect(() => capturedWs?.onclose?.()).not.toThrow()
  })

  it('onerror does not throw', () => {
    renderHook(() => useNotificationSocket(true), { wrapper: makeWrapper() })
    expect(() => capturedWs?.onerror?.(new Event('error'))).not.toThrow()
  })

  it('handles unread_count message without error', () => {
    renderHook(() => useNotificationSocket(true), { wrapper: makeWrapper() })
    act(() => {
      capturedWs?.onmessage?.({ data: JSON.stringify({ type: 'unread_count', count: 7 }) })
    })
    expect(capturedWs).not.toBeNull()
  })

  it('handles application_status notification without error', () => {
    renderHook(() => useNotificationSocket(true), { wrapper: makeWrapper() })
    act(() => {
      capturedWs?.onmessage?.({
        data: JSON.stringify({
          type: 'notification',
          notification: { id: 1, type: 'application_status', title: 'Updated', message: 'Shortlisted', is_read: false, created_at: '2024-01-01T00:00:00Z' },
        }),
      })
    })
    expect(capturedWs).not.toBeNull()
  })

  it('handles new_message notification and shows toast', async () => {
    const toast = (await import('react-hot-toast')).default as any
    renderHook(() => useNotificationSocket(true), { wrapper: makeWrapper() })
    act(() => {
      capturedWs?.onmessage?.({
        data: JSON.stringify({
          type: 'notification',
          notification: {
            id: 2, type: 'new_message', title: 'New Message', message: 'Hey!',
            is_read: false, created_at: '2024-01-01T00:00:00Z',
            data: { conversation_id: 'convo-1' },
          },
        }),
      })
    })
    expect(toast).toHaveBeenCalled()
  })

  it('handles general notification and shows toast', async () => {
    const toast = (await import('react-hot-toast')).default as any
    renderHook(() => useNotificationSocket(true), { wrapper: makeWrapper() })
    act(() => {
      capturedWs?.onmessage?.({
        data: JSON.stringify({
          type: 'notification',
          notification: { id: 3, type: 'general', title: 'FYI', message: 'Info', is_read: false, created_at: '2024-01-01T00:00:00Z' },
        }),
      })
    })
    expect(toast).toHaveBeenCalled()
  })

  it('closes WebSocket on unmount', () => {
    const { unmount } = renderHook(() => useNotificationSocket(true), { wrapper: makeWrapper() })
    const ws = capturedWs
    unmount()
    expect(ws?.close).toHaveBeenCalledTimes(1)
  })

  it('does nothing on unmount when unauthenticated', () => {
    const { unmount } = renderHook(() => useNotificationSocket(false), { wrapper: makeWrapper() })
    unmount()
    expect(capturedWs).toBeNull()
  })

  it('skips connection if no token in localStorage', () => {
    ;(global as any).localStorage = { getItem: vi.fn().mockReturnValue(null), setItem: vi.fn() }
    renderHook(() => useNotificationSocket(true), { wrapper: makeWrapper() })
    expect(capturedWs).toBeNull()
  })
})
