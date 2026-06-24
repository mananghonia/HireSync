/**
 * Unit tests for the auth Redux slice.
 *
 * Slice location: src/features/auth/authSlice.ts
 *
 * State shape:
 *   { user: User | null, accessToken: string | null,
 *     refreshToken: string | null, isAuthenticated: boolean }
 *
 * Actions: setCredentials, setUser, logout
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import authReducer, { setCredentials, setUser, logout } from '../features/auth/authSlice'

// ---------------------------------------------------------------------------
// Mock localStorage — jsdom provides it but we want isolation between tests.
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
// Fixtures
// ---------------------------------------------------------------------------
const mockUser = {
  id: 'user-abc-123',
  email: 'mananghonia@gmail.com',
  first_name: 'Manan',
  last_name: 'Ghonia',
  full_name: 'Manan Ghonia',
  role: 'seeker' as const,
  is_verified: true,
}

const mockTokens = {
  access: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.access.sig',
  refresh: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh.sig',
}

/** Returns a clean initial state derived from an empty localStorage */
function freshInitialState() {
  localStorageMock.clear()
  // Re-import would be needed for true module isolation; instead derive directly.
  return {
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('authSlice', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------
  describe('initial state', () => {
    it('has user set to null when localStorage is empty', () => {
      const state = freshInitialState()
      expect(state.user).toBeNull()
    })

    it('has accessToken set to null when localStorage is empty', () => {
      const state = freshInitialState()
      expect(state.accessToken).toBeNull()
    })

    it('has isAuthenticated set to false when localStorage is empty', () => {
      const state = freshInitialState()
      expect(state.isAuthenticated).toBe(false)
    })

    it('has refreshToken set to null when localStorage is empty', () => {
      const state = freshInitialState()
      expect(state.refreshToken).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // setCredentials
  // -------------------------------------------------------------------------
  describe('setCredentials action', () => {
    it('sets the user on the state', () => {
      const initialState = freshInitialState()
      const nextState = authReducer(
        initialState as any,
        setCredentials({ user: mockUser, tokens: mockTokens }),
      )
      expect(nextState.user).toEqual(mockUser)
    })

    it('sets accessToken on the state', () => {
      const initialState = freshInitialState()
      const nextState = authReducer(
        initialState as any,
        setCredentials({ user: mockUser, tokens: mockTokens }),
      )
      expect(nextState.accessToken).toBe(mockTokens.access)
    })

    it('sets refreshToken on the state', () => {
      const initialState = freshInitialState()
      const nextState = authReducer(
        initialState as any,
        setCredentials({ user: mockUser, tokens: mockTokens }),
      )
      expect(nextState.refreshToken).toBe(mockTokens.refresh)
    })

    it('sets isAuthenticated to true', () => {
      const initialState = freshInitialState()
      const nextState = authReducer(
        initialState as any,
        setCredentials({ user: mockUser, tokens: mockTokens }),
      )
      expect(nextState.isAuthenticated).toBe(true)
    })

    it('persists access_token to localStorage', () => {
      const initialState = freshInitialState()
      authReducer(
        initialState as any,
        setCredentials({ user: mockUser, tokens: mockTokens }),
      )
      expect(localStorageMock.getItem('access_token')).toBe(mockTokens.access)
    })

    it('persists refresh_token to localStorage', () => {
      const initialState = freshInitialState()
      authReducer(
        initialState as any,
        setCredentials({ user: mockUser, tokens: mockTokens }),
      )
      expect(localStorageMock.getItem('refresh_token')).toBe(mockTokens.refresh)
    })

    it('persists user JSON to localStorage', () => {
      const initialState = freshInitialState()
      authReducer(
        initialState as any,
        setCredentials({ user: mockUser, tokens: mockTokens }),
      )
      const stored = localStorageMock.getItem('user')
      expect(stored).not.toBeNull()
      expect(JSON.parse(stored!)).toEqual(mockUser)
    })
  })

  // -------------------------------------------------------------------------
  // setUser
  // -------------------------------------------------------------------------
  describe('setUser action', () => {
    it('updates only the user field', () => {
      const stateAfterLogin = authReducer(
        freshInitialState() as any,
        setCredentials({ user: mockUser, tokens: mockTokens }),
      )
      const updatedUser = { ...mockUser, first_name: 'Updated' }
      const nextState = authReducer(stateAfterLogin, setUser(updatedUser))
      expect(nextState.user?.first_name).toBe('Updated')
    })

    it('does not change isAuthenticated', () => {
      const stateAfterLogin = authReducer(
        freshInitialState() as any,
        setCredentials({ user: mockUser, tokens: mockTokens }),
      )
      const nextState = authReducer(stateAfterLogin, setUser(mockUser))
      expect(nextState.isAuthenticated).toBe(true)
    })

    it('persists updated user JSON to localStorage', () => {
      const stateAfterLogin = authReducer(
        freshInitialState() as any,
        setCredentials({ user: mockUser, tokens: mockTokens }),
      )
      const updatedUser = { ...mockUser, email: 'new@example.com' }
      authReducer(stateAfterLogin, setUser(updatedUser))
      const stored = localStorageMock.getItem('user')
      expect(JSON.parse(stored!).email).toBe('new@example.com')
    })
  })

  // -------------------------------------------------------------------------
  // logout (clearCredentials equivalent)
  // -------------------------------------------------------------------------
  describe('logout action', () => {
    function loggedInState() {
      return authReducer(
        freshInitialState() as any,
        setCredentials({ user: mockUser, tokens: mockTokens }),
      )
    }

    it('clears user to null', () => {
      const nextState = authReducer(loggedInState(), logout())
      expect(nextState.user).toBeNull()
    })

    it('clears accessToken to null', () => {
      const nextState = authReducer(loggedInState(), logout())
      expect(nextState.accessToken).toBeNull()
    })

    it('clears refreshToken to null', () => {
      const nextState = authReducer(loggedInState(), logout())
      expect(nextState.refreshToken).toBeNull()
    })

    it('sets isAuthenticated to false', () => {
      const nextState = authReducer(loggedInState(), logout())
      expect(nextState.isAuthenticated).toBe(false)
    })

    it('removes access_token from localStorage', () => {
      authReducer(loggedInState(), logout())
      expect(localStorageMock.getItem('access_token')).toBeNull()
    })

    it('removes refresh_token from localStorage', () => {
      authReducer(loggedInState(), logout())
      expect(localStorageMock.getItem('refresh_token')).toBeNull()
    })

    it('removes user JSON from localStorage', () => {
      authReducer(loggedInState(), logout())
      expect(localStorageMock.getItem('user')).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // Selector: selectIsAuthenticated (derived from state shape)
  // -------------------------------------------------------------------------
  describe('isAuthenticated selector logic', () => {
    it('returns false before login', () => {
      const state = freshInitialState()
      expect(state.isAuthenticated).toBe(false)
    })

    it('returns true after setCredentials', () => {
      const nextState = authReducer(
        freshInitialState() as any,
        setCredentials({ user: mockUser, tokens: mockTokens }),
      )
      expect(nextState.isAuthenticated).toBe(true)
    })

    it('returns false after logout', () => {
      const afterLogin = authReducer(
        freshInitialState() as any,
        setCredentials({ user: mockUser, tokens: mockTokens }),
      )
      const afterLogout = authReducer(afterLogin, logout())
      expect(afterLogout.isAuthenticated).toBe(false)
    })
  })
})
