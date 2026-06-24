import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { configureStore } from '@reduxjs/toolkit'
import React from 'react'
import authReducer, { setCredentials } from '../features/auth/authSlice'
import notificationsReducer from '../features/notifications/notificationsSlice'
import { useAuth } from '../hooks/useAuth'
import ProtectedRoute from '../components/shared/ProtectedRoute'
import { store as appStore } from '../app/store'

function makeStore(preloadedState: object = {}) {
  return configureStore({
    reducer: { auth: authReducer, notifications: notificationsReducer },
    preloadedState,
  })
}

function wrapper(store: ReturnType<typeof makeStore>) {
  return function Wrap({ children }: { children: React.ReactNode }) {
    return <Provider store={store}>{children}</Provider>
  }
}

function routerWrapper(store: ReturnType<typeof makeStore>, path = '/') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrap({ children }: { children: React.ReactNode }) {
    return (
      <Provider store={store}>
        <QueryClientProvider client={qc}>
          <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
        </QueryClientProvider>
      </Provider>
    )
  }
}

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  first_name: 'Test',
  last_name: 'User',
  full_name: 'Test User',
  role: 'seeker' as const,
  is_verified: true,
}

describe('useAuth hook', () => {
  it('returns isAuthenticated=false and null user when not logged in', () => {
    const store = makeStore()
    const { result } = renderHook(() => useAuth(), { wrapper: wrapper(store) })
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.user).toBeNull()
  })

  it('returns isAuthenticated=true and user after login', () => {
    const store = makeStore()
    store.dispatch(setCredentials({ user: mockUser, tokens: { access: 'a', refresh: 'r' } }))
    const { result } = renderHook(() => useAuth(), { wrapper: wrapper(store) })
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.user).toEqual(mockUser)
  })

  it('returns isSeeker=true for seeker role', () => {
    const store = makeStore()
    store.dispatch(setCredentials({ user: { ...mockUser, role: 'seeker' }, tokens: { access: 'a', refresh: 'r' } }))
    const { result } = renderHook(() => useAuth(), { wrapper: wrapper(store) })
    expect(result.current.isSeeker).toBe(true)
    expect(result.current.isRecruiter).toBe(false)
    expect(result.current.isAdmin).toBe(false)
  })

  it('returns isRecruiter=true for recruiter role', () => {
    const store = makeStore()
    store.dispatch(setCredentials({ user: { ...mockUser, role: 'recruiter' }, tokens: { access: 'a', refresh: 'r' } }))
    const { result } = renderHook(() => useAuth(), { wrapper: wrapper(store) })
    expect(result.current.isSeeker).toBe(false)
    expect(result.current.isRecruiter).toBe(true)
    expect(result.current.isAdmin).toBe(false)
  })

  it('returns isAdmin=true for admin role', () => {
    const store = makeStore()
    store.dispatch(setCredentials({ user: { ...mockUser, role: 'admin' }, tokens: { access: 'a', refresh: 'r' } }))
    const { result } = renderHook(() => useAuth(), { wrapper: wrapper(store) })
    expect(result.current.isSeeker).toBe(false)
    expect(result.current.isRecruiter).toBe(false)
    expect(result.current.isAdmin).toBe(true)
  })

  it('all role flags are false when not authenticated', () => {
    const store = makeStore()
    const { result } = renderHook(() => useAuth(), { wrapper: wrapper(store) })
    expect(result.current.isSeeker).toBe(false)
    expect(result.current.isRecruiter).toBe(false)
    expect(result.current.isAdmin).toBe(false)
  })
})

describe('ProtectedRoute component', () => {
  it('redirects to /login when not authenticated', () => {
    const store = makeStore()
    const { container } = render(
      <ProtectedRoute><div>Protected</div></ProtectedRoute>,
      { wrapper: routerWrapper(store) },
    )
    expect(container.textContent).not.toContain('Protected')
  })

  it('renders children when authenticated and no role required', () => {
    const store = makeStore()
    store.dispatch(setCredentials({ user: mockUser, tokens: { access: 'a', refresh: 'r' } }))
    const { container } = render(
      <ProtectedRoute><div>Protected Content</div></ProtectedRoute>,
      { wrapper: routerWrapper(store) },
    )
    expect(container.textContent).toContain('Protected Content')
  })

  it('renders children when authenticated with correct role', () => {
    const store = makeStore()
    store.dispatch(setCredentials({ user: { ...mockUser, role: 'seeker' }, tokens: { access: 'a', refresh: 'r' } }))
    const { container } = render(
      <ProtectedRoute role="seeker"><div>Seeker Content</div></ProtectedRoute>,
      { wrapper: routerWrapper(store) },
    )
    expect(container.textContent).toContain('Seeker Content')
  })

  it('redirects to seeker dashboard when recruiter tries seeker-only route', () => {
    const store = makeStore()
    store.dispatch(setCredentials({ user: { ...mockUser, role: 'recruiter' }, tokens: { access: 'a', refresh: 'r' } }))
    const { container } = render(
      <ProtectedRoute role="seeker"><div>Seeker Only</div></ProtectedRoute>,
      { wrapper: routerWrapper(store) },
    )
    expect(container.textContent).not.toContain('Seeker Only')
  })

  it('redirects to /admin when admin tries seeker-only route', () => {
    const store = makeStore()
    store.dispatch(setCredentials({ user: { ...mockUser, role: 'admin' }, tokens: { access: 'a', refresh: 'r' } }))
    const { container } = render(
      <ProtectedRoute role="seeker"><div>Seeker Only</div></ProtectedRoute>,
      { wrapper: routerWrapper(store) },
    )
    expect(container.textContent).not.toContain('Seeker Only')
  })

  it('renders recruiter content for correct recruiter role', () => {
    const store = makeStore()
    store.dispatch(setCredentials({ user: { ...mockUser, role: 'recruiter' }, tokens: { access: 'a', refresh: 'r' } }))
    const { container } = render(
      <ProtectedRoute role="recruiter"><div>Recruiter Zone</div></ProtectedRoute>,
      { wrapper: routerWrapper(store) },
    )
    expect(container.textContent).toContain('Recruiter Zone')
  })

  it('renders admin content for correct admin role', () => {
    const store = makeStore()
    store.dispatch(setCredentials({ user: { ...mockUser, role: 'admin' }, tokens: { access: 'a', refresh: 'r' } }))
    const { container } = render(
      <ProtectedRoute role="admin"><div>Admin Zone</div></ProtectedRoute>,
      { wrapper: routerWrapper(store) },
    )
    expect(container.textContent).toContain('Admin Zone')
  })
})

describe('Redux store', () => {
  it('has auth and notifications slices', () => {
    const state = appStore.getState()
    expect(state).toHaveProperty('auth')
    expect(state).toHaveProperty('notifications')
  })

  it('auth initial state has correct shape', () => {
    const store = makeStore()
    const { auth } = store.getState()
    expect(auth).toMatchObject({ user: null, isAuthenticated: false })
  })

  it('notifications initial state has correct shape', () => {
    const store = makeStore()
    const { notifications } = store.getState()
    expect(notifications).toMatchObject({ items: [], unreadCount: 0 })
  })
})
