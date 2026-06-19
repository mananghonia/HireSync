import { useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import { addNotification, setUnreadCount } from "../features/notifications/notificationsSlice";

export function useNotificationSocket(isAuthenticated: boolean) {
  const dispatch = useDispatch();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    const token = localStorage.getItem("access_token");
    const wsUrl = `ws://${window.location.host}/ws/notifications/?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "unread_count") {
        dispatch(setUnreadCount(data.count));
      } else if (data.type === "notification") {
        dispatch(addNotification(data.notification));
      }
    };

    return () => ws.close();
  }, [isAuthenticated, dispatch]);

  return wsRef;
}
