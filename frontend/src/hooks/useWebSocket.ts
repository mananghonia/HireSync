import { useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import { useQueryClient } from "@tanstack/react-query";
import { addNotification, setUnreadCount } from "../features/notifications/notificationsSlice";

export function useNotificationSocket(isAuthenticated: boolean) {
  const dispatch = useDispatch();
  const qc = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    const token = localStorage.getItem("access_token");
    if (!token) return;

    // Use relative WS path so Vite proxy handles it in dev;
    // in production this connects directly to the same host.
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${proto}://${window.location.host}/ws/notifications/?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => console.log("[WS] Notification socket connected");
    ws.onclose = () => console.log("[WS] Notification socket closed");
    ws.onerror = (e) => console.warn("[WS] Notification socket error", e);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "unread_count") {
        dispatch(setUnreadCount(data.count));
        // Sync query cache so Navbar badge updates immediately
        qc.setQueryData(["notif-unread-count"], data.count);
      } else if (data.type === "notification") {
        dispatch(addNotification(data.notification));
        // Bump the unread count and refresh popup
        qc.setQueryData<number>(["notif-unread-count"], (prev = 0) => prev + 1);
        qc.invalidateQueries({ queryKey: ["notifications-popup"] });
        qc.invalidateQueries({ queryKey: ["notifications"] });
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [isAuthenticated, dispatch, qc]);

  return wsRef;
}
