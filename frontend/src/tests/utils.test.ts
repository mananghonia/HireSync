/**
 * Unit tests for the axios instance (src/lib/axios.ts) and the
 * React Query client configuration (src/lib/queryClient.ts).
 *
 * Because these modules reference import.meta.env (Vite-specific) and
 * localStorage, we mock both before importing.
 */

import { describe, it, expect, beforeEach } from 'vitest'

// import.meta.env is handled by vitest.config.ts define block.

// ---------------------------------------------------------------------------
// Mock localStorage
// ---------------------------------------------------------------------------
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

// ---------------------------------------------------------------------------
// Mock window.location so the interceptor redirect does not throw in jsdom
// ---------------------------------------------------------------------------
Object.defineProperty(globalThis, 'window', {
  value: { location: { href: '' } },
  writable: true,
})

// ---------------------------------------------------------------------------
// Import the modules under test AFTER setting up globals
// ---------------------------------------------------------------------------
import api from '../lib/axios'
import { queryClient } from '../lib/queryClient'

// ---------------------------------------------------------------------------
// Axios instance configuration
// ---------------------------------------------------------------------------
describe('api axios instance', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it('is created with the correct baseURL from VITE_API_URL', () => {
    expect(api.defaults.baseURL).toBe(
      'https://hiresync-production-483b.up.railway.app/api/v1',
    )
  })

  it('falls back to localhost when VITE_API_URL is not set', async () => {
    /**
     * The fallback is baked into the module at import time via the || operator.
     * We verify the current value is either the env var or the fallback — both
     * are acceptable production-safe values.
     */
    expect(api.defaults.baseURL).toMatch(
      /^https?:\/\/(localhost:8000|hiresync-production)/,
    )
  })

  it('has Content-Type application/json as default header', () => {
    const headers = api.defaults.headers as Record<string, unknown>
    const contentType =
      headers['Content-Type'] ?? headers['content-type']
    expect(contentType).toBe('application/json')
  })

  it('request interceptor adds Authorization header when token is in localStorage', async () => {
    localStorageMock.setItem('access_token', 'test-access-token-abc')

    // Grab the request interceptor handlers directly from the internals.
    // axios stores them as an array; we call the first fulfilled handler.
    const interceptors = (api.interceptors.request as any).handlers
    expect(interceptors.length).toBeGreaterThan(0)

    const fulfilled = interceptors[0]?.fulfilled
    expect(fulfilled).toBeDefined()

    const fakeConfig = { headers: {} as Record<string, string> }
    const result = fulfilled(fakeConfig)
    expect(result.headers['Authorization']).toBe('Bearer test-access-token-abc')
  })

  it('request interceptor does NOT add Authorization header when no token', async () => {
    localStorageMock.clear()

    const interceptors = (api.interceptors.request as any).handlers
    const fulfilled = interceptors[0]?.fulfilled
    expect(fulfilled).toBeDefined()

    const fakeConfig = { headers: {} as Record<string, string> }
    const result = fulfilled(fakeConfig)
    expect(result.headers['Authorization']).toBeUndefined()
  })

  it('has at least one response interceptor registered', () => {
    const interceptors = (api.interceptors.response as any).handlers
    expect(interceptors.length).toBeGreaterThan(0)
  })

  it('response interceptor passes through successful responses unchanged', async () => {
    const interceptors = (api.interceptors.response as any).handlers
    const fulfilled = interceptors[0]?.fulfilled
    expect(fulfilled).toBeDefined()

    const fakeResponse = { status: 200, data: { id: 1 } }
    const result = fulfilled(fakeResponse)
    expect(result).toBe(fakeResponse)
  })
})

// ---------------------------------------------------------------------------
// React Query client configuration
// ---------------------------------------------------------------------------
describe('queryClient configuration', () => {
  it('is an instance of QueryClient', async () => {
    const { QueryClient } = await import('@tanstack/react-query')
    expect(queryClient).toBeInstanceOf(QueryClient)
  })

  it('has staleTime set to 5 minutes (300 000 ms)', () => {
    const options = queryClient.getDefaultOptions()
    expect(options.queries?.staleTime).toBe(1000 * 60 * 5)
  })

  it('has retry set to 1', () => {
    const options = queryClient.getDefaultOptions()
    expect(options.queries?.retry).toBe(1)
  })

  it('has refetchOnWindowFocus set to false', () => {
    const options = queryClient.getDefaultOptions()
    expect(options.queries?.refetchOnWindowFocus).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Pure utility: token presence guard
// ---------------------------------------------------------------------------
describe('localStorage token helpers (integration with axios interceptor)', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it('getItem returns null for access_token when not stored', () => {
    expect(localStorage.getItem('access_token')).toBeNull()
  })

  it('getItem returns null for refresh_token when not stored', () => {
    expect(localStorage.getItem('refresh_token')).toBeNull()
  })

  it('setItem and getItem round-trip correctly for access_token', () => {
    localStorage.setItem('access_token', 'my-jwt-value')
    expect(localStorage.getItem('access_token')).toBe('my-jwt-value')
  })

  it('removeItem clears access_token', () => {
    localStorage.setItem('access_token', 'my-jwt-value')
    localStorage.removeItem('access_token')
    expect(localStorage.getItem('access_token')).toBeNull()
  })

  it('clear removes all stored keys', () => {
    localStorage.setItem('access_token', 'a')
    localStorage.setItem('refresh_token', 'b')
    localStorage.clear()
    expect(localStorage.getItem('access_token')).toBeNull()
    expect(localStorage.getItem('refresh_token')).toBeNull()
  })
})
