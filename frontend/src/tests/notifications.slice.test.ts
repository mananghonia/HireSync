import { describe, it, expect } from 'vitest'
import notificationsReducer, {
  addNotification,
  setUnreadCount,
  markRead,
} from '../features/notifications/notificationsSlice'

const baseState = { items: [], unreadCount: 0 }

const notif = (overrides = {}) => ({
  id: 1,
  type: 'application_status',
  title: 'Status update',
  message: 'Your application was shortlisted',
  data: {},
  is_read: false,
  created_at: '2024-01-01T00:00:00Z',
  ...overrides,
})

describe('notificationsSlice', () => {
  describe('initial state', () => {
    it('starts with empty items and zero unread', () => {
      const state = notificationsReducer(undefined, { type: '@@INIT' })
      expect(state.items).toEqual([])
      expect(state.unreadCount).toBe(0)
    })
  })

  describe('addNotification', () => {
    it('prepends the notification to items', () => {
      const n = notif({ id: 1 })
      const state = notificationsReducer(baseState, addNotification(n))
      expect(state.items).toHaveLength(1)
      expect(state.items[0]).toEqual(n)
    })

    it('increments unreadCount when notification is unread', () => {
      const state = notificationsReducer(baseState, addNotification(notif({ is_read: false })))
      expect(state.unreadCount).toBe(1)
    })

    it('does NOT increment unreadCount when notification is already read', () => {
      const state = notificationsReducer(baseState, addNotification(notif({ is_read: true })))
      expect(state.unreadCount).toBe(0)
    })

    it('prepends to existing items (most-recent first)', () => {
      const first = notif({ id: 1 })
      const second = notif({ id: 2 })
      let state = notificationsReducer(baseState, addNotification(first))
      state = notificationsReducer(state, addNotification(second))
      expect(state.items[0].id).toBe(2)
      expect(state.items[1].id).toBe(1)
    })

    it('accumulates unreadCount across multiple unread items', () => {
      let state = notificationsReducer(baseState, addNotification(notif({ id: 1, is_read: false })))
      state = notificationsReducer(state, addNotification(notif({ id: 2, is_read: false })))
      expect(state.unreadCount).toBe(2)
    })

    it('does not count read items in accumulated count', () => {
      let state = notificationsReducer(baseState, addNotification(notif({ id: 1, is_read: false })))
      state = notificationsReducer(state, addNotification(notif({ id: 2, is_read: true })))
      expect(state.unreadCount).toBe(1)
    })
  })

  describe('setUnreadCount', () => {
    it('sets unreadCount to the given value', () => {
      const state = notificationsReducer(baseState, setUnreadCount(5))
      expect(state.unreadCount).toBe(5)
    })

    it('sets unreadCount to zero', () => {
      const state = notificationsReducer({ ...baseState, unreadCount: 3 }, setUnreadCount(0))
      expect(state.unreadCount).toBe(0)
    })

    it('does not change items', () => {
      const withItem = { items: [notif({ id: 1 })], unreadCount: 1 }
      const state = notificationsReducer(withItem, setUnreadCount(10))
      expect(state.items).toHaveLength(1)
    })
  })

  describe('markRead', () => {
    function stateWithNotif(n: ReturnType<typeof notif>) {
      return { items: [n], unreadCount: n.is_read ? 0 : 1 }
    }

    it('marks the notification as read', () => {
      const n = notif({ id: 1, is_read: false })
      const state = notificationsReducer(stateWithNotif(n), markRead(1))
      expect(state.items[0].is_read).toBe(true)
    })

    it('decrements unreadCount when marking an unread notification', () => {
      const n = notif({ id: 1, is_read: false })
      const state = notificationsReducer(stateWithNotif(n), markRead(1))
      expect(state.unreadCount).toBe(0)
    })

    it('does not go below zero for unreadCount', () => {
      const n = notif({ id: 1, is_read: false })
      const state = notificationsReducer({ items: [n], unreadCount: 0 }, markRead(1))
      expect(state.unreadCount).toBe(0)
    })

    it('does NOT change count when marking an already-read notification', () => {
      const n = notif({ id: 1, is_read: true })
      const state = notificationsReducer({ items: [n], unreadCount: 0 }, markRead(1))
      expect(state.unreadCount).toBe(0)
      expect(state.items[0].is_read).toBe(true)
    })

    it('is a no-op for an id not in items', () => {
      const n = notif({ id: 1, is_read: false })
      const before = stateWithNotif(n)
      const state = notificationsReducer(before, markRead(999))
      expect(state.items[0].is_read).toBe(false)
      expect(state.unreadCount).toBe(1)
    })

    it('only marks the targeted notification, not others', () => {
      const items = [notif({ id: 1, is_read: false }), notif({ id: 2, is_read: false })]
      const before = { items, unreadCount: 2 }
      const state = notificationsReducer(before, markRead(1))
      expect(state.items[0].is_read).toBe(true)
      expect(state.items[1].is_read).toBe(false)
      expect(state.unreadCount).toBe(1)
    })
  })
})
